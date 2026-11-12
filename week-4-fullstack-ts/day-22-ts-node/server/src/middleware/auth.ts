import type { Request, Response, NextFunction } from "express";

const jwt = require("jsonwebtoken");

type AuthTokenPayload = {
    userId?: unknown;
    organizationId?: unknown;
};

function requireAuth(req: Request, res: Response, next: NextFunction) {
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
            decoded.userId <= 0
        ) {
            throw new Error("Invalid user ID");
        }

        req.userId = decoded.userId;

        // Older login tokens do not contain this yet.
        if (decoded.organizationId !== undefined) {
            if (
                typeof decoded.organizationId !== "number" ||
                !Number.isInteger(decoded.organizationId) ||
                decoded.organizationId <= 0
            ) {
                throw new Error("Invalid organization ID");
            }

            req.organizationId = decoded.organizationId;
        }

        next();
    } catch (error) {
        return res.status(401).json({
            error: "Invalid or expired token"
        });
    }
}

module.exports = requireAuth;