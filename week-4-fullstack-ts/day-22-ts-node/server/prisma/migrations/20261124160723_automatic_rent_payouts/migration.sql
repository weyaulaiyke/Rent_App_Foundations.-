-- CreateEnum
CREATE TYPE "RentPayoutStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "PropertyPayoutAccount" (
    "propertyId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "beneficiaryRef" TEXT NOT NULL,

    CONSTRAINT "PropertyPayoutAccount_pkey" PRIMARY KEY ("propertyId")
);

-- CreateTable
CREATE TABLE "RentCollection" (
    "reference" TEXT NOT NULL,
    "leaseId" INTEGER NOT NULL,
    "renterId" INTEGER NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "beneficiaryRef" TEXT NOT NULL,
    "grossUgx" INTEGER NOT NULL,
    "feeUgx" INTEGER NOT NULL,
    "deductionUgx" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentCollection_pkey" PRIMARY KEY ("reference")
);

-- CreateTable
CREATE TABLE "RentPayout" (
    "collectionRef" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "netUgx" INTEGER NOT NULL,
    "status" "RentPayoutStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RentPayout_pkey" PRIMARY KEY ("collectionRef")
);

-- CreateIndex
CREATE UNIQUE INDEX "RentPayout_paymentId_key" ON "RentPayout"("paymentId");

-- CreateIndex
CREATE INDEX "RentPayout_status_createdAt_idx" ON "RentPayout"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RentPayout_provider_transactionId_key" ON "RentPayout"("provider", "transactionId");

-- AddForeignKey
ALTER TABLE "PropertyPayoutAccount" ADD CONSTRAINT "PropertyPayoutAccount_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentCollection" ADD CONSTRAINT "RentCollection_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentPayout" ADD CONSTRAINT "RentPayout_collectionRef_fkey" FOREIGN KEY ("collectionRef") REFERENCES "RentCollection"("reference") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentPayout" ADD CONSTRAINT "RentPayout_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Amount integrity checks (UGX)
ALTER TABLE "RentCollection"
  ADD CONSTRAINT "RentCollection_amounts_nonnegative_chk"
  CHECK ("grossUgx" >= 0 AND "feeUgx" >= 0 AND "deductionUgx" >= 0);

ALTER TABLE "RentCollection"
  ADD CONSTRAINT "RentCollection_fee_deduction_within_gross_chk"
  CHECK ("feeUgx" + "deductionUgx" <= "grossUgx");

ALTER TABLE "RentPayout"
  ADD CONSTRAINT "RentPayout_net_nonnegative_chk"
  CHECK ("netUgx" >= 0);
