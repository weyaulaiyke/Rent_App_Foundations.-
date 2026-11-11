import { useId, useState, type FormEvent } from "react";
import { useApiFetch } from "../../context/OrganizationContext";
import { errorMessage, readResponse } from "../../lib/api";
import { availableCredit, ugx, wholeUgx, type Invoice, type LedgerPayment } from "../../lib/billing";

type Props = { invoices: Invoice[]; payments: LedgerPayment[]; invoice?: Invoice; payment?: LedgerPayment; onSaved: () => void; onCancel: () => void };
function AllocationForm({ invoices, payments, invoice, payment, onSaved, onCancel }: Props) {
    const apiFetch = useApiFetch();
    const id = useId();
    const [invoiceId, setInvoiceId] = useState(invoice ? String(invoice.id) : "");
    const [paymentId, setPaymentId] = useState(payment ? String(payment.id) : "");
    const [amount, setAmount] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const selectedInvoice = invoices.find((item) => item.id === Number(invoiceId));
    const selectedPayment = payments.find((item) => item.id === Number(paymentId));
    const limit = Math.min(selectedInvoice?.outstanding ?? 0, selectedPayment ? availableCredit(selectedPayment) : 0);
    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        const value = wholeUgx(amount);
        if (!selectedInvoice || !selectedPayment || selectedInvoice.renterId !== selectedPayment.renterId || value === null || value > limit) {
            setError("Choose this tenant’s payment and invoice, and an amount within the available credit and balance."); return;
        }
        setBusy(true); setError("");
        try {
            await readResponse(await apiFetch("/billing/allocations", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paymentId: selectedPayment.id, invoiceId: selectedInvoice.id, amount: value })
            }));
            onSaved();
        } catch (error) { setError(errorMessage(error)); }
        finally { setBusy(false); }
    }
    return <form className="financial-inline-form financial-allocation" onSubmit={save}>
        <h3>Apply existing credit</h3>
        {invoice ? <p>Invoice {invoice.number}</p> : <>
            <label htmlFor={`${id}-invoice`}>Outstanding invoice</label>
            <select id={`${id}-invoice`} value={invoiceId} required disabled={busy} onChange={(event) => { setInvoiceId(event.target.value); setAmount(""); }}>
                <option value="">Select invoice</option>
                {invoices.filter((item) => item.status !== "VOID" && item.outstanding > 0 && (!payment || item.renterId === payment.renterId))
                    .map((item) => <option key={item.id} value={item.id}>{item.number} · {item.unitNumber} · {ugx(item.outstanding)}</option>)}
            </select>
        </>}
        {payment ? <p>{payment.receiptNumber || `Legacy payment #${payment.id}`} · {ugx(availableCredit(payment))} credit</p> : <>
            <label htmlFor={`${id}-payment`}>Available payment credit</label>
            <select id={`${id}-payment`} value={paymentId} required disabled={busy} onChange={(event) => { setPaymentId(event.target.value); setAmount(""); }}>
                <option value="">Select payment</option>
                {payments.filter((item) => availableCredit(item) > 0 && (!invoice || item.renterId === invoice.renterId))
                    .map((item) => <option key={item.id} value={item.id}>{item.receiptNumber || `Legacy payment #${item.id}`} · {ugx(availableCredit(item))}</option>)}
            </select>
        </>}
        <label htmlFor={`${id}-amount`}>Amount to apply (whole UGX){limit > 0 ? ` · maximum ${ugx(limit)}` : ""}</label>
        <input id={`${id}-amount`} type="number" min="1" max={limit || 2147483647} step="1" value={amount}
            onChange={(event) => setAmount(event.target.value)} required disabled={busy} />
        <div className="financial-actions"><button type="submit" disabled={busy || limit <= 0}>{busy ? "Applying…" : "Apply credit"}</button>
            <button type="button" className="btn-cancel" disabled={busy} onClick={onCancel}>Cancel</button></div>
        {error && <p className="workspace-error" role="alert">{error}</p>}
    </form>;
}
export default AllocationForm;
