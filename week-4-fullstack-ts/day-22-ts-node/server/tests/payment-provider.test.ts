import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
    configuredSubaccountId, createCheckout, getSubaccount, ProviderError,
    providerConfigured, verifyTransaction, verifyWebhookSignature,
    type CheckoutInput,
} from "../src/payments/flutterwave";
import { HttpError } from "../src/http";

// This suite has no database dependency. Every fetch is replaced before each test;
// no account, checkout, charge, verification, or email can reach an external service.
const environmentKeys = [
    "FLW_SECRET_KEY", "FLW_WEBHOOK_SECRET", "FLW_WEBHOOK_SIGNATURE_MODE",
    "FLW_ORGANIZATION_SUBACCOUNTS", "NODE_ENV",
] as const;
let originalEnvironment: Partial<Record<typeof environmentKeys[number], string>>;
let originalFetch: typeof fetch;
let calls: Array<{ url: string; options: RequestInit }>;

const input: CheckoutInput = {
    reference: "rent-adapter-test-1",
    amount: 150000,
    currency: "UGX",
    email: "tenant@example.test",
    name: "Test Tenant",
    redirectUrl: "https://remote.example.test/payments/return",
    subaccountId: "RS_landlord_one",
};
const transaction = {
    id: 77, tx_ref: input.reference, status: "successful", amount: input.amount,
    currency: "UGX", payment_type: "mobilemoneyuganda",
};

function status(expected: number) {
    return (error: unknown) => error instanceof ProviderError
        && error instanceof HttpError && error.status === expected;
}

function response(data: unknown, httpStatus = 200): void {
    globalThis.fetch = async (url, options) => {
        calls.push({ url: String(url), options: options ?? {} });
        return Response.json({ status: "success", data }, { status: httpStatus });
    };
}

describe("Flutterwave payment adapter with all HTTP mocked", { concurrency: false }, () => {
    beforeEach(() => {
        originalFetch = globalThis.fetch;
        originalEnvironment = {};
        for (const key of environmentKeys) {
            const value = process.env[key];
            if (value !== undefined) originalEnvironment[key] = value;
            delete process.env[key];
        }
        process.env.NODE_ENV = "test";
        process.env.FLW_SECRET_KEY = "test-only-fake-api-key";
        process.env.FLW_WEBHOOK_SECRET = "test-only-fake-webhook-secret";
        calls = [];
        globalThis.fetch = async () => {
            throw new Error("External HTTP is prohibited in provider unit tests");
        };
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        for (const key of environmentKeys) {
            const value = originalEnvironment[key];
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });

    it("keeps checkout disabled without both server credentials and a valid signature mode", async () => {
        response({ link: "https://checkout.flutterwave.com/v3/hosted/pay/test" });
        for (const missing of ["FLW_SECRET_KEY", "FLW_WEBHOOK_SECRET"] as const) {
            const saved = process.env[missing];
            delete process.env[missing];
            assert.equal(providerConfigured(), false);
            await assert.rejects(createCheckout(input), status(503));
            process.env[missing] = saved;
        }
        process.env.FLW_WEBHOOK_SIGNATURE_MODE = "accept-either";
        assert.equal(providerConfigured(), false);
        await assert.rejects(createCheckout(input), status(503));
        assert.equal(calls.length, 0);
    });

    it("accepts only operator-provided organization mappings and fails closed on invalid configuration", () => {
        assert.equal(configuredSubaccountId(1), null);
        process.env.FLW_ORGANIZATION_SUBACCOUNTS = '{"1":"RS_landlord_one","2":"RS_landlord_two"}';
        assert.equal(configuredSubaccountId(1), "RS_landlord_one");
        assert.equal(configuredSubaccountId(2), "RS_landlord_two");
        assert.equal(configuredSubaccountId(3), null);
        for (const invalid of ["bad-json", "null", "[]", '{"1":""}', '{"01":"RS_bad"}', '{"1":7}', '{"__proto__":"RS_bad"}']) {
            process.env.FLW_ORGANIZATION_SUBACCOUNTS = invalid;
            assert.throws(() => configuredSubaccountId(1), status(503));
        }
        assert.throws(() => configuredSubaccountId(0), status(400));
        assert.throws(() => configuredSubaccountId(1.5), status(400));
    });

    it("routes every Uganda checkout to exactly its own mandatory landlord subaccount", async () => {
        response({ link: "https://checkout.flutterwave.com/v3/hosted/pay/test" });
        for (const subaccountId of ["RS_landlord_one", "RS_landlord_two"]) {
            assert.deepEqual(await createCheckout({ ...input, subaccountId }), {
                checkoutUrl: "https://checkout.flutterwave.com/v3/hosted/pay/test",
            });
            const call = calls.at(-1)!;
            assert.equal(call.url, "https://api.flutterwave.com/v3/payments");
            assert.equal(call.options.method, "POST");
            assert.equal(call.options.redirect, "error");
            assert.ok(call.options.signal instanceof AbortSignal);
            const payload = JSON.parse(String(call.options.body));
            assert.equal(payload.tx_ref, input.reference);
            assert.equal(payload.amount, input.amount);
            assert.equal(payload.currency, "UGX");
            assert.equal(payload.payment_options, "mobilemoneyuganda");
            assert.deepEqual(payload.customer, { email: input.email, name: input.name });
            assert.deepEqual(payload.subaccounts, [{
                id: subaccountId, transaction_charge_type: "flat",
                transaction_charge: 0, transaction_split_ratio: 1,
            }]);
        }
        for (const subaccountId of ["", "42", "another-provider-id"]) {
            await assert.rejects(createCheckout({ ...input, subaccountId }), status(503));
        }
        assert.equal(calls.length, 2, "invalid subaccounts must never fall back to platform settlement");
    });

    it("rejects fractional or invalid checkout values before any request", async () => {
        response({ link: "https://checkout.flutterwave.com/v3/hosted/pay/test" });
        for (const amount of [0, -1, 1.25, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
            await assert.rejects(createCheckout({ ...input, amount }), status(400));
        }
        await assert.rejects(createCheckout({ ...input, currency: "USD" as "UGX" }), status(400));
        await assert.rejects(createCheckout({ ...input, email: "invalid-email" }), status(400));
        await assert.rejects(createCheckout({ ...input, redirectUrl: "https://user:pass@remote.example.test" }), status(400));
        process.env.NODE_ENV = "production";
        await assert.rejects(createCheckout({ ...input, redirectUrl: "http://localhost:5173/return" }), status(400));
        assert.equal(calls.length, 0);
    });

    it("accepts only secure hosted checkout links at the actual provider host", async () => {
        for (const link of [
            "http://checkout.flutterwave.com/v3/hosted/pay/test",
            "https://checkout.flutterwave.com.attacker.example/test",
            "https://checkout.flutterwave.com:8443/test",
            "https://attacker@checkout.flutterwave.com/test",
            "javascript:alert(1)", "invalid-url",
        ]) {
            response({ link });
            await assert.rejects(createCheckout(input), status(502));
        }
    });

    it("finds the exact collection RS identifier and returns only masked bank details", async () => {
        response([
            { id: 1, subaccount_id: "RS_other", full_name: "Other", bank_name: "Other Bank", account_number: "99999999" },
            { id: 2, subaccount_id: input.subaccountId, full_name: "Landlord", bank_name: "Test Bank", account_number: "12345678", country: "UG", private_field: "never-return" },
        ]);
        assert.deepEqual(await getSubaccount(input.subaccountId), {
            id: input.subaccountId, name: "Landlord", bankName: "Test Bank", accountLast4: "5678", country: "UG",
        });
        assert.equal(calls[0]?.url, "https://api.flutterwave.com/v3/subaccounts");
        await assert.rejects(getSubaccount("RS_missing"), status(503));
        await assert.rejects(getSubaccount("2"), status(503));
    });

    it("normalizes whole numeric amounts and integer-valued monetary strings without rounding fractions", async () => {
        for (const amount of [1000, "1000", "1000.00", "1000.00000"]) {
            response({ ...transaction, amount });
            const verified = await verifyTransaction("77");
            assert.equal(verified.amount, 1000);
            assert.equal(verified.id, "77");
            assert.equal(verified.status, "successful");
            assert.equal(verified.paymentType, "mobilemoneyuganda");
            assert.equal(calls.at(-1)?.url, "https://api.flutterwave.com/v3/transactions/77/verify");
        }
        for (const amount of [
            true, null, {}, [], "", " ", "1e3", "0x3e8", "+1000", "1000 ",
            "1000.01", "1000.00000000000000000001", "0", -1, 0, 1000.01,
            Number.MAX_SAFE_INTEGER + 1, "9007199254740992.00",
        ]) {
            response({ ...transaction, amount });
            await assert.rejects(verifyTransaction("77"), status(502));
        }
    });

    it("never turns malformed transaction identity, status, currency or split data into success", async () => {
        for (const invalid of [
            { id: 78 }, { id: true }, { tx_ref: "" }, { status: "completed" },
            { currency: null }, { currency: "ugx" }, { payment_type: 7 },
            { subaccounts: {} }, { subaccounts: [null] }, { subaccounts: [{ id: 1 }] },
        ]) {
            response({ ...transaction, ...invalid });
            await assert.rejects(verifyTransaction("77"), status(502));
        }
        const previousCalls = calls.length;
        for (const invalidId of ["0", "77/other", "1e2", "-1", "9007199254740992"]) {
            await assert.rejects(verifyTransaction(invalidId), status(400));
        }
        assert.equal(calls.length, previousCalls);
        response({ ...transaction, subaccounts: [{ subaccount_id: input.subaccountId, account_number: "private" }] });
        assert.deepEqual((await verifyTransaction("77")).subaccounts, [{ id: input.subaccountId }]);
        for (const providerStatus of ["pending", "failed"] as const) {
            response({ ...transaction, status: providerStatus });
            assert.equal((await verifyTransaction("77")).status, providerStatus);
        }
    });

    it("sanitizes HTTP, malformed-envelope and transport errors", async () => {
        response({ account_number: "provider-private-account" }, 401);
        await assert.rejects(verifyTransaction("77"), error => status(503)(error)
            && !String(error).includes("provider-private-account"));
        globalThis.fetch = async () => Response.json({ status: "error", message: "provider-private-account" });
        await assert.rejects(verifyTransaction("77"), error => status(502)(error)
            && !String(error).includes("provider-private-account"));
        globalThis.fetch = async () => { throw new Error("provider-private-token"); };
        await assert.rejects(verifyTransaction("77"), error => status(503)(error)
            && !String(error).includes("provider-private-token"));
    });

    it("aborts provider requests after the bounded timeout", async t => {
        t.mock.timers.enable({ apis: ["setTimeout"] });
        let signal: AbortSignal | null | undefined;
        globalThis.fetch = async (_url, options) => {
            signal = options?.signal;
            return new Promise<Response>((_resolve, reject) => {
                signal?.addEventListener("abort", () => reject(new Error("Aborted")), { once: true });
            });
        };
        const rejection = assert.rejects(verifyTransaction("77"), status(503));
        t.mock.timers.tick(15_000);
        await rejection;
        assert.equal(signal?.aborted, true);
    });

    it("defaults v3 to only the legacy verif-hash protocol", () => {
        const body = Buffer.from('{"event":"charge.completed"}');
        const secret = process.env.FLW_WEBHOOK_SECRET!;
        const hmac = createHmac("sha256", secret).update(body).digest("base64");
        assert.equal(verifyWebhookSignature(body, { "verif-hash": secret }), true);
        assert.equal(verifyWebhookSignature(body, { "Verif-Hash": secret }), true);
        assert.equal(verifyWebhookSignature(body, { "flutterwave-signature": hmac }), false);
        assert.equal(verifyWebhookSignature(body, { "verif-hash": "short" }), false);
        assert.equal(verifyWebhookSignature(body, { "verif-hash": [secret] }), false);
        assert.equal(verifyWebhookSignature(body, { "verif-hash": secret, "Verif-Hash": secret }), false);
        assert.equal(verifyWebhookSignature(body, {}), false);
    });

    it("HMAC mode authenticates exact raw bytes and rejects legacy fallback or invalid configuration", () => {
        process.env.FLW_WEBHOOK_SIGNATURE_MODE = "hmac";
        const body = Buffer.from('{"event":"charge.completed"}');
        const secret = process.env.FLW_WEBHOOK_SECRET!;
        const hmac = createHmac("sha256", secret).update(body).digest("base64");
        assert.equal(verifyWebhookSignature(body, { "flutterwave-signature": hmac }), true);
        assert.equal(verifyWebhookSignature(Buffer.from('{}'), { "flutterwave-signature": hmac }), false);
        assert.equal(verifyWebhookSignature(body, { "verif-hash": secret }), false);
        assert.equal(verifyWebhookSignature(body, { "flutterwave-signature": "bad", "verif-hash": secret }), false);
        process.env.FLW_WEBHOOK_SIGNATURE_MODE = "accept-either";
        assert.equal(verifyWebhookSignature(body, { "verif-hash": secret }), false);
        assert.equal(verifyWebhookSignature(body, { "flutterwave-signature": hmac }), false);
        delete process.env.FLW_WEBHOOK_SECRET;
        assert.equal(verifyWebhookSignature(body, { "flutterwave-signature": hmac }), false);
    });
});
