type ScreeningResult = "APPROVED" | "CONDITIONAL" | "REJECTED";

function scrernRenter(
    monthlyIncome: number,
    creditHistory:string,
    evictionHistory: string
): ScreeningResult{
    if (
        monthlyIncome >= 1500000 &&
        creditHistory === "good" &&
        evictionHistory === "none"
      ) {
        return "APPROVED";
      }

      if (
        monthlyIncome >= 1500000 &&
        creditHistory === "good" &&
        evictionHistory === "yes"
      ) {
        return "CONDITIONAL";
      }

      if(
        creditHistory === "poor" &&
        evictionHistory === "none"
      ){
        return "CONDITIONAL"
      }
      
      return "REJECTED"
}

