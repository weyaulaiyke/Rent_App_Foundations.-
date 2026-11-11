import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { errorMessage, publicApiFetch, readResponse } from "../lib/api";
import { ugx } from "../lib/billing";
import "./AuthPage.css";

type Status = { status: "PENDING" | "SUCCESS" | "FAILED"; amount: number; currency: string };
function validStatus(value: Status) {
    return value && ["PENDING", "SUCCESS", "FAILED"].includes(value.status)
        && Number.isSafeInteger(value.amount) && value.amount > 0 && value.currency === "UGX";
}
function PaymentReturnPage() {
    const location = useLocation(); const params = new URLSearchParams(location.search);
    const reference = params.get("tx_ref") || params.get("reference") || "";
    const transactionId = params.get("transaction_id") || params.get("transactionId") || "";
    const validReference = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(reference);
    const validTransaction = /^[1-9][0-9]{0,29}$/.test(transactionId);
    const [snapshot, setSnapshot] = useState<{ reference: string; data: Status } | null>(null);
    const status = snapshot?.reference === reference ? snapshot.data : null; const [busy, setBusy] = useState(false);
    const [error, setError] = useState(""); const [revision, setRevision] = useState(0);
    const [remaining, setRemaining] = useState(0); const deadline = useRef(0);
    useEffect(function() { setRemaining(0); deadline.current = 0; }, [reference, transactionId]);
    useEffect(function() {
        if (remaining <= 0) return;
        const timer = window.setTimeout(() => setRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))), 1000);
        return () => window.clearTimeout(timer);
    }, [remaining]);
    useEffect(function() {
        const controller = new AbortController(); setError(""); setSnapshot(null);
        if (!validReference) { setBusy(false); setError("This payment reference is missing or invalid. Open the payment link supplied by your landlord."); return () => controller.abort(); }
        setBusy(true);
        async function check() {
            try {
                const current = await readResponse<Status>(await publicApiFetch(`/payment-status/${encodeURIComponent(reference)}`, { signal: controller.signal }));
                if (!validStatus(current)) throw new Error("The payment status could not be confirmed. Please try again.");
                if (controller.signal.aborted) return;
                setSnapshot({ reference, data: current });
                if (current.status !== "SUCCESS" && validTransaction) {
                    const response = await publicApiFetch(`/payment-status/${encodeURIComponent(reference)}/confirm`, {
                        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactionId }), signal: controller.signal
                    });
                    if (response.status === 429) {
                        const retry = Number(response.headers.get("Retry-After"));
                        const seconds = Number.isFinite(retry) && retry > 0 ? Math.ceil(retry) : 10;
                        deadline.current = Date.now() + seconds * 1000; setRemaining(seconds);
                    }
                    const confirmed = await readResponse<Status>(response);
                    if (!validStatus(confirmed)) throw new Error("The payment status could not be confirmed. Please try again.");
                    if (!controller.signal.aborted) setSnapshot({ reference, data: confirmed });
                }
            } catch (error) { if (!controller.signal.aborted) setError(errorMessage(error)); }
            finally { if (!controller.signal.aborted) setBusy(false); }
        }
        void check(); return () => controller.abort();
    }, [reference, validReference, transactionId, validTransaction, revision]);
    return <div className="remote-auth-page"><section className="remote-auth-card" aria-labelledby="payment-return-heading">
        <div className="remote-auth-brand"><span className="remote-auth-brand-mark" aria-hidden="true">R</span><div><span className="remote-auth-brand-name">REMOTE</span><span className="remote-auth-brand-caption">Property Management</span></div></div>
        <h1 className="remote-auth-heading" id="payment-return-heading">{status?.status === "SUCCESS" ? "Payment confirmed" : status?.status === "FAILED" ? "Payment not completed" : "Payment status"}</h1>
        <p className="remote-auth-intro">{status?.status === "SUCCESS" ? "The payment provider has confirmed your payment. Your landlord can view the receipt in REMOTE."
            : status?.status === "FAILED" ? "The provider has not completed this payment. Contact your landlord if you need a new payment link."
            : "REMOTE checks the payment provider before confirming a payment."}</p>
        {status && <p className="remote-auth-notice" role="status">{ugx(status.amount)} · {status.status === "SUCCESS" ? "Confirmed" : status.status === "FAILED" ? "Not completed" : "Awaiting confirmation"}</p>}
        {busy && <p role="status">Checking with the payment service…</p>}{error && <p className="remote-auth-error" role="alert">{error}</p>}
        {validReference && status?.status !== "SUCCESS" && <button type="button" className="remote-auth-submit" disabled={busy || remaining > 0}
            onClick={() => setRevision((value) => value + 1)}>{busy ? "Checking…" : remaining > 0 ? `Check again in ${remaining}s` : "Check payment status"}</button>}
        {validReference && <p className="financial-help financial-reference">Reference: {reference}</p>}
        <p className="remote-auth-switch"><Link className="financial-auth-link" to="/login">Sign in to REMOTE</Link></p>
    </section></div>;
}
export default PaymentReturnPage;
