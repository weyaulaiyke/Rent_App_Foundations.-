import express = require("express");
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError, positiveId } from "../http";
import { organizationId, requirePermission } from "../middleware/organization";
import { mobileMoneyRoutes } from "./mobileMoney";
import {
    allocateInTransaction, createManualPayment, financialTransaction, generateMonthlyInvoices,
    getArrears, getInvoiceViews, invoiceView, lockedInvoice, lockedPayment, paymentView, wholeUgx
} from "./ledger";

export const billingRoutes = express.Router();
const read = requirePermission("finance:read");
const write = requirePermission("payment:write");
const owner = requirePermission("organization:manage");
const reasonSchema = z.string().trim().min(1).max(500);

function reason(value: unknown): string {
    const result = reasonSchema.safeParse(value);
    if (!result.success) throw new HttpError(400, "Provide a reason of 1 to 500 characters");
    return result.data;
}

billingRoutes.use(mobileMoneyRoutes);
billingRoutes.get("/billing/invoices", read, async function(req, res) {
    const month = req.query.month;
    if (month !== undefined && typeof month !== "string") throw new HttpError(400, "Use a month in YYYY-MM format");
    res.json({ data: await getInvoiceViews(organizationId(req), month) });
});
billingRoutes.post("/billing/invoices/generate", write, async function(req, res) {
    const result = z.object({ month: z.string(), dueDate: z.string().optional() }).safeParse(req.body);
    if (!result.success) throw new HttpError(400, "Provide month and optional dueDate");
    res.json({ data: await generateMonthlyInvoices(organizationId(req), result.data.month, result.data.dueDate) });
});
billingRoutes.post("/billing/allocations", write, async function(req, res) {
    const paymentId = positiveId(req.body?.paymentId, "payment ID");
    const invoiceId = positiveId(req.body?.invoiceId, "invoice ID");
    const amount = wholeUgx(req.body?.amount);
    const data = await financialTransaction(tx => allocateInTransaction(tx, organizationId(req), paymentId, invoiceId, amount));
    res.status(201).json({ data });
});
billingRoutes.post("/billing/invoices/:id/void", write, async function(req, res) {
    const orgId = organizationId(req);
    const id = positiveId(req.params.id, "invoice ID");
    const voidReason = reason(req.body?.reason);
    const data = await financialTransaction(async function(tx) {
        const invoice = await lockedInvoice(tx, orgId, id);
        if (invoice.voidedAt) return invoiceView(invoice);
        if (invoiceView(invoice).paid > 0) throw new HttpError(409, "An invoice with effective payments cannot be voided");
        const updated = await tx.invoice.update({
            where: { id, organizationId: orgId }, data: { voidedAt: new Date(), voidReason },
            include: { allocations: { include: { payment: true } } }
        });
        await tx.documentDelivery.updateMany({
            where: { organizationId: orgId, invoiceId: id, status: { in: ["QUEUED", "FAILED"] } },
            data: { status: "SKIPPED", lastError: "Invoice was voided" }
        });
        return invoiceView(updated);
    });
    res.json({ data });
});

billingRoutes.get("/payments", read, async function(req, res) {
    const payments = await prisma.payment.findMany({
        where: { renter: { organizationId: organizationId(req) } },
        include: { renter: true, allocations: { include: { invoice: true } } },
        orderBy: { id: "desc" }
    });
    res.json({ data: payments.map(paymentView) });
});
billingRoutes.post("/payments", write, async function(req, res) {
    const renterId = positiveId(req.body?.renterId, "renter ID");
    const amount = wholeUgx(req.body?.amount);
    const rawDate: unknown = req.body?.paymentDate;
    if (typeof rawDate !== "string" || !rawDate.trim()) throw new HttpError(400, "Valid paymentDate is required");
    const paymentDate = new Date(rawDate);
    if (!Number.isFinite(paymentDate.getTime())) throw new HttpError(400, "Valid paymentDate is required");
    const invoiceId = req.body?.invoiceId === undefined ? undefined : positiveId(req.body.invoiceId, "invoice ID");
    const data = await createManualPayment(organizationId(req), {
        renterId, amount, paymentDate, ...(invoiceId === undefined ? {} : { invoiceId })
    });
    res.status(201).json({ data });
});
billingRoutes.post("/payments/:id/void", write, async function(req, res) {
    const orgId = organizationId(req);
    const id = positiveId(req.params.id, "payment ID");
    const voidReason = reason(req.body?.reason);
    const data = await financialTransaction(async function(tx) {
        const payment = await lockedPayment(tx, orgId, id);
        if (payment.source === "MOBILE_MONEY") throw new HttpError(409, "Mobile-money payments require a real provider refund flow and cannot be voided here");
        if (payment.voidedAt) return paymentView(payment);
        const updated = await tx.payment.update({
            where: { id, renter: { organizationId: orgId } }, data: { voidedAt: new Date(), voidReason },
            include: { allocations: { include: { invoice: true } } }
        });
        await tx.documentDelivery.updateMany({
            where: { organizationId: orgId, paymentId: id, status: { in: ["QUEUED", "FAILED"] } },
            data: { status: "SKIPPED", lastError: "Payment was voided" }
        });
        return paymentView(updated);
    });
    res.json({ data });
});

billingRoutes.patch("/payments/:id", write, async function(req, res) {
    const orgId = organizationId(req);
    const id = positiveId(req.params.id, "payment ID");
    const body: unknown = req.body;
    if (!body || typeof body !== "object") throw new HttpError(400, "Provide amount or paymentDate");
    const changes: { amount?: number; paymentDate?: Date } = {};
    if ("amount" in body) changes.amount = wholeUgx(body.amount);
    if ("paymentDate" in body) {
        if (typeof body.paymentDate !== "string" || !body.paymentDate.trim()) throw new HttpError(400, "Valid paymentDate is required");
        changes.paymentDate = new Date(body.paymentDate);
        if (!Number.isFinite(changes.paymentDate.getTime())) throw new HttpError(400, "Valid paymentDate is required");
    }
    if (Object.keys(changes).length === 0) throw new HttpError(400, "Provide amount or paymentDate");
    const data = await financialTransaction(async function(tx) {
        const payment = await lockedPayment(tx, orgId, id);
        if (payment.source !== "LEGACY" || payment.receiptNumber || payment.allocations.length > 0 || payment.voidedAt) {
            throw new HttpError(409, "Issued or allocated payments are immutable. Use void with a reason instead");
        }
        const deliveries = await tx.documentDelivery.count({ where: { organizationId: orgId, paymentId: id } });
        if (deliveries > 0) throw new HttpError(409, "This payment has issued documents. Use void with a reason instead");
        return tx.payment.update({ where: { id, renter: { organizationId: orgId } }, data: changes });
    });
    res.json({ data });
});
billingRoutes.delete("/payments/:id", write, async function(req, res) {
    const orgId = organizationId(req);
    const id = positiveId(req.params.id, "payment ID");
    await financialTransaction(async function(tx) {
        const payment = await lockedPayment(tx, orgId, id);
        if (payment.source !== "LEGACY" || payment.receiptNumber || payment.allocations.length > 0 || payment.voidedAt) {
            throw new HttpError(409, "Issued or allocated payments are immutable. Use void with a reason instead");
        }
        const deliveries = await tx.documentDelivery.count({ where: { organizationId: orgId, paymentId: id } });
        if (deliveries > 0) throw new HttpError(409, "This payment has issued documents. Use void with a reason instead");
        await tx.payment.delete({ where: { id, renter: { organizationId: orgId } } });
    });
    res.json({ data: { message: "Payment deleted" } });
});

billingRoutes.get("/reports/arrears", read, async function(req, res) {
    res.json({ data: await getArrears(organizationId(req)) });
});

function settingsView(value: { currency: string; timeZone: string; billingDay: number; monthlyBillingEnabled: boolean; remindersEnabled: boolean }) {
    return {
        currency: value.currency, timeZone: value.timeZone, billingDay: value.billingDay,
        monthlyBillingEnabled: value.monthlyBillingEnabled, remindersEnabled: value.remindersEnabled
    };
}
billingRoutes.get("/organization/billing-settings", owner, async function(req, res) {
    const organization = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId(req) } });
    res.json({ data: settingsView(organization) });
});
billingRoutes.patch("/organization/billing-settings", owner, async function(req, res) {
    const result = z.object({
        billingDay: z.number().int().min(1).max(28).optional(),
        monthlyBillingEnabled: z.boolean().optional(), remindersEnabled: z.boolean().optional()
    }).strict().safeParse(req.body);
    if (!result.success || Object.keys(result.data).length === 0) throw new HttpError(400, "Provide billingDay (1–28), monthlyBillingEnabled or remindersEnabled. Currency and timezone are read-only");
    const data = {
        ...(result.data.billingDay === undefined ? {} : { billingDay: result.data.billingDay }),
        ...(result.data.monthlyBillingEnabled === undefined ? {} : { monthlyBillingEnabled: result.data.monthlyBillingEnabled }),
        ...(result.data.remindersEnabled === undefined ? {} : { remindersEnabled: result.data.remindersEnabled })
    };
    const organization = await prisma.organization.update({
        where: { id: organizationId(req), memberships: { some: { userId: req.userId!, role: "OWNER" } } }, data
    });
    res.json({ data: settingsView(organization) });
});
