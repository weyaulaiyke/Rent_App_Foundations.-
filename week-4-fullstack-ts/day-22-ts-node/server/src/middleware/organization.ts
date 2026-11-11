import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { OrganizationRole } from "@prisma/client";
import { prisma } from "../prisma";
import { HttpError, positiveId } from "../http";
import { permissionsFor, type Permission } from "../permissions";

declare global {
    namespace Express {
        interface Request {
            organization?: {
                id: number;
                role: OrganizationRole;
                permissions: Permission[];
            };
        }
    }
}

export async function requireOrganization(req: Request, res: Response, next: NextFunction) {
    if (req.userId === undefined) throw new HttpError(401, "Authentication required");
    const header = req.get("X-Organization-Id");
    const organizationId = header === undefined ? undefined : positiveId(header, "organization ID");
    const membership = await prisma.organizationMembership.findFirst({
        where: {
            userId: req.userId,
            ...(organizationId === undefined ? {} : { organizationId })
        },
        orderBy: { id: "asc" }
    });
    if (!membership) {
        throw new HttpError(403, "You do not have access to this organization");
    }
    req.organization = {
        id: membership.organizationId,
        role: membership.role,
        permissions: permissionsFor(membership.role)
    };
    res.setHeader("X-Organization-Id", String(membership.organizationId));
    next();
}

export function requirePermission(permission: Permission): RequestHandler {
    return function(req, _res, next) {
        if (!req.organization?.permissions.includes(permission)) {
            throw new HttpError(403, "Your organization role does not allow this action");
        }
        next();
    };
}

export function organizationId(req: Request): number {
    if (!req.organization) throw new HttpError(403, "Select an organization");
    return req.organization.id;
}
