import { useId, useState, type FormEvent } from "react";
import { useApiFetch } from "../../context/OrganizationContext";
import { errorMessage, readResponse } from "../../lib/api";
function VoidRecord({ path, label, onSaved }: { path: string; label: string; onSaved: () => void }) {
    const apiFetch = useApiFetch(); const id = useId();
    const [open, setOpen] = useState(false); const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false); const [error, setError] = useState("");
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); if (busy || !reason.trim()) return;
        setBusy(true); setError("");
        try { await readResponse(await apiFetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: reason.trim() }) })); setOpen(false); onSaved(); }
        catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
    }
    return <div className="financial-void">
        {!open ? <button type="button" className="financial-button financial-danger" onClick={() => setOpen(true)}>{label}</button>
            : <form className="financial-inline-form" onSubmit={submit}>
                <label htmlFor={id}>Reason for voiding</label>
                <textarea id={id} value={reason} onChange={(event) => setReason(event.target.value)} required maxLength={500} disabled={busy} />
                <p className="financial-help">The original record and its history are retained.</p>
                <div className="financial-actions"><button type="submit" disabled={busy}>{busy ? "Saving…" : "Confirm void"}</button>
                    <button type="button" className="btn-cancel" disabled={busy} onClick={() => setOpen(false)}>Cancel</button></div>
                {error && <p className="workspace-error" role="alert">{error}</p>}
            </form>}
    </div>;
}
export default VoidRecord;
