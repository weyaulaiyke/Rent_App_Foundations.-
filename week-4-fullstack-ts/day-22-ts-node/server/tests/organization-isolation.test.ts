import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) {
    throw new Error("Set TEST_DATABASE_URL to a disposable local remote_phase2_test database before running integration tests.");
}
const database = new URL(databaseURL);
if (!['localhost', '127.0.0.1', '[::1]'].includes(database.hostname) ||
    !/^\/remote_phase2_test(?:_[a-z0-9_]+)?$/i.test(database.pathname)) {
    throw new Error("Integration tests only reset a local database named remote_phase2_test or remote_phase2_test_<suffix>.");
}

// Explicit test configuration takes precedence over any development .env file.
process.env.DATABASE_URL = databaseURL;
process.env.JWT_SECRET = "remote-phase2-integration-test-only";
process.env.NODE_ENV = "test";

const serverDirectory = process.cwd();
const migrationsDirectory = path.join(serverDirectory, "prisma/migrations");
const organizationMigration = "20261111120000_organization_isolation";
const password = "IntegrationPassword123";
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

type Json = Record<string, any>;
type Result = { status: number; body: Json; cookie: string | null };

test("organization migration, isolation and per-organization roles", { timeout: 180_000 }, async function(t) {
    const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "remote-phase2-tests-"));
    let server: Server | undefined;
    let sharedPrisma: any;
    let legacyPrisma: any;

    t.after(async function() {
        if (server) {
            server.closeAllConnections();
            await new Promise<void>(resolve => server!.close(() => resolve()));
        }
        await sharedPrisma?.$disconnect();
        await legacyPrisma?.$disconnect();
        rmSync(temporaryDirectory, { recursive: true, force: true });
    });

    function executeSQLFile(filename: string) {
        return execFileSync(process.execPath, [
            path.join(serverDirectory, "node_modules/prisma/build/index.js"),
            "db", "execute", "--schema", path.join(serverDirectory, "prisma/schema.prisma"),
            "--file", filename
        ], {
            cwd: serverDirectory,
            env: { ...process.env, DATABASE_URL: databaseURL! },
            encoding: "utf8",
            stdio: "pipe"
        });
    }

    const resetFile = path.join(temporaryDirectory, "reset.sql");
    writeFileSync(resetFile, 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
    executeSQLFile(resetFile);

    const migrationNames = readdirSync(migrationsDirectory, { withFileTypes: true })
        .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
    assert.ok(migrationNames.includes(organizationMigration), "organization migration must exist");
    for (const migration of migrationNames) {
        if (migration === organizationMigration) break;
        executeSQLFile(path.join(migrationsDirectory, migration, "migration.sql"));
    }

    const { PrismaClient } = await import("@prisma/client");
    legacyPrisma = new PrismaClient();
    const passwordHash = await bcrypt.hash(password, 4);
    async function insertID(query: string, ...values: unknown[]): Promise<number> {
        const rows = await legacyPrisma.$queryRawUnsafe(query, ...values);
        return rows[0].id;
    }
    const ownerA = await insertID('INSERT INTO "User" (email,"passwordHash") VALUES ($1,$2) RETURNING id', 'owner-a@example.test', passwordHash);
    const ownerB = await insertID('INSERT INTO "User" (email,"passwordHash") VALUES ($1,$2) RETURNING id', 'owner-b@example.test', passwordHash);
    const manager = await insertID('INSERT INTO "User" (email,"passwordHash") VALUES ($1,$2) RETURNING id', 'manager@example.test', passwordHash);
    const staff = await insertID('INSERT INTO "User" (email,"passwordHash") VALUES ($1,$2) RETURNING id', 'staff@example.test', passwordHash);
    const propertyA = await insertID('INSERT INTO "Property" (name,"userId") VALUES ($1,$2) RETURNING id', 'Property A', ownerA);
    const propertyB = await insertID('INSERT INTO "Property" (name,"userId") VALUES ($1,$2) RETURNING id', 'Property B', ownerB);
    const unitA = await insertID('INSERT INTO "Unit" (number,"propertyId") VALUES ($1,$2) RETURNING id', 'A1', propertyA);
    const unitB = await insertID('INSERT INTO "Unit" (number,"propertyId") VALUES ($1,$2) RETURNING id', 'B1', propertyB);
    const renterA = await insertID('INSERT INTO "Renter" (name,"userId") VALUES ($1,$2) RETURNING id', 'Renter A', ownerA);
    const renterB = await insertID('INSERT INTO "Renter" (name,"userId") VALUES ($1,$2) RETURNING id', 'Renter B', ownerB);
    const leaseA = await insertID('INSERT INTO "Lease" ("renterId","unitId","monthlyRent") VALUES ($1,$2,$3) RETURNING id', renterA, unitA, 1_000_000);
    const leaseB = await insertID('INSERT INTO "Lease" ("renterId","unitId","monthlyRent") VALUES ($1,$2,$3) RETURNING id', renterB, unitB, 800_000);
    const paymentA = await insertID('INSERT INTO "Payment" ("renterId",amount,"paymentDate") VALUES ($1,$2,$3) RETURNING id', renterA, 100_000, new Date("2026-11-01T00:00:00Z"));
    const paymentB = await insertID('INSERT INTO "Payment" ("renterId",amount,"paymentDate") VALUES ($1,$2,$3) RETURNING id', renterB, 50_000, new Date("2026-11-01T00:00:00Z"));
    const maintenanceA = await insertID('INSERT INTO "maintenance" ("unitId",title,description) VALUES ($1,$2,$3) RETURNING id', unitA, 'Tap A', 'A issue');
    const maintenanceB = await insertID('INSERT INTO "maintenance" ("unitId",title,description) VALUES ($1,$2,$3) RETURNING id', unitB, 'Tap B', 'B issue');
    const badLease = await insertID('INSERT INTO "Lease" ("renterId","unitId","monthlyRent") VALUES ($1,$2,$3) RETURNING id', renterB, unitA, 500_000);
    const migrationFile = path.join(migrationsDirectory, organizationMigration, "migration.sql");

    await t.test("migration refuses inconsistent ownership and rolls back before reassigning records", async function() {
        assert.throws(() => executeSQLFile(migrationFile), /cross-owner|ownership|migration stopped/i);
        const [table] = await legacyPrisma.$queryRawUnsafe("SELECT to_regclass('\"Organization\"')::text AS name");
        assert.equal(table.name, null);
        const [renter] = await legacyPrisma.$queryRawUnsafe('SELECT "userId" FROM "Renter" WHERE id=$1', renterB);
        assert.equal(renter.userId, ownerB);
    });
    await legacyPrisma.$executeRawUnsafe('DELETE FROM "Lease" WHERE id=$1', badLease);
    executeSQLFile(migrationFile);
    // Keep this ownership suite usable after additive application migrations.
    for (const migration of migrationNames.filter(name => name > organizationMigration)) {
        executeSQLFile(path.join(migrationsDirectory, migration, "migration.sql"));
    }
    await legacyPrisma.$disconnect();

    const serverModule = await import("../src/server.ts");
    const prismaModule = await import("../src/prisma.ts");
    sharedPrisma = prismaModule.prisma;
    const orgA = (await sharedPrisma.organizationMembership.findFirst({ where: { userId: ownerA } })).organizationId;
    const orgB = (await sharedPrisma.organizationMembership.findFirst({ where: { userId: ownerB } })).organizationId;
    const cookieFor = (userId: number) => `token=${jwt.sign({ userId }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "1h" })}`;
    const cookieA = cookieFor(ownerA), cookieB = cookieFor(ownerB), cookieManager = cookieFor(manager), cookieStaff = cookieFor(staff);

    await t.test("migration preserves business IDs, balances and owner access", async function() {
        assert.equal(await sharedPrisma.organization.count(), 4);
        assert.equal(await sharedPrisma.organizationMembership.count({ where: { role: "OWNER" } }), 4);
        assert.equal((await sharedPrisma.property.findUnique({ where: { id: propertyA } })).organizationId, orgA);
        assert.equal((await sharedPrisma.renter.findUnique({ where: { id: renterB } })).organizationId, orgB);
        assert.equal((await sharedPrisma.payment.findUnique({ where: { id: paymentA } })).amount, 100_000);
        assert.equal((await sharedPrisma.payment.findUnique({ where: { id: paymentB } })).renterId, renterB);
        assert.equal(await sharedPrisma.lease.count(), 2);
        assert.equal(await sharedPrisma.maintenance.count(), 2);
    });

    server = serverModule.app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server!.once("listening", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;

    async function request(method: string, endpoint: string, cookie?: string, org?: number | string, body?: Json): Promise<Result> {
        const headers: Record<string, string> = {};
        if (cookie) headers.Cookie = cookie;
        if (org !== undefined) headers["X-Organization-Id"] = String(org);
        if (body !== undefined) headers["Content-Type"] = "application/json";
        const response = await fetch(base + endpoint, {
            method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) })
        });
        const text = await response.text();
        let parsed: Json;
        try { parsed = JSON.parse(text); } catch { parsed = { text }; }
        return { status: response.status, body: parsed, cookie: response.headers.get("set-cookie") };
    }

    await t.test("sessions, organization selection and membership are checked on the server", async function() {
        assert.equal((await request("GET", "/properties")).status, 401);
        assert.equal((await request("GET", "/properties", cookieFor(999999))).status, 401);
        for (const invalid of ["0", "-1", "abc", "1,2", "1.5"]) {
            assert.equal((await request("GET", "/properties", cookieA, invalid)).status, 400);
        }
        assert.equal((await request("GET", "/properties", cookieA, orgB)).status, 403);
        const own = await request("GET", "/organizations", cookieA);
        assert.equal(own.status, 200);
        assert.deepEqual(own.body.data.map((org: Json) => org.id), [orgA]);
        const oldClient = await request("GET", "/properties", cookieA);
        assert.equal(oldClient.status, 200);
        assert.deepEqual(oldClient.body.data.map((property: Json) => property.id), [propertyA]);
    });

    await t.test("lists and reports contain only the active organization's records", async function() {
        const expectations = [
            ["/properties", propertyA], ["/units", unitA], ["/renters", renterA],
            ["/leases", leaseA], ["/payments", paymentA], ["/maintenance", maintenanceA]
        ] as const;
        for (const [endpoint, expectedID] of expectations) {
            const response = await request("GET", endpoint, cookieA, orgA);
            assert.equal(response.status, 200, endpoint);
            assert.deepEqual(response.body.data.map((record: Json) => record.id), [expectedID], endpoint);
        }
        const report = await request("GET", "/reports/arrears", cookieA, orgA);
        assert.equal(report.status, 200);
        assert.ok(report.body.data.every((row: Json) => row.renterId === renterA));
    });

    await t.test("foreign resource IDs cannot be changed, archived, restored or deleted", async function() {
        const operations: Array<[string, string, Json | undefined]> = [
            ["PATCH", `/properties/${propertyB}`, { name: "Stolen" }], ["DELETE", `/properties/${propertyB}`, undefined],
            ["PATCH", `/units/${unitB}`, { number: "Stolen" }], ["DELETE", `/units/${unitB}`, undefined],
            ["PATCH", `/renters/${renterB}`, { name: "Stolen" }], ["DELETE", `/renters/${renterB}`, undefined],
            ["PATCH", `/renters/${renterB}/restore`, {}],
            ["PATCH", `/leases/${leaseB}`, { monthlyRent: 1 }], ["DELETE", `/leases/${leaseB}`, undefined],
            ["PATCH", `/payments/${paymentB}`, { amount: 1 }], ["DELETE", `/payments/${paymentB}`, undefined],
            ["PATCH", `/maintenance/${maintenanceB}`, { status: "COMPLETED" }]
        ];
        for (const [method, endpoint, body] of operations) {
            assert.equal((await request(method, endpoint, cookieA, orgA, body)).status, 404, `${method} ${endpoint}`);
        }
        assert.equal((await sharedPrisma.property.findUnique({ where: { id: propertyB } })).name, "Property B");
        assert.equal((await sharedPrisma.renter.findUnique({ where: { id: renterB } })).isArchived, false);
        assert.equal((await sharedPrisma.payment.findUnique({ where: { id: paymentB } })).amount, 50_000);
    });

    await t.test("related-record creation rejects cross-organization properties, renters and units", async function() {
        const operations: Array<[string, Json]> = [
            ["/units", { number: "X1", propertyId: propertyB }],
            ["/maintenance", { unitId: unitB, title: "Foreign", description: "Foreign request" }],
            ["/leases", { renterId: renterB, unitId: unitA, monthlyRent: 100 }],
            ["/leases", { renterId: renterA, unitId: unitB, monthlyRent: 100 }],
            ["/payments", { renterId: renterB, amount: 100, paymentDate: "2026-11-01" }]
        ];
        for (const [endpoint, body] of operations) {
            assert.equal((await request("POST", endpoint, cookieA, orgA, body)).status, 404, endpoint);
        }
        assert.equal((await request("PATCH", `/leases/${leaseA}`, cookieA, orgA, { monthlyRent: 100, unitId: unitB })).status, 404);
        assert.equal((await sharedPrisma.lease.findUnique({ where: { id: leaseA } })).unitId, unitA);
    });

    await t.test("owners can add existing team accounts and roles apply per organization", async function() {
        assert.equal((await request("POST", "/organization/members", cookieA, orgA, { email: "manager@example.test", role: "PROPERTY_MANAGER" })).status, 201);
        assert.equal((await request("POST", "/organization/members", cookieB, orgB, { email: "manager@example.test", role: "STAFF" })).status, 201);
        assert.equal((await request("POST", "/organization/members", cookieA, orgA, { email: "staff@example.test", role: "STAFF" })).status, 201);
        const organizations = await request("GET", "/organizations", cookieManager);
        assert.equal(organizations.body.data.find((org: Json) => org.id === orgA).role, "PROPERTY_MANAGER");
        assert.equal(organizations.body.data.find((org: Json) => org.id === orgB).role, "STAFF");
        const property = await request("POST", "/properties", cookieManager, orgA, {
            name: "Shared manager property",
            organizationId: orgB,
            userId: ownerB
        });
        assert.equal(property.status, 201);
        assert.equal(property.body.data.organizationId, orgA);
        assert.equal(property.body.data.userId, manager);
        const ownerList = await request("GET", "/properties", cookieA, orgA);
        assert.ok(ownerList.body.data.some((row: Json) => row.id === property.body.data.id));
        assert.equal((await request("POST", "/properties", cookieManager, orgB, { name: "Forbidden" })).status, 403);
        assert.equal((await request("GET", "/payments", cookieManager, orgA)).status, 200);
        assert.equal((await request("GET", "/payments", cookieManager, orgB)).status, 403);
        assert.equal((await request("GET", "/organization/members", cookieManager, orgA)).status, 403);
        assert.equal((await request("POST", "/organization/members", cookieA, orgA, { email: "unknown@example.test", role: "STAFF" })).status, 404);
    });

    await t.test("staff can handle maintenance but cannot access finance, edit property data or manage a team", async function() {
        for (const endpoint of ["/properties", "/units", "/renters", "/maintenance"]) {
            assert.equal((await request("GET", endpoint, cookieStaff, orgA)).status, 200, endpoint);
        }
        for (const endpoint of ["/leases", "/payments", "/reports/arrears", "/organization/members"]) {
            assert.equal((await request("GET", endpoint, cookieStaff, orgA)).status, 403, endpoint);
        }
        assert.equal((await request("PATCH", `/properties/${propertyA}`, cookieStaff, orgA, { name: "Forbidden" })).status, 403);
        assert.equal((await request("POST", "/renters", cookieStaff, orgA, { name: "Forbidden" })).status, 403);
        const maintenance = await request("POST", "/maintenance", cookieStaff, orgA, { unitId: unitA, title: "Staff request", description: "Allowed" });
        assert.equal(maintenance.status, 201);
        assert.equal((await request("PATCH", `/maintenance/${maintenance.body.data.id}`, cookieStaff, orgA, { status: "COMPLETED" })).status, 200);
    });

    await t.test("new accounts receive an owned workspace and can create another isolated organization", async function() {
        const registered = await request("POST", "/auth/register", undefined, undefined, { email: "registered@example.test", password });
        assert.equal(registered.status, 201);
        const signedIn = await request("POST", "/auth/login", undefined, undefined, { email: "registered@example.test", password });
        assert.equal(signedIn.status, 200);
        assert.ok(signedIn.cookie);
        const cookie = signedIn.cookie!.split(";")[0]!;
        const organizations = await request("GET", "/organizations", cookie);
        assert.equal(organizations.body.data.length, 1);
        assert.equal(organizations.body.data[0].role, "OWNER");
        assert.equal((await request("GET", "/properties", cookie)).body.data.length, 0);
        const second = await request("POST", "/organizations", cookie, undefined, { name: "Second business" });
        assert.equal(second.status, 201);
        assert.equal(second.body.data.role, "OWNER");
        assert.equal((await request("PATCH", `/organizations/${second.body.data.id}`, cookieA, orgA, { name: "Forbidden" })).status, 403);
        assert.equal((await request("PATCH", `/organizations/${second.body.data.id}`, cookie, undefined, { name: "Renamed business" })).status, 200);
    });

    await t.test("membership changes preserve the final owner, including simultaneous demotions", async function() {
        assert.equal((await request("PATCH", `/organization/members/${ownerA}`, cookieA, orgA, { role: "STAFF" })).status, 409);
        assert.equal((await request("DELETE", `/organization/members/${ownerA}`, cookieA, orgA)).status, 409);
        assert.equal((await request("POST", "/organization/members", cookieA, orgA, { email: "owner-b@example.test", role: "OWNER" })).status, 201);
        const results = await Promise.all([
            request("PATCH", `/organization/members/${ownerA}`, cookieA, orgA, { role: "PROPERTY_MANAGER" }),
            request("PATCH", `/organization/members/${ownerB}`, cookieB, orgA, { role: "PROPERTY_MANAGER" })
        ]);
        assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
        const owners = await sharedPrisma.organizationMembership.findMany({ where: { organizationId: orgA, role: "OWNER" } });
        assert.equal(owners.length, 1);
        const remainingOwner = owners[0].userId;
        assert.equal((await request("DELETE", `/organization/members/${remainingOwner}`, cookieFor(remainingOwner), orgA)).status, 409);
    });
});
