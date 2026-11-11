import { z } from "zod";
import { prisma } from "../prisma";
import { generateMonthlyInvoices, invoiceView, kampalaDate } from "../billing/ledger";

export function kampalaHour(now: Date): number {
    return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Kampala", hour: "2-digit", hourCycle: "h23" }).format(now));
}

export async function scheduleBillingAndReminders(now = new Date()) {
    const today = kampalaDate(now);
    const dateKey = today.toISOString().slice(0, 10);
    const month = dateKey.slice(0, 7);
    const summary = { invoicesCreated: 0, remindersQueued: 0, missingContacts: 0, organizationErrors: 0 };
    const organizations = await prisma.organization.findMany({ where: { OR: [{ monthlyBillingEnabled: true }, { remindersEnabled: true }] } });
    for (const organization of organizations) {
        try {
            if (organization.monthlyBillingEnabled) summary.invoicesCreated += (await generateMonthlyInvoices(organization.id, month)).created;
            if (!organization.remindersEnabled || kampalaHour(now) < 9) continue;
            const invoices = await prisma.invoice.findMany({
                where: { organizationId: organization.id, voidedAt: null, dueDate: { lte: today } },
                include: { renter: true, allocations: { include: { payment: true } } }
            });
            for (const invoice of invoices) {
                if (invoiceView(invoice).outstanding <= 0) continue;
                const daysPastDue = Math.round((today.getTime() - invoice.dueDate.getTime()) / 86_400_000);
                if (daysPastDue < 0 || daysPastDue % 7 !== 0) continue;
                const email = invoice.renter.email;
                const validContact = z.email().max(254).safeParse(email).success;
                const dedupeKey = `reminder:${organization.id}:${invoice.id}:${dateKey}`;
                const created = await prisma.documentDelivery.createMany({ skipDuplicates: true, data: [{
                    organizationId: organization.id, invoiceId: invoice.id, kind: "REMINDER", dedupeKey,
                    recipient: email ?? "", availableAt: now,
                    status: validContact ? "QUEUED" : "SKIPPED",
                    lastError: validContact ? null : "No valid tenant email is configured"
                }] });
                if (validContact) summary.remindersQueued += created.count;
                else summary.missingContacts += created.count;
            }
        } catch {
            // Isolate organizations: a failed legacy lease must not prevent the
            // next landlord's reminders from being scheduled. The command exits
            // nonzero when any organization fails so operators can investigate.
            summary.organizationErrors++;
        }
    }
    return summary;
}
