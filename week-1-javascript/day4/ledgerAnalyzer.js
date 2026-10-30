let payments = [{
        property: "Sunrise Apartments",
        renter: "John",
        status: "overdue",
        outstanding: 500000
    },
    {
        property: "Sunrise Apartments",
        renter: "Mary",
        status: "paid",
        outstanding: 0
    },
    {
        property: "Green View",
        renter: "Peter",
        status: "overdue",
        outstanding: 300000
    }
];
let overduePayment = payments.filter(function(payment) {
    return payment.status === "overdue"
})
console.log(overduePayment);
let reminders = overduePayment.map(function(payment) {
    return payment.renter + " owes " + payment.outstanding
});
console.log(reminders)
let totalsByProperty = overduePayment.reduce(function(totals, payment) {
    totals[payment.property] =
        (totals[payment.property] || 0) + payment.outstanding
    return totals;
}, {})
console.log(totalsByProperty);
for (let i = 4; i <= 52; i++) {
    payments.push({
        property: "Sunrise Apartments",
        renter: "Renter " + i,
        status: "paid",
        outstanding: 0
    });
}
console.log(payments)