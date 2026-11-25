import prisma from "./prisma";
import { assertPaymentMatchesCollection } from "./rentPaymentConfirmation";
import type { ConfirmRentPayment } from "./rentPaymentConfirmation";

export async function recordConfirmedRentPayment(
    payment: ConfirmRentPayment,
    paidAt: Date
){
    try {
        return await prisma.$transaction(async (tx) => {
            const collection = await tx.rentCollection.findUniqueOrThrow({
                where: {reference: payment.collectionReference}
            });

            assertPaymentMatchesCollection(collection, payment);

            const rentPayment = await tx.payment.create({
                data: {
                    renterId: collection.renterId,
                    amount: collection.grossUgx,
                    paymentDate: paidAt
                }
            });

            return tx.rentPayout.create({
                data: {
                    collectionRef: collection.reference,
                    provider: collection.provider,
                    transactionId: payment.transactionId,
                    paymentId: rentPayment.id,
                    netUgx: collection.grossUgx - collection.feeUgx - collection.deductionUgx,
                    status: "PENDING"
                }
            });
        });
    } catch (error) {
        // Prisma uses P2002 when a write would break a unique constraint.
        if (!(error instanceof Error) || !("code" in error) || error.code !== "P2002"){
            throw error;
        }

        const existing = await prisma.rentPayout.findUnique({
            where: {collectionRef: payment.collectionReference}
        });

        if(
            existing && existing.provider === payment.provider && existing.transactionId === payment.transactionId
        ){
            return existing;
        }

        throw error;
    }
}