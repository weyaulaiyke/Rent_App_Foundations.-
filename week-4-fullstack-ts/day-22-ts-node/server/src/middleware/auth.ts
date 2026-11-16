import type {
    Request,
    Response,
    NextFunction
} from "express";
import prisma from "../prisma";
import { clearSessionCookie } from "../sessions";

const jwt = require("jsonwebtoken");

type AuthTokenPayload = {
    userId?: unknown;
    organizationId?: unknown;
    sessionId?: unknown;
};

async function requireAuth(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({
            error: "Authentication required"
        });
    }

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        ) as AuthTokenPayload;

        if (
            typeof decoded.userId !== "number" ||
            !Number.isInteger(decoded.userId) ||
            decoded.userId <= 0 ||
            typeof decoded.organizationId !== "number" ||
            !Number.isInteger(decoded.organizationId) ||
            decoded.organizationId <= 0 ||
            typeof decoded.sessionId !== "string" ||
            !decoded.sessionId
        ) {
            throw new Error("Invalid session token");
        }

        const session = await prisma.session.findUnique({
            where: {
                id: decoded.sessionId
            },
            include: {
                user: {
                    select: {
                        emailVerifiedAt: true
                    }
                }
            }
        });

        if (
            !session ||
            session.revokedAt !== null ||
            session.expiresAt.getTime() <= Date.now() ||
            session.userId !== decoded.userId ||
            session.organizationId !==
                decoded.organizationId ||
            session.user.emailVerifiedAt === null
        ) {
            clearSessionCookie(res);

            return res.status(401).json({
                error: "Session expired or revoked"
            });
        }

        req.userId = session.userId;
        req.organizationId = session.organizationId;
        req.sessionId = session.id;

        if (
            Date.now() - session.lastSeenAt.getTime() >
            5 * 60 * 1000
        ) {
            await prisma.session.updateMany({
                where: {
                    id: session.id,
                    revokedAt: null,
                    expiresAt: {
                        gt: new Date()
                    }
                },
                data: {
                    lastSeenAt: new Date()
                }
            });
        }

        next();
    } catch (error) {
        clearSessionCookie(res);

        return res.status(401).json({
            error: "Invalid or expired session"
        });
    }
}

module.exports = requireAuth;