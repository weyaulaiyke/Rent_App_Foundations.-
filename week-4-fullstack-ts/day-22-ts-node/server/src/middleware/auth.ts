import type { Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
const jwt = require("jsonwebtoken");

declare global {
    namespace Express {
        interface Request {
            userId?: number;
        }
    }
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const token: unknown = req.cookies?.token;
    if (typeof token !== "string" || !token) {
        return res.status(401).json({ error: "Authentication required" });
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        return res.status(503).json({ error: "Authentication is temporarily unavailable" });
    }
    let decoded: unknown;
    try {
        decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
    } catch {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
    const userId = typeof decoded === "object" && decoded !== null && "userId" in decoded
        ? decoded.userId
        : undefined;
    if (typeof userId !== "number" || !Number.isSafeInteger(userId) || userId <= 0) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
    let user;
    try {
        user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    } catch {
        return res.status(503).json({ error: "Authentication is temporarily unavailable" });
    }
    if (!user) return res.status(401).json({ error: "Authentication required" });
    req.userId = user.id;
    next();
}

module.exports = requireAuth;
