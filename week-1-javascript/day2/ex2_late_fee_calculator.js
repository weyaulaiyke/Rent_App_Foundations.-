function calculateLateFee(rent, daysOverdue, leaseType) {
    if (leaseType === "residential")
        return daysOverdue * 10000;
    else if (leaseType === "commercial" && daysOverdue > 5)
        return rent * 5 / 100;
}
console.log(calculateLateFee(1000000, 7, "commercial"));