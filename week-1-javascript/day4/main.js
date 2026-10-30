import readline from "readline";
import { calculateLateFee } from "./lib/fees.js";
import { assessApplication } from "./lib/screener.js";
console.log("1.Calculate late fee");
console.log("2.Screen renter");
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})
rl.question("choose an option: ", function(choice) {
    if (choice === "1") {
        console.log(calculateLateFee(1000000, 7, "commercial"))
    } else if (choice === "2") {
        console.log(assessApplication(2000000, "good", "none"))
    }
})