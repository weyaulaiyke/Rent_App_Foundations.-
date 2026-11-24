-- CreateIndex
CREATE INDEX "PropertyPayoutAccount_organizationId_idx" ON "PropertyPayoutAccount"("organizationId");

-- CreateIndex
CREATE INDEX "RentCollection_leaseId_idx" ON "RentCollection"("leaseId");

-- CreateIndex
CREATE INDEX "RentCollection_renterId_idx" ON "RentCollection"("renterId");

-- CreateIndex
CREATE INDEX "RentCollection_propertyId_idx" ON "RentCollection"("propertyId");

-- CreateIndex
CREATE INDEX "RentCollection_organizationId_idx" ON "RentCollection"("organizationId");

-- AddForeignKey
ALTER TABLE "PropertyPayoutAccount" ADD CONSTRAINT "PropertyPayoutAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentCollection" ADD CONSTRAINT "RentCollection_renterId_fkey" FOREIGN KEY ("renterId") REFERENCES "Renter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentCollection" ADD CONSTRAINT "RentCollection_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentCollection" ADD CONSTRAINT "RentCollection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
