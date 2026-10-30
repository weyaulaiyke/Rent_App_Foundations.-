const readline = require("readline")
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})
let building = {
    A1: {
        renters: "John",
        status: "paid"
    },
    A2: {
        renters: "Mary",
        status: "overdue"
    }
}
rl.question("Enter unit number:", function(unitNumber) {
    console.log(building[unitNumber]);
    rl.question("Enter new payment status", function(newStatus) {
        building[unitNumber].status = newStatus;
        console.log(building[unitNumber])
        for (let unit of Object.keys(building)) {
            console.log(unit)
        }
        rl.close();
    })
})