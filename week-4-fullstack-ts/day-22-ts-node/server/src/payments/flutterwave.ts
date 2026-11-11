import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpError } from "../http";

const API_URL = "https://api.flutterwave.com/v3";
const TIMEOUT_MS = 15_000;
const SUBACCOUNT_ID = /^RS_[A-Za-z0-9_-]{1,100}$/;

export class ProviderError extends HttpError {
    constructor(status: number, message: string) {
        super(status, message);
        this.name = "ProviderError";
    }
}

type JsonObject = Record<string, unknown>;
type WebhookHeaders = Record<string, string | string[] | undefined>;

export type CheckoutInput = {
    reference: string;
    amount: number;
    currency: "UGX";
    email: string;
    name: string;
    redirectUrl: string;
    subaccountId: string;
};

export type VerifiedTransaction = {
    id: string;
    reference: string;
    status: "successful" | "failed" | "pending";
    amount: number;
    currency: string;
    paymentType: string;
    subaccounts?: Array<{ id: string }>;
};

export type SubaccountSummary = {
    id: string;
    name: string;
    bankName: string;
    accountLast4: string;
    country: string | null;
};

function object(value: unknown): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonempty(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function signatureMode(): "legacy" | "hmac" | null {
    const mode = process.env.FLW_WEBHOOK_SIGNATURE_MODE ?? "legacy";
    return mode === "legacy" || mode === "hmac" ? mode : null;
}

export function providerConfigured(): boolean {
    return Boolean(
        nonempty(process.env.FLW_SECRET_KEY)
        && nonempty(process.env.FLW_WEBHOOK_SECRET)
        && signatureMode(),
    );
}

/** This mapping is deployment configuration approved by the platform operator. */
export function configuredSubaccountId(organizationId: number): string | null {
    if (!Number.isSafeInteger(organizationId) || organizationId <= 0) {
        throw new ProviderError(400, "Invalid organization ID");
    }
    const raw = process.env.FLW_ORGANIZATION_SUBACCOUNTS;
    if (!raw?.trim()) return null;

    let mapping: unknown;
    try {
        mapping = JSON.parse(raw);
    } catch {
        throw new ProviderError(503, "Payment settlement configuration is invalid");
    }
    if (!object(mapping) || Object.entries(mapping).some(([key, value]) => (
        !/^[1-9]\d*$/.test(key)
        || !Number.isSafeInteger(Number(key))
        || typeof value !== "string"
        || !SUBACCOUNT_ID.test(value)
    ))) {
        throw new ProviderError(503, "Payment settlement configuration is invalid");
    }
    return (mapping[String(organizationId)] as string | undefined) ?? null;
}

function requireSubaccount(value: string): void {
    if (typeof value !== "string" || !SUBACCOUNT_ID.test(value)) {
        throw new ProviderError(503, "An approved landlord settlement account is required");
    }
}

async function request(path: string, body?: JsonObject): Promise<unknown> {
    const secretKey = process.env.FLW_SECRET_KEY;
    if (!nonempty(secretKey)) {
        throw new ProviderError(503, "The payment provider is not configured");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const response = await fetch(`${API_URL}${path}`, {
            method: body ? "POST" : "GET",
            headers: {
                Authorization: `Bearer ${secretKey}`,
                Accept: "application/json",
                ...(body ? { "Content-Type": "application/json" } : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
            redirect: "error",
            signal: controller.signal,
        });
        if (!response.ok) {
            // Never pass provider responses (which may contain account data) to clients.
            throw new ProviderError(503, "The payment provider could not complete the request");
        }
        const result: unknown = await response.json();
        if (!object(result) || result.status !== "success" || !("data" in result)) {
            throw new ProviderError(502, "The payment provider returned an invalid response");
        }
        return result.data;
    } catch (error) {
        if (error instanceof ProviderError) throw error;
        throw new ProviderError(503, "The payment provider is temporarily unavailable");
    } finally {
        clearTimeout(timeout);
    }
}

/** Existence is checked here; landlord ownership/KYC must be checked before mapping. */
export async function getSubaccount(subaccountId: string): Promise<SubaccountSummary> {
    requireSubaccount(subaccountId);
    // Checkout uses subaccount_id (RS_...), whereas single-account fetch takes a numeric ID.
    const accounts = await request("/subaccounts");
    if (!Array.isArray(accounts)) {
        throw new ProviderError(502, "The payment provider returned invalid settlement accounts");
    }
    const account = accounts.find((entry: unknown) => object(entry) && entry.subaccount_id === subaccountId);
    if (!object(account)) {
        throw new ProviderError(503, "The approved landlord settlement account could not be verified");
    }
    if (!nonempty(account.full_name) || !nonempty(account.bank_name) || !nonempty(account.account_number)) {
        throw new ProviderError(502, "The payment provider returned an invalid settlement account");
    }
    return {
        id: subaccountId,
        name: account.full_name,
        bankName: account.bank_name,
        accountLast4: account.account_number.slice(-4),
        country: nonempty(account.country) ? account.country : null,
    };
}

export async function createCheckout(input: CheckoutInput): Promise<{ checkoutUrl: string }> {
    if (!providerConfigured()) {
        throw new ProviderError(503, "The payment provider is not configured");
    }
    requireSubaccount(input.subaccountId);
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || input.currency !== "UGX") {
        throw new ProviderError(400, "Payments require a positive whole UGX amount");
    }
    if (!nonempty(input.reference) || input.reference.length > 200
        || !nonempty(input.name) || input.name.length > 200
        || !nonempty(input.email) || input.email.length > 254
        || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
        throw new ProviderError(400, "Valid payment reference and customer details are required");
    }
    let redirect: URL;
    try {
        redirect = new URL(input.redirectUrl);
    } catch {
        throw new ProviderError(400, "A valid payment return URL is required");
    }
    const localHttp = process.env.NODE_ENV !== "production"
        && redirect.protocol === "http:"
        && ["localhost", "127.0.0.1", "[::1]"].includes(redirect.hostname);
    if ((redirect.protocol !== "https:" && !localHttp) || redirect.username || redirect.password) {
        throw new ProviderError(400, "A secure payment return URL is required");
    }
    const data = await request("/payments", {
        tx_ref: input.reference,
        amount: input.amount,
        currency: "UGX",
        payment_options: "mobilemoneyuganda",
        customer: { email: input.email, name: input.name },
        redirect_url: redirect.toString(),
        // A missing landlord account must never turn into central settlement.
        subaccounts: [{
            id: input.subaccountId,
            transaction_charge_type: "flat",
            transaction_charge: 0,
            transaction_split_ratio: 1,
        }],
    });
    let checkout: URL;
    try {
        if (!object(data) || !nonempty(data.link)) throw new Error();
        checkout = new URL(data.link);
    } catch {
        throw new ProviderError(502, "The payment provider returned an invalid checkout URL");
    }
    if (checkout.protocol !== "https:" || checkout.hostname !== "checkout.flutterwave.com"
        || checkout.port || checkout.username || checkout.password) {
        throw new ProviderError(502, "The payment provider returned an invalid checkout URL");
    }
    return { checkoutUrl: checkout.toString() };
}

function transactionId(value: unknown): string | null {
    if (typeof value !== "string" && typeof value !== "number") return null;
    const str = String(value);
    return /^[1-9]\d*$/.test(str) && Number.isSafeInteger(Number(str)) ? str : null;
}

export async function verifyTransaction(id: string): Promise<VerifiedTransaction> {
    const expectedId = transactionId(id);
    if (!expectedId) throw new ProviderError(400, "Invalid provider transaction ID");
    const data = await request(`/transactions/${encodeURIComponent(expectedId)}/verify`);
    if (!object(data)) throw new ProviderError(502, "The payment provider returned an invalid transaction");

    const verifiedId = transactionId(data.id);
    // Accept whole monetary values such as "1000.00" without rounding fractions.
    // Check the string before conversion: tiny nonzero fractions can round to integers.
    const amount = typeof data.amount === "number" ? data.amount
        : typeof data.amount === "string" && /^\d+(?:\.0+)?$/.test(data.amount) ? Number(data.amount) : NaN;
    const status = data.status;
    if (!verifiedId || verifiedId !== expectedId
        || !nonempty(data.tx_ref) || data.tx_ref.length > 200
        || (status !== "successful" && status !== "failed" && status !== "pending")
        || !Number.isSafeInteger(amount) || amount <= 0
        || typeof data.currency !== "string" || !/^[A-Z]{3}$/.test(data.currency)
        || !nonempty(data.payment_type)) {
        throw new ProviderError(502, "The payment provider returned an invalid transaction");
    }
    let subaccounts: Array<{ id: string }> | undefined;
    if (data.subaccounts !== undefined) {
        if (!Array.isArray(data.subaccounts)) {
            throw new ProviderError(502, "The payment provider returned invalid settlement details");
        }
        subaccounts = data.subaccounts.map((entry: unknown) => {
            if (!object(entry)) {
                throw new ProviderError(502, "The payment provider returned invalid settlement details");
            }
            const subaccountId = entry.subaccount_id ?? entry.id;
            if (typeof subaccountId !== "string" || !SUBACCOUNT_ID.test(subaccountId)) {
                throw new ProviderError(502, "The payment provider returned invalid settlement details");
            }
            return { id: subaccountId };
        });
    }
    return {
        id: verifiedId,
        reference: data.tx_ref,
        status,
        amount,
        currency: data.currency,
        paymentType: data.payment_type,
        ...(subaccounts === undefined ? {} : { subaccounts }),
    };
}

function singleHeader(headers: WebhookHeaders, expectedName: string): string | null {
    const matching = Object.entries(headers).filter(([key]) => key.toLowerCase() === expectedName);
    if (matching.length !== 1) return null;
    const value = matching[0]?.[1];
    return typeof value === "string" ? value : null;
}

function secureEquals(actual: string, expected: string): boolean {
    const actualBytes = Buffer.from(actual, "utf8");
    const expectedBytes = Buffer.from(expected, "utf8");
    return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export function verifyWebhookSignature(rawBody: Buffer, headers: WebhookHeaders): boolean {
    const secret = process.env.FLW_WEBHOOK_SECRET;
    const mode = signatureMode();
    if (!nonempty(secret) || !mode || !Buffer.isBuffer(rawBody)) return false;

    // v3's verif-hash and v4's HMAC header are distinct protocols. Never accept both.
    const header = singleHeader(headers, mode === "legacy" ? "verif-hash" : "flutterwave-signature");
    if (!header) return false;
    const expected = mode === "legacy" ? secret
        : createHmac("sha256", secret).update(rawBody).digest("base64");
    return secureEquals(header, expected);
}
