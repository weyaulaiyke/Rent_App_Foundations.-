import type { Request, Response, NextFunction } from "express";
const jwt = require("jsonwebtoken")

function requireAuth(req:Request, res:Response, next:NextFunction) {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({
            error: "Authentication required"
        });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        return res.status(401).json({
            error: "Invalid or expired token"
        });
    }
}
module.exports = requireAuth;