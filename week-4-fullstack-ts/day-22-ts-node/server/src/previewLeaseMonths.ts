import { getLeaseBillingDates } from "./leaseBillingDates";
import { previewRentPayment, type RentPeriod } from "./previewRentPayment";

export function previewLeaseMonths(
    firstRentDueOn: Date,
    monthlyRent: number,
    savedPeriods: readonly RentPeriod[],
    monthCount: number,
    amountTodayUgx?: number
) {
    if (!Number.isSafeInteger(monthCount) || monthCount < 1) {
        throw new Error("Choose a positive whole number of months.");
    }

    if (!Number.isSafeInteger(monthlyRent) || monthlyRent <= 0) {
        throw new Error("A positive monthly rent is required.");
    }

    const savedByMonth = new Map(savedPeriods.map(period => [period.month, period]));
    const payablePeriods: RentPeriod[] = [];

    for (let offset = 0; payablePeriods.length < monthCount; offset++) {
        const { billingMonth } = getLeaseBillingDates(firstRentDueOn, offset);
        const month = billingMonth.toISOString().slice(0, 7);
        const period = savedByMonth.get(month) ?? {
            month,
            agreedRentUgx: monthlyRent,
            creditedUgx: 0
        };

        if (period.creditedUgx !== period.agreedRentUgx) {
            payablePeriods.push(period);
        }
    }

    return previewRentPayment(payablePeriods, monthCount, amountTodayUgx);
}