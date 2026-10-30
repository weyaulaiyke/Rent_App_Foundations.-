const { z } = require("zod");
const propertySchema = z.object({
    name: z.string().min(1)
})

function validateProperty(req, res, next) {
    const result = propertySchema.safeParse(req.body)
    if (!result.success) {
        return res.status(400).json({
            message: "Invalid property data"
        })
    }
    req.body = result.data;
    next();
}
module.exports = validateProperty;