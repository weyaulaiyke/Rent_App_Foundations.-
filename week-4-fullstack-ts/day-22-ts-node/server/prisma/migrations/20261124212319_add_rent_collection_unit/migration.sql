BEGIN;

ALTER TABLE "RentCollection"
  ADD COLUMN "unitId" INTEGER;

UPDATE "RentCollection" AS collection
SET "unitId" = lease."unitId"
FROM "Lease" AS lease
WHERE lease."id" = collection."leaseId";

COMMIT;