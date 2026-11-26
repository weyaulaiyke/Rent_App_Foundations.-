-- AlterTable
ALTER TABLE "Lease" ADD COLUMN     "firstRentDueOn" DATE;

-- CreateTable
CREATE TABLE "LeaseRentPeriod" (
    "id" SERIAL NOT NULL,
    "leaseId" INTEGER NOT NULL,
    "billingMonth" DATE NOT NULL,
    "dueOn" DATE NOT NULL,
    "agreedRentUgx" INTEGER NOT NULL,

    CONSTRAINT "LeaseRentPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeaseRentPeriod_leaseId_billingMonth_key" ON "LeaseRentPeriod"("leaseId", "billingMonth");

-- AddForeignKey
ALTER TABLE "LeaseRentPeriod" ADD CONSTRAINT "LeaseRentPeriod_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LeaseRentPeriod"
    ADD CONSTRAINT "LeaseRentPeriod_billingMonth_first_day_check"
        CHECK (EXTRACT(DAY FROM "billingMonth") = 1),
    ADD CONSTRAINT "LeaseRentPeriod_agreedRentUgx_nonnegative_check"
        CHECK ("agreedRentUgx" >= 0);