-- Additive migration: preserve all original business IDs and creator userIds.
-- Audit and backfill run in one transaction. Stop application writes while
-- applying: these locks also prevent a concurrent legacy write escaping audit.
BEGIN;
LOCK TABLE "User", "Property", "Unit", "Renter", "Lease", "Payment", "maintenance" IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
    bad_ids TEXT;
BEGIN
    SELECT string_agg(s."id"::TEXT, ', ') INTO bad_ids
    FROM (
        SELECT l."id" FROM "Lease" l
        LEFT JOIN "Renter" r ON r."id" = l."renterId"
        LEFT JOIN "Unit" u ON u."id" = l."unitId"
        LEFT JOIN "Property" p ON p."id" = u."propertyId"
        LEFT JOIN "User" ru ON ru."id" = r."userId"
        LEFT JOIN "User" pu ON pu."id" = p."userId"
        WHERE r."id" IS NULL OR u."id" IS NULL OR p."id" IS NULL
           OR ru."id" IS NULL OR pu."id" IS NULL OR r."userId" <> p."userId"
        ORDER BY l."id" LIMIT 20
    ) s;
    IF bad_ids IS NOT NULL THEN
        RAISE EXCEPTION 'Organization migration stopped: cross-owner or orphan Lease IDs: %. Review their renter and unit/property ownership before retrying. No records were reassigned.', bad_ids;
    END IF;

    SELECT string_agg(s."id"::TEXT, ', ') INTO bad_ids
    FROM (
        SELECT pay."id" FROM "Payment" pay
        LEFT JOIN "Renter" r ON r."id" = pay."renterId"
        LEFT JOIN "User" owner ON owner."id" = r."userId"
        WHERE r."id" IS NULL OR owner."id" IS NULL OR EXISTS (
            SELECT 1 FROM "Lease" l
            JOIN "Unit" u ON u."id" = l."unitId"
            JOIN "Property" p ON p."id" = u."propertyId"
            WHERE l."renterId" = r."id" AND p."userId" <> r."userId"
        )
        ORDER BY pay."id" LIMIT 20
    ) s;
    IF bad_ids IS NOT NULL THEN
        RAISE EXCEPTION 'Organization migration stopped: inconsistent Payment IDs: %. Review renter ownership and related leases before retrying. No payments were reassigned.', bad_ids;
    END IF;

    IF EXISTS (SELECT 1 FROM "Property" p LEFT JOIN "User" u ON u."id" = p."userId" WHERE u."id" IS NULL)
       OR EXISTS (SELECT 1 FROM "Renter" r LEFT JOIN "User" u ON u."id" = r."userId" WHERE u."id" IS NULL) THEN
        RAISE EXCEPTION 'Organization migration stopped: a Property or Renter has no valid owner. Review ownership before retrying.';
    END IF;
END $$;

CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'PROPERTY_MANAGER', 'STAFF');
CREATE TABLE "Organization" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OrganizationMembership" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "OrganizationRole" NOT NULL DEFAULT 'STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Property" ADD COLUMN "organizationId" INTEGER;
ALTER TABLE "Renter" ADD COLUMN "organizationId" INTEGER;

-- Reuse each user's ID only for this initial organization mapping. No existing
-- entity ID changes. Advance the sequence below for later organizations.
INSERT INTO "Organization" ("id", "name")
SELECT "id", "email" || '''s workspace' FROM "User" ORDER BY "id";
SELECT setval(pg_get_serial_sequence('"Organization"', 'id'), COALESCE(MAX("id"), 1), MAX("id") IS NOT NULL) FROM "Organization";
INSERT INTO "OrganizationMembership" ("organizationId", "userId", "role")
SELECT "id", "id", 'OWNER'::"OrganizationRole" FROM "User" ORDER BY "id";
UPDATE "Property" SET "organizationId" = "userId";
UPDATE "Renter" SET "organizationId" = "userId";

ALTER TABLE "Property" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Renter" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE UNIQUE INDEX "OrganizationMembership_organizationId_userId_key" ON "OrganizationMembership"("organizationId", "userId");
CREATE INDEX "OrganizationMembership_userId_idx" ON "OrganizationMembership"("userId");
CREATE INDEX "Property_organizationId_idx" ON "Property"("organizationId");
CREATE INDEX "Renter_organizationId_idx" ON "Renter"("organizationId");

ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Property" ADD CONSTRAINT "Property_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Renter" ADD CONSTRAINT "Renter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
COMMIT;
