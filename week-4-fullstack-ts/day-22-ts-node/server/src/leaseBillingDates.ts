export function getLeaseBillingDates(firstRentDueOn: Date, monthsAfterFirst: number) {
    if (!Number.isFinite(firstRentDueOn.getTime())) {
        throw new Error("A valid first rent due date is required.");
    }

    if (!Number.isSafeInteger(monthsAfterFirst) || monthsAfterFirst < 0) {
        throw new Error("The month offset must be a nonnegative whole number.");
    }

    const billingMonth = new Date(firstRentDueOn);
    billingMonth.setUTCHours(0, 0, 0, 0);
    billingMonth.setUTCDate(1);
    billingMonth.setUTCMonth(billingMonth.getUTCMonth() + monthsAfterFirst);

    const lastDay = new Date(billingMonth);
    lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0);

    const dueOn = new Date(billingMonth);
    dueOn.setUTCDate(Math.min(firstRentDueOn.getUTCDate(), lastDay.getUTCDate()));

    return { billingMonth, dueOn };
}