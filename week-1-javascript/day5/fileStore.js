import { readFile, writeFile } from "fs/promises"
let renter = {
    name: "John",
    rent: 500000,
    status: "paid"
};
let jsonData = JSON.stringify(renter);
try {
    let fileData = await readFile("renter.json", "utf8");
    let renterData = JSON.parse(fileData);
    console.log(renterData)
} catch (error) {
    await writeFile("renter.json", jsonData)
    console.log("File does not exist yet")
}