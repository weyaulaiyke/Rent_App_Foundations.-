import { readFile, writeFile } from "fs/promises";
export async function loadProperties() {
    try {
        let fileData = await readFile("./week-1-javascript/day6/data/properties.json",
            "utf8");
        let properties = JSON.parse(fileData);
        return properties;
    } catch (error) {
        return [];
    }
}
export async function saveProperties(properties) {
    let jsonData = JSON.stringify(properties);

    await writeFile(
        "./week-1-javascript/day6/data/properties.json", jsonData
    );
}