import express = require("express");
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./prisma";
import { HttpError, positiveId } from "./http";
import { permissionsFor } from "./permissions";
import { organizationId, requireOrganization, requirePermission } from "./middleware/organization";
const requireAuth = require("./middleware/auth");

export const organizationRoutes = express.Router();
const nameSchema = z.object({ name: z.string().trim().min(1).max(120) });
const roleSchema = z.enum(["OWNER", "PROPERTY_MANAGER", "STAFF"]);
const addMemberSchema = z.object({ email: z.string().trim().email(), role: roleSchema });
const changeRoleSchema = z.object({ role: roleSchema });

function organizationView(value: { organization: { id: number; name: string }; role: "OWNER" | "PROPERTY_MANAGER" | "STAFF" }) {
    return { ...value.organization, role: value.role, permissions: permissionsFor(value.role) };
}

function memberView(value: { userId: number; role: "OWNER" | "PROPERTY_MANAGER" | "STAFF"; createdAt: Date; user: { email: string } }) {
    return { userId: value.userId, email: value.user.email, role: value.role, joinedAt: value.createdAt };
}

organizationRoutes.get("/organizations", requireAuth, async function(req, res) {
    const memberships = await prisma.organizationMembership.findMany({
        where: { userId: req.userId! },
        include: { organization: { select: { id: true, name: true } } },
        orderBy: { id: "asc" }
    });
    res.json({ data: memberships.map(organizationView) });
});

organizationRoutes.post("/organizations", requireAuth, async function(req, res) {
    const result = nameSchema.safeParse(req.body);
    if (!result.success) throw new HttpError(400, "Organization name must contain 1 to 120 characters");
    const membership = await prisma.organizationMembership.create({
        data: {
            user: { connect: { id: req.userId! } },
            role: "OWNER",
            organization: { create: { name: result.data.name } }
        },
        include: { organization: { select: { id: true, name: true } } }
    });
    res.status(201).json({ data: organizationView(membership) });
});

organizationRoutes.patch("/organizations/:id", requireAuth, async function(req, res) {
    const id = positiveId(req.params.id, "organization ID");
    const result = nameSchema.safeParse(req.body);
    if (!result.success) throw new HttpError(400, "Organization name must contain 1 to 120 characters");
    const membership = await prisma.organizationMembership.findUnique({
        where: { organizationId_userId: { organizationId: id, userId: req.userId! } }
    });
    if (membership?.role !== "OWNER") throw new HttpError(403, "Only an organization owner can rename it");
    const organization = await prisma.organization.update({
        where: { id, memberships: { some: { userId: req.userId!, role: "OWNER" } } },
        data: { name: result.data.name },
        select: { id: true, name: true }
    });
    res.json({ data: organizationView({ organization, role: "OWNER" }) });
});

const memberAccess = [requireAuth, requireOrganization, requirePermission("members:manage")];

organizationRoutes.get("/organization/members", ...memberAccess, async function(req, res) {
    const members = await prisma.organizationMembership.findMany({
        where: { organizationId: organizationId(req) },
        include: { user: { select: { email: true } } },
        orderBy: { id: "asc" }
    });
    res.json({ data: members.map(memberView) });
});

// Serialize membership changes per organization and recheck the actor inside the
// transaction. Concurrent demotions/removals must never remove the final owner.
async function changeMembership<T>(organizationId: number, actorId: number, action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            return await prisma.$transaction(async function(tx) {
                await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} FOR UPDATE`;
                const actor = await tx.organizationMembership.findUnique({
                    where: { organizationId_userId: { organizationId, userId: actorId } }
                });
                if (actor?.role !== "OWNER") throw new HttpError(403, "Only an organization owner can manage members");
                return action(tx);
            }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        } catch (error: unknown) {
            const retryable = error instanceof Prisma.PrismaClientKnownRequestError && (
                error.code === "P2034" ||
                // A concurrent rename/settings update can change the locked
                // Organization row; Prisma 5 reports that raw-lock conflict here.
                (error.code === "P2010" && (error.meta?.code === "40001" || error.meta?.code === "40P01"))
            );
            if (!retryable) throw error;
            if (attempt === 2) throw new HttpError(409, "Membership changed concurrently. Please try again");
        }
    }
    throw new HttpError(409, "Membership changed concurrently. Please try again");
}

organizationRoutes.post("/organization/members", ...memberAccess, async function(req, res) {
    const result = addMemberSchema.safeParse(req.body);
    if (!result.success) throw new HttpError(400, "Provide an existing account email and a valid role");
    const member = await changeMembership(organizationId(req), req.userId!, async function(tx) {
        const users = await tx.user.findMany({
            where: { email: { equals: result.data.email, mode: "insensitive" } },
            select: { id: true, email: true }
        });
        const user = users.length === 1 ? users[0] : users.find(value => value.email === result.data.email);
        if (!user) throw new HttpError(404, "That email must already have a REMOTE account");
        return tx.organizationMembership.create({
            data: { organizationId: organizationId(req), userId: user.id, role: result.data.role },
            include: { user: { select: { email: true } } }
        });
    });
    res.status(201).json({ data: memberView(member) });
});

organizationRoutes.patch("/organization/members/:userId", ...memberAccess, async function(req, res) {
    const userId = positiveId(req.params.userId, "member user ID");
    const result = changeRoleSchema.safeParse(req.body);
    if (!result.success) throw new HttpError(400, "Choose OWNER, PROPERTY_MANAGER or STAFF");
    const orgId = organizationId(req);
    const updated = await changeMembership(orgId, req.userId!, async function(tx) {
        const member = await tx.organizationMembership.findUnique({
            where: { organizationId_userId: { organizationId: orgId, userId } }
        });
        if (!member) throw new HttpError(404, "Member not found");
        if (member.role === "OWNER" && result.data.role !== "OWNER") {
            const owners = await tx.organizationMembership.count({ where: { organizationId: orgId, role: "OWNER" } });
            if (owners <= 1) throw new HttpError(409, "An organization must keep at least one owner");
        }
        return tx.organizationMembership.update({
            where: { organizationId_userId: { organizationId: orgId, userId } },
            data: { role: result.data.role },
            include: { user: { select: { email: true } } }
        });
    });
    res.json({ data: memberView(updated) });
});

organizationRoutes.delete("/organization/members/:userId", ...memberAccess, async function(req, res) {
    const userId = positiveId(req.params.userId, "member user ID");
    const orgId = organizationId(req);
    await changeMembership(orgId, req.userId!, async function(tx) {
        const member = await tx.organizationMembership.findUnique({
            where: { organizationId_userId: { organizationId: orgId, userId } }
        });
        if (!member) throw new HttpError(404, "Member not found");
        if (member.role === "OWNER") {
            const owners = await tx.organizationMembership.count({ where: { organizationId: orgId, role: "OWNER" } });
            if (owners <= 1) throw new HttpError(409, "An organization must keep at least one owner");
        }
        await tx.organizationMembership.delete({
            where: { organizationId_userId: { organizationId: orgId, userId } }
        });
    });
    res.json({ data: { message: "Member removed" } });
});
