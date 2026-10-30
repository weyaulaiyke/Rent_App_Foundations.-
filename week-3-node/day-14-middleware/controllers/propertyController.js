const properties = [
    { id: 1, name: "Sunrise Apartments" },
    { id: 2, name: "Green View Flats" }
];
const units = [
    { id: 1, number: "A1", propertyId: 1 },
    { id: 2, number: "A2", propertyId: 1 },
    { id: 3, number: "B1", propertyId: 2 }
]

function getProperties(req, res) {
    res.json(properties);
};

function createProperty(req, res) {

    const newId = properties.length + 1;
    const newProperty = {
        id: newId,
        ...req.body
    }
    properties.push(newProperty);
    res.status(201).json(newProperty)
};

function updateProperty(req, res) {
    const id = Number(req.params.id);
    const property = properties.find(function(property) {
        return property.id === id;
    })
    if (!property) {
        return res.status(404).json({
            message: "Property not found"
        });
    }
    property.name = req.body.name;
    res.json(property);
}

function deleteProperty(req, res) {
    const id = Number(req.params.id);
    const propertyIndex = properties.findIndex(function(property) {
        return property.id === id
    })
    if (propertyIndex === -1) {
        return res.status(404).json({
            message: "Property not found"
        })
    }
    const deletedProperty = properties.splice(propertyIndex, 1)
    res.status(200).json(deletedProperty[0])
}


function getPropertyUnits(req, res) {
    const id = Number(req.params.id);
    const property = properties.find(function(property) {
        return property.id === id;
    })
    if (!property) {
        return res.status(404).json({
            message: "Property not found"
        });
    }
    const propertyUnits = units.filter(function(unit) {
        return unit.propertyId === id
    })
    res.json(propertyUnits)
}
module.exports = {
    getProperties,
    createProperty,
    updateProperty,
    deleteProperty,
    getPropertyUnits
};