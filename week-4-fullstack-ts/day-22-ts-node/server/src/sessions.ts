import type { Response } from "express";
import prisma from "./prisma";

const jwt = require("jsonwebtoken");

const SESSION_DURATION_MS =
    24 * 60 * 60 * 1000;

type CreateSessionInput = {
    userId: number;
    organizationId: number;
    userAgent: string | null;
};

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error("JWT_SECRET is missing");
    }

    return secret;
}

export async function createLoginSession({
    userId,
    organizationId,
    userAgent
}: CreateSessionInput) {
    const expiresAt = new Date(
        Date.now() + SESSION_DURATION_MS
    );

    const session = await prisma.session.create({
        data: {
            userId: userId,
            organizationId: organizationId,
            userAgent:
                userAgent === null
                    ? null
                    : userAgent.slice(0, 500),
            expiresAt: expiresAt
        }
    });

    const token = jwt.sign(
        {
            userId: userId,
            organizationId: organizationId,
            sessionId: session.id
        },
        getJwtSecret(),
        {
            expiresIn: "1d"
        }
    );

    return {
        token,
        session
    };
}

export function setSessionCookie(
    res: Response,
    token: string
) {
    res.cookie("token", token, {
        httpOnly: true,
        sameSite:
            process.env.NODE_ENV === "production"
                ? "none"
                : "lax",
        secure:
            process.env.NODE_ENV === "production",
        maxAge: SESSION_DURATION_MS
    });
}

export function clearSessionCookie(res: Response) {
    res.clearCookie("token", {
        httpOnly: true,
        sameSite:
            process.env.NODE_ENV === "production"
                ? "none"
                : "lax",
        secure:
            process.env.NODE_ENV === "production"
    });
}