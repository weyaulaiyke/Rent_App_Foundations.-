async function processPayment(amount: number): Promise<boolean>{
    console.log(`Processing UGX ${amount}`);
    
    for (let attempt = 1; attempt <= 4; attempt++) {
        console.log(`Attempt ${attempt}`);
    
        await new Promise<void>((resolve) => {
            setTimeout(resolve, 2000);
        });
    
        if (Math.random() > 0.5) {
            return true;
        }
    }
    
    return false;
}
processPayment(500000).then((success) => {
    if (success) {
        console.log("Receipt: UGX 500000 payment successful");
    } else {
        console.error("Error: Payment failed after 4 attempts");
    }
});