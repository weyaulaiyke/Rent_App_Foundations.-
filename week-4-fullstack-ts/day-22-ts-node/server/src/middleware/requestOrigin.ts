import type { Request, RequestHandler } from "express";
import { HttpError } from "../http";

function checkOrigin(req: Request): void {
    const origin = req.get("Origin");
    const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";
    // Browsers send Origin on cross-site mutations. "null", multiple origins
    // and lookalike hosts must not inherit the authenticated user's cookies.
    // Origin-less requests remain available to CLI and server clients.
    if (origin !== undefined && origin !== allowedOrigin) {
        throw new HttpError(403, "This request must come from the configured REMOTE site");
    }
}

/** CORS controls response access; this guard also prevents cookie-based writes. */
export const requireMutationOrigin: RequestHandler = function(req, _res, next) {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) checkOrigin(req);
    next();
};

/** Downloading a legacy receipt issues its immutable receipt number. */
export const requireReceiptRequest: RequestHandler = function(req, _res, next) {
    checkOrigin(req);
    // Cross-site images and navigations cannot supply this custom header. The
    // organization middleware has already validated its value and membership.
    if (req.get("X-Organization-Id") === undefined) {
        throw new HttpError(403, "Select a workspace explicitly before issuing a receipt");
    }
    next();
};
