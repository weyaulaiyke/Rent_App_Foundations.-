import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "./prisma";
import { HttpError, positiveId } from "./http";
import { organizationId, requirePermission } from "./middleware/organization";
import { assertMailConfigured } from "./mail";
import { parseMonth } from "./billing/ledger";
import { findInvoice, findPayment, invoiceDocument, issueReceipt, receiptDocument, reportDocument, type BuiltDocument } from "./docs/builders";
import { deliveryView, manualDeliveryKey, queueDocumentDelivery, runDeliveryJob } from "./jobs/worker";
import type { DocumentDelivery } from "@prisma/client";

export const documentRoutes = Router();
const optionalRecipient = z.object({ email: z.email().max(254).optional() });
const reportInput = z.object({ type: z.enum(["collections", "arrears"]), month: z.string(), email: z.email().max(254) });
const reportQuery = z.object({ type: z.enum(["collections", "arrears"]), month: z.string() });

function parse<T>(schema: z.ZodType<T>, input: unknown, message: string): T {
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new HttpError(400, message);
    return parsed.data;
}
function recipient(input: string | undefined, fallback: string | null): string {
    const email = input ?? fallback;
    if (!z.email().max(254).safeParse(email).success) throw new HttpError(400, "Add a valid tenant email or provide a recipient email");
    return email!;
}
function pdfResponse(res: Response, document: BuiltDocument) {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${document.filename}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(document.content);
}
function deliveryResponse(res: Response, job: DocumentDelivery) {
    const data = deliveryView(job);
    if (job.status === "SENT") return res.status(200).json({ data, message: "The email provider accepted the document for delivery." });
    if (job.status === "FAILED") return res.status(503).json({ data, error: "Email delivery failed. Review the delivery status before sending again." });
    if (job.status === "SKIPPED") return res.status(200).json({ data, message: "Delivery was skipped because this document is no longer eligible." });
    return res.status(202).json({ data, message: "The document is queued for delivery. Check its delivery status for the outcome." });
}

documentRoutes.get("/billing/invoices/:id/pdf", requirePermission("finance:read"), async (req, res) => {
    pdfResponse(res, await invoiceDocument(organizationId(req), positiveId(req.params.id, "invoice ID")));
});
documentRoutes.get("/payments/:id/receipt.pdf", requirePermission("finance:read"), async (req, res) => {
    pdfResponse(res, await receiptDocument(organizationId(req), positiveId(req.params.id, "payment ID")));
});
documentRoutes.get("/reports/financial.pdf", requirePermission("finance:read"), async (req, res) => {
    const input = parse(reportQuery, req.query, "A report type (collections or arrears) and month are required");
    parseMonth(input.month);
    pdfResponse(res, await reportDocument(organizationId(req), input.type, input.month));
});

documentRoutes.post("/billing/invoices/:id/send", requirePermission("payment:write"), async (req, res) => {
    const orgId = organizationId(req);
    const invoice = await findInvoice(orgId, positiveId(req.params.id, "invoice ID"));
    const input = parse(optionalRecipient, req.body ?? {}, "Provide a valid recipient email");
    const email = recipient(input.email, invoice.renter.email);
    assertMailConfigured();
    const job = await queueDocumentDelivery({ organizationId: orgId, invoiceId: invoice.id, kind: "INVOICE", recipient: email,
        dedupeKey: manualDeliveryKey(orgId, "INVOICE", String(invoice.id), email) });
    deliveryResponse(res, await runDeliveryJob(job.id, orgId));
});
documentRoutes.post("/payments/:id/send-receipt", requirePermission("payment:write"), async (req, res) => {
    const orgId = organizationId(req);
    const payment = await findPayment(orgId, positiveId(req.params.id, "payment ID"));
    if (payment.voidedAt || payment.amount <= 0) throw new HttpError(409, "A positive, nonvoided settled payment is required to send a receipt");
    const input = parse(optionalRecipient, req.body ?? {}, "Provide a valid recipient email");
    const email = recipient(input.email, payment.renter.email);
    assertMailConfigured();
    await issueReceipt(orgId, payment.id);
    const job = await queueDocumentDelivery({ organizationId: orgId, paymentId: payment.id, kind: "RECEIPT", recipient: email,
        dedupeKey: manualDeliveryKey(orgId, "RECEIPT", String(payment.id), email) });
    deliveryResponse(res, await runDeliveryJob(job.id, orgId));
});
documentRoutes.post("/reports/send", requirePermission("payment:write"), async (req, res) => {
    const orgId = organizationId(req);
    const input = parse(reportInput, req.body, "Provide report type (collections or arrears), month and a valid email");
    parseMonth(input.month);
    assertMailConfigured();
    const job = await queueDocumentDelivery({ organizationId: orgId, kind: "REPORT", recipient: input.email,
        reportMonth: input.month, reportType: input.type,
        dedupeKey: manualDeliveryKey(orgId, "REPORT", `${input.type}:${input.month}`, input.email) });
    deliveryResponse(res, await runDeliveryJob(job.id, orgId));
});
documentRoutes.get("/billing/deliveries", requirePermission("finance:read"), async (req, res) => {
    const jobs = await prisma.documentDelivery.findMany({ where: { organizationId: organizationId(req) }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 });
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ data: jobs.map(deliveryView) });
});
