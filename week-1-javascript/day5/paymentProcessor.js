async function processPayment() {
    let attempts = 0;
    let paymentSucceeded = false;
    while (attempts < 3) {
        attempts++;
        await new Promise(function(resolve) {
            setTimeout(resolve, 2000);
        });
        let paymentWorked = Math.random() < 0.5;
        if (paymentWorked) {
            paymentSucceeded = true;
            console.log("Reciept:Payment successful")
            break;
        } else {
            console.log("Reciept:Payment declined")
        }
    }
    if (!paymentSucceeded) {
        console.log("Receipt:Payment declined after 3 attempts")
    }
}
processPayment()