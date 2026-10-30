let amentities = ["Wifi", "Parking", "Wifi", "Pool", "Parking"]
let cleanedAmentities = []
for (let amentity of amentities) {
    cleanedAmentities.push(amentity.trim())
}
console.log(cleanedAmentities)
let uniqueAmentities = new Set(cleanedAmentities);
console.log(uniqueAmentities)
console.log([...uniqueAmentities].join(","))