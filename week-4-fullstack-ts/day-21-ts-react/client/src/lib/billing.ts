export type Invoice = {
    id: number; number: string; leaseId: number; renterId: number; renterName: string;
    propertyName: string; unitNumber: string; periodStart: string; dueDate: string;
    amount: number; currency: string; paid: number; outstanding: number;
    status: "PAID" | "PARTIAL" | "UNPAID" | "VOID";
};
export type LedgerPayment = {
    id: number; renterId: number; amount: number; paymentDate: string;
    source?: "LEGACY" | "MANUAL" | "MOBILE_MONEY";
    receiptNumber?: string | null; allocatedAmount?: number; unallocatedAmount?: number;
    payerName?: string | null; issuerName?: string | null;
    voidedAt?: string | null; voidReason?: string | null;
};
export type RenterContact = { id: number; name: string; email?: string | null; phone?: string | null };
export type ProviderStatus = {
    configured: boolean; settlementConfigured: boolean; provider: string; networks: string[]; message: string;
};
export type BillingSettings = {
    billingDay: number; monthlyBillingEnabled: boolean; remindersEnabled: boolean;
    currency: string; timeZone: string;
};
export type Delivery = {
    id: string; kind: string; status: "QUEUED" | "SENDING" | "SENT" | "FAILED" | "SKIPPED";
    recipient: string; attempts: number; availableAt?: string; sentAt?: string | null; lastError?: string | null;
};
export function ugx(amount: number) { return `UGX ${Number(amount).toLocaleString("en-UG")}`; }
export function billingDate(value: string) {
    return new Date(value).toLocaleDateString("en-UG", { timeZone: "Africa/Kampala" });
}
export function currentMonth(date: Date = new Date()) {
    const parts = new Intl.DateTimeFormat("en", { timeZone: "Africa/Kampala", year: "numeric", month: "2-digit" }).formatToParts(date);
    return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}
export function wholeUgx(value: string) {
    const amount = Number(value);
    return Number.isSafeInteger(amount) && amount > 0 && amount <= 2147483647 ? amount : null;
}
export function availableCredit(payment: LedgerPayment) {
    return payment.voidedAt ? 0 : Number(payment.unallocatedAmount ?? (Number(payment.amount) - Number(payment.allocatedAmount ?? 0)));
}
