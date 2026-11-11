import type { OrganizationRole } from "@prisma/client";

export const ALL_PERMISSIONS = [
    "property:write",
    "renter:write",
    "lease:write",
    "finance:read",
    "payment:write",
    "maintenance:write",
    "organization:manage",
    "members:manage"
] as const;

export type Permission = typeof ALL_PERMISSIONS[number];

export function permissionsFor(role: OrganizationRole): Permission[] {
    if (role === "OWNER") return [...ALL_PERMISSIONS];
    if (role === "PROPERTY_MANAGER") return ALL_PERMISSIONS.slice(0, 6);
    return ["maintenance:write"];
}
