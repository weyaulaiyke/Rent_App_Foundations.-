import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("Set TEST_DATABASE_URL to a disposable local remote_phase2_test database.");
const database = new URL(databaseURL);
if (!['localhost', '127.0.0.1', '[::1]'].includes(database.hostname) ||
    !/^\/remote_phase2_test(?:_[a-z0-9_]+)?$/i.test(database.pathname)) {
    throw new Error("Billing tests only reset a local database named remote_phase2_test or remote_phase2_test_<suffix>.");
}
process.env.DATABASE_URL = databaseURL;
process.env.JWT_SECRET = "remote-phase2-billing-test-only";
process.env.NODE_ENV = "test";
process.env.FRONTEND_URL = "https://frontend.example";
process.env.FLW_SECRET_KEY = "test-flutterwave-key";
process.env.FLW_WEBHOOK_SECRET = "test-webhook-secret";
process.env.FLW_WEBHOOK_SIGNATURE_MODE = "legacy";

type Json = Record<string, any>;
type Result = { status: number; body: Json; headers: Headers; bytes: Buffer };
const directory = process.cwd();
const migrationsDirectory = path.join(directory, "prisma/migrations");
const organizationMigration = "20261111120000_organization_isolation";
const billingMigration = "20261111140000_monthly_billing_ledger";
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

test("monthly ledger, landlord settlement, documents and durable jobs", { timeout: 240_000 }, async function(t) {
    const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "remote-billing-tests-"));
    const originalFetch = globalThis.fetch;
    let prisma: any, legacy: any, server: Server | undefined;
    const checkouts: Json[] = [], emails: Json[] = [], verificationCalls: string[] = [];
    const transactions = new Map<string, Json>();
    let mailFailure = false;
    let mailDuplicate: "none" | "generic" | "processed" = "none";
    t.after(async function() {
        globalThis.fetch = originalFetch;
        if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server!.close(() => resolve())); }
        await prisma?.$disconnect(); await legacy?.$disconnect();
        rmSync(temporaryDirectory, { recursive: true, force: true });
    });

    function execute(filename: string) {
        execFileSync(process.execPath, [path.join(directory, "node_modules/prisma/build/index.js"), "db", "execute", "--schema", path.join(directory, "prisma/schema.prisma"), "--file", filename], {
            cwd: directory, env: { ...process.env, DATABASE_URL: databaseURL! }, encoding: "utf8", stdio: "pipe"
        });
    }
    const reset = path.join(temporaryDirectory, "reset.sql");
    writeFileSync(reset, 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'); execute(reset);
    const names = readdirSync(migrationsDirectory, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
    assert.ok(names.includes(billingMigration));
    for (const name of names.filter(name => name < organizationMigration)) execute(path.join(migrationsDirectory, name, "migration.sql"));
    const { PrismaClient } = await import("@prisma/client"); legacy = new PrismaClient();
    async function insertID(query: string, ...values: unknown[]): Promise<number> { return (await legacy.$queryRawUnsafe(query, ...values))[0].id; }
    const hash = await bcrypt.hash("BillingPassword123", 4);
    const ownerA = await insertID('INSERT INTO "User" (email,"passwordHash") VALUES ($1,$2) RETURNING id', 'owner-a@example.test', hash);
    const ownerB = await insertID('INSERT INTO "User" (email,"passwordHash") VALUES ($1,$2) RETURNING id', 'owner-b@example.test', hash);
    const staff = await insertID('INSERT INTO "User" (email,"passwordHash") VALUES ($1,$2) RETURNING id', 'staff@example.test', hash);
    const propertyA = await insertID('INSERT INTO "Property" (name,"userId") VALUES ($1,$2) RETURNING id', 'Original property A', ownerA);
    const propertyB = await insertID('INSERT INTO "Property" (name,"userId") VALUES ($1,$2) RETURNING id', 'Original property B', ownerB);
    const renterA = await insertID('INSERT INTO "Renter" (name,"userId") VALUES ($1,$2) RETURNING id', 'Original renter A', ownerA);
    const renterB = await insertID('INSERT INTO "Renter" (name,"userId") VALUES ($1,$2) RETURNING id', 'Original renter B', ownerB);
    const archived = await insertID('INSERT INTO "Renter" (name,"userId","isArchived") VALUES ($1,$2,true) RETURNING id', 'Archived renter', ownerA);
    const unitA = await insertID('INSERT INTO "Unit" (number,"propertyId") VALUES ($1,$2) RETURNING id', 'A1', propertyA);
    const unitA2 = await insertID('INSERT INTO "Unit" (number,"propertyId") VALUES ($1,$2) RETURNING id', 'A2', propertyA);
    const unitArchived = await insertID('INSERT INTO "Unit" (number,"propertyId") VALUES ($1,$2) RETURNING id', 'AX', propertyA);
    const unitB = await insertID('INSERT INTO "Unit" (number,"propertyId") VALUES ($1,$2) RETURNING id', 'B1', propertyB);
    const leaseA = await insertID('INSERT INTO "Lease" ("renterId","unitId","monthlyRent") VALUES ($1,$2,$3) RETURNING id', renterA, unitA, 100_000);
    const leaseA2 = await insertID('INSERT INTO "Lease" ("renterId","unitId","monthlyRent") VALUES ($1,$2,$3) RETURNING id', renterA, unitA2, 50_000);
    await insertID('INSERT INTO "Lease" ("renterId","unitId","monthlyRent") VALUES ($1,$2,$3) RETURNING id', archived, unitArchived, 40_000);
    await insertID('INSERT INTO "Lease" ("renterId","unitId","monthlyRent") VALUES ($1,$2,$3) RETURNING id', renterB, unitB, 80_000);
    const legacyPayment = await insertID('INSERT INTO "Payment" ("renterId",amount,"paymentDate") VALUES ($1,$2,$3) RETURNING id', renterA, 30_000, new Date("2020-01-01T00:00:00Z"));
    for (const name of names.filter(name => name >= organizationMigration)) execute(path.join(migrationsDirectory, name, "migration.sql"));
    await legacy.$disconnect();
    prisma = (await import("../src/prisma.ts")).prisma;
    const orgA = (await prisma.organizationMembership.findFirst({ where: { userId: ownerA } })).organizationId;
    const orgB = (await prisma.organizationMembership.findFirst({ where: { userId: ownerB } })).organizationId;
    await prisma.organizationMembership.create({ data: { userId: staff, organizationId: orgA, role: "STAFF" } });
    await prisma.renter.update({ where: { id: renterA }, data: { email: "renter-a@example.test" } });
    await prisma.renter.update({ where: { id: renterB }, data: { email: "renter-b@example.test" } });
    process.env.FLW_ORGANIZATION_SUBACCOUNTS = JSON.stringify({ [orgA]: "RS_LANDLORD_A", [orgB]: "RS_LANDLORD_B" });

    globalThis.fetch = async function(input, init) {
        const url = String(input);
        if (url === "https://api.flutterwave.com/v3/subaccounts") return Response.json({ status: "success", data: [
            { id: 1, subaccount_id: "RS_LANDLORD_A", full_name: "Landlord A", bank_name: "Example Bank", account_number: "0000001234", country: "UG" },
            { id: 2, subaccount_id: "RS_LANDLORD_B", full_name: "Landlord B", bank_name: "Example Bank", account_number: "0000005678", country: "UG" }
        ] });
        if (url === "https://api.flutterwave.com/v3/payments") {
            checkouts.push(JSON.parse(String(init?.body)));
            return Response.json({ status: "success", data: { link: `https://checkout.flutterwave.com/v3/hosted/test-${checkouts.length}` } });
        }
        const verification = url.match(/^https:\/\/api\.flutterwave\.com\/v3\/transactions\/(\d+)\/verify$/);
        if (verification) {
            verificationCalls.push(verification[1]!);
            return Response.json({ status: "success", data: transactions.get(verification[1]!) || {} });
        }
        if (url === "https://api.brevo.com/v3/smtp/email") {
            emails.push(JSON.parse(String(init?.body)));
            if (mailDuplicate !== "none") return Response.json({ code: "duplicate_parameter", message: mailDuplicate === "processed" ? "Email for the idempotency key has already been processed" : "Duplicate sender parameter" }, { status: 400 });
            return Response.json({ messageId: "mock-message" }, { status: mailFailure ? 503 : 201 });
        }
        if (new URL(url).hostname === "127.0.0.1") return originalFetch(input, init);
        throw new Error(`Unexpected external request in integration test: ${url}`);
    };
    const { app } = await import("../src/server.ts");
    server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server!.once("listening", resolve));
    const address = server.address(); assert.ok(address && typeof address !== "string"); const base = `http://127.0.0.1:${address.port}`;
    const cookie = (id: number) => `token=${jwt.sign({ userId: id }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "1h" })}`;

    async function request(method: string, endpoint: string, body?: Json, organization = orgA, user = ownerA, extraHeaders: Record<string, string> = {}): Promise<Result> {
        const response = await originalFetch(base + endpoint, {
            method, headers: { Cookie: cookie(user), "X-Organization-Id": String(organization), ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...extraHeaders },
            ...(body === undefined ? {} : { body: JSON.stringify(body) })
        });
        const bytes = Buffer.from(await response.arrayBuffer()); let parsed: Json = {};
        if (response.headers.get("content-type")?.includes("application/json")) parsed = JSON.parse(bytes.toString());
        return { status: response.status, body: parsed, headers: response.headers, bytes };
    }
    async function invoice(id: number, organization = orgA, user = ownerA) {
        const response = await request("GET", "/billing/invoices", undefined, organization, user); assert.equal(response.status, 200);
        const found = response.body.data.find((row: Json) => row.id === id); assert.ok(found); return found;
    }
    let caseNumber = 0;
    async function invoiceCase(label: string, organization = orgA, owner = ownerA, amount = 100_000) {
        caseNumber++;
        const renter = await prisma.renter.create({ data: { name: label, email: `case-${caseNumber}@example.test`, userId: owner, organizationId: organization } });
        const unit = await prisma.unit.create({ data: { number: `CASE-${caseNumber}`, propertyId: organization === orgA ? propertyA : propertyB } });
        const lease = await prisma.lease.create({ data: { renterId: renter.id, unitId: unit.id, monthlyRent: amount } });
        const organizationRow = await prisma.organization.findUniqueOrThrow({ where: { id: organization } });
        const value = await prisma.invoice.create({ data: {
            organizationId: organization, leaseId: lease.id, renterId: renter.id, number: `TEST-${organization}-${caseNumber}`,
            periodStart: new Date("2020-01-01T00:00:00Z"), dueDate: new Date("2020-01-01T00:00:00Z"), amount, currency: "UGX",
            renterName: renter.name, propertyName: organization === orgA ? "Original property A" : "Original property B", unitNumber: unit.number, organizationName: organizationRow.name
        } });
        return { invoice: value, renter, lease, unit };
    }
    async function manual(renterId: number, amount: number, invoiceId?: number, organization = orgA, owner = ownerA) {
        const response = await request("POST", "/payments", { renterId, amount, paymentDate: "2026-01-01", ...(invoiceId === undefined ? {} : { invoiceId }) }, organization, owner);
        assert.equal(response.status, 201, JSON.stringify(response.body)); return response.body.data;
    }
    async function paymentLink(value: any, organization = orgA, owner = ownerA, extra: Json = {}) {
        const response = await request("POST", `/billing/invoices/${value.id}/payment-link`, extra, organization, owner);
        assert.equal(response.status, 201, JSON.stringify(response.body)); return response.body.data;
    }
    function verified(request: Json, id: string, changes: Json = {}) {
        transactions.set(id, { id: Number(id), tx_ref: request.id, status: "successful", amount: request.amount, currency: "UGX", payment_type: "mobilemoneyuganda", subaccounts: [{ id: request.subaccountId || "RS_LANDLORD_A" }], ...changes });
    }
    async function webhook(reference: string, id: string, headers: Record<string, string> = { "verif-hash": process.env.FLW_WEBHOOK_SECRET! }, data: Json = {}) {
        return request("POST", "/webhooks/flutterwave", { event: "charge.completed", data: { id: Number(id), tx_ref: reference, status: "successful", ...data } }, orgA, ownerA, headers);
    }

    await t.test("ledger migration preserves historical payments without inventing charges or allocations", async function() {
        const historical = await prisma.payment.findUniqueOrThrow({ where: { id: legacyPayment } });
        assert.equal(historical.source, "LEGACY"); assert.equal(historical.amount, 30_000); assert.equal(historical.receiptNumber, null);
        assert.equal(await prisma.invoice.count(), 0); assert.equal(await prisma.paymentAllocation.count(), 0);
        const listed = await request("GET", "/payments"); const old = listed.body.data.find((row: Json) => row.id === legacyPayment);
        assert.equal(old.allocatedAmount, 0); assert.equal(old.unallocatedAmount, 30_000);
        assert.deepEqual((await request("GET", "/reports/arrears")).body.data, []);
    });

    await t.test("monthly generation is concurrent-idempotent and keeps issued amount/name snapshots", async function() {
        assert.equal((await request("PATCH", "/organization/billing-settings", { billingDay: 12 })).status, 200);
        const generated = await Promise.all([1, 2].map(() => request("POST", "/billing/invoices/generate", { month: "2020-01" })));
        assert.ok(generated.every(response => response.status === 200)); assert.equal(generated.reduce((sum, response) => sum + response.body.data.created, 0), 2);
        let rows = (await request("GET", "/billing/invoices?month=2020-01")).body.data;
        assert.equal(rows.length, 2); assert.ok(rows.every((row: Json) => row.status === "UNPAID" && row.paid === 0));
        const first = rows.find((row: Json) => row.leaseId === leaseA); assert.equal(first.amount, 100_000); assert.equal(first.dueDate.slice(0, 10), "2020-01-12");
        await prisma.lease.update({ where: { id: leaseA }, data: { monthlyRent: 200_000 } });
        await prisma.renter.update({ where: { id: renterA }, data: { name: "Renamed renter" } });
        assert.equal((await request("POST", "/billing/invoices/generate", { month: "2020-01" })).body.data.created, 0);
        rows = (await request("GET", "/billing/invoices?month=2020-01")).body.data;
        assert.equal(rows.find((row: Json) => row.id === first.id).amount, 100_000); assert.equal(rows.find((row: Json) => row.id === first.id).renterName, "Original renter A");
        const report = (await request("GET", "/reports/arrears")).body.data;
        assert.equal(report.find((row: Json) => row.leaseId === leaseA).arrears, 100_000);
        assert.equal(report.find((row: Json) => row.leaseId === leaseA2).arrears, 50_000);
        assert.equal((await request("POST", "/billing/invoices/generate", { month: "2020-13" })).status, 400);
    });

    await t.test("partial and excess payments retain credit, and voids preserve financial history", async function() {
        const current = await invoiceCase("Partial payments");
        const first = await manual(current.renter.id, 40_000, current.invoice.id);
        assert.equal(first.source, "MANUAL"); assert.equal(first.receiptNumber, `RCP-${first.id}`); assert.equal(first.allocatedAmount, 40_000);
        assert.equal((await invoice(current.invoice.id)).outstanding, 60_000);
        const excess = await manual(current.renter.id, 80_000, current.invoice.id);
        assert.equal(excess.allocatedAmount, 60_000); assert.equal(excess.unallocatedAmount, 20_000); assert.equal((await invoice(current.invoice.id)).status, "PAID");
        assert.equal((await request("PATCH", `/payments/${first.id}`, { amount: 1 })).status, 409);
        assert.equal((await request("DELETE", `/payments/${first.id}`)).status, 409);
        assert.equal((await request("POST", `/billing/invoices/${current.invoice.id}/void`, { reason: "Incorrect issue" })).status, 409);
        assert.equal((await request("POST", `/payments/${excess.id}/void`, { reason: "Duplicate record" })).status, 200);
        assert.equal((await invoice(current.invoice.id)).paid, 40_000); assert.equal((await invoice(current.invoice.id)).outstanding, 60_000);
        assert.equal(await prisma.paymentAllocation.count({ where: { paymentId: excess.id } }), 1); assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: excess.id } })).amount, 80_000);
        await request("POST", `/payments/${first.id}/void`, { reason: "Incorrect record" });
        assert.equal((await request("POST", `/billing/invoices/${current.invoice.id}/void`, { reason: "Issue cancelled" })).status, 200);
        assert.equal((await invoice(current.invoice.id)).status, "VOID");
    });

    await t.test("allocation enforces tenant/renter boundaries and cannot overspend a payment or overpay an invoice concurrently", async function() {
        const target = await invoiceCase("Allocation target"), other = await invoiceCase("Other renter"), foreign = await invoiceCase("Foreign renter", orgB, ownerB);
        const credit = await manual(target.renter.id, 100_000);
        assert.equal((await request("POST", "/billing/allocations", { paymentId: credit.id, invoiceId: other.invoice.id, amount: 1 })).status, 409);
        assert.equal((await request("POST", "/billing/allocations", { paymentId: credit.id, invoiceId: foreign.invoice.id, amount: 1 })).status, 404);
        assert.equal((await request("POST", "/billing/allocations", { paymentId: credit.id, invoiceId: target.invoice.id, amount: 0.5 })).status, 400);
        const competing = await Promise.all([1, 2].map(() => request("POST", "/billing/allocations", { paymentId: credit.id, invoiceId: target.invoice.id, amount: 70_000 })));
        assert.deepEqual(competing.map(response => response.status).sort(), [201, 409]);
        assert.equal((await invoice(target.invoice.id)).paid, 70_000);
        const left = await manual(target.renter.id, 30_000), right = await manual(target.renter.id, 30_000);
        const finish = await Promise.all([left, right].map(payment => request("POST", "/billing/allocations", { paymentId: payment.id, invoiceId: target.invoice.id, amount: 30_000 })));
        assert.deepEqual(finish.map(response => response.status).sort(), [201, 409]); assert.equal((await invoice(target.invoice.id)).paid, 100_000);
        const sum = await prisma.paymentAllocation.aggregate({ where: { paymentId: credit.id }, _sum: { amount: true } }); assert.ok(sum._sum.amount <= credit.amount);
    });

    await t.test("a payment void racing an allocation cannot leave effective money on the invoice", async function() {
        const target = await invoiceCase("Void versus allocation");
        const credit = await manual(target.renter.id, target.invoice.amount);
        const results = await Promise.all([
            request("POST", "/billing/allocations", { paymentId: credit.id, invoiceId: target.invoice.id, amount: credit.amount }),
            request("POST", `/payments/${credit.id}/void`, { reason: "Incorrect payment" })
        ]);
        assert.equal(results[1]!.status, 200, JSON.stringify(results.map(result => result.body)));
        assert.ok([201, 409].includes(results[0]!.status), JSON.stringify(results.map(result => ({ status: result.status, body: result.body }))));
        const final = await invoice(target.invoice.id);
        assert.equal(final.paid, 0); assert.equal(final.outstanding, target.invoice.amount);
        const persisted = await prisma.payment.findUniqueOrThrow({ where: { id: credit.id } });
        assert.ok(persisted.voidedAt); assert.equal(persisted.amount, credit.amount);
    });

    let mobileCase: any, mobileRequest: Json, mobilePayment: any;
    await t.test("each landlord checkout uses its approved settlement mapping and absent configuration never falls back", async function() {
        mobileCase = await invoiceCase("Mobile renter A"); const second = await invoiceCase("Mobile renter B", orgB, ownerB);
        process.env.FLW_ORGANIZATION_SUBACCOUNTS = JSON.stringify({ [orgA]: "RS_LANDLORD_A" });
        const before = checkouts.length;
        assert.equal((await request("POST", `/billing/invoices/${second.invoice.id}/payment-link`, {}, orgB, ownerB)).status, 503); assert.equal(checkouts.length, before);
        process.env.FLW_ORGANIZATION_SUBACCOUNTS = JSON.stringify({ [orgA]: "RS_LANDLORD_A", [orgB]: "RS_LANDLORD_B" });
        mobileRequest = await paymentLink(mobileCase.invoice, orgA, ownerA, { subaccountId: "RS_ATTACKER" });
        const requestB = await paymentLink(second.invoice, orgB, ownerB);
        assert.equal(checkouts.at(-2)!.subaccounts[0].id, "RS_LANDLORD_A"); assert.equal(checkouts.at(-1)!.subaccounts[0].id, "RS_LANDLORD_B");
        assert.equal(checkouts.at(-2)!.payment_options, "mobilemoneyuganda"); assert.equal(checkouts.at(-2)!.subaccounts[0].transaction_charge, 0);
        assert.equal((await prisma.paymentRequest.findUniqueOrThrow({ where: { id: requestB.id } })).subaccountId, "RS_LANDLORD_B");
        const publicStatus = await request("GET", `/payment-status/${mobileRequest.id}`, undefined, orgA, ownerA, { Cookie: "" });
        assert.equal(publicStatus.status, 200); assert.deepEqual(Object.keys(publicStatus.body.data).sort(), ["amount", "currency", "status"]);
        assert.equal((await request("POST", `/billing/invoices/${second.invoice.id}/payment-link`, {})).status, 404);
    });

    await t.test("forged or mismatched callbacks never create money; verified duplicate callbacks settle once", async function() {
        const before = verificationCalls.length; verified(mobileRequest, "101");
        assert.equal((await webhook(mobileRequest.id, "101", { "verif-hash": "forged" })).status, 401); assert.equal(verificationCalls.length, before);
        for (const changes of [{ amount: mobileRequest.amount - 1 }, { currency: "USD" }, { tx_ref: "wrong-reference" }, { payment_type: "card" }, { subaccounts: [{ id: "RS_LANDLORD_B" }] }]) {
            verified(mobileRequest, "101", changes); assert.equal((await webhook(mobileRequest.id, "101")).status, 409);
            assert.equal(await prisma.payment.count({ where: { source: "MOBILE_MONEY" } }), 0);
        }
        verified(mobileRequest, "101");
        const callbacks = await Promise.all([1, 2, 3].map(() => webhook(mobileRequest.id, "101", undefined, { amount: 1, currency: "USD" })));
        assert.ok(callbacks.every(response => [200, 202].includes(response.status)), JSON.stringify(callbacks.map(response => ({ status: response.status, body: response.body }))));
        const settled = await prisma.paymentRequest.findUniqueOrThrow({ where: { id: mobileRequest.id } }); assert.equal(settled.status, "SUCCESS");
        mobilePayment = await prisma.payment.findUniqueOrThrow({ where: { id: settled.paymentId } }); assert.equal(mobilePayment.amount, mobileRequest.amount); assert.equal(mobilePayment.source, "MOBILE_MONEY");
        assert.equal(await prisma.payment.count({ where: { source: "MOBILE_MONEY" } }), 1);
        assert.equal(await prisma.documentDelivery.count({ where: { dedupeKey: `receipt:${mobilePayment.id}` } }), 1);
        assert.equal((await invoice(mobileCase.invoice.id)).status, "PAID");
        assert.equal((await request("POST", `/payments/${mobilePayment.id}/void`, { reason: "Pretend refund" })).status, 409);
        verified(mobileRequest, "101", { status: "failed" }); await webhook(mobileRequest.id, "101");
        assert.equal((await prisma.paymentRequest.findUniqueOrThrow({ where: { id: mobileRequest.id } })).status, "SUCCESS");
    });

    await t.test("HMAC mode is explicit and a late genuine payment becomes credit instead of being lost", async function() {
        const target = await invoiceCase("Late payment"); const pending = await paymentLink(target.invoice);
        await manual(target.renter.id, target.invoice.amount, target.invoice.id); verified(pending, "202");
        process.env.FLW_WEBHOOK_SIGNATURE_MODE = "hmac";
        assert.equal((await webhook(pending.id, "202")).status, 401);
        const payload = { event: "charge.completed", data: { id: 202, tx_ref: pending.id, status: "successful" } };
        const signature = createHmac("sha256", process.env.FLW_WEBHOOK_SECRET!).update(JSON.stringify(payload)).digest("base64");
        assert.equal((await request("POST", "/webhooks/flutterwave", payload, orgA, ownerA, { "flutterwave-signature": signature })).status, 200);
        const settled = await prisma.paymentRequest.findUniqueOrThrow({ where: { id: pending.id } });
        const listed = (await request("GET", "/payments")).body.data.find((payment: Json) => payment.id === settled.paymentId);
        assert.equal(listed.allocatedAmount, 0); assert.equal(listed.unallocatedAmount, pending.amount); assert.equal((await invoice(target.invoice.id)).paid, target.invoice.amount);
        process.env.FLW_WEBHOOK_SIGNATURE_MODE = "legacy";
    });

    await t.test("public confirmation uses provider verification and exposes only minimal status", async function() {
        const target = await invoiceCase("Confirmation renter"); const pending = await paymentLink(target.invoice); verified(pending, "303");
        const [checked, callback] = await Promise.all([
            request("POST", `/payment-status/${pending.id}/confirm`, { transactionId: "303", status: "failed" }),
            webhook(pending.id, "303")
        ]);
        assert.equal(checked.status, 200); assert.deepEqual(checked.body.data, { status: "SUCCESS", amount: pending.amount, currency: "UGX" });
        assert.ok([200, 202].includes(callback.status), JSON.stringify(callback.body));
        assert.equal((await request("GET", "/payment-status/not-a-reference")).status, 404);
        const duplicate = await request("POST", `/payment-status/${pending.id}/confirm`, { transactionId: "999" }); assert.equal(duplicate.body.data.status, "SUCCESS");
        const settled = await prisma.paymentRequest.findUniqueOrThrow({ where: { id: pending.id } });
        assert.equal(await prisma.payment.count({ where: { renterId: target.renter.id, source: "MOBILE_MONEY" } }), 1);
        assert.equal(await prisma.documentDelivery.count({ where: { dedupeKey: `receipt:${settled.paymentId}` } }), 1);
    });

    await t.test("invoice, receipt and report PDFs and email sends enforce organization and role", async function() {
        const target = await invoiceCase("Document renter"); const payment = await manual(target.renter.id, 25_000, target.invoice.id);
        for (const endpoint of [`/billing/invoices/${target.invoice.id}/pdf`, `/payments/${payment.id}/receipt.pdf`, "/reports/financial.pdf?type=collections&month=2026-01"]) {
            const response = await request("GET", endpoint); assert.equal(response.status, 200, endpoint); assert.ok(response.headers.get("content-type")?.includes("application/pdf")); assert.equal(response.bytes.subarray(0, 5).toString(), "%PDF-");
        }
        assert.equal((await request("GET", `/billing/invoices/${target.invoice.id}/pdf`, undefined, orgB, ownerB)).status, 404);
        assert.equal((await request("GET", `/payments/${payment.id}/receipt.pdf`, undefined, orgB, ownerB)).status, 404);
        assert.equal((await request("GET", `/billing/invoices/${target.invoice.id}/pdf`, undefined, orgA, staff)).status, 403);
        const count = await prisma.documentDelivery.count(); delete process.env.BREVO_API_KEY;
        assert.equal((await request("POST", `/billing/invoices/${target.invoice.id}/send`, { email: "recipient@example.test" })).status, 503); assert.equal(await prisma.documentDelivery.count(), count);
        process.env.BREVO_API_KEY = "test-brevo-key"; process.env.EMAIL_FROM = "sender@example.test";
        const sent = await request("POST", `/billing/invoices/${target.invoice.id}/send`, { email: "recipient@example.test" }); assert.equal(sent.status, 200); assert.equal(sent.body.data.status, "SENT");
        assert.equal(emails.at(-1)!.to[0].email, "recipient@example.test"); assert.equal(Buffer.from(emails.at(-1)!.attachment[0].content, "base64").subarray(0, 5).toString(), "%PDF-");
        assert.equal((await request("POST", `/payments/${payment.id}/send-receipt`, { email: "recipient@example.test" }, orgB, ownerB)).status, 404);
        mailFailure = true; const queued = await request("POST", "/reports/send", { type: "arrears", month: "2026-01", email: "recipient@example.test" }); assert.equal(queued.status, 202); assert.equal(queued.body.data.status, "QUEUED"); mailFailure = false;
        const deliveries = await request("GET", "/billing/deliveries", undefined, orgB, ownerB); assert.equal(deliveries.status, 200); assert.ok(deliveries.body.data.every((row: Json) => row.organizationId === undefined || row.organizationId === orgB));
    });

    await t.test("durable delivery claims, provider idempotency and retries never invent a successful send", async function() {
        const { queueDocumentDelivery, runDeliveryJob } = await import("../src/jobs/index.ts");
        const target = await invoiceCase("Outbox renter");
        const queue = () => queueDocumentDelivery({ organizationId: orgA, invoiceId: target.invoice.id, kind: "INVOICE", recipient: "outbox@example.test", dedupeKey: `test:${randomUUID()}` });
        const instant = new Date(Date.now() + 60_000);
        const job = await queue();
        await assert.rejects(() => runDeliveryJob(job.id, orgB, instant), (error: any) => error.status === 404);
        const before = emails.length;
        await Promise.all([runDeliveryJob(job.id, orgA, instant), runDeliveryJob(job.id, orgA, instant)]);
        await runDeliveryJob(job.id, orgA, instant);
        assert.equal(emails.length, before + 1);
        const sent = await prisma.documentDelivery.findUniqueOrThrow({ where: { id: job.id } });
        assert.equal(sent.status, "SENT"); assert.equal(sent.attempts, 1); assert.equal(emails.at(-1)!.headers.idempotencyKey, job.id);

        const missingConfig = await queue(); delete process.env.BREVO_API_KEY;
        const retained = await runDeliveryJob(missingConfig.id, orgA, instant);
        assert.equal(retained.status, "QUEUED"); assert.equal(retained.attempts, 0); assert.equal(retained.firstAttemptAt, null);
        assert.equal(emails.length, before + 1); process.env.BREVO_API_KEY = "test-brevo-key";

        const duplicate = await queue(); mailDuplicate = "generic";
        const rejected = await runDeliveryJob(duplicate.id, orgA, instant);
        assert.equal(rejected.status, "QUEUED"); assert.equal(rejected.sentAt, null); assert.equal(rejected.attempts, 1);
        mailDuplicate = "processed";
        const accepted = await runDeliveryJob(duplicate.id, orgA, rejected.availableAt);
        assert.equal(accepted.status, "SENT"); assert.equal(accepted.attempts, 2);
        assert.equal(emails.at(-1)!.headers.idempotencyKey, emails.at(-2)!.headers.idempotencyKey);
        mailDuplicate = "none";

        const retry = await queue(); mailFailure = true;
        let failed: any = await runDeliveryJob(retry.id, orgA, instant);
        for (let attempt = 2; attempt <= 4; attempt++) failed = await runDeliveryJob(retry.id, orgA, failed.availableAt);
        assert.equal(failed.status, "FAILED"); assert.equal(failed.attempts, 4); assert.equal(failed.sentAt, null);
        const attempts = emails.length;
        await runDeliveryJob(retry.id, orgA, new Date(instant.getTime() + 3600_000)); assert.equal(emails.length, attempts);
        mailFailure = false;

        const uncertain = await queue();
        await prisma.documentDelivery.update({ where: { id: uncertain.id }, data: { status: "SENDING", attempts: 1, firstAttemptAt: new Date(instant.getTime() - 16 * 60_000), claimedAt: new Date(instant.getTime() - 3 * 60_000) } });
        assert.equal((await runDeliveryJob(uncertain.id, orgA, instant)).status, "FAILED"); assert.equal(emails.length, attempts);

        assert.ok(mobilePayment, "the verified callback must have persisted its payment");
        const receipt = await prisma.documentDelivery.findUniqueOrThrow({ where: { dedupeKey: `receipt:${mobilePayment.id}` } });
        await Promise.all([runDeliveryJob(receipt.id, orgA, instant), runDeliveryJob(receipt.id, orgA, instant)]);
        await runDeliveryJob(receipt.id, orgA, instant);
        assert.equal(await prisma.documentDelivery.count({ where: { paymentId: mobilePayment.id, kind: "RECEIPT" } }), 1);
        assert.equal((await prisma.documentDelivery.findUniqueOrThrow({ where: { id: receipt.id } })).attempts, 1);
    });

    await t.test("collections and receipts use Kampala calendar boundaries for timestamp payments", async function() {
        const target = await invoiceCase("Kampala boundary renter");
        const boundary = await prisma.payment.create({ data: { renterId: target.renter.id, amount: 23_456, paymentDate: new Date("2077-10-31T22:00:00Z"), source: "LEGACY" } });
        await prisma.payment.create({ data: { renterId: target.renter.id, amount: 900_000, paymentDate: new Date("2077-11-30T22:00:00Z"), source: "LEGACY" } });
        const { reportDocument, receiptDocument } = await import("../src/docs/builders.ts");
        const report = await reportDocument(orgA, "collections", "2077-11");
        assert.match(report.summary, /Total UGX 23,456\./);
        const october = await reportDocument(orgA, "collections", "2077-10"); assert.match(october.summary, /Total UGX 0\./);
        const receipt = await receiptDocument(orgA, boundary.id); assert.match(receipt.summary, /1 Nov 2077/);
        assert.equal((await request("PATCH", `/payments/${boundary.id}`, { amount: 1 })).status, 409);
    });

    await t.test("opt-in schedules are repeatable, use Kampala time and skip paid, missing-contact or stale reminders", async function() {
        const { scheduleBillingAndReminders, runDeliveryJob } = await import("../src/jobs/index.ts");
        const target = await invoiceCase("Scheduled renter"), noEmail = await invoiceCase("No contact renter"), paid = await invoiceCase("Paid scheduled renter");
        const due = new Date("2030-07-15T00:00:00Z");
        for (const value of [target, noEmail, paid]) await prisma.invoice.update({ where: { id: value.invoice.id }, data: { periodStart: new Date("2030-07-01T00:00:00Z"), dueDate: due } });
        await prisma.renter.update({ where: { id: noEmail.renter.id }, data: { email: null } });
        await manual(paid.renter.id, paid.invoice.amount, paid.invoice.id);
        await prisma.organization.update({ where: { id: orgA }, data: { monthlyBillingEnabled: true, remindersEnabled: true, billingDay: 15 } });
        const early = new Date("2030-07-15T05:59:00Z"), morning = new Date("2030-07-15T06:00:00Z");
        const first = await scheduleBillingAndReminders(early); assert.ok(first.invoicesCreated > 0); assert.equal(first.remindersQueued, 0);
        const second = await scheduleBillingAndReminders(morning); assert.equal(second.invoicesCreated, 0); assert.ok(second.remindersQueued > 0);
        const repeated = await scheduleBillingAndReminders(morning); assert.equal(repeated.invoicesCreated, 0); assert.equal(repeated.remindersQueued, 0); assert.equal(repeated.missingContacts, 0);
        assert.equal(await prisma.documentDelivery.count({ where: { organizationId: orgB, kind: "REMINDER" } }), 0);
        assert.equal(await prisma.invoice.count({ where: { organizationId: orgB, periodStart: new Date("2030-07-01T00:00:00Z") } }), 0);
        const key = `reminder:${orgA}:${target.invoice.id}:2030-07-15`;
        const reminder = await prisma.documentDelivery.findUniqueOrThrow({ where: { dedupeKey: key } });
        assert.equal(reminder.status, "QUEUED");
        assert.equal((await prisma.documentDelivery.findUniqueOrThrow({ where: { dedupeKey: `reminder:${orgA}:${noEmail.invoice.id}:2030-07-15` } })).status, "SKIPPED");
        assert.equal(await prisma.documentDelivery.count({ where: { invoiceId: paid.invoice.id, kind: "REMINDER" } }), 0);
        const calls = emails.length;
        assert.equal((await runDeliveryJob(reminder.id, orgA, new Date("2030-07-16T06:00:00Z"))).status, "SKIPPED");
        assert.equal(emails.length, calls);
    });

    await t.test("cookie-based document sends reject cross-site forms and receipt issuance requires an explicit workspace", async function() {
        const target = await invoiceCase("Origin guard renter");
        const legacy = await prisma.payment.create({ data: {
            renterId: target.renter.id, amount: 10_000,
            paymentDate: new Date("2026-01-01T00:00:00Z"), source: "LEGACY"
        } });
        const beforeJobs = await prisma.documentDelivery.count();
        const beforeEmails = emails.length;
        async function browserForm(endpoint: string, origin?: string) {
            return originalFetch(base + endpoint, {
                method: "POST", headers: {
                    Cookie: cookie(ownerA), "Content-Type": "application/x-www-form-urlencoded",
                    ...(origin === undefined ? {} : { Origin: origin })
                }, body: "ignored=value"
            });
        }
        for (const origin of ["https://attacker.example", "null", "https://frontend.example.attacker.example"]) {
            assert.equal((await browserForm(`/billing/invoices/${target.invoice.id}/send`, origin)).status, 403);
            assert.equal((await browserForm(`/payments/${legacy.id}/send-receipt`, origin)).status, 403);
        }
        const workspaceCount = await prisma.organization.count();
        assert.equal((await request("POST", "/organizations", { name: "Forged workspace" }, orgA, ownerA,
            { Origin: "https://attacker.example" })).status, 403);
        assert.equal(await prisma.organization.count(), workspaceCount);
        assert.equal(await prisma.documentDelivery.count(), beforeJobs);
        assert.equal(emails.length, beforeEmails);
        assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: legacy.id } })).receiptNumber, null);

        const unscopedDownload = await originalFetch(`${base}/payments/${legacy.id}/receipt.pdf`, {
            headers: { Cookie: cookie(ownerA) }
        });
        assert.equal(unscopedDownload.status, 403);
        assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: legacy.id } })).receiptNumber, null);
        assert.equal((await request("GET", `/payments/${legacy.id}/receipt.pdf`, undefined, orgA, ownerA,
            { Origin: "https://attacker.example" })).status, 403);
        assert.equal((await request("GET", `/payments/${legacy.id}/receipt.pdf`, undefined, orgA, ownerA,
            { Origin: process.env.FRONTEND_URL! })).status, 200);
        assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: legacy.id } })).receiptNumber, `RCP-${legacy.id}`);

        // The configured browser origin and explicit origin-less CLI calls
        // remain usable; private reads and public provider flows are unchanged.
        assert.equal((await browserForm(`/billing/invoices/${target.invoice.id}/send`, process.env.FRONTEND_URL)).status, 200);
        assert.equal((await browserForm(`/payments/${legacy.id}/send-receipt`)).status, 200);
        assert.equal((await request("GET", "/billing/invoices", undefined, orgA, ownerA,
            { Origin: "https://attacker.example" })).status, 200);
        assert.equal(emails.length, beforeEmails + 2);
    });
});
