BEGIN;

ALTER TABLE "PropertyPayoutAccount"
  DROP CONSTRAINT "PropertyPayoutAccount_propertyId_fkey";

CREATE UNIQUE INDEX "Property_id_organizationId_key"
  ON "Property" ("id", "organizationId");

CREATE UNIQUE INDEX "PropertyPayoutAccount_propertyId_organizationId_key"
  ON "PropertyPayoutAccount" ("propertyId", "organizationId");

ALTER TABLE "PropertyPayoutAccount"
  ADD CONSTRAINT "PropertyPayoutAccount_propertyId_organizationId_fkey"
  FOREIGN KEY ("propertyId", "organizationId")
  REFERENCES "Property" ("id", "organizationId")
  ON DELETE RESTRICT
  ON UPDATE RESTRICT;

COMMIT;