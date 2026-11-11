-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "organizationId" INTEGER;

-- AlterTable
ALTER TABLE "Renter" ADD COLUMN     "organizationId" INTEGER;

-- CreateIndex
CREATE INDEX "Property_organizationId_idx" ON "Property"("organizationId");

-- CreateIndex
CREATE INDEX "Renter_organizationId_idx" ON "Renter"("organizationId");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Renter" ADD CONSTRAINT "Renter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
