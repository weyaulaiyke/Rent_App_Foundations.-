type PaymentStatus = "PAID" | "OVERDUE" | "PARTIAL";

interface Payment {
    property: string;
    renter: string;
    amountDue: number;
    amountPaid: number;
    status: PaymentStatus
}

const payments: Payment[] = [
    {
        property: "House A",
        renter: "John",
        amountDue: 500000,
        amountPaid: 500000,
        status: "PAID"
    },
    {
        property: "House B",
        renter: "Sarah",
        amountDue: 700000,
        amountPaid: 0,
        status: "OVERDUE"
    }
]

const overduePayments = payments.filter(
    (payment) => payment.status === "OVERDUE"
);
console.log(overduePayments)

const reminders = overduePayments.map((payment) => {
    const balance =payment.amountDue - payment.amountPaid;
    return `Hello ${payment.renter}, you owe UGX ${balance} for ${payment.property}.`;
});
console.log(reminders);

const totalOutsanding = payments.reduce(
    (total, payment) => total + (payment.amountDue - payment.amountPaid), 0
)
console.log(totalOutsanding)

const balancesByProperty = payments.reduce<Record<string, number>>(
    (totals, payment) => {
        const balance = payment.amountDue - payment.amountPaid;
    totals[payment.property] = (totals[payment.property] ?? 0) + balance;
        return totals;
    },
    {}
);
console.log(balancesByProperty)
