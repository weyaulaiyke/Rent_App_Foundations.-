const express = require("express");
const router = express.Router();
const validateProperty = require("../middleware/validateProperty")
const {
    getProperties,
    createProperty,
    updateProperty,
    deleteProperty,
    getPropertyUnits
} = require("../controllers/propertyController");
router.get("/", getProperties);
router.post("/", validateProperty, createProperty);
router.patch("/:id", validateProperty, updateProperty);
router.delete("/:id", deleteProperty);
router.get("/:id/units", getPropertyUnits);
module.exports = router;