const express = require("express");
const app = express();
app.use(express.json());

const properties = [
    { id: 1, name: "Sunrise Apartments" },
    { id: 2, name: "Green View Flats" }
];
const units = [
    { id: 1, number: "A1", propertyId: 1 },
    { id: 2, number: "A2", propertyId: 1 },
    { id: 3, number: "B1", propertyId: 2 }
]
app.get("/properties", function(req, res) {
    res.json(properties);
});
app.get("/properties/:id/units", function(req, res) {
    const id = Number(req.params.id)
    const propertyUnits = units.filter(function(unit) {
        return unit.propertyId === id
    })
    const property = properties.find(function(property) {
        return property.id === id;
    })
    if (!property) {
        return res.status(404).json({
            message: "Property not found"
        });
    }
    res.json(propertyUnits);
})
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
app.patch("/properties/:id", function(req, res) {
    const id = Number(req.params.id);
    const property = properties.find(function(property) {
        return property.id === id;
    })
    if (!property) {
        return res.status(404).json({
            message: "Property not found"
        })
    }
    property.name = req.body.name;
    res.json(property);
})
app.delete("/properties/:id", function(req, res) {
    const id = Number(req.params.id);
    const propertyIndex = properties.findIndex(function(property) {
        return property.id === id;
    })
    if (propertyIndex === -1) {
        return res.status(404).json({
            message: "Property not found"
        })
    }
    const deletedProperty = properties.splice(propertyIndex, 1);
    res.status(200).json(deletedProperty[0]);
})
const PORT = 3000;
app.listen(PORT, function() {
    console.log(`Server running on http://localhost:${PORT}`);
});