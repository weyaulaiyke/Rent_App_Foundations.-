import { useState, type FormEvent } from "react";
import useFetch from "../hooks/useFetch";
import { useApiFetch, useOrganization } from "../context/OrganizationContext";
import { errorMessage, readResponse } from "../lib/api";
import { availableCredit, billingDate, ugx, wholeUgx, type Invoice, type LedgerPayment, type RenterContact } from "../lib/billing";
import AllocationForm from "../components/billing/AllocationForm";
import DocumentActions from "../components/billing/DocumentActions";
import FinancialReportActions from "../components/billing/FinancialReportActions";
import VoidRecord from "../components/billing/VoidRecord";

function PaymentsPage() {
    const apiFetch = useApiFetch(); const { can } = useOrganization(); const writable = can("payment:write");
    const [renterId, setRenterId] = useState(""); const [invoiceId, setInvoiceId] = useState("");
    const [amount, setAmount] = useState(""); const [date, setDate] = useState("");
    const [busy, setBusy] = useState(false); const [actionError, setActionError] = useState(""); const [message, setMessage] = useState("");
    const [allocating, setAllocating] = useState<number | null>(null);
    const renters = useFetch<RenterContact[]>("/renters"); const payments = useFetch<LedgerPayment[]>("/payments");
    const invoices = useFetch<Invoice[]>("/billing/invoices");
    function refresh() { setAllocating(null); payments.reload(); invoices.reload(); }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); if (busy || !writable) return;
        const value = wholeUgx(amount);
        if (!renters.data?.some((renter) => renter.id === Number(renterId)) || value === null) { setActionError("Select a tenant and enter a positive whole-UGX amount."); return; }
        if (invoiceId && !invoices.data?.some((invoice) => invoice.id === Number(invoiceId) && invoice.renterId === Number(renterId) && invoice.status !== "VOID" && invoice.outstanding > 0)) {
            setActionError("Choose an outstanding invoice for this tenant."); return;
        }
        setBusy(true); setActionError(""); setMessage("");
        try {
            await readResponse<LedgerPayment>(await apiFetch("/payments", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ renterId: Number(renterId), amount: value, paymentDate: date, ...(invoiceId ? { invoiceId: Number(invoiceId) } : {}) })
            }));
            setRenterId(""); setInvoiceId(""); setAmount(""); setDate(""); setMessage("Payment recorded. Any amount above the selected invoice balance remains available as tenant credit."); refresh();
        } catch (error) { setActionError(errorMessage(error)); } finally { setBusy(false); }
    }
    const credit = (payments.data ?? []).reduce((sum, payment) => sum + availableCredit(payment), 0);
    return <>
        <h1 className="dashboard-heading">Payments &amp; Receipts</h1>
        <p className="financial-help">Record payments you have received, download receipts, and apply unallocated credit to issued invoices.</p>
        {actionError && <p className="workspace-error" role="alert">{actionError}</p>}{message && <p role="status">{message}</p>}
        {writable && <form className="payment-form" onSubmit={submit}>
            <h2>Record manual payment</h2>
            <label htmlFor="payment-renter">Tenant</label>
            <select id="payment-renter" value={renterId} onChange={(event) => { setRenterId(event.target.value); setInvoiceId(""); }} required disabled={busy || renters.loading}>
                <option value="">Select tenant</option>{(renters.data ?? []).map((renter) => <option key={renter.id} value={renter.id}>{renter.name}</option>)}
            </select>
            <label htmlFor="payment-invoice">Allocate to invoice (optional)</label>
            <select id="payment-invoice" value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)} disabled={busy || invoices.loading || !renterId}>
                <option value="">Keep as unallocated tenant credit</option>
                {(invoices.data ?? []).filter((invoice) => invoice.renterId === Number(renterId) && invoice.status !== "VOID" && invoice.outstanding > 0)
                    .map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.number} · {ugx(invoice.outstanding)} outstanding</option>)}
            </select>
            <label htmlFor="payment-amount">Amount (whole UGX)</label>
            <input id="payment-amount" type="number" min="1" max="2147483647" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} required disabled={busy} />
            <label htmlFor="payment-date">Payment date</label><input id="payment-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required disabled={busy} />
            <button type="submit" disabled={busy || renters.loading || !renters.data?.length}>{busy ? "Saving…" : "Record Payment"}</button>
        </form>}
        <p className="financial-credit-total">Available unallocated credit: <strong>{ugx(credit)}</strong></p>
        {payments.loading && <p role="status">Loading payments…</p>}
        {[renters.error, payments.error, invoices.error].filter(Boolean).map((error) => <p key={error} className="workspace-error" role="alert">{error}</p>)}
        <div className="table-scroll"><table className="financial-table">
            <thead><tr><th>Receipt / tenant</th><th>Source</th><th>Amount</th><th>Allocated</th><th>Credit</th><th>Date / status</th><th>Actions</th></tr></thead>
            <tbody>{(payments.data ?? []).map((payment) => {
                const renter = renters.data?.find((item) => item.id === payment.renterId);
                const hasInvoice = invoices.data?.some((invoice) => invoice.renterId === payment.renterId && invoice.status !== "VOID" && invoice.outstanding > 0);
                return <tr key={payment.id}>
                    <td><strong>{payment.receiptNumber || `Legacy payment #${payment.id}`}</strong><small className="financial-subline">{payment.payerName || renter?.name || `Tenant #${payment.renterId}`}</small></td>
                    <td>{payment.source === "MOBILE_MONEY" ? "Mobile money" : payment.source === "MANUAL" ? "Manual" : "Legacy"}</td>
                    <td>{ugx(payment.amount)}</td><td>{ugx(payment.allocatedAmount ?? 0)}</td><td>{payment.voidedAt ? "—" : ugx(availableCredit(payment))}</td>
                    <td>{billingDate(payment.paymentDate)}<span className={`financial-status financial-status--${payment.voidedAt ? "void" : "paid"}`}>{payment.voidedAt ? "VOID" : "RECORDED"}</span>
                        {payment.voidReason && <small className="financial-subline">{payment.voidReason}</small>}</td>
                    <td className="financial-actions-cell">
                        <DocumentActions pdfPath={`/payments/${payment.id}/receipt.pdf`} fileName={`${payment.receiptNumber || `payment-${payment.id}`}.pdf`}
                            {...(!payment.voidedAt ? { sendPath: `/payments/${payment.id}/send-receipt` } : {})} defaultEmail={renter?.email} />
                        {writable && !payment.voidedAt && availableCredit(payment) > 0 && hasInvoice && <button type="button" className="financial-button" onClick={() => setAllocating(allocating === payment.id ? null : payment.id)}>Allocate credit</button>}
                        {writable && !payment.voidedAt && payment.source !== "MOBILE_MONEY" && <VoidRecord path={`/payments/${payment.id}/void`} label="Void manual / legacy payment" onSaved={refresh} />}
                        {payment.source === "MOBILE_MONEY" && <p className="financial-help">Mobile-money refunds require provider support.</p>}
                        {writable && allocating === payment.id && <AllocationForm payment={payment} payments={payments.data ?? []} invoices={invoices.data ?? []} onSaved={refresh} onCancel={() => setAllocating(null)} />}
                    </td>
                </tr>;
            })}</tbody>
        </table></div>
        <FinancialReportActions defaultType="collections" />
    </>;
}
export default PaymentsPage;
