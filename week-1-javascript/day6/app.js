import readline from "readline";
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
rl.question("Choose an option: ",
    async function(choice) {
        if (choice === "1") {
            rl.question("Enter property name: ", async function(propertyName) {
                properties.push({
                    name: propertyName,
                    units: []
                })
                await saveProperties(properties);
                console.log("Property added")
            });
        } else if (choice === "2") {
            rl.question("Enter property name: ", function(propertyName) {
                let property = properties.find(function(item) {
                    return item.name === propertyName;
                });
                if (!property) {
                    console.log("Property not found")
                    return;
                }
                rl.question("Enter unit number:", async function(unitNumber) {
                    property.units.push({
                        number: unitNumber,
                        renter: null
                    })
                    await saveProperties(properties);
                    console.log("Unit added")
                })
            });
        } else if (choice === "3") {
            rl.question("Enter property name:", function(propertyName) {
                let property = properties.find(function(item) {
                    return item.name === propertyName
                });
                if (!property) {
                    console.log("Property not found");
                    return;
                }
                rl.question("Enter unit number:", function(unitNumber) {
                    let unit = property.units.find(function(item) {
                        return item.number === unitNumber;
                    })
                    if (!unit) {
                        console.log("Unit not found");
                        return;
                    }
                    rl.question("Enter renter name:", async function(renterName) {
                        unit.renter = {
                            name: renterName,
                            paid: false
                        }
                        await saveProperties(properties);
                        console.log("Renter added")
                    })
                })
            })
        } else if (choice === "4") {
            rl.question("Enter property name:", function(propertyName) {
                let property = properties.find(function(item) {
                    return item.name === propertyName;
                });
                if (!property) {
                    console.log("Property not found");
                    return;
                }
                rl.question("Enter unit number:", async function(unitNumber) {
                    let unit = property.units.find(function(item) {
                        return item.number === unitNumber;
                    });
                    if (!unit) {
                        console.log("Unit not found")
                        return;
                    }
                    if (!unit.renter) {
                        console.log("No renter assigned to this unit")
                        return;
                    }
                    unit.renter.paid = true;
                    await saveProperties(properties);
                    console.log("Payment recorded");
                })
            })
        } else if (choice === "5") {
            for (let property of properties) {
                for (let unit of property.units) {
                    if (unit.renter && unit.renter.paid === false)
                        console.log(property.name + "-unit" + unit.number + "-" + unit.renter.name);
                }
            }
        } else if (choice === "6") {
            await saveProperties(properties);
            console.log("Data saved. Goodbye!");
            rl.close();
        }
    });
import { loadProperties, saveProperties } from "./lib/storage.js";
let properties = await loadProperties();

console.log("1. Add property");
console.log("2. Add unit");
console.log("3. Add renter");
console.log("4. Record Payment");
console.log("5. Show arrears");
console.log("6. Exit");