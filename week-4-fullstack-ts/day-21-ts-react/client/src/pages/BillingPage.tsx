import { useState, type FormEvent } from "react";
import { useApiFetch, useOrganization } from "../context/OrganizationContext";
import useFetch from "../hooks/useFetch";
import { errorMessage, readResponse } from "../lib/api";
import { availableCredit, billingDate, currentMonth, ugx, type Delivery, type Invoice, type LedgerPayment, type ProviderStatus, type RenterContact } from "../lib/billing";
import AllocationForm from "../components/billing/AllocationForm";
import DocumentActions from "../components/billing/DocumentActions";
import PaymentLinkControl from "../components/billing/PaymentLinkControl";
import VoidRecord from "../components/billing/VoidRecord";

function BillingPage() {
    const apiFetch = useApiFetch(); const { can } = useOrganization(); const writable = can("payment:write");
    const [month, setMonth] = useState(currentMonth); const [dueDate, setDueDate] = useState("");
    const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
    const [allocating, setAllocating] = useState<number | null>(null);
    const invoices = useFetch<Invoice[]>(`/billing/invoices${month ? `?month=${encodeURIComponent(month)}` : ""}`);
    const payments = useFetch<LedgerPayment[]>("/payments");
    const renters = useFetch<RenterContact[]>("/renters");
    const provider = useFetch<ProviderStatus>("/billing/payment-provider");
    const deliveries = useFetch<Delivery[]>("/billing/deliveries");
    async function generate(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); if (busy || !writable || !/^[0-9]{4}-[0-9]{2}$/.test(month)) return;
        setBusy(true); setError(""); setMessage("");
        try {
            const result = await readResponse<{ created: number; existing: number }>(await apiFetch("/billing/invoices/generate", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ month, ...(dueDate ? { dueDate } : {}) })
            }));
            setMessage(`${result.created} invoice(s) created; ${result.existing} already existed for this month.`); invoices.reload();
        } catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
    }
    function refreshLedger() { setAllocating(null); invoices.reload(); payments.reload(); }
    const total = (invoices.data ?? []).filter((invoice) => invoice.status !== "VOID").reduce((sum, invoice) => sum + invoice.amount, 0);
    const outstanding = (invoices.data ?? []).reduce((sum, invoice) => sum + (invoice.status === "VOID" ? 0 : invoice.outstanding), 0);
    return <>
        <h1 className="dashboard-heading">Invoices &amp; Receipts</h1>
        <p className="financial-help">Monthly rent invoices use the rent and property details saved when issued. All amounts are whole Uganda shillings.</p>
        <section className="financial-panel" aria-labelledby="billing-month-heading">
            <h2 id="billing-month-heading">Monthly invoices</h2>
            <form className="financial-filter-row" onSubmit={generate}>
                <div><label htmlFor="invoice-month">Invoice month</label><input id="invoice-month" type="month" value={month}
                    onChange={(event) => { setMonth(event.target.value); setDueDate(""); setAllocating(null); }} disabled={busy} /></div>
                {writable && <div><label htmlFor="invoice-due-date">Due date override (optional)</label><input id="invoice-due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={busy} /></div>}
                <button type="button" className="financial-button" disabled={busy} onClick={() => { setMonth(""); setAllocating(null); }}>All months</button>
                {writable && <button type="submit" disabled={busy || !month}>{busy ? "Generating…" : "Generate monthly invoices"}</button>}
                <button type="button" className="financial-button" disabled={busy} onClick={refreshLedger}>Refresh balances</button>
            </form>
            <p className="financial-help">Generating the same month again keeps existing invoices. Historical months are generated only when you choose them.</p>
            {error && <p className="workspace-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
            <div className="financial-totals"><span>Issued: <strong>{ugx(total)}</strong></span><span>Outstanding: <strong>{ugx(outstanding)}</strong></span></div>
        </section>
        <section className="financial-provider" aria-label="Mobile-money availability">
            <h2>MTN and Airtel mobile money</h2>
            <p>{provider.loading ? "Checking payment availability…" : provider.data?.message || provider.error || "Payment provider setup is required."}</p>
            <p className="financial-help">Collections settle into this landlord’s approved account. Account approval and payment-provider setup are managed by the platform operator.</p>
        </section>
        {invoices.loading && <p role="status">Loading invoices…</p>}{invoices.error && <p className="workspace-error" role="alert">{invoices.error}</p>}
        {payments.error && <p className="workspace-error" role="alert">Credit balances: {payments.error}</p>}
        <div className="table-scroll"><table className="financial-table invoice-table" role="table" aria-label="Rent invoices">
            <thead role="rowgroup"><tr role="row"><th>Invoice / tenant</th><th>Property / unit</th><th>Due</th><th>Amount</th><th>Paid</th><th>Outstanding</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody role="rowgroup">{!invoices.loading && !invoices.data?.length && <tr><td colSpan={8}>No invoices for this selection.</td></tr>}
                {(invoices.data ?? []).map((invoice) => {
                    const contact = renters.data?.find((renter) => renter.id === invoice.renterId);
                    const hasCredit = payments.data?.some((payment) => payment.renterId === invoice.renterId && availableCredit(payment) > 0);
                    return <tr key={invoice.id} role="row">
                        <td role="cell" data-label="Invoice / tenant"><strong>{invoice.number}</strong><small className="financial-subline">{invoice.renterName}</small></td>
                        <td role="cell" data-label="Property / unit">{invoice.propertyName}<small className="financial-subline">Unit {invoice.unitNumber}</small></td>
                        <td role="cell" data-label="Due date">{billingDate(invoice.dueDate)}</td><td role="cell" data-label="Invoice amount">{ugx(invoice.amount)}</td><td role="cell" data-label="Paid">{ugx(invoice.paid)}</td><td role="cell" data-label="Outstanding">{ugx(invoice.outstanding)}</td>
                        <td role="cell" data-label="Status"><span className={`financial-status financial-status--${invoice.status.toLowerCase()}`}>{invoice.status}</span></td>
                        <td role="cell" data-label="Actions" className="financial-actions-cell">
                            <DocumentActions pdfPath={`/billing/invoices/${invoice.id}/pdf`} fileName={`${invoice.number}.pdf`}
                                sendPath={`/billing/invoices/${invoice.id}/send`} defaultEmail={contact?.email} onSent={deliveries.reload} />
                            {writable && invoice.status !== "VOID" && invoice.outstanding > 0 && <>
                                <PaymentLinkControl invoice={invoice} provider={provider.data} defaultEmail={contact?.email} />
                                {hasCredit && <button type="button" className="financial-button" onClick={() => setAllocating(allocating === invoice.id ? null : invoice.id)}>Apply existing credit</button>}
                            </>}
                            {writable && invoice.status !== "VOID" && invoice.paid === 0 && <VoidRecord path={`/billing/invoices/${invoice.id}/void`} label="Void invoice" onSaved={refreshLedger} />}
                            {writable && allocating === invoice.id && <AllocationForm invoice={invoice} invoices={invoices.data ?? []} payments={payments.data ?? []} onSaved={refreshLedger} onCancel={() => setAllocating(null)} />}
                        </td>
                    </tr>;
                })}
            </tbody>
        </table></div>
        <section className="financial-panel financial-deliveries" aria-labelledby="delivery-heading">
            <h2 id="delivery-heading">Recent email deliveries</h2>
            <button type="button" className="financial-button" onClick={deliveries.reload}>Refresh deliveries</button>
            {deliveries.loading && <p role="status">Loading deliveries…</p>}{deliveries.error && <p className="workspace-error" role="alert">{deliveries.error}</p>}
            {!deliveries.loading && !deliveries.data?.length && <p>No email delivery requests yet.</p>}
            {(deliveries.data ?? []).map((delivery) => <div key={delivery.id} className="financial-delivery-row">
                <span>{delivery.kind} · {delivery.recipient}</span><strong>{delivery.status === "SENT" ? "Accepted by email provider" : delivery.status}</strong>
                {delivery.lastError && <small className="financial-subline">{delivery.lastError}</small>}
            </div>)}
        </section>
    </>;
}
export default BillingPage;
