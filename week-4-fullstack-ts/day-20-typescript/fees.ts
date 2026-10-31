type LeaseType = "RESIDENTIAL" | "COMMERCIAL";

function calculatedLateFee(
    rent: number,
    daysOverdue: number,
    leaseType: LeaseType
): number {
    if(leaseType === "RESIDENTIAL"){
        return daysOverdue *10000;
    } 
    if(leaseType === "COMMERCIAL" && daysOverdue > 5){
        return rent *0.05;
    } 
    return 0;
}
console.log(calculatedLateFee(500000, 5, "RESIDENTIAL"));
console.log(calculatedLateFee(800000, 7, "COMMERCIAL"));

export{};