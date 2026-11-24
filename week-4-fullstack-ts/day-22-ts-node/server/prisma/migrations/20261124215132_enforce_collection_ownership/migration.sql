BEGIN;

-- DropForeignKey
ALTER TABLE "RentCollection" DROP CONSTRAINT "RentCollection_leaseId_renterId_fkey";

-- DropForeignKey
ALTER TABLE "RentCollection" DROP CONSTRAINT "RentCollection_renterId_fkey";

-- DropForeignKey
ALTER TABLE "RentCollection" DROP CONSTRAINT "RentCollection_propertyId_fkey";

-- DropIndex
DROP INDEX "Lease_id_renterId_key";

-- AlterTable
ALTER TABLE "RentCollection" ALTER COLUMN "unitId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Unit_id_propertyId_key" ON "Unit"("id", "propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "Renter_id_organizationId_key" ON "Renter"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Lease_id_renterId_unitId_key" ON "Lease"("id", "renterId", "unitId");

-- AddForeignKey
ALTER TABLE "RentCollection" ADD CONSTRAINT "RentCollection_leaseId_renterId_unitId_fkey" FOREIGN KEY ("leaseId", "renterId", "unitId") REFERENCES "Lease"("id", "renterId", "unitId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "RentCollection" ADD CONSTRAINT "RentCollection_unitId_propertyId_fkey" FOREIGN KEY ("unitId", "propertyId") REFERENCES "Unit"("id", "propertyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "RentCollection" ADD CONSTRAINT "RentCollection_renterId_organizationId_fkey" FOREIGN KEY ("renterId", "organizationId") REFERENCES "Renter"("id", "organizationId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "RentCollection" ADD CONSTRAINT "RentCollection_propertyId_organizationId_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "Property"("id", "organizationId") ON DELETE RESTRICT ON UPDATE RESTRICT;

COMMIT;
