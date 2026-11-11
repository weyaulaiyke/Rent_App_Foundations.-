import express = require("express");
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError, positiveId } from "../http";
import { organizationId, requirePermission } from "../middleware/organization";
import {
    configuredSubaccountId, createCheckout, getSubaccount, providerConfigured,
    verifyTransaction, verifyWebhookSignature, type VerifiedTransaction
} from "../payments/flutterwave";
import { financialTransaction, invoiceView, lockedInvoice, queueReceipt, wholeUgx } from "./ledger";

export const mobileMoneyRoutes = express.Router();
export const paymentPublicRoutes = express.Router();
const uuidSchema = z.string().uuid();
const emailSchema = z.string().trim().max(254).email();
const VERIFY_COOLDOWN_MS = 10_000;

// Bound public API pressure in addition to the persisted per-reference cooldown.
// This is intentionally local-process protection, not a distributed quota.
const publicRequests = new Map<string, { window: number; count: number }>();
function publicLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    for (const [ip, bucket] of publicRequests) if (bucket.window <= now - 60_000) publicRequests.delete(ip);
    const bucket = publicRequests.get(key) ?? { window: now, count: 0 };
    bucket.count++;
    if (publicRequests.size < 5000 || publicRequests.has(key)) publicRequests.set(key, bucket);
    if (bucket.count > 30) {
        res.setHeader("Retry-After", "60");
        return res.status(429).json({ error: "Too many status checks. Try again shortly." });
    }
    next();
}

function reference(value: unknown): string {
    const parsed = uuidSchema.safeParse(value);
    if (!parsed.success) throw new HttpError(404, "Payment request not found");
    return parsed.data;
}
function publicView(request: { status: string; amount: number; currency: string }) {
    return { status: request.status, amount: request.amount, currency: request.currency };
}

mobileMoneyRoutes.get("/billing/payment-provider", requirePermission("finance:read"), function(req, res) {
    const configured = providerConfigured();
    let settlementConfigured = false;
    let message = configured ? "This workspace needs an operator-approved landlord settlement account." : "Mobile money is unavailable until the payment provider is configured.";
    try {
        settlementConfigured = Boolean(configuredSubaccountId(organizationId(req)));
        if (configured && settlementConfigured) message = "MTN and Airtel checkout is available through Flutterwave.";
    } catch {
        message = "Landlord settlement configuration needs operator review.";
    }
    res.json({ data: { configured, settlementConfigured, provider: "FLUTTERWAVE", networks: ["MTN", "Airtel"], message } });
});

mobileMoneyRoutes.post("/billing/invoices/:id/payment-link", requirePermission("payment:write"), async function(req, res) {
    const orgId = organizationId(req);
    const invoiceId = positiveId(req.params.id, "invoice ID");
    const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, organizationId: orgId }, include: { renter: true } });
    if (!invoice) throw new HttpError(404, "Invoice not found");
    if (!providerConfigured()) throw new HttpError(503, "The payment provider is not configured");
    const subaccountId = configuredSubaccountId(orgId);
    if (!subaccountId) throw new HttpError(503, "This landlord needs an operator-approved settlement account before collecting payments");
    const parsedEmail = emailSchema.safeParse(req.body?.email ?? invoice.renter.email);
    if (!parsedEmail.success) throw new HttpError(400, "Provide a valid payer email or save the renter's email first");
    const requestedAmount = req.body?.amount === undefined ? undefined : wholeUgx(req.body.amount);
    const requestId = randomUUID();
    let redirect: URL;
    try {
        const frontend = process.env.FRONTEND_URL || (process.env.NODE_ENV === "production" ? "" : "http://localhost:5173");
        redirect = new URL("/payment-return", frontend);
        redirect.searchParams.set("reference", requestId);
    } catch { throw new HttpError(503, "The payment return URL is not configured"); }
    await getSubaccount(subaccountId);
    const request = await financialTransaction(async function(tx) {
        const current = await lockedInvoice(tx, orgId, invoiceId);
        const balance = invoiceView(current).outstanding;
        const amount = requestedAmount ?? balance;
        if (current.voidedAt || balance <= 0) throw new HttpError(409, "This invoice has no payable balance");
        if (amount <= 0 || amount > balance) throw new HttpError(409, "Requested payment exceeds the invoice balance");
        return tx.paymentRequest.create({ data: {
            id: requestId, organizationId: orgId, invoiceId,
            amount, currency: "UGX", payerEmail: parsedEmail.data, subaccountId
        } });
    });
    try {
        const checkout = await createCheckout({
            reference: request.id, amount: request.amount, currency: "UGX", email: request.payerEmail,
            name: invoice.renterName, redirectUrl: redirect.toString(), subaccountId: request.subaccountId
        });
        const updated = await prisma.paymentRequest.update({
            where: { id: request.id, organizationId: orgId }, data: { checkoutUrl: checkout.checkoutUrl }
        });
        res.status(201).json({ data: { id: updated.id, ...publicView(updated), checkoutUrl: updated.checkoutUrl } });
    } catch (error) {
        await prisma.paymentRequest.updateMany({ where: { id: request.id, organizationId: orgId, status: { not: "SUCCESS" } }, data: { status: "FAILED" } });
        throw error;
    }
});

/** Only authoritative provider data enters this function. It never sends mail. */
export async function settleVerifiedTransaction(requestId: string, verified: VerifiedTransaction) {
    return financialTransaction(async function(tx) {
        await tx.$queryRaw`SELECT "id" FROM "PaymentRequest" WHERE "id" = ${requestId} FOR UPDATE`;
        const request = await tx.paymentRequest.findUnique({ where: { id: requestId } });
        if (!request) throw new HttpError(404, "Payment request not found");
        if (verified.reference !== request.id || verified.amount !== request.amount || verified.currency !== request.currency) {
            throw new HttpError(409, "The verified transaction does not match this payment request");
        }
        // The official v3 Uganda example labels its UGX webhook "mobilemoneygh".
        // Accept that documented response only with all exact request checks.
        if (!["mobilemoneyuganda", "mobilemoneygh"].includes(verified.paymentType.toLowerCase())) {
            throw new HttpError(409, "The verified transaction is not a Uganda mobile-money payment");
        }
        if (verified.subaccounts !== undefined && (verified.subaccounts.length !== 1 || verified.subaccounts[0]?.id !== request.subaccountId)) {
            throw new HttpError(409, "The verified transaction does not match the landlord settlement account");
        }
        if (request.status === "SUCCESS") return publicView(request);
        if (verified.status !== "successful") {
            const updated = await tx.paymentRequest.update({
                where: { id: request.id, organizationId: request.organizationId, status: { not: "SUCCESS" } },
                data: { status: verified.status === "failed" ? "FAILED" : "PENDING" }
            });
            return publicView(updated);
        }
        const prior = await tx.paymentRequest.findUnique({ where: { providerTransactionId: verified.id } });
        if (prior && prior.id !== request.id) throw new HttpError(409, "This provider transaction was already recorded");
        const invoice = await lockedInvoice(tx, request.organizationId, request.invoiceId);
        const renter = await tx.renter.findFirst({ where: { id: invoice.renterId, organizationId: request.organizationId } });
        if (!renter) throw new HttpError(409, "Invoice ownership needs review");
        const created = await tx.payment.create({ data: {
            renterId: invoice.renterId, amount: verified.amount, paymentDate: new Date(),
            source: "MOBILE_MONEY", payerName: invoice.renterName, issuerName: invoice.organizationName
        } });
        await tx.payment.update({ where: { id: created.id, renter: { organizationId: request.organizationId } }, data: { receiptNumber: `RCP-${created.id}` } });
        const allocationAmount = Math.min(verified.amount, invoiceView(invoice).outstanding);
        if (!invoice.voidedAt && allocationAmount > 0) {
            await tx.paymentAllocation.create({ data: { paymentId: created.id, invoiceId: invoice.id, amount: allocationAmount } });
        }
        const updated = await tx.paymentRequest.update({
            where: { id: request.id, organizationId: request.organizationId },
            data: { status: "SUCCESS", providerTransactionId: verified.id, paymentId: created.id }
        });
        await queueReceipt(tx, request.organizationId, created.id, request.payerEmail);
        return publicView(updated);
    });
}

paymentPublicRoutes.get("/payment-status/:reference", publicLimit, async function(req, res) {
    const id = reference(req.params.reference);
    const request = await prisma.paymentRequest.findUnique({ where: { id }, select: { status: true, amount: true, currency: true } });
    if (!request) throw new HttpError(404, "Payment request not found");
    res.json({ data: publicView(request) });
});

paymentPublicRoutes.post("/payment-status/:reference/confirm", publicLimit, async function(req, res) {
    const id = reference(req.params.reference);
    const request = await prisma.paymentRequest.findUnique({ where: { id } });
    if (!request) throw new HttpError(404, "Payment request not found");
    if (request.status === "SUCCESS") return res.json({ data: publicView(request) });
    const value: unknown = req.body?.transactionId;
    const transactionId = typeof value === "number" || typeof value === "string" ? String(value) : "";
    if (!/^[1-9]\d*$/.test(transactionId) || !Number.isSafeInteger(Number(transactionId))) throw new HttpError(400, "A valid provider transaction ID is required");
    if (!providerConfigured()) throw new HttpError(503, "The payment provider is not configured");
    const now = new Date();
    const updated = await prisma.paymentRequest.updateMany({
        where: { id, status: { not: "SUCCESS" }, OR: [{ lastVerifiedAt: null }, { lastVerifiedAt: { lte: new Date(now.getTime() - VERIFY_COOLDOWN_MS) } }] },
        data: { lastVerifiedAt: now }
    });
    if (updated.count === 0) {
        const current = await prisma.paymentRequest.findUniqueOrThrow({ where: { id } });
        if (current.status === "SUCCESS") return res.json({ data: publicView(current) });
        res.setHeader("Retry-After", "10");
        throw new HttpError(429, "Please wait a few seconds before checking again");
    }
    const verified = await verifyTransaction(transactionId);
    res.json({ data: await settleVerifiedTransaction(id, verified) });
});

paymentPublicRoutes.post("/webhooks/flutterwave", async function(req, res) {
    if (!verifyWebhookSignature(req.rawBody ?? Buffer.alloc(0), req.headers)) throw new HttpError(401, "Invalid webhook signature");
    const data: unknown = req.body?.data;
    if (typeof data !== "object" || data === null || !("tx_ref" in data) || !("id" in data)) {
        return res.status(202).json({ received: true });
    }
    const parsed = uuidSchema.safeParse(data.tx_ref);
    const providerId = typeof data.id === "string" || typeof data.id === "number" ? String(data.id) : "";
    if (!parsed.success || !/^[1-9]\d*$/.test(providerId) || !Number.isSafeInteger(Number(providerId))) return res.status(202).json({ received: true });
    const request = await prisma.paymentRequest.findUnique({ where: { id: parsed.data } });
    if (!request || request.status === "SUCCESS") return res.status(202).json({ received: true });
    const verified = await verifyTransaction(providerId);
    await settleVerifiedTransaction(request.id, verified);
    res.json({ received: true });
});

declare global {
    namespace Express {
        interface Request { rawBody?: Buffer; }
    }
}
