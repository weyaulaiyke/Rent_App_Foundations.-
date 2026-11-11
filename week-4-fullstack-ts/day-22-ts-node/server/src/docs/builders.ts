import type { DocumentDelivery } from "@prisma/client";
import { prisma } from "../prisma";
import { HttpError } from "../http";
import { financialTransaction, getArrears, invoiceView, lockedPayment, parseMonth } from "../billing/ledger";
import { calendarDate, money, paymentCalendarDate, renderPdf, safeFilename, type DocumentRow } from "./pdf";

export type BuiltDocument = { filename: string; content: Buffer; subject: string; summary: string };
export type FinancialReportType = "collections" | "arrears";

export async function findInvoice(organizationId: number, id: number) {
    const invoice = await prisma.invoice.findFirst({
        where: { id, organizationId },
        include: { renter: true, allocations: { include: { payment: true } } }
    });
    if (!invoice) throw new HttpError(404, "Invoice not found");
    return invoice;
}

export async function findPayment(organizationId: number, id: number) {
    const payment = await prisma.payment.findFirst({
        where: { id, renter: { organizationId } },
        include: { renter: true, allocations: { include: { invoice: true } } }
    });
    if (!payment) throw new HttpError(404, "Payment not found");
    return payment;
}

// Issuing an old receipt makes its original payment immutable under the ledger's
// edit guards. The row lock also serializes against a concurrent payment edit.
export async function issueReceipt(organizationId: number, id: number) {
    return financialTransaction(async function(tx) {
        const payment = await lockedPayment(tx, organizationId, id);
        if (payment.amount <= 0) throw new HttpError(409, "A positive settled payment is required for a receipt");
        if (!payment.receiptNumber) {
            const renter = await tx.renter.findFirstOrThrow({ where: { id: payment.renterId, organizationId } });
            const organization = await tx.organization.findUniqueOrThrow({ where: { id: organizationId } });
            await tx.payment.update({
                where: { id, renter: { organizationId } },
                data: { receiptNumber: `RCP-${id}`, payerName: payment.payerName ?? renter.name, issuerName: payment.issuerName ?? organization.name }
            });
        }
        return tx.payment.findFirstOrThrow({
            where: { id, renter: { organizationId } },
            include: { renter: true, allocations: { include: { invoice: true } } }
        });
    });
}

export async function invoiceDocument(organizationId: number, id: number, reminder = false): Promise<BuiltDocument> {
    const invoice = await findInvoice(organizationId, id);
    const view = invoiceView(invoice);
    const rows: DocumentRow[] = [
        { label: "Tenant", value: invoice.renterName },
        { label: "Property / unit", value: `${invoice.propertyName} / ${invoice.unitNumber}` },
        { label: "Rental month", value: invoice.periodStart.toISOString().slice(0, 7) },
        { label: "Due date", value: calendarDate(invoice.dueDate) },
        { label: "Invoice amount", value: money(invoice.amount, invoice.currency) },
        { label: "Payments allocated", value: money(view.paid, invoice.currency) },
        { label: "Outstanding balance", value: money(view.outstanding, invoice.currency) },
        { label: "Status", value: view.status }
    ];
    if (invoice.voidedAt) rows.push({ label: "Void reason", value: invoice.voidReason ?? "Voided" });
    const title = reminder ? "Rent payment reminder" : "Rent invoice";
    return {
        filename: `${safeFilename(invoice.number)}.pdf`,
        subject: `${title}: ${invoice.number}`,
        summary: `${invoice.organizationName}: ${invoice.number} has an outstanding balance of ${money(view.outstanding, invoice.currency)}. Due ${calendarDate(invoice.dueDate)}.`,
        content: await renderPdf({ title, organization: invoice.organizationName, number: invoice.number, rows,
            note: "Balances reflect allocations recorded when this document was generated. An invoice is not a payment receipt." })
    };
}

export async function receiptDocument(organizationId: number, id: number): Promise<BuiltDocument> {
    const payment = await issueReceipt(organizationId, id);
    const allocations = payment.allocations.filter(allocation => allocation.invoice.organizationId === organizationId);
    const allocated = payment.voidedAt ? 0 : allocations.reduce((sum, allocation) => sum + (allocation.invoice.voidedAt ? 0 : allocation.amount), 0);
    const rows: DocumentRow[] = [
        { label: "Received from", value: payment.payerName ?? payment.renter.name },
        { label: "Payment date", value: paymentCalendarDate(payment.paymentDate) },
        { label: "Amount received", value: money(payment.amount) },
        { label: "Payment method", value: payment.source === "MOBILE_MONEY" ? "Mobile money (provider verified)" : payment.source === "MANUAL" ? "Manually recorded payment" : "Historical recorded payment" },
        { label: "Status", value: payment.voidedAt ? "VOID — no longer an effective payment" : "RECORDED" },
        { label: "Allocated to rent", value: money(allocated) },
        { label: "Unallocated credit", value: money(payment.voidedAt ? 0 : Math.max(0, payment.amount - allocated)) }
    ];
    for (const allocation of allocations) rows.push({ label: allocation.invoice.number, value: `${money(allocation.amount)}${allocation.invoice.voidedAt ? " (invoice void)" : ""}` });
    if (payment.voidedAt) rows.push({ label: "Void reason", value: payment.voidReason ?? "Voided" });
    const number = payment.receiptNumber!;
    const organization = payment.issuerName ?? (await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })).name;
    return {
        filename: `${safeFilename(number)}.pdf`, subject: `${payment.voidedAt ? "VOID " : ""}Rent receipt: ${number}`,
        summary: `${organization}: ${number}, ${money(payment.amount)} recorded on ${paymentCalendarDate(payment.paymentDate)}.${payment.voidedAt ? " This payment has been voided." : ""}`,
        content: await renderPdf({ title: payment.voidedAt ? "VOID payment receipt" : "Payment receipt", organization, number, rows,
            note: "A manually recorded or historical payment is confirmed by the issuing organization. Only provider-verified mobile-money payments are labelled as such." })
    };
}

export async function reportDocument(organizationId: number, type: FinancialReportType, month: string): Promise<BuiltDocument> {
    const start = parseMonth(month);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) throw new HttpError(404, "Organization not found");
    const rows: DocumentRow[] = [];
    let total = 0;
    if (type === "collections") {
        // Payments are timestamps, unlike invoice @db.Date calendar fields.
        // Uganda has a fixed UTC+03 offset and no daylight saving changes.
        const localStart = new Date(start.getTime() - 3 * 60 * 60_000);
        const localEnd = new Date(end.getTime() - 3 * 60 * 60_000);
        const payments = await prisma.payment.findMany({
            where: { renter: { organizationId }, voidedAt: null, amount: { gt: 0 }, paymentDate: { gte: localStart, lt: localEnd } },
            include: { renter: true }, orderBy: [{ paymentDate: "asc" }, { id: "asc" }]
        });
        for (const payment of payments) {
            total += payment.amount;
            rows.push({ label: `${payment.receiptNumber ?? `Payment ${payment.id}`} · ${paymentCalendarDate(payment.paymentDate)}`,
                value: `${payment.payerName ?? payment.renter.name}\n${money(payment.amount)} · ${payment.source.replaceAll("_", " ")}` });
        }
    } else {
        // Current balances of invoices due through the selected month. This is
        // explicitly not a historical reconstruction before later payments.
        const asOf = new Date(end.getTime() - 3 * 60 * 60_000 - 1);
        const arrears = await getArrears(organizationId, asOf);
        for (const entry of arrears) {
            total += entry.arrears;
            rows.push({ label: `${entry.renter}\n${entry.property} / ${entry.unit}`,
                value: `Invoiced ${money(entry.invoicedAmount)}\nAllocated ${money(entry.totalPaid)}\nOutstanding ${money(entry.arrears)}` });
        }
    }
    rows.unshift({ label: type === "collections" ? "Total rent collected" : "Total outstanding", value: money(total) });
    if (rows.length === 1) rows.push({ label: "Records", value: "No matching records" });
    const title = type === "collections" ? "Rent collection report" : "Rent arrears report";
    return {
        filename: `REMOTE-${type}-${month}.pdf`, subject: `${title}: ${month}`,
        summary: `${organization.name}: ${title.toLowerCase()} for ${month}. Total ${money(total)}.`,
        content: await renderPdf({ title, organization: organization.name, subtitle: `Month: ${month} · Generated ${paymentCalendarDate(new Date())}`, rows,
            note: type === "arrears" ? "Shows current outstanding balances of invoices due through the end of this month. Later allocations are included. Voided invoices and payments do not contribute." : "Includes positive recorded payments dated within this month; voided payments are excluded. Historical records remain identified as LEGACY." })
    };
}

export async function buildDeliveryDocument(job: DocumentDelivery): Promise<BuiltDocument> {
    if ((job.kind === "INVOICE" || job.kind === "REMINDER") && job.invoiceId !== null) return invoiceDocument(job.organizationId, job.invoiceId, job.kind === "REMINDER");
    if (job.kind === "RECEIPT" && job.paymentId !== null) return receiptDocument(job.organizationId, job.paymentId);
    if (job.kind === "REPORT" && (job.reportType === "collections" || job.reportType === "arrears") && job.reportMonth) return reportDocument(job.organizationId, job.reportType, job.reportMonth);
    throw new HttpError(409, "The document delivery has an invalid target");
}
