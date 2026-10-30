let propertyName = "Sunrise Apartments";
let monthlyRent = 500000;
let depositMultiplier = 2;
let securityDeposit = monthlyRent * depositMultiplier;
let securityDepositPercentage = 10;
let percentageAmount = monthlyRent * securityDepositPercentage / 100;
console.log("Property", propertyName);
console.log("Security Deposit", securityDeposit)
console.log("Monthly Rent", monthlyRent)
console.log("====LEASE RECEIPT=====")
console.log("=============")
console.log("10% Amount", percentageAmount)
let RECEIPT = `
Property ${propertyName}
Rent ${monthlyRent} UGX
Deposit ${securityDeposit} UGX
Percentage ${percentageAmount} UGX`;
console.log(RECEIPT);