import { useState, type FormEvent } from "react";
import useFetch from "../hooks/useFetch";

type Renter = {
    id: number;
    name: string;
};

type Payment = {
    id: number;
    renterId: number;
    amount: number;
    paymentDate: string;
};

const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:3000";

function PaymentsPage() {
    const [renterId, setRenterId] = useState("");
    const [amount, setAmount] = useState("");
    const [date, setDate] = useState("");
    const [actionError, setActionError] = useState("");

    const {
        data: renters,
        loading: rentersLoading,
        error: rentersError
    } = useFetch<Renter[]>("/renters");

    const {
        data: payments,
        setData: setPayments,
        loading: paymentsLoading,
        error: paymentsError
    } = useFetch<Payment[]>("/payments");

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setActionError("");

        const newPayment = {
            renterId: Number(renterId),
            amount: Number(amount),
            paymentDate: date
        };

        try {
            const response = await fetch(
                `${API_URL}/payments`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    credentials: "include",
                    body: JSON.stringify(newPayment)
                }
            );

            const savedPayment = await response.json();

            if (!response.ok) {
                throw new Error("Could not record payment");
            }

            setPayments([
                ...(payments ?? []),
                savedPayment.data
            ]);

            setRenterId("");
            setAmount("");
            setDate("");
        } catch (error) {
            console.error(error);
            setActionError(error instanceof Error ? error.message : "Payment failed");
        }
    }

    if (rentersLoading || paymentsLoading) {
        return <p>Loading payments...</p>;
    }

    if (rentersError || paymentsError) {
        return (
            <p>
                {rentersError || paymentsError}
            </p>
        );
    }

    return (
        <>
            <h1>Record Payment</h1>

            {actionError && (
                <p>{actionError}</p>
            )}

            <form onSubmit={handleSubmit}>
                <label>Renter</label>

                <select
                    value={renterId}
                    onChange={(event) =>
                        setRenterId(event.target.value)
                    }
                    required
                >
                    <option value="">
                        Select renter
                    </option>

                    {(renters ?? []).map(function(renter) {
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
                    onChange={(event) =>
                        setAmount(event.target.value)
                    }
                    required
                />

                <label>Date</label>

                <input
                    type="date"
                    value={date}
                    onChange={(event) =>
                        setDate(event.target.value)
                    }
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
                    {(payments ?? []).map(function(payment) {
                        const renter = (renters?? []).find(
                            function(renter) {
                                return (
                                    Number(renter.id) ===
                                    Number(payment.renterId)
                                );
                            }
                        );

                        return (
                            <tr key={payment.id}>
                                <td>
                                    {renter
                                        ? renter.name
                                        : "Unknown renter"}
                                </td>

                                <td>
                                    UGX {payment.amount}
                                </td>

                                <td>
                                    {payment.paymentDate}
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