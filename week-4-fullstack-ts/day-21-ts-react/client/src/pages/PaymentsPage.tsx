import { useState, type FormEvent } from "react";
import useFetch from "../hooks/useFetch";
import PageLoader from "../components/PageLoader";

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

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

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

    async function downloadReceipt(paymentId: number) {
        setActionError("");
    
        try {
            const response = await fetch(
                `${API_URL}/payments/${paymentId}/receipt.pdf`,
                { credentials: "include" }
            );
    
            if (response.status === 401) {
                throw new Error("Please sign in again to download your receipt.");
            }
    
            if (!response.ok || !response.headers.get("content-type")?.includes("application/pdf")) {
                throw new Error("Could not download this receipt.");
            }
    
            const file = await response.blob();
            const url = URL.createObjectURL(file);
            const link = document.createElement("a");
    
            link.href = url;
            link.download = `rent-receipt-R-${paymentId}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
    
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) {
            setActionError(
                error instanceof Error ? error.message : "Receipt download failed."
            );
        }
    }

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
        return <PageLoader label="Loadind payments..."/>;
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

            <form className="payment-form" onSubmit={handleSubmit}>
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

        <div className="table-scroll">
            <table className="payments-table">
                <thead>
                    <tr>
                        <th>Renter</th>
                        <th>Amount</th>
                        <th>Date</th>
                        <th>Receipt</th>
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

                                <td className="payment-amount">
                                    UGX {Number(payment.amount).toLocaleString("en-US")}
                                </td>

                                <td>
                                    {payment.paymentDate}
                                </td>
                                <td>
                                <button type="button" onClick={() => void downloadReceipt(payment.id)}>
                                    Download receipt
                                </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
        </>
    );
}

export default PaymentsPage;