import type { Prisma } from "@prisma/client";

export async function loadLeaseRentPeriods(
    db: Prisma.TransactionClient,
    leaseId: number
) {
    const periods = await db.leaseRentPeriod.findMany({
        where: { leaseId },
        orderBy: { billingMonth: "asc" },
        select: {
            id: true,
            billingMonth: true,
            agreedRentUgx: true,
            allocations: { select: { amountUgx: true } }
        }
    });

    return periods.map(period => ({
        rentPeriodId: period.id,
        month: period.billingMonth.toISOString().slice(0, 7),
        agreedRentUgx: period.agreedRentUgx,
        creditedUgx: period.allocations.reduce(
            (total, allocation) => total + allocation.amountUgx,
            0
        )
    }));
}