// Supply the billing periods for one lease, including any unpaid earlier periods.
export interface RentPeriod {
    month: string; // YYYY-MM
    agreedRentUgx: number;
    creditedUgx: number;
}

export function previewRentPayment(
    periods: readonly RentPeriod[],
    monthCount: number,
    amountTodayUgx?: number
) {
    if (!Number.isSafeInteger(monthCount) || monthCount < 1) {
        throw new Error("Choose a positive whole number of months.");
    }

    const seen = new Set<string>();
    for (const period of periods) {
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period.month) || seen.has(period.month)) {
            throw new Error("Each billing period needs a unique month in YYYY-MM format.");
        }
        seen.add(period.month);
        if (!Number.isSafeInteger(period.agreedRentUgx) || period.agreedRentUgx < 0 ||
            !Number.isSafeInteger(period.creditedUgx) || period.creditedUgx < 0 ||
            period.creditedUgx > period.agreedRentUgx) {
            throw new Error("Invalid billing amounts for " + period.month);
        }
    }

    const selected = periods
        .filter(period => period.creditedUgx < period.agreedRentUgx)
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(0, monthCount);
    if (selected.length !== monthCount) {
        throw new Error("There are fewer payable months than requested.");
    }

    const totalDueUgx = selected.reduce(
        (total, period) => total + (period.agreedRentUgx - period.creditedUgx), 0
    );
    if (!Number.isSafeInteger(totalDueUgx)) {
        throw new Error("Selected balance exceeds the supported range.");
    }
    const paymentUgx = amountTodayUgx ?? totalDueUgx;
    if (!Number.isSafeInteger(paymentUgx) || paymentUgx <= 0 || paymentUgx > totalDueUgx) {
        throw new Error("Enter a whole UGX amount between 1 and the selected balance.");
    }

    let available = paymentUgx;
    const months = selected.map(period => {
        const dueUgx = period.agreedRentUgx - period.creditedUgx;
        const appliedUgx = Math.min(available, dueUgx);
        available -= appliedUgx;
        return { month: period.month, dueUgx, appliedUgx, remainingUgx: dueUgx - appliedUgx };
    });

    return { totalDueUgx, paymentUgx, remainingUgx: totalDueUgx - paymentUgx, months };
}
