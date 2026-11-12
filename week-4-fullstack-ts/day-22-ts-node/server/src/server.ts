const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken")
const cors = require("cors");
const requireAuth = require("./middleware/auth")
import { z } from "zod";
import express = require("express");
const cookieParser = require("cookie-parser")
import PrismaPackage = require("@prisma/client")
import { error } from "console";
const { PrismaClient } = PrismaPackage;
require("dotenv").config();

declare global {
    namespace Express {
        interface Request {
            userId?: number;
            organizationId?: number;
            organizationRole?: PrismaPackage.OrganizationRole;
            workspaceType?: PrismaPackage.WorkspaceType;
        }
    }
}

const renterSchema = z.object({
    name: z.string().trim().min(1)
});

type RenterInput = z.infer<typeof renterSchema>

const app = express();
const prisma = new PrismaClient();

app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true
}));

async function requireOrganization(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) {
    const userId = req.userId;

    if (userId === undefined) {
        return res.status(401).json({
            error: "Authentication required"
        });
    }

    const headerResult = z.coerce.number()
        .int()
        .positive()
        .max(2147483647)
        .optional()
        .safeParse(req.get("X-Organization-Id"));

    if (!headerResult.success) {
        return res.status(400).json({
            error: "Invalid organization ID"
        });
    }

    const sessionOrganizationId = req.organizationId;
    const headerOrganizationId = headerResult.data;

    if (
        sessionOrganizationId !== undefined &&
        headerOrganizationId !== undefined &&
        sessionOrganizationId !== headerOrganizationId
    ) {
        return res.status(403).json({
            error: "You cannot switch organizations during this session"
        });
    }

    const selectedOrganizationId =
        sessionOrganizationId ?? headerOrganizationId;

    try {
        const membership = await prisma.organizationMembership.findFirst({
            where: {
                userId: userId,
                ...(selectedOrganizationId === undefined
                    ? {}
                    : { organizationId: selectedOrganizationId })
            },
            include: {
                organization: {
                    select: {
                        workspaceType: true
                    }
                }
            },
            orderBy: {
                id: "asc"
            }
        });

        if (!membership) {
            return res.status(403).json({
                error: "You do not have access to this workspace"
            });
        }

        req.organizationId = membership.organizationId;
        req.organizationRole = membership.role;
        req.workspaceType = membership.organization.workspaceType;

        next();
    } catch (error) {
        console.error("Workspace membership check failed:", error);

        return res.status(500).json({
            error: "Could not check workspace access"
        });
    }
}

function requireOrganizationRoles(
    ...allowedRoles: PrismaPackage.OrganizationRole[]
) {
    return function(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        const role = req.organizationRole;

        if (role === undefined) {
            return res.status(403).json({
                error: "Organization access required"
            });
        }

        if (!allowedRoles.includes(role)) {
            return res.status(403).json({
                error: "You do not have permission to perform this action"
            });
        }

        next();
    };
}

app.get(
    "/organization/current",
    requireAuth,
    requireOrganization,
    function(req, res) {
        if (
            req.organizationId === undefined || req.organizationRole === undefined
        ) {
            return res.status(403).json({
                error: "Organization access required"
            });
        }

        return res.json({
            data: {
                organizationId: req.organizationId,
                role: req.organizationRole
            }
        });
    }
);

app.get("/", function(req, res) {
    res.json({
        message: "Rent API is running"
    });
});

app.post("/auth/register", async function(req, res) {
    const result = z.object({
        email: z.string().trim().email().max(254),
        password: z.string().min(1).max(72),
        workspaceType: z.enum(["PERSONAL", "COMPANY"]).default("PERSONAL"),
        companyName: z.string().trim().min(1).max(120).optional()
    }).safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({
            error: "Valid registration details are required"
        });
    }

    if (
        result.data.workspaceType === "COMPANY" &&
        !result.data.companyName
    ) {
        return res.status(400).json({
            error: "Company name is required for a company account"
        });
    }

    try {
        const passwordHash = await bcrypt.hash(
            result.data.password,
            10
        );

        const workspaceName =
            result.data.workspaceType === "COMPANY"
                ? result.data.companyName as string
                : "Personal Workspace";

        const user = await prisma.user.create({
            data: {
                email: result.data.email,
                passwordHash: passwordHash,
                memberships: {
                    create: {
                        role: "OWNER",
                        organization: {
                            create: {
                                name: workspaceName,
                                workspaceType: result.data.workspaceType
                            }
                        }
                    }
                }
            },
            select: {
                id: true,
                email: true
            }
        });

        return res.status(201).json({
            user: user,
            workspace: {
                name: workspaceName,
                workspaceType: result.data.workspaceType
            }
        });
    } catch (error) {
        if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "P2002"
        ) {
            return res.status(409).json({
                error: "An account with this email already exists"
            });
        }

        console.error("Registration failed:", error);

        return res.status(500).json({
            error: "Could not create account"
        });
    }
});

app.post("/auth/login", async function(req, res) {
    const result = z.object({
        email: z.string().trim().email().max(254),
        password: z.string().min(1),
        workspaceType: z.enum(["PERSONAL", "COMPANY"]).default("PERSONAL")
    }).safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({
            error: "A valid email, password and workspace type are required"
        });
    }

    try {
        const user = await prisma.user.findUnique({
            where: {
                email: result.data.email
            }
        });

        if (!user) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        const passwordMatches = await bcrypt.compare(
            result.data.password,
            user.passwordHash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        const memberships = await prisma.organizationMembership.findMany({
            where: {
                userId: user.id,
                organization: {
                    workspaceType: result.data.workspaceType
                }
            },
            include: {
                organization: true
            },
            orderBy: {
                id: "asc"
            },
            take: 2
        });

        if (memberships.length === 0) {
            return res.status(403).json({
                error: `This account does not have a ${result.data.workspaceType.toLowerCase()} workspace`
            });
        }

        if (memberships.length > 1) {
            return res.status(409).json({
                error: "Multiple matching workspaces found. Workspace selection is required."
            });
        }

        const membership = memberships[0];

        if (!membership) {
            return res.status(403).json({
                error: "No matching workspace was found"
            });
        }

        const token = jwt.sign(
            {
                userId: user.id,
                organizationId: membership.organizationId
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1d"
            }
        );

        res.cookie("token", token, {
            httpOnly: true,
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 24 * 60 * 60 * 1000
        });

        return res.json({
            message: "Login successful",
            user: {
                id: user.id,
                email: user.email,
                organizationId: membership.organizationId,
                organizationName: membership.organization.name,
                workspaceType: membership.organization.workspaceType,
                role: membership.role
            }
        });
    } catch (error) {
        console.error("Login failed:", error);

        return res.status(500).json({
            error: "Could not sign in"
        });
    }
});

app.post("/auth/logout", function(req, res){
    res.clearCookie("token",{
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        secure: process.env.NODE_ENV === "production",
    });
    return res.json({
        message: "Logout successful",
        
    })
})

app.get("/auth/me", requireAuth, async function(req, res) {
    const userId = req.userId;
    const organizationId = req.organizationId;

    if (userId === undefined || organizationId === undefined) {
        return res.status(401).json({
            error: "Please sign in again"
        });
    }

    try {
        const membership = await prisma.organizationMembership.findFirst({
            where: {
                userId: userId,
                organizationId: organizationId
            },
            include: {
                user: true,
                organization: true
            }
        });

        if (!membership) {
            return res.status(401).json({
                error: "Your workspace access is no longer available"
            });
        }

        return res.json({
            id: membership.user.id,
            email: membership.user.email,
            organizationId: membership.organizationId,
            organizationName: membership.organization.name,
            workspaceType: membership.organization.workspaceType,
            role: membership.role
        });
    } catch (error) {
        console.error("Could not load authenticated user:", error);

        return res.status(500).json({
            error: "Could not load your account"
        });
    }
});

app.post("/organizations", requireAuth, async function(req, res){
    const userId = req.userId;

    if (userId === undefined){
        return res.status(401).json({
            error: "Authentication required"
        });
    }

    const result = z.object({
        name: z.string().trim().min(1).max(120),
        workspaceType: z.enum(["PERSONAL", "COMPANY"]).default("PERSONAL")
    }).safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({
            error: "Organization name must contain 1-120 characters"
        });
    }

    try {
        const organization = await prisma.organization.create({
            data: {
                name: result.data.name,
                workspaceType: result.data.workspaceType,
                memberships: {
                    create: {
                        userId: userId,
                        role: "OWNER"
                    }
                }
            }
        });

        return res.status(201).json({
            data: organization
        });
    } catch (error) {
        console.error("Organization creation failed:", error);

        return res.status(500).json({
            error: "Could not create organization"
        });
    }
});

app.get("/organizations", requireAuth, async function(req, res){
    const userId = req.userId;

    if (userId === undefined) {
        return res.status(401).json({
            error: "Authentication required"
        });
    }

    try {
        const memberships = await prisma.organizationMembership.findMany({
            where: {
                userId: userId
            },
            include:{
                organization: true
            },
            orderBy: {
                id: "asc"
            }
        });

        return res.json({
            data: memberships.map(function(membership){
                return {
                    id: membership.organization.id,
                    name: membership.organization.name,
                    role: membership.role,
                    workspaceType: membership.organization.workspaceType
                };
            })
        });
    } catch (error) {
        console.error("Could not load organizations:", error);

        return res.status(500).json({
            error: "Could not load organizations"
        });
    }
});

app.get("/properties", requireAuth, requireOrganization, async function(req, res) {
    const organizationId = req.organizationId;

    if (organizationId === undefined) {
        return res.status(403).json({
            error: "Organization access required"
        });
    }

    try {
        const properties = await prisma.property.findMany({
            where: {
                organizationId: organizationId
            },
            orderBy: {
                id: "asc"
            }
        });

        return res.json({
            data: properties
        });
    } catch (error) {
        console.error("Could not load properties:", error);

        return res.status(500).json({
            error: "Could not load properties"
        });
    }
});

app.post(
    "/properties",
    requireAuth,
    requireOrganization,
    requireOrganizationRoles("OWNER", "PROPERTY_MANAGER"),
    async function(req, res) {
        const userId = req.userId;
        const organizationId = req.organizationId;

        if (userId === undefined) {
            return res.status(401).json({
                error: "Authentication required"
            });
        }

        if (organizationId === undefined) {
            return res.status(403).json({
                error: "Organization access required"
            });
        }

        const result = z.object({
            name: z.string().trim().min(1).max(120)
        }).safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                error: "Property name must contain 1-120 characters"
            });
        }

        try {
            const property = await prisma.property.create({
                data: {
                    name: result.data.name,
                    userId: userId,
                    organizationId: organizationId
                }
            });

            return res.status(201).json({
                data: property
            });
        } catch (error) {
            console.error("Could not create property:", error);

            return res.status(500).json({
                error: "Could not create property"
            });
        }
    }
);

app.patch(
    "/properties/:id",
    requireAuth,
    requireOrganization,
    requireOrganizationRoles("OWNER", "PROPERTY_MANAGER"),
    async function(req, res) {
        const organizationId = req.organizationId;
        const propertyId = Number(req.params.id);

        if (organizationId === undefined) {
            return res.status(403).json({
                error: "Organization access required"
            });
        }

        if (
            !Number.isInteger(propertyId) ||
            propertyId <= 0 ||
            propertyId > 2147483647
        ) {
            return res.status(400).json({
                error: "Invalid property ID"
            });
        }

        const result = z.object({
            name: z.string().trim().min(1).max(120)
        }).safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                error: "Property name must contain 1-120 characters"
            });
        }

        try {
            const updateResult = await prisma.property.updateMany({
                where: {
                    id: propertyId,
                    organizationId: organizationId
                },
                data: {
                    name: result.data.name
                }
            });

            if (updateResult.count === 0) {
                return res.status(404).json({
                    error: "Property not found"
                });
            }

            const updatedProperty = await prisma.property.findFirst({
                where: {
                    id: propertyId,
                    organizationId: organizationId
                }
            });

            return res.json({
                data: updatedProperty
            });
        } catch (error) {
            console.error("Could not update property:", error);

            return res.status(500).json({
                error: "Could not update property"
            });
        }
    }
);

app.delete(
    "/properties/:id",
    requireAuth,
    requireOrganization,
    requireOrganizationRoles("OWNER", "PROPERTY_MANAGER"),
    async function(req, res) {
        const organizationId = req.organizationId;
        const propertyId = Number(req.params.id);

        if (organizationId === undefined) {
            return res.status(403).json({
                error: "Organization access required"
            });
        }

        if (
            !Number.isInteger(propertyId) ||
            propertyId <= 0 ||
            propertyId > 2147483647
        ) {
            return res.status(400).json({
                error: "Invalid property ID"
            });
        }

        try {
            const deleteResult = await prisma.property.deleteMany({
                where: {
                    id: propertyId,
                    organizationId: organizationId
                }
            });

            if (deleteResult.count === 0) {
                return res.status(404).json({
                    error: "Property not found"
                });
            }

            return res.json({
                data: {
                    message: "Property deleted"
                }
            });
        } catch (error) {
            console.error("Could not delete property:", error);

            return res.status(500).json({
                error: "Could not delete property"
            });
        }
    }
);

app.get(
    "/units",
    requireAuth,
    requireOrganization,
    async function(req, res) {
        const organizationId = req.organizationId;

        if (organizationId === undefined) {
            return res.status(403).json({
                error: "Workspace access required"
            });
        }

        try {
            const units = await prisma.unit.findMany({
                where: {
                    property: {
                        organizationId: organizationId
                    }
                },
                include: {
                    property: true
                },
                orderBy: {
                    id: "asc"
                }
            });

            return res.json({
                data: units
            });
        } catch (error) {
            console.error("Could not load units:", error);

            return res.status(500).json({
                error: "Could not load units"
            });
        }
    }
);

app.post(
    "/units",
    requireAuth,
    requireOrganization,
    requireOrganizationRoles("OWNER", "PROPERTY_MANAGER"),
    async function(req, res) {
        const organizationId = req.organizationId;

        if (organizationId === undefined) {
            return res.status(403).json({
                error: "Workspace access required"
            });
        }

        const result = z.object({
            number: z.string().trim().min(1).max(50),
            propertyId: z.coerce.number()
                .int()
                .positive()
                .max(2147483647)
        }).safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                error: "A valid unit number and property are required"
            });
        }

        try {
            const property = await prisma.property.findFirst({
                where: {
                    id: result.data.propertyId,
                    organizationId: organizationId
                }
            });

            if (!property) {
                return res.status(404).json({
                    error: "Property not found in this workspace"
                });
            }

            const unit = await prisma.unit.create({
                data: {
                    number: result.data.number,
                    propertyId: property.id
                }
            });

            return res.status(201).json({
                data: unit
            });
        } catch (error) {
            console.error("Could not create unit:", error);

            return res.status(500).json({
                error: "Could not create unit"
            });
        }
    }
);

app.get(
    "/maintenance",
    requireAuth,
    requireOrganization,
    async function(req, res) {
        const organizationId = req.organizationId;

        if (organizationId === undefined) {
            return res.status(403).json({
                error: "Workspace access required"
            });
        }

        try {
            const requests = await prisma.maintenance.findMany({
                where: {
                    unit: {
                        property: {
                            organizationId: organizationId
                        }
                    }
                },
                include: {
                    unit: {
                        include: {
                            property: true
                        }
                    }
                },
                orderBy: {
                    createdAt: "desc"
                }
            });

            return res.json({
                data: requests
            });
        } catch (error) {
            console.error("Could not load maintenance requests:", error);

            return res.status(500).json({
                error: "Could not load maintenance requests"
            });
        }
    }
);

app.post(
    "/maintenance",
    requireAuth,
    requireOrganization,
    async function(req, res) {
        const organizationId = req.organizationId;

        if (organizationId === undefined) {
            return res.status(403).json({
                error: "Workspace access required"
            });
        }

        const result = z.object({
            unitId: z.coerce.number()
                .int()
                .positive()
                .max(2147483647),
            title: z.string().trim().min(1).max(120),
            description: z.string().trim().min(1).max(2000)
        }).safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                error: "A valid unit, title and description are required"
            });
        }

        try {
            const unit = await prisma.unit.findFirst({
                where: {
                    id: result.data.unitId,
                    property: {
                        organizationId: organizationId
                    }
                }
            });

            if (!unit) {
                return res.status(404).json({
                    error: "Unit not found in this workspace"
                });
            }

            const request = await prisma.maintenance.create({
                data: {
                    unitId: unit.id,
                    title: result.data.title,
                    description: result.data.description
                }
            });

            return res.status(201).json({
                data: request
            });
        } catch (error) {
            console.error("Could not create maintenance request:", error);

            return res.status(500).json({
                error: "Could not create maintenance request"
            });
        }
    }
);

app.patch(
    "/maintenance/:id",
    requireAuth,
    requireOrganization,
    async function(req, res) {
        const organizationId = req.organizationId;
        const requestId = Number(req.params.id);

        if (organizationId === undefined) {
            return res.status(403).json({
                error: "Workspace access required"
            });
        }

        if (
            !Number.isInteger(requestId) ||
            requestId <= 0 ||
            requestId > 2147483647
        ) {
            return res.status(400).json({
                error: "Invalid maintenance request ID"
            });
        }

        const result = z.enum([
            "OPEN",
            "IN_PROGRESS",
            "COMPLETED"
        ]).safeParse(req.body?.status);

        if (!result.success) {
            return res.status(400).json({
                error: "Status must be OPEN, IN_PROGRESS or COMPLETED"
            });
        }

        try {
            const updateResult = await prisma.maintenance.updateMany({
                where: {
                    id: requestId,
                    unit: {
                        property: {
                            organizationId: organizationId
                        }
                    }
                },
                data: {
                    status: result.data
                }
            });

            if (updateResult.count === 0) {
                return res.status(404).json({
                    error: "Maintenance request not found"
                });
            }

            return res.json({
                data: {
                    id: requestId,
                    status: result.data
                }
            });
        } catch (error) {
            console.error("Could not update maintenance status:", error);

            return res.status(500).json({
                error: "Could not update maintenance status"
            });
        }
    }
);

app.patch(
    "/units/:id",
    requireAuth,
    requireOrganization,
    requireOrganizationRoles("OWNER", "PROPERTY_MANAGER"),
    async function(req, res) {
        const organizationId = req.organizationId;
        const unitId = Number(req.params.id);

        if (organizationId === undefined) {
            return res.status(403).json({
                error: "Workspace access required"
            });
        }

        if (
            !Number.isInteger(unitId) ||
            unitId <= 0 ||
            unitId > 2147483647
        ) {
            return res.status(400).json({
                error: "Invalid unit ID"
            });
        }

        const result = z.object({
            number: z.string().trim().min(1).max(50)
        }).safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                error: "A valid unit number is required"
            });
        }

        try {
            const updateResult = await prisma.unit.updateMany({
                where: {
                    id: unitId,
                    property: {
                        organizationId: organizationId
                    }
                },
                data: {
                    number: result.data.number
                }
            });

            if (updateResult.count === 0) {
                return res.status(404).json({
                    error: "Unit not found"
                });
            }

            const updatedUnit = await prisma.unit.findFirst({
                where: {
                    id: unitId,
                    property: {
                        organizationId: organizationId
                    }
                }
            });

            return res.json({
                data: updatedUnit
            });
        } catch (error) {
            console.error("Could not update unit:", error);

            return res.status(500).json({
                error: "Could not update unit"
            });
        }
    }
);

app.delete(
    "/units/:id",
    requireAuth,
    requireOrganization,
    requireOrganizationRoles("OWNER", "PROPERTY_MANAGER"),
    async function(req, res) {
        const organizationId = req.organizationId;
        const unitId = Number(req.params.id);

        if (organizationId === undefined) {
            return res.status(403).json({
                error: "Workspace access required"
            });
        }

        if (
            !Number.isInteger(unitId) ||
            unitId <= 0 ||
            unitId > 2147483647
        ) {
            return res.status(400).json({
                error: "Invalid unit ID"
            });
        }

        try {
            const deleteResult = await prisma.unit.deleteMany({
                where: {
                    id: unitId,
                    property: {
                        organizationId: organizationId
                    }
                }
            });

            if (deleteResult.count === 0) {
                return res.status(404).json({
                    error: "Unit not found"
                });
            }

            return res.json({
                data: {
                    message: "Unit deleted"
                }
            });
        } catch (error) {
            console.error("Could not delete unit:", error);

            return res.status(500).json({
                error: "Could not delete unit"
            });
        }
    }
);

app.get(
    "/renters",
    requireAuth,
    requireOrganization,
    async function(req, res) {
        const organizationId = req.organizationId;

        if (organizationId === undefined) {
            return res.status(403).json({
                error: "Workspace access required"
            });
        }

        try {
            const renters = await prisma.renter.findMany({
                where: {
                    isArchived: false,
                    organizationId: organizationId
                },
                orderBy: {
                    id: "asc"
                }
            });

            return res.json({
                data: renters
            });
        } catch (error) {
            console.error("Could not load renters:", error);

            return res.status(500).json({
                error: "Could not load renters"
            });
        }
    }
);

app.get(
    "/renters/archived",
    requireAuth,
    requireOrganization,
    async function(req, res) {
        const organizationId = req.organizationId;

        if (organizationId === undefined) {
            return res.status(403).json({
                error: "Workspace access required"
            });
        }

        try {
            const renters = await prisma.renter.findMany({
                where: {
                    isArchived: true,
                    organizationId: organizationId
                },
                orderBy: {
                    id: "asc"
                }
            });

            return res.json({
                data: renters
            });
        } catch (error) {
            console.error("Could not load archived renters:", error);

            return res.status(500).json({
                error: "Could not load archived renters"
            });
        }
    }
);

app.post(
    "/renters",
    requireAuth,
    requireOrganization,
    requireOrganizationRoles("OWNER", "PROPERTY_MANAGER"),
    async function(req, res) {
        const userId = req.userId;
        const organizationId = req.organizationId;

        if (userId === undefined) {
            return res.status(401).json({
                error: "Authentication required"
            });
        }

        if (organizationId === undefined) {
            return res.status(403).json({
                error: "Workspace access required"
            });
        }

        const result = renterSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                error: "A valid renter name is required"
            });
        }

        try {
            const renter = await prisma.renter.create({
                data: {
                    name: result.data.name,
                    userId: userId,
                    organizationId: organizationId
                }
            });

            return res.status(201).json({
                data: renter
            });
        } catch (error) {
            console.error("Could not create renter:", error);

            return res.status(500).json({
                error: "Could not create renter"
            });
        }
    }
);

app.patch(
    "/renters/:id",
    requireAuth,
    requireOrganization,
    requireOrganizationRoles("OWNER", "PROPERTY_MANAGER"),
    async function(req, res) {
        const organizationId = req.organizationId;
        const renterId = Number(req.params.id);

        if (organizationId === undefined) {
            return res.status(403).json({
                error: "Workspace access required"
            });
        }

        if (
            !Number.isInteger(renterId) ||
            renterId <= 0 ||
            renterId > 2147483647
        ) {
            return res.status(400).json({
                error: "Invalid renter ID"
            });
        }

        const result = renterSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                error: "A valid renter name is required"
            });
        }

        try {
            const updateResult = await prisma.renter.updateMany({
                where: {
                    id: renterId,
                    organizationId: organizationId
                },
                data: {
                    name: result.data.name
                }
            });

            if (updateResult.count === 0) {
                return res.status(404).json({
                    error: "Renter not found"
                });
            }

            const updatedRenter = await prisma.renter.findFirst({
                where: {
                    id: renterId,
                    organizationId: organizationId
                }
            });

            return res.json({
                data: updatedRenter
            });
        } catch (error) {
            console.error("Could not update renter:", error);

            return res.status(500).json({
                error: "Could not update renter"
            });
        }
    }
);

app.patch(
    "/renters/:id/restore",
    requireAuth,
    requireOrganization,
    requireOrganizationRoles("OWNER", "PROPERTY_MANAGER"),
    async function(req, res) {
        const organizationId = req.organizationId;
        const renterId = Number(req.params.id);

        if (organizationId === undefined) {
            return res.status(403).json({
                error: "Workspace access required"
            });
        }

        if (
            !Number.isInteger(renterId) ||
            renterId <= 0 ||
            renterId > 2147483647
        ) {
            return res.status(400).json({
                error: "Invalid renter ID"
            });
        }

        try {
            const restoreResult = await prisma.renter.updateMany({
                where: {
                    id: renterId,
                    organizationId: organizationId,
                    isArchived: true
                },
                data: {
                    isArchived: false
                }
            });

            if (restoreResult.count === 0) {
                return res.status(404).json({
                    error: "Archived renter not found"
                });
            }

            const restoredRenter = await prisma.renter.findFirst({
                where: {
                    id: renterId,
                    organizationId: organizationId
                }
            });

            return res.json({
                data: restoredRenter
            });
        } catch (error) {
            console.error("Could not restore renter:", error);

            return res.status(500).json({
                error: "Could not restore renter"
            });
        }
    }
);

app.delete(
    "/renters/:id",
    requireAuth,
    requireOrganization,
    requireOrganizationRoles("OWNER", "PROPERTY_MANAGER"),
    async function(req, res) {
        const organizationId = req.organizationId;
        const renterId = Number(req.params.id);

        if (organizationId === undefined) {
            return res.status(403).json({
                error: "Workspace access required"
            });
        }

        if (
            !Number.isInteger(renterId) ||
            renterId <= 0 ||
            renterId > 2147483647
        ) {
            return res.status(400).json({
                error: "Invalid renter ID"
            });
        }

        try {
            const archiveResult = await prisma.renter.updateMany({
                where: {
                    id: renterId,
                    organizationId: organizationId,
                    isArchived: false
                },
                data: {
                    isArchived: true
                }
            });

            if (archiveResult.count === 0) {
                return res.status(404).json({
                    error: "Active renter not found"
                });
            }

            return res.json({
                data: {
                    message: "Renter archived"
                }
            });
        } catch (error) {
            console.error("Could not archive renter:", error);

            return res.status(500).json({
                error: "Could not archive renter"
            });
        }
    }
);

app.get(
    "/leases",
    requireAuth,
    requireOrganization,
    requireOrganizationRoles("OWNER", "PROPERTY_MANAGER"),
    async function(req, res) {
        const organizationId = req.organizationId;

        if (organizationId === undefined) {
            return res.status(403).json({
                error: "Workspace access required"
            });
        }

        try {
            const leases = await prisma.lease.findMany({
                where: {
                    renter: {
                        organizationId: organizationId
                    },
                    unit: {
                        property: {
                            organizationId: organizationId
                        }
                    }
                },
                include: {
                    renter: true,
                    unit: {
                        include: {
                            property: true
                        }
                    }
                },
                orderBy: {
                    id: "asc"
                }
            });

            return res.json({
                data: leases
            });
        } catch (error) {
            console.error("Could not load leases:", error);

            return res.status(500).json({
                error: "Could not load leases"
            });
        }
    }
);

app.post(
    "/leases",
    requireAuth,
    requireOrganization,
    requireOrganizationRoles("OWNER", "PROPERTY_MANAGER"),
    async function(req, res) {
        const organizationId = req.organizationId;

        if (organizationId === undefined) {
            return res.status(403).json({
                error: "Workspace access required"
            });
        }

        const result = z.object({
            renterId: z.coerce.number()
                .int()
                .positive()
                .max(2147483647),
            unitId: z.coerce.number()
                .int()
                .positive()
                .max(2147483647),
            monthlyRent: z.coerce.number()
                .int()
                .positive()
                .max(2147483647)
        }).safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                error: "A valid renter, unit and monthly rent are required"
            });
        }

        try {
            const [renter, unit] = await Promise.all([
                prisma.renter.findFirst({
                    where: {
                        id: result.data.renterId,
                        organizationId: organizationId,
                        isArchived: false
                    }
                }),
                prisma.unit.findFirst({
                    where: {
                        id: result.data.unitId,
                        property: {
                            organizationId: organizationId
                        }
                    }
                })
            ]);

            if (!renter) {
                return res.status(404).json({
                    error: "Active renter not found in this workspace"
                });
            }

            if (!unit) {
                return res.status(404).json({
                    error: "Unit not found in this workspace"
                });
            }

            const lease = await prisma.lease.create({
                data: {
                    renterId: renter.id,
                    unitId: unit.id,
                    monthlyRent: result.data.monthlyRent
                }
            });

            return res.status(201).json({
                data: lease
            });
        } catch (error) {
            console.error("Could not create lease:", error);

            return res.status(500).json({
                error: "Could not create lease"
            });
        }
    }
);

app.patch(
    "/leases/:id",
    requireAuth,
    requireOrganization,
    requireOrganizationRoles("OWNER", "PROPERTY_MANAGER"),
    async function(req, res) {
        const organizationId = req.organizationId;
        const leaseId = Number(req.params.id);

        if (organizationId === undefined) {
            return res.status(403).json({
                error: "Workspace access required"
            });
        }

        if (
            !Number.isInteger(leaseId) ||
            leaseId <= 0 ||
            leaseId > 2147483647
        ) {
            return res.status(400).json({
                error: "Invalid lease ID"
            });
        }

        const result = z.object({
            monthlyRent: z.coerce.number()
                .int()
                .positive()
                .max(2147483647)
        }).safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                error: "A valid monthly rent is required"
            });
        }

        try {
            const updateResult = await prisma.lease.updateMany({
                where: {
                    id: leaseId,
                    renter: {
                        organizationId: organizationId
                    },
                    unit: {
                        property: {
                            organizationId: organizationId
                        }
                    }
                },
                data: {
                    monthlyRent: result.data.monthlyRent
                }
            });

            if (updateResult.count === 0) {
                return res.status(404).json({
                    error: "Lease not found"
                });
            }

            const updatedLease = await prisma.lease.findFirst({
                where: {
                    id: leaseId,
                    renter: {
                        organizationId: organizationId
                    },
                    unit: {
                        property: {
                            organizationId: organizationId
                        }
                    }
                }
            });

            return res.json({
                data: updatedLease
            });
        } catch (error) {
            console.error("Could not update lease:", error);

            return res.status(500).json({
                error: "Could not update lease"
            });
        }
    }
);

app.delete(
    "/leases/:id",
    requireAuth,
    requireOrganization,
    requireOrganizationRoles("OWNER", "PROPERTY_MANAGER"),
    async function(req, res) {
        const organizationId = req.organizationId;
        const leaseId = Number(req.params.id);

        if (organizationId === undefined) {
            return res.status(403).json({
                error: "Workspace access required"
            });
        }

        if (
            !Number.isInteger(leaseId) ||
            leaseId <= 0 ||
            leaseId > 2147483647
        ) {
            return res.status(400).json({
                error: "Invalid lease ID"
            });
        }

        try {
            const deleteResult = await prisma.lease.deleteMany({
                where: {
                    id: leaseId,
                    renter: {
                        organizationId: organizationId
                    },
                    unit: {
                        property: {
                            organizationId: organizationId
                        }
                    }
                }
            });

            if (deleteResult.count === 0) {
                return res.status(404).json({
                    error: "Lease not found"
                });
            }

            return res.json({
                data: {
                    message: "Lease deleted"
                }
            });
        } catch (error) {
            console.error("Could not delete lease:", error);

            return res.status(500).json({
                error: "Could not delete lease"
            });
        }
    }
);

app.get(
    "/payments",
    requireAuth,
    requireOrganization,
    requireOrganizationRoles("OWNER", "PROPERTY_MANAGER"),
    async function(req, res) {
        const organizationId = req.organizationId;

        if (organizationId === undefined) {
            return res.status(403).json({
                error: "Workspace access required"
            });
        }

        try {
            const payments = await prisma.payment.findMany({
                where: {
                    renter: {
                        organizationId: organizationId
                    }
                },
                include: {
                    renter: true
                },
                orderBy: {
                    paymentDate: "desc"
                }
            });

            return res.json({
                data: payments
            });
        } catch (error) {
            console.error("Could not load payments:", error);

            return res.status(500).json({
                error: "Could not load payments"
            });
        }
    }
);

app.post(
    "/payments",
    requireAuth,
    requireOrganization,
    requireOrganizationRoles("OWNER", "PROPERTY_MANAGER"),
    async function(req, res) {
        const organizationId = req.organizationId;

        if (organizationId === undefined) {
            return res.status(403).json({
                error: "Workspace access required"
            });
        }

        const result = z.object({
            renterId: z.coerce.number()
                .int()
                .positive()
                .max(2147483647),
            amount: z.coerce.number()
                .int()
                .positive()
                .max(2147483647),
            paymentDate: z.coerce.date()
        }).safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                error: "A valid renter, amount and payment date are required"
            });
        }

        try {
            const renter = await prisma.renter.findFirst({
                where: {
                    id: result.data.renterId,
                    organizationId: organizationId,
                    isArchived: false,
                    leases: {
                        some: {
                            unit: {
                                property: {
                                    organizationId: organizationId
                                }
                            }
                        }
                    }
                }
            });

            if (!renter) {
                return res.status(404).json({
                    error: "Active leased renter not found in this workspace"
                });
            }

            const payment = await prisma.payment.create({
                data: {
                    renterId: renter.id,
                    amount: result.data.amount,
                    paymentDate: result.data.paymentDate
                }
            });

            return res.status(201).json({
                data: payment
            });
        } catch (error) {
            console.error("Could not create payment:", error);

            return res.status(500).json({
                error: "Could not create payment"
            });
        }
    }
);

app.patch(
    "/payments/:id",
    requireAuth,
    requireOrganization,
    requireOrganizationRoles("OWNER", "PROPERTY_MANAGER"),
    async function(req, res) {
        const organizationId = req.organizationId;
        const paymentId = Number(req.params.id);

        if (organizationId === undefined) {
            return res.status(403).json({
                error: "Workspace access required"
            });
        }

        if (
            !Number.isInteger(paymentId) ||
            paymentId <= 0 ||
            paymentId > 2147483647
        ) {
            return res.status(400).json({
                error: "Invalid payment ID"
            });
        }

        const result = z.object({
            amount: z.coerce.number()
                .int()
                .positive()
                .max(2147483647)
                .optional(),
            paymentDate: z.coerce.date().optional()
        }).refine(
            (data) =>
                data.amount !== undefined ||
                data.paymentDate !== undefined,
            {
                message: "Amount or payment date is required"
            }
        ).safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                error: "A valid amount or payment date is required"
            });
        }

        try {
            const updateData: PrismaPackage.Prisma.PaymentUpdateManyMutationInput = {};

            if (result.data.amount !== undefined) {
                updateData.amount = result.data.amount;
            }

            if (result.data.paymentDate !== undefined) {
                updateData.paymentDate = result.data.paymentDate;
            }
            const updateResult = await prisma.payment.updateMany({
                where: {
                    id: paymentId,
                    renter: {
                        organizationId: organizationId
                    }
                },
                data: updateData
            });

            if (updateResult.count === 0) {
                return res.status(404).json({
                    error: "Payment not found"
                });
            }

            const updatedPayment = await prisma.payment.findFirst({
                where: {
                    id: paymentId,
                    renter: {
                        organizationId: organizationId
                    }
                },
                include: {
                    renter: true
                }
            });

            return res.json({
                data: updatedPayment
            });
        } catch (error) {
            console.error("Could not update payment:", error);

            return res.status(500).json({
                error: "Could not update payment"
            });
        }
    }
);

app.delete(
    "/payments/:id",
    requireAuth,
    requireOrganization,
    requireOrganizationRoles("OWNER", "PROPERTY_MANAGER"),
    async function(req, res) {
        const organizationId = req.organizationId;
        const paymentId = Number(req.params.id);

        if (organizationId === undefined) {
            return res.status(403).json({
                error: "Workspace access required"
            });
        }

        if (
            !Number.isInteger(paymentId) ||
            paymentId <= 0 ||
            paymentId > 2147483647
        ) {
            return res.status(400).json({
                error: "Invalid payment ID"
            });
        }

        try {
            const deleteResult = await prisma.payment.deleteMany({
                where: {
                    id: paymentId,
                    renter: {
                        organizationId: organizationId
                    }
                }
            });

            if (deleteResult.count === 0) {
                return res.status(404).json({
                    error: "Payment not found"
                });
            }

            return res.json({
                data: {
                    message: "Payment deleted"
                }
            });
        } catch (error) {
            console.error("Could not delete payment:", error);

            return res.status(500).json({
                error: "Could not delete payment"
            });
        }
    }
);

app.get(
    "/reports/arrears",
    requireAuth,
    requireOrganization,
    requireOrganizationRoles("OWNER", "PROPERTY_MANAGER"),
    async function(req, res) {
        const organizationId = req.organizationId;

        if (organizationId === undefined) {
            return res.status(403).json({
                error: "Workspace access required"
            });
        }

        try {
            const leases = await prisma.lease.findMany({
                where: {
                    renter: {
                        organizationId: organizationId
                    },
                    unit: {
                        property: {
                            organizationId: organizationId
                        }
                    }
                },
                include: {
                    renter: {
                        include: {
                            payments: true
                        }
                    },
                    unit: {
                        include: {
                            property: true
                        }
                    }
                }
            });

            const arrears = leases
                .map(function(lease) {
                    const totalPaid = lease.renter.payments.reduce(
                        function(total, payment) {
                            return total + payment.amount;
                        },
                        0
                    );

                    return {
                        renterId: lease.renter.id,
                        renter: lease.renter.name,
                        property: lease.unit.property.name,
                        unit: lease.unit.number,
                        monthlyRent: lease.monthlyRent,
                        totalPaid: totalPaid,
                        arrears: lease.monthlyRent - totalPaid
                    };
                })
                .filter(function(item) {
                    return item.arrears > 0;
                });

            return res.json({
                data: arrears
            });
        } catch (error) {
            console.error("Could not calculate arrears:", error);

            return res.status(500).json({
                error: "Could not calculate arrears"
            });
        }
    }
);

const PORT = process.env.PORT || 3000;

app.listen(PORT, function() {
    console.log(`Server running on http://localhost:${PORT}`);
});
