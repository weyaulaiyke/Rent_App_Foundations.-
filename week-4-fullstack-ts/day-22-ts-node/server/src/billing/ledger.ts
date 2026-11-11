import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { HttpError } from "../http";

export const MAX_UGX = 2147483647;
export type InvoiceWithPayments = Prisma.InvoiceGetPayload<{ include: { allocations: { include: { payment: true } } } }>;
export type PaymentWithAllocations = Prisma.PaymentGetPayload<{ include: { allocations: { include: { invoice: true } } } }>;

export function wholeUgx(value: unknown, label = "amount"): number {
    const parsed = typeof value === "number" ? value
        : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
    if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > MAX_UGX) {
        throw new HttpError(400, `${label} must be a positive whole UGX amount`);
    }
    return parsed;
}

export function parseMonth(month: string): Date {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0, 4)) < 1900) {
        throw new HttpError(400, "Use a valid month in YYYY-MM format");
    }
    return new Date(`${month}-01T00:00:00.000Z`);
}

export function parseDate(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HttpError(400, "Use a valid date in YYYY-MM-DD format");
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw new HttpError(400, "Use a valid date in YYYY-MM-DD format");
    }
    return date;
}

export function kampalaDate(now = new Date()): Date {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Kampala", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(now);
    const value = (type: string) => parts.find(part => part.type === type)!.value;
    return parseDate(`${value("year")}-${value("month")}-${value("day")}`);
}

export function invoiceView(invoice: InvoiceWithPayments) {
    const paid = invoice.allocations.reduce((sum, allocation) => sum + (allocation.payment.voidedAt ? 0 : allocation.amount), 0);
    const outstanding = invoice.voidedAt ? 0 : Math.max(0, invoice.amount - paid);
    const status = invoice.voidedAt ? "VOID" : outstanding === 0 ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";
    return {
        id: invoice.id, number: invoice.number, leaseId: invoice.leaseId,
        renterId: invoice.renterId, renterName: invoice.renterName,
        propertyName: invoice.propertyName, unitNumber: invoice.unitNumber,
        organizationName: invoice.organizationName,
        periodStart: invoice.periodStart, dueDate: invoice.dueDate,
        amount: invoice.amount, currency: invoice.currency,
        paid, outstanding, status, voidedAt: invoice.voidedAt, voidReason: invoice.voidReason
    };
}

export function paymentView(payment: PaymentWithAllocations) {
    const allocatedAmount = payment.voidedAt ? 0 : payment.allocations.reduce(
        (sum, allocation) => sum + (allocation.invoice.voidedAt ? 0 : allocation.amount), 0
    );
    const { allocations: _allocations, ...original } = payment;
    return { ...original, allocatedAmount, unallocatedAmount: payment.voidedAt ? 0 : Math.max(0, payment.amount - allocatedAmount) };
}

export async function getInvoiceViews(organizationId: number, month?: string) {
    const periodStart = month === undefined ? undefined : parseMonth(month);
    const invoices = await prisma.invoice.findMany({
        where: { organizationId, ...(periodStart === undefined ? {} : { periodStart }) },
        include: { allocations: { include: { payment: true } } },
        orderBy: [{ periodStart: "desc" }, { id: "desc" }]
    });
    return invoices.map(invoiceView);
}

export async function generateMonthlyInvoices(organizationId: number, month: string, dueDate?: string) {
    const periodStart = parseMonth(month);
    const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) throw new HttpError(404, "Organization not found");
    const due = dueDate === undefined
        ? parseDate(`${month}-${String(organization.billingDay).padStart(2, "0")}`)
        : parseDate(dueDate);
    const leases = await prisma.lease.findMany({
        where: { renter: { organizationId, isArchived: false }, unit: { property: { organizationId } } },
        include: { renter: true, unit: { include: { property: true } } }
    });
    for (const lease of leases) wholeUgx(lease.monthlyRent, "Monthly rent");
    if (leases.length === 0) return { created: 0, existing: 0 };
    const created = await prisma.invoice.createMany({
        skipDuplicates: true,
        data: leases.map(lease => ({
            organizationId, leaseId: lease.id, renterId: lease.renterId,
            number: `INV-${month.replace("-", "")}-${lease.id}`,
            periodStart, dueDate: due, amount: lease.monthlyRent, currency: "UGX",
            renterName: lease.renter.name, propertyName: lease.unit.property.name,
            unitNumber: lease.unit.number, organizationName: organization.name
        }))
    });
    return { created: created.count, existing: leases.length - created.count };
}

export async function financialTransaction<T>(action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt++) {
        try {
            return await prisma.$transaction(action, {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
                timeout: 10_000
            });
        } catch (error: unknown) {
            if (!(error instanceof Prisma.PrismaClientKnownRequestError)) throw error;
            // Prisma 5 wraps PostgreSQL failures from SELECT ... FOR UPDATE in
            // P2010 rather than its usual P2034 transaction-conflict error.
            // Retry only the two PostgreSQL transaction-conflict SQLSTATEs.
            const rawConflict = error.code === "P2010" &&
                (error.meta?.code === "40001" || error.meta?.code === "40P01");
            if (error.code !== "P2034" && !rawConflict) throw error;
            if (attempt === 3) throw new HttpError(409, "Financial records changed concurrently. Please try again");
        }
    }
    throw new HttpError(409, "Financial records changed concurrently. Please try again");
}

export async function lockedInvoice(tx: Prisma.TransactionClient, organizationId: number, invoiceId: number) {
    await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} AND "organizationId" = ${organizationId} FOR UPDATE`;
    const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, organizationId },
        include: { allocations: { include: { payment: true } } }
    });
    if (!invoice) throw new HttpError(404, "Invoice not found");
    return invoice;
}

export async function lockedPayment(tx: Prisma.TransactionClient, organizationId: number, paymentId: number) {
    await tx.$queryRaw`SELECT p."id" FROM "Payment" p JOIN "Renter" r ON r."id" = p."renterId" WHERE p."id" = ${paymentId} AND r."organizationId" = ${organizationId} FOR UPDATE OF p`;
    const payment = await tx.payment.findFirst({
        where: { id: paymentId, renter: { organizationId } },
        include: { allocations: { include: { invoice: true } } }
    });
    if (!payment) throw new HttpError(404, "Payment not found");
    return payment;
}

export async function allocateInTransaction(tx: Prisma.TransactionClient, organizationId: number, paymentId: number, invoiceId: number, amount: number) {
    wholeUgx(amount);
    const invoice = await lockedInvoice(tx, organizationId, invoiceId);
    const payment = await lockedPayment(tx, organizationId, paymentId);
    if (invoice.voidedAt || payment.voidedAt) throw new HttpError(409, "Voided records cannot receive allocations");
    if (invoice.renterId !== payment.renterId) throw new HttpError(409, "Payment and invoice must belong to the same renter");
    if (amount > invoiceView(invoice).outstanding || amount > paymentView(payment).unallocatedAmount) {
        throw new HttpError(409, "Allocation exceeds the invoice balance or available payment credit");
    }
    return tx.paymentAllocation.upsert({
        where: { paymentId_invoiceId: { paymentId, invoiceId } },
        create: { paymentId, invoiceId, amount },
        update: { amount: { increment: amount } }
    });
}

export async function queueReceipt(tx: Prisma.TransactionClient, organizationId: number, paymentId: number, recipient: string | null | undefined) {
    if (!recipient) return;
    await tx.documentDelivery.upsert({
        where: { dedupeKey: `receipt:${paymentId}` },
        update: {},
        create: { organizationId, paymentId, kind: "RECEIPT", recipient, dedupeKey: `receipt:${paymentId}` }
    });
}

export async function createManualPayment(organizationId: number, input: { renterId: number; amount: number; paymentDate: Date; invoiceId?: number }) {
    wholeUgx(input.amount);
    return financialTransaction(async function(tx) {
        const renter = await tx.renter.findFirst({
            where: {
                id: input.renterId, organizationId,
                leases: { some: { renter: { organizationId }, unit: { property: { organizationId } } } }
            }
        });
        if (!renter) throw new HttpError(404, "Renter with a lease in this organization not found");
        const organization = await tx.organization.findUniqueOrThrow({ where: { id: organizationId } });
        if (input.invoiceId !== undefined) {
            const invoice = await lockedInvoice(tx, organizationId, input.invoiceId);
            if (invoice.renterId !== renter.id || invoice.voidedAt) throw new HttpError(409, "Choose a valid invoice for this renter");
        }
        const created = await tx.payment.create({
            data: {
                renterId: renter.id, amount: input.amount, paymentDate: input.paymentDate,
                source: "MANUAL", payerName: renter.name, issuerName: organization.name
            }
        });
        await tx.payment.update({ where: { id: created.id, renter: { organizationId } }, data: { receiptNumber: `RCP-${created.id}` } });
        if (input.invoiceId !== undefined) {
            const invoice = await lockedInvoice(tx, organizationId, input.invoiceId);
            const amount = Math.min(input.amount, invoiceView(invoice).outstanding);
            if (amount > 0) await allocateInTransaction(tx, organizationId, created.id, invoice.id, amount);
        }
        await queueReceipt(tx, organizationId, created.id, renter.email);
        return paymentView(await tx.payment.findFirstOrThrow({
            where: { id: created.id, renter: { organizationId } },
            include: { allocations: { include: { invoice: true } } }
        }));
    });
}

export async function getArrears(organizationId: number, now = new Date()) {
    const invoices = await prisma.invoice.findMany({
        where: { organizationId, voidedAt: null, dueDate: { lte: kampalaDate(now) } },
        include: { allocations: { include: { payment: true } } },
        orderBy: { id: "asc" }
    });
    const groups = new Map<number, {
        leaseId: number; renterId: number; renter: string; property: string; unit: string;
        monthlyRent: number; invoicedAmount: number; totalPaid: number; arrears: number; overdueInvoiceCount: number;
    }>();
    for (const invoice of invoices) {
        const view = invoiceView(invoice);
        const group = groups.get(invoice.leaseId) ?? {
            leaseId: invoice.leaseId, renterId: invoice.renterId, renter: invoice.renterName,
            property: invoice.propertyName, unit: invoice.unitNumber,
            monthlyRent: 0, invoicedAmount: 0, totalPaid: 0, arrears: 0, overdueInvoiceCount: 0
        };
        group.monthlyRent += invoice.amount;
        group.invoicedAmount += invoice.amount;
        group.totalPaid += view.paid;
        group.arrears += view.outstanding;
        if (view.outstanding > 0) group.overdueInvoiceCount++;
        groups.set(invoice.leaseId, group);
    }
    return [...groups.values()].filter(group => group.arrears > 0);
}
