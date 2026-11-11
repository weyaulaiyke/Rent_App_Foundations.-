-- Additive ledger migration; no historical invoices or allocations are fabricated.
BEGIN;
-- CreateEnum
CREATE TYPE "PaymentSource" AS ENUM ('LEGACY', 'MANUAL', 'MOBILE_MONEY');

-- CreateEnum
CREATE TYPE "PaymentRequestStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('INVOICE', 'RECEIPT', 'REMINDER', 'REPORT');

-- CreateEnum
CREATE TYPE "DocumentDeliveryStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "billingDay" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'UGX',
ADD COLUMN     "monthlyBillingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "remindersEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "timeZone" TEXT NOT NULL DEFAULT 'Africa/Kampala';

-- AlterTable
ALTER TABLE "Renter" ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "issuerName" TEXT,
ADD COLUMN     "payerName" TEXT,
ADD COLUMN     "receiptNumber" TEXT,
ADD COLUMN     "source" "PaymentSource" NOT NULL DEFAULT 'LEGACY',
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "leaseId" INTEGER NOT NULL,
    "renterId" INTEGER NOT NULL,
    "number" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UGX',
    "renterName" TEXT NOT NULL,
    "propertyName" TEXT NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UGX',
    "payerEmail" TEXT NOT NULL,
    "subaccountId" TEXT NOT NULL,
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "checkoutUrl" TEXT,
    "providerTransactionId" TEXT,
    "paymentId" INTEGER,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentDelivery" (
    "id" TEXT NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "invoiceId" INTEGER,
    "paymentId" INTEGER,
    "kind" "DocumentKind" NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" "DocumentDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "dedupeKey" TEXT NOT NULL,
    "reportMonth" TEXT,
    "reportType" TEXT,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "firstAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Invoice_organizationId_dueDate_idx" ON "Invoice"("organizationId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_organizationId_leaseId_periodStart_key" ON "Invoice"("organizationId", "leaseId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_organizationId_number_key" ON "Invoice"("organizationId", "number");

-- CreateIndex
CREATE INDEX "PaymentAllocation_invoiceId_idx" ON "PaymentAllocation"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_paymentId_invoiceId_key" ON "PaymentAllocation"("paymentId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_providerTransactionId_key" ON "PaymentRequest"("providerTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_paymentId_key" ON "PaymentRequest"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentRequest_organizationId_idx" ON "PaymentRequest"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentDelivery_dedupeKey_key" ON "DocumentDelivery"("dedupeKey");

-- CreateIndex
CREATE INDEX "DocumentDelivery_organizationId_createdAt_idx" ON "DocumentDelivery"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentDelivery_status_availableAt_idx" ON "DocumentDelivery"("status", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptNumber_key" ON "Payment"("receiptNumber");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_renterId_fkey" FOREIGN KEY ("renterId") REFERENCES "Renter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentDelivery" ADD CONSTRAINT "DocumentDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentDelivery" ADD CONSTRAINT "DocumentDelivery_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentDelivery" ADD CONSTRAINT "DocumentDelivery_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- New financial records are whole-UGX positive amounts. Legacy Payment values
-- and all historical allocations (none are generated here) remain untouched.
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_billingDay_check" CHECK ("billingDay" BETWEEN 1 AND 28);
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_amount_check" CHECK ("amount" > 0);
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_month_check" CHECK (EXTRACT(DAY FROM "periodStart") = 1);
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_amount_check" CHECK ("amount" > 0);
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_amount_check" CHECK ("amount" > 0);
COMMIT;
