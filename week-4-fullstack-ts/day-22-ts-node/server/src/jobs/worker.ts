import { createHash } from "node:crypto";
import type { DocumentDelivery, DocumentKind, Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { HttpError } from "../http";
import { invoiceView, kampalaDate } from "../billing/ledger";
import { assertMailConfigured, escapeHtml, sendTransactionalEmail } from "../mail";
import { buildDeliveryDocument, findInvoice, findPayment } from "../docs/builders";
import { kampalaHour } from "./scheduler";

const MAX_ATTEMPTS = 4;
const CLAIM_LEASE_MS = 2 * 60_000;
// Brevo's older transactional API documentation guarantees a 15 minute window.
// Stop uncertain retries within that conservative window, even if newer API
// documentation offers a longer window. A human can review final failures.
const IDEMPOTENCY_WINDOW_MS = 15 * 60_000;

export function deliveryView(job: DocumentDelivery) {
    return { id: job.id, kind: job.kind, status: job.status, recipient: job.recipient,
        attempts: job.attempts, availableAt: job.availableAt, sentAt: job.sentAt, lastError: job.lastError,
        createdAt: job.createdAt, invoiceId: job.invoiceId, paymentId: job.paymentId };
}

export function manualDeliveryKey(organizationId: number, kind: DocumentKind, target: string, recipient: string, now = new Date()): string {
    const digest = createHash("sha256").update(`${organizationId}:${kind}:${target}:${recipient.toLowerCase()}:${Math.floor(now.getTime() / 60_000)}`).digest("hex");
    return `manual:${digest}`;
}

export async function queueDocumentDelivery(input: {
    organizationId: number; kind: DocumentKind; recipient: string; dedupeKey: string;
    invoiceId?: number; paymentId?: number; reportMonth?: string; reportType?: string;
}) {
    return prisma.documentDelivery.upsert({ where: { dedupeKey: input.dedupeKey }, update: {}, create: input });
}

function frontendLink(): string {
    try {
        const url = new URL(process.env.FRONTEND_URL ?? "");
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "";
        return `<p><a href="${escapeHtml(new URL("/login", url).href)}">Open REMOTE</a></p>`;
    } catch { return ""; }
}

async function eligibility(job: DocumentDelivery, now: Date): Promise<string | null> {
    if (job.kind === "REMINDER") {
        if (job.invoiceId === null) return "The reminder has no invoice";
        const invoice = await findInvoice(job.organizationId, job.invoiceId);
        const organization = await prisma.organization.findUnique({ where: { id: job.organizationId } });
        if (!organization?.remindersEnabled) return "Automatic rent reminders are disabled";
        const scheduledDate = /^reminder:\d+:\d+:(\d{4}-\d{2}-\d{2})$/.exec(job.dedupeKey)?.[1];
        if (scheduledDate && scheduledDate !== kampalaDate(now).toISOString().slice(0, 10)) return "The scheduled reminder day has passed";
        if (invoiceView(invoice).outstanding === 0) return "The invoice is paid or void";
        if (invoice.dueDate > kampalaDate(now)) return "The invoice is not due";
        if (!invoice.renter.email || invoice.renter.email.toLowerCase() !== job.recipient.toLowerCase()) return "The tenant contact has changed or is missing";
    } else if (job.kind === "RECEIPT") {
        if (job.paymentId === null) return "The receipt has no payment";
        const payment = await findPayment(job.organizationId, job.paymentId);
        if (payment.voidedAt || payment.amount <= 0) return "The payment is void or is not a positive settled payment";
    } else if (job.kind === "INVOICE") {
        if (job.invoiceId === null) return "The delivery has no invoice";
        await findInvoice(job.organizationId, job.invoiceId);
    }
    return null;
}

export async function runDeliveryJob(id: string, organizationId?: number, now = new Date()) {
    const where = { id, ...(organizationId === undefined ? {} : { organizationId }) };
    let job = await prisma.documentDelivery.findFirst({ where });
    if (!job) throw new HttpError(404, "Document delivery not found");
    if (["SENT", "FAILED", "SKIPPED"].includes(job.status)) return job;
    if (job.status === "SENDING" && job.claimedAt && job.claimedAt.getTime() > now.getTime() - CLAIM_LEASE_MS) return job;
    if (job.status === "QUEUED" && job.availableAt > now) return job;
    if ((job.firstAttemptAt && now.getTime() - job.firstAttemptAt.getTime() >= IDEMPOTENCY_WINDOW_MS) || job.attempts >= MAX_ATTEMPTS) {
        await prisma.documentDelivery.updateMany({
            where: { ...where, status: job.status, claimedAt: job.claimedAt },
            data: { status: "FAILED", claimedAt: null, lastError: "Delivery confirmation is uncertain or retry limit was reached. Review with the email provider before sending again." }
        });
        return prisma.documentDelivery.findFirstOrThrow({ where });
    }
    if (job.kind === "REMINDER" && kampalaHour(now) < 9) {
        await prisma.documentDelivery.updateMany({
            where: { ...where, status: job.status, claimedAt: job.claimedAt, attempts: job.attempts },
            data: { status: "QUEUED", claimedAt: null, availableAt: new Date(kampalaDate(now).getTime() + 6 * 60 * 60_000) }
        });
        return prisma.documentDelivery.findFirstOrThrow({ where });
    }
    // Missing operator configuration keeps durable automatic jobs queued. It
    // must neither consume attempts nor become an invented successful send.
    try { assertMailConfigured(); } catch (error) {
        if (error instanceof HttpError && error.status === 503) {
            await prisma.documentDelivery.updateMany({
                where: { ...where, status: job.status, claimedAt: job.claimedAt, attempts: job.attempts },
                data: { status: "QUEUED", claimedAt: null, lastError: "Email delivery is not configured. The job remains queued without a send attempt." }
            });
            return prisma.documentDelivery.findFirstOrThrow({ where });
        }
        throw error;
    }
    const firstAttemptAt = job.firstAttemptAt ?? now;
    const claimed = await prisma.documentDelivery.updateMany({
        where: { ...where, status: job.status, claimedAt: job.claimedAt, attempts: job.attempts },
        data: { status: "SENDING", claimedAt: now, firstAttemptAt, attempts: { increment: 1 }, lastError: null }
    });
    if (claimed.count === 0) return prisma.documentDelivery.findFirstOrThrow({ where });
    job = await prisma.documentDelivery.findFirstOrThrow({ where });
    // Every completion uses this claim token so a stale process cannot replace
    // another worker's result after its lease has been reclaimed.
    const claim: Prisma.DocumentDeliveryWhereInput = { ...where, status: "SENDING", claimedAt: now, attempts: job.attempts };
    try {
        const skipReason = await eligibility(job, now);
        if (skipReason) {
            await prisma.documentDelivery.updateMany({ where: claim, data: { status: "SKIPPED", claimedAt: null, lastError: skipReason } });
        } else {
            const built = await buildDeliveryDocument(job);
            await sendTransactionalEmail({ recipient: job.recipient, subject: built.subject,
                html: `<p>${escapeHtml(built.summary)}</p><p>Your PDF document is attached.</p>${frontendLink()}`,
                idempotencyKey: job.id, attachments: [{ name: built.filename, content: built.content }] });
            await prisma.documentDelivery.updateMany({ where: claim, data: { status: "SENT", sentAt: new Date(), claimedAt: null, lastError: null } });
        }
    } catch (error) {
        const delay = 60_000 * 2 ** (job.attempts - 1);
        const retryAt = new Date(now.getTime() + delay);
        const canRetry = job.attempts < MAX_ATTEMPTS && retryAt.getTime() - firstAttemptAt.getTime() < IDEMPOTENCY_WINDOW_MS;
        const missingTarget = error instanceof HttpError && [404, 409].includes(error.status);
        await prisma.documentDelivery.updateMany({ where: claim, data: {
            status: missingTarget ? "SKIPPED" : canRetry ? "QUEUED" : "FAILED", claimedAt: null,
            availableAt: retryAt,
            lastError: missingTarget ? "The document is no longer available for delivery" : "The email provider could not confirm delivery. A bounded retry will be attempted if eligible."
        } });
    }
    return prisma.documentDelivery.findFirstOrThrow({ where });
}

export async function processDeliveryQueue(limit = 25, now = new Date()) {
    const jobs = await prisma.documentDelivery.findMany({
        where: { OR: [
            { status: "QUEUED", availableAt: { lte: now } },
            { status: "SENDING", claimedAt: { lte: new Date(now.getTime() - CLAIM_LEASE_MS) } }
        ] }, orderBy: { availableAt: "asc" }, take: Math.min(100, Math.max(1, Math.floor(limit)))
    });
    const results = [];
    for (const job of jobs) results.push(deliveryView(await runDeliveryJob(job.id, job.organizationId, now)));
    return results;
}
