import { useState } from "react";
import useFetch from "../hooks/useFetch";
function PaymentsPage() {
    const [renterId, setRenterId] = useState("");
    const [amount, setAmount] = useState("");
    const [date, setDate] = useState("");

    const {
        data: renters,
        loading: rentersLoading,
        error: rentersError
    } = useFetch("http://localhost:3000/renters");

    const {
        data: payments,
        setData: setPayments,
        loading: paymentsLoading,
        error: paymentsError
    } = useFetch("http://localhost:3000/payments");

    async function handleSubmit(e) {
        e.preventDefault();

        const newPayment = {
            renterId: Number(renterId),
            amount: Number(amount),
            date
        };

        const response = await fetch(
            "http://localhost:3000/payments",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(newPayment)
            }
        );

        const savedPayment = await response.json();
        const updatedPayments = [...payments, savedPayment];
        const renterPayments = updatedPayments.filter(function(payment){
            return Number(payment.renterId) === Number(renterId);
        });
        const totalPaid = renterPayments.reduce(function(total, payment){
            return total + payment.amount
        }, 0);
        const renter = renters.find(function(renter){
            return Number(renter.id) ===Number(renterId);
        });
        let newStatus; 
        if (totalPaid >= renter.rentDue){
            newStatus= "PAID";
        }
        else {
            newStatus= "OVERDUE";
        }
        const statusResponse = await fetch(
            `http://localhost:3000/renters/${renter.id}`,
            {
                method: "PATCH",
                headers:{
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    status: newStatus
                })
            }
        )

        setPayments([...payments, savedPayment]);

        setRenterId("");
        setAmount("");
        setDate("");
    }

    if (rentersLoading || paymentsLoading) {
        return <p>Loading payments...</p>;
    }

    if (rentersError || paymentsError) {
        return <p>{rentersError || paymentsError}</p>;
    }

    return (
        <>
            <h1>Record Payment</h1>

            <form onSubmit={handleSubmit}>
                <label>Renter</label>
                <select
                    value={renterId}
                    onChange={(e) => setRenterId(e.target.value)}
                    required
                >
                    <option value="">Select renter</option>

                    {renters.map(function (renter) {
                        return (
                            <option
                                key={renter.id}
                                value={renter.id}
                            >
                                {renter.name}
                            </option>
                        );
                    })}
                </select>

                <label>Amount</label>
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                />

                <label>Date</label>
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                />

                <button type="submit">
                    Record Payment
                </button>
            </form>

            <h2>Payments</h2>

            <table>
                <thead>
                    <tr>
                        <th>Renter</th>
                        <th>Amount</th>
                        <th>Date</th>
                    </tr>
                </thead>

                <tbody>
                    {payments.map(function (payment) {
                        const renter = renters.find(function (renter) {
                            return String(renter.id) === String(payment.renterId);
                        });

                        return (
                            <tr key={payment.id}>
                                <td>
                                    {renter ? renter.name : "Unknown renter"}
                                </td>

                                <td>
                                    UGX {payment.amount}
                                </td>

                                <td>
                                    {payment.date}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </>
    );
}

export default PaymentsPage;
