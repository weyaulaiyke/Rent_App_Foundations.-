import type { RentCollection } from "@prisma/client";
import { error } from "console";

type ExpectedCollection = Pick<
RentCollection,
"reference" | "provider" | "grossUgx"
>;

export interface ConfirmRentPayment {
    provider: string;
    transactionId: string;
    collectionReference: string;
    currency: string;
    amountUgx: number;
}

export function assertPaymentMatchesCollection(
    collection: ExpectedCollection,
    payment: ConfirmRentPayment
): void {
    if (payment.collectionReference !== collection.reference){
        throw new Error("Payment refernce does not match the rent collection.");
    }

    if (payment.provider !== collection.provider){
        throw new Error("Payment provider does not match the rent collection.")
    }

    if (payment.transactionId.trim().length === 0) {
        throw new Error("The provider transaction ID is missing");
    }

    if (payment.currency !== "UGX"){
        throw new Error("Rent payment must be in UGX.")
    }

    if (
        !Number.isSafeInteger(payment.amountUgx) 
        || payment.amountUgx <= 0
        || payment.amountUgx !== collection.grossUgx
    ) {
        throw new Error("Payment amount does not match the rent collection.");
    }
}