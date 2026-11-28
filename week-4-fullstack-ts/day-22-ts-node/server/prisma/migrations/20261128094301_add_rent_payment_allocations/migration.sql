-- CreateTable
CREATE TABLE "RentPaymentAllocation" (
    "paymentId" INTEGER NOT NULL,
    "rentPeriodId" INTEGER NOT NULL,
    "amountUgx" INTEGER NOT NULL,

    CONSTRAINT "RentPaymentAllocation_pkey" PRIMARY KEY ("paymentId","rentPeriodId")
);

-- CreateIndex
CREATE INDEX "RentPaymentAllocation_rentPeriodId_idx" ON "RentPaymentAllocation"("rentPeriodId");

-- AddForeignKey
ALTER TABLE "RentPaymentAllocation" ADD CONSTRAINT "RentPaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentPaymentAllocation" ADD CONSTRAINT "RentPaymentAllocation_rentPeriodId_fkey" FOREIGN KEY ("rentPeriodId") REFERENCES "LeaseRentPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RentPaymentAllocation"
ADD CONSTRAINT "RentPaymentAllocation_amountUgx_positive"
CHECK ("amountUgx" > 0);