import { useEffect, useId, useState, type FormEvent } from "react";
import { useApiFetch } from "../../context/OrganizationContext";
import { errorMessage, readResponse } from "../../lib/api";
import { ugx, wholeUgx, type Invoice, type ProviderStatus } from "../../lib/billing";

type LinkResult = { id: string; status: string; checkoutUrl: string; amount: number; currency: string };
function PaymentLinkControl({ invoice, provider, defaultEmail }: { invoice: Invoice; provider: ProviderStatus | null; defaultEmail?: string | null | undefined }) {
    const apiFetch = useApiFetch(); const id = useId();
    const [open, setOpen] = useState(false); const [email, setEmail] = useState(defaultEmail ?? "");
    const [emailEdited, setEmailEdited] = useState(false);
    useEffect(() => { if (!emailEdited) setEmail(defaultEmail ?? ""); }, [defaultEmail, emailEdited]);
    const [amount, setAmount] = useState(String(invoice.outstanding));
    const [result, setResult] = useState<LinkResult | null>(null);
    const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
    const enabled = Boolean(provider?.configured && provider.settlementConfigured && invoice.status !== "VOID" && invoice.outstanding > 0);
    async function create(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); if (!enabled || busy) return;
        const value = wholeUgx(amount);
        if (value === null || value > invoice.outstanding) { setError("Enter a whole-UGX amount within the outstanding balance."); return; }
        setBusy(true); setError(""); setMessage("");
        try {
            const link = await readResponse<LinkResult>(await apiFetch(`/billing/invoices/${invoice.id}/payment-link`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), amount: value })
            }));
            if (new URL(link.checkoutUrl).protocol !== "https:") throw new Error("The payment provider did not return a secure checkout link.");
            setResult(link); setOpen(false);
        } catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
    }
    async function copy() {
        if (!result) return;
        try { await navigator.clipboard.writeText(result.checkoutUrl); setMessage("Payment link copied."); }
        catch { setError("Copy is unavailable here. Select the payment link below and copy it."); }
    }
    return <div className="financial-payment-link">
        <button type="button" className="financial-button" disabled={!enabled || busy} title={!enabled ? provider?.message || "Mobile-money setup is required." : "Create MTN/Airtel checkout link"}
            onClick={() => setOpen(!open)}>MTN / Airtel payment link</button>
        {open && <form className="financial-inline-form" onSubmit={create}>
            <label htmlFor={`${id}-email`}>Payer email</label>
            <input id={`${id}-email`} type="email" value={email} onChange={(event) => { setEmailEdited(true); setEmail(event.target.value); }} required disabled={busy} />
            <label htmlFor={`${id}-amount`}>Amount (whole UGX)</label>
            <input id={`${id}-amount`} type="number" min="1" max={invoice.outstanding} step="1" value={amount} onChange={(event) => setAmount(event.target.value)} required disabled={busy} />
            <button type="submit" disabled={busy}>{busy ? "Creating link…" : "Create secure payment link"}</button>
        </form>}
        {result && <div className="financial-link-result">
            <p>Payment link created for {ugx(result.amount)}. The receipt becomes available after provider confirmation.</p>
            <div className="financial-actions"><a href={result.checkoutUrl} target="_blank" rel="noopener noreferrer">Open secure checkout</a>
                <button type="button" className="financial-button" onClick={() => void copy()}>Copy payment link</button></div>
            <label className="financial-help" htmlFor={`${id}-link`}>Payment link</label>
            <input id={`${id}-link`} type="url" value={result.checkoutUrl} readOnly onFocus={(event) => event.target.select()} />
        </div>}
        {error && <p className="workspace-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    </div>;
}
export default PaymentLinkControl;
