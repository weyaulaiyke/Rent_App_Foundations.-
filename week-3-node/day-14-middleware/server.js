require("dotenv").config();
const express = require("express");
const app = express();
const propertyRoutes = require("./routes/propertyRoutes")
const logger = require("./middleware/logger")
const cors = require("cors")
const errorHandler = require("./middleware/errorHandler")
const notFound = require("./middleware/notFound");
app.use(express.json());
app.use(cors());
app.use(logger);
app.use("/properties", propertyRoutes)
app.use(notFound)
app.use(errorHandler);

app.get("/properties", function(req, res) {
    res.json(properties);
});

app.post("/properties", function(req, res) {
    if (!req.body.name) {
        return res.status(400).json({
            message: "Property name required"
        });
    }
    const newId = properties.length + 1;
    const newProperty = {
        id: newId,
        ...req.body
    };
    properties.push(newProperty);
    res.status(201).json(newProperty);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
    console.log(`Server running on http://localhost:${PORT}`);
});