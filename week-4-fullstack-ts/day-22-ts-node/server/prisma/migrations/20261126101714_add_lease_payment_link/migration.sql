-- CreateTable
CREATE TABLE "LeasePaymentLink" (
    "token" TEXT NOT NULL,
    "leaseId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeasePaymentLink_pkey" PRIMARY KEY ("token")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeasePaymentLink_leaseId_key" ON "LeasePaymentLink"("leaseId");

-- AddForeignKey
ALTER TABLE "LeasePaymentLink" ADD CONSTRAINT "LeasePaymentLink_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
