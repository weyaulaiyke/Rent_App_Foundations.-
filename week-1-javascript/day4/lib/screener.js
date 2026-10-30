export function assessApplication(monthlyIncome, creditHistory, evictionHistory) {
    if (monthlyIncome >= 1500000 && creditHistory === "good" && evictionHistory === "none")
        return "APPROVED";
    else if (creditHistory === "poor" && evictionHistory === "none")
        return "CONDITIONAL (HIGHER DEPOSIT)"
    else {
        return "REJECTED"
    }
}