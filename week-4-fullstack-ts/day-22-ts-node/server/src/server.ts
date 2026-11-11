import express = require("express");
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./prisma";
import { HttpError, positiveId } from "./http";
import { organizationRoutes } from "./organizations";
import { billingRoutes } from "./billing/routes";
import { paymentPublicRoutes } from "./billing/mobileMoney";
import { documentRoutes } from "./documents";
import { organizationId, requireOrganization, requirePermission } from "./middleware/organization";
import { requireMutationOrigin, requireReceiptRequest } from "./middleware/requestOrigin";
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const requireAuth = require("./middleware/auth");

export const app = express();
// Render's production ingress adds one trusted proxy hop. Other deployments
// can set a bounded hop count; never trust arbitrary forwarding chains.
const proxyHops = Number(process.env.TRUST_PROXY_HOPS ?? (process.env.NODE_ENV === "production" ? "1" : "0"));
if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 5) {
    throw new Error("TRUST_PROXY_HOPS must be an integer between 0 and 5");
}
app.set("trust proxy", proxyHops);
app.use(express.json({
    verify: function(req, _res, buffer) { (req as express.Request).rawBody = Buffer.from(buffer); }
}));
app.use(cookieParser());
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
    exposedHeaders: ["X-Organization-Id"]
}));
app.use(function(_req, res, next) {
    res.setHeader("Cache-Control", "no-store");
    next();
});

const nameSchema = z.object({ name: z.string().trim().min(1) });
const integer = z.coerce.number().int().positive().max(2147483647);
const unitSchema = z.object({ number: z.string().trim().min(1), propertyId: integer });
const maintenanceSchema = z.object({ unitId: integer, title: z.string().trim().min(1), description: z.string().trim().min(1) });
const leaseSchema = z.object({ renterId: integer, unitId: integer, monthlyRent: integer });
const renterSchema = z.object({
    name: z.string().trim().min(1),
    email: z.union([z.string().trim().max(254).email(), z.literal(""), z.null()]).optional(),
    phone: z.union([z.string().trim().max(32), z.null()]).optional()
});
function renterInput(input: unknown) {
    const value = parse(renterSchema, input, "Provide a name and valid optional contact details");
    return {
        name: value.name,
        ...(value.email === undefined ? {} : { email: value.email || null }),
        ...(value.phone === undefined ? {} : { phone: value.phone || null })
    };
}
const credentialsSchema = z.object({ email: z.string().min(1), password: z.string().min(1) });

function parse<T>(schema: z.ZodType<T>, input: unknown, message: string): T {
    const result = schema.safeParse(input);
    if (!result.success) throw new HttpError(400, message);
    return result.data;
}
// Use both ends of a lease's relationship when reading or changing it.
function leaseScope(id: number) {
    return { renter: { organizationId: id }, unit: { property: { organizationId: id } } };
}

app.get("/", function(_req, res) {
    res.json({ message: "Rent API is running" });
});
app.post("/auth/register", async function(req, res) {
    const { email, password } = parse(credentialsSchema, req.body, "Email and password are required");
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
        data: {
            email,
            passwordHash,
            memberships: {
                create: { role: "OWNER", organization: { create: { name: "My workspace" } } }
            }
        },
        select: { id: true, email: true }
    });
    res.status(201).json(user);
});
app.post("/auth/login", async function(req, res) {
    const { email, password } = parse(credentialsSchema, req.body, "Email and password are required");
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !await bcrypt.compare(password, user.passwordHash)) throw new HttpError(401, "Invalid email or password");
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new HttpError(503, "Sign-in is temporarily unavailable");
    const token = jwt.sign({ userId: user.id }, secret, { expiresIn: "1d", algorithm: "HS256" });
    res.cookie("token", token, {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000
    });
    res.json({ message: "Login successful", user: { id: user.id, email: user.email } });
});
app.post("/auth/logout", function(_req, res) {
    res.clearCookie("token", {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        secure: process.env.NODE_ENV === "production"
    });
    res.json({ message: "Logout successful" });
});
app.get("/auth/me", requireAuth, async function(req, res) {
    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { id: true, email: true } });
    if (!user) throw new HttpError(401, "Authentication required");
    res.json(user);
});
app.use(paymentPublicRoutes);
// Public provider callbacks do not use a browser session. All private routes
// below reject cross-site cookie mutations, independently of CORS headers.
app.use(requireMutationOrigin);
app.use(organizationRoutes);

// All business routes below require a current database-backed membership.
const business = express.Router();
business.use(requireAuth, requireOrganization);
app.use(business);
business.get("/payments/:id/receipt.pdf", requireReceiptRequest);
business.use(billingRoutes);
business.use(documentRoutes);

business.get("/properties", async function(req, res) {
    const data = await prisma.property.findMany({ where: { organizationId: organizationId(req) } });
    res.json({ data });
});
business.post("/properties", requirePermission("property:write"), async function(req, res) {
    const { name } = parse(nameSchema, req.body, "Property name is required");
    const data = await prisma.property.create({ data: { name, userId: req.userId!, organizationId: organizationId(req) } });
    res.status(201).json({ data });
});
business.patch("/properties/:id", requirePermission("property:write"), async function(req, res) {
    const id = positiveId(req.params.id, "property ID");
    const { name } = parse(nameSchema, req.body, "Property name is required");
    const data = await prisma.property.update({ where: { id, organizationId: organizationId(req) }, data: { name } });
    res.json({ data });
});
business.delete("/properties/:id", requirePermission("property:write"), async function(req, res) {
    const id = positiveId(req.params.id, "property ID");
    await prisma.property.delete({ where: { id, organizationId: organizationId(req) } });
    res.json({ data: { message: "Property deleted" } });
});

business.get("/units", async function(req, res) {
    const data = await prisma.unit.findMany({ where: { property: { organizationId: organizationId(req) } }, include: { property: true } });
    res.json({ data });
});
business.post("/units", requirePermission("property:write"), async function(req, res) {
    const input = parse(unitSchema, req.body, "Valid unit number and propertyId are required");
    const property = await prisma.property.findFirst({ where: { id: input.propertyId, organizationId: organizationId(req) } });
    if (!property) throw new HttpError(404, "Property not found");
    const data = await prisma.unit.create({ data: input });
    res.status(201).json({ data });
});
business.patch("/units/:id", requirePermission("property:write"), async function(req, res) {
    const id = positiveId(req.params.id, "unit ID");
    const { number } = parse(z.object({ number: z.string().trim().min(1) }), req.body, "Unit number is required");
    const data = await prisma.unit.update({ where: { id, property: { organizationId: organizationId(req) } }, data: { number } });
    res.json({ data });
});
business.delete("/units/:id", requirePermission("property:write"), async function(req, res) {
    const id = positiveId(req.params.id, "unit ID");
    await prisma.unit.delete({ where: { id, property: { organizationId: organizationId(req) } } });
    res.json({ data: { message: "Unit deleted" } });
});

business.get("/maintenance", async function(req, res) {
    const data = await prisma.maintenance.findMany({
        where: { unit: { property: { organizationId: organizationId(req) } } },
        include: { unit: { include: { property: true } } }
    });
    res.json({ data });
});
business.post("/maintenance", requirePermission("maintenance:write"), async function(req, res) {
    const input = parse(maintenanceSchema, req.body, "Valid unitId, title and description are required");
    const unit = await prisma.unit.findFirst({ where: { id: input.unitId, property: { organizationId: organizationId(req) } } });
    if (!unit) throw new HttpError(404, "Unit not found");
    const data = await prisma.maintenance.create({ data: input });
    res.status(201).json({ data });
});
business.patch("/maintenance/:id", requirePermission("maintenance:write"), async function(req, res) {
    const id = positiveId(req.params.id, "maintenance request ID");
    const status = parse(z.enum(["OPEN", "IN_PROGRESS", "COMPLETED"]), req.body?.status, "Status must be OPEN, IN_PROGRESS or COMPLETED");
    const result = await prisma.maintenance.updateMany({
        where: { id, unit: { property: { organizationId: organizationId(req) } } },
        data: { status }
    });
    if (result.count === 0) throw new HttpError(404, "Maintenance request not found");
    res.json({ data: { id, status } });
});

business.get("/renters", async function(req, res) {
    const data = await prisma.renter.findMany({ where: { organizationId: organizationId(req), isArchived: false } });
    res.json({ data });
});
business.get("/renters/archived", async function(req, res) {
    const data = await prisma.renter.findMany({ where: { organizationId: organizationId(req), isArchived: true } });
    res.json({ data });
});
business.post("/renters", requirePermission("renter:write"), async function(req, res) {
    const input = renterInput(req.body);
    const data = await prisma.renter.create({ data: { ...input, userId: req.userId!, organizationId: organizationId(req) } });
    res.status(201).json({ data });
});
business.patch("/renters/:id", requirePermission("renter:write"), async function(req, res) {
    const id = positiveId(req.params.id, "renter ID");
    const input = renterInput(req.body);
    const data = await prisma.renter.update({ where: { id, organizationId: organizationId(req) }, data: input });
    res.json({ data });
});
business.patch("/renters/:id/restore", requirePermission("renter:write"), async function(req, res) {
    const id = positiveId(req.params.id, "renter ID");
    const data = await prisma.renter.update({ where: { id, organizationId: organizationId(req) }, data: { isArchived: false } });
    res.json({ data });
});
business.delete("/renters/:id", requirePermission("renter:write"), async function(req, res) {
    const id = positiveId(req.params.id, "renter ID");
    await prisma.renter.update({ where: { id, organizationId: organizationId(req) }, data: { isArchived: true } });
    res.json({ data: { message: "Renter deleted" } });
});

business.get("/leases", requirePermission("finance:read"), async function(req, res) {
    const data = await prisma.lease.findMany({ where: leaseScope(organizationId(req)), include: { renter: true, unit: { include: { property: true } } } });
    res.json({ data });
});
business.post("/leases", requirePermission("lease:write"), async function(req, res) {
    const input = parse(leaseSchema, req.body, "Valid renterId, unitId and monthlyRent are required");
    const orgId = organizationId(req);
    const [renter, unit] = await Promise.all([
        prisma.renter.findFirst({ where: { id: input.renterId, organizationId: orgId } }),
        prisma.unit.findFirst({ where: { id: input.unitId, property: { organizationId: orgId } } })
    ]);
    if (!renter) throw new HttpError(404, "Renter not found");
    if (!unit) throw new HttpError(404, "Unit not found");
    const data = await prisma.lease.create({ data: input });
    res.status(201).json({ data });
});
business.patch("/leases/:id", requirePermission("lease:write"), async function(req, res) {
    const id = positiveId(req.params.id, "lease ID");
    const input = parse(z.object({ monthlyRent: integer, unitId: integer.optional() }), req.body, "Valid monthlyRent and unitId are required");
    const orgId = organizationId(req);
    if (input.unitId !== undefined) {
        const unit = await prisma.unit.findFirst({ where: { id: input.unitId, property: { organizationId: orgId } } });
        if (!unit) throw new HttpError(404, "Unit not found");
    }
    const changes = { monthlyRent: input.monthlyRent, ...(input.unitId === undefined ? {} : { unitId: input.unitId }) };
    const data = await prisma.lease.update({ where: { id, ...leaseScope(orgId) }, data: changes });
    res.json({ data });
});
business.delete("/leases/:id", requirePermission("lease:write"), async function(req, res) {
    const id = positiveId(req.params.id, "lease ID");
    await prisma.lease.delete({ where: { id, ...leaseScope(organizationId(req)) } });
    res.json({ data: { message: "Lease deleted" } });
});


app.use(function(_req, _res, next) { next(new HttpError(404, "Page not found")); });
app.use(function(error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) {
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    if (error instanceof SyntaxError && "body" in error) return res.status(400).json({ error: "Invalid JSON body" });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") return res.status(404).json({ error: "Record not found" });
        if (error.code === "P2002") return res.status(409).json({ error: "An account or membership already exists" });
        if (error.code === "P2003") return res.status(409).json({ error: "This record is still used by related records" });
        if (error.code === "P2034") return res.status(409).json({ error: "The data changed concurrently. Please try again" });
    }
    console.error("Request failed:", error instanceof Error ? error.name : "UnknownError");
    return res.status(500).json({ error: "Could not complete this request" });
});

if (require.main === module) {
    const port = process.env.PORT || 3000;
    app.listen(port, function() { console.log(`Server running on http://localhost:${port}`); });
}
