BEGIN;

ALTER TABLE "RentCollection"
  DROP CONSTRAINT "RentCollection_leaseId_fkey";

CREATE UNIQUE INDEX "Lease_id_renterId_key"
  ON "Lease" ("id", "renterId");

ALTER TABLE "RentCollection"
  ADD CONSTRAINT "RentCollection_leaseId_renterId_fkey"
  FOREIGN KEY ("leaseId", "renterId")
  REFERENCES "Lease" ("id", "renterId")
  ON DELETE RESTRICT
  ON UPDATE RESTRICT;

COMMIT;