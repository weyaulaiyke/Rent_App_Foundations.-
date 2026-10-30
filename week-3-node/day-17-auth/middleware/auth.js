const jwt = require("jsonwebtoken")

function requireAuth(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({
            error: "Authentication requred"
        })
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        return res.status(401).json({
            error: "Invalid or expired token"
        })
    }
}
module.exports = requireAuth;