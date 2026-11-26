import prisma from "./prisma";

export async function getOrCreateLeasePaymentLink(
    leaseId: number,
    organizationId: number
) {
    return prisma.$transaction(async (tx) => {
        const lease = await tx.lease.findFirst({
            where: {
                id: leaseId,
                renter: { organizationId },
                unit: {property: { organizationId }}
            },
            select: {id: true}
        });

        if (!lease) {
            return null;
        }

        await tx.leasePaymentLink.createMany({
            data: [{ leaseId: lease.id }],
            skipDuplicates: true
        });

        return tx.leasePaymentLink.findUniqueOrThrow({
            where: {leaseId: leaseId},
            select: {token: true}
        });
    });
}