import { useEffect, useId, useState, type FormEvent } from "react";
import { useApiFetch, useOrganization } from "../../context/OrganizationContext";
import { errorMessage, readResponse } from "../../lib/api";
import type { Delivery } from "../../lib/billing";

type Props = {
    pdfPath: string; fileName: string; sendPath?: string; defaultEmail?: string | null | undefined;
    sendBody?: Record<string, string>; onSent?: () => void;
};
function DocumentActions({ pdfPath, fileName, sendPath, defaultEmail, sendBody, onSent }: Props) {
    const apiFetch = useApiFetch();
    const { can } = useOrganization();
    const id = useId();
    const [email, setEmail] = useState(defaultEmail ?? "");
    const [emailEdited, setEmailEdited] = useState(false);
    useEffect(() => { if (!emailEdited) setEmail(defaultEmail ?? ""); }, [defaultEmail, emailEdited]);
    const [showEmail, setShowEmail] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    async function download() {
        if (busy) return;
        setBusy(true); setError(""); setMessage("");
        try {
            const response = await apiFetch(pdfPath);
            if (!response.ok) await readResponse(response);
            if (!response.headers.get("Content-Type")?.includes("application/pdf")) throw new Error("The PDF could not be downloaded. Please try again.");
            const url = URL.createObjectURL(await response.blob());
            const link = document.createElement("a");
            link.href = url; link.download = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
            document.body.append(link); link.click(); link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) { setError(errorMessage(error)); }
        finally { setBusy(false); }
    }
    async function send(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy || !sendPath || !can("payment:write")) return;
        setBusy(true); setError(""); setMessage("");
        try {
            const delivery = await readResponse<Delivery>(await apiFetch(sendPath, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...sendBody, email: email.trim() })
            }));
            if (delivery.status === "FAILED" || delivery.status === "SKIPPED") {
                throw new Error(delivery.lastError || "This email was not sent. Check the delivery history.");
            }
            setMessage(delivery.status === "SENT" ? "Email accepted by the email provider."
                : delivery.status === "SENDING" ? "Email is being sent." : "Email queued for delivery.");
            setShowEmail(false); onSent?.();
        } catch (error) { setError(errorMessage(error)); onSent?.(); }
        finally { setBusy(false); }
    }
    return <div className="financial-document-actions">
        <div className="financial-actions">
            <button type="button" className="financial-button" disabled={busy} onClick={() => void download()}>Download PDF</button>
            {sendPath && can("payment:write") && <button type="button" className="financial-button" disabled={busy}
                onClick={() => { setShowEmail(!showEmail); setError(""); }}>Email PDF</button>}
        </div>
        {showEmail && <form className="financial-inline-form" onSubmit={send}>
            <label htmlFor={id}>Recipient email</label>
            <input id={id} type="email" value={email} onChange={(event) => { setEmailEdited(true); setEmail(event.target.value); }} required disabled={busy} />
            <button type="submit" disabled={busy}>{busy ? "Sending…" : "Send email"}</button>
        </form>}
        {error && <p className="workspace-error" role="alert">{error}</p>}
        {message && <p className="financial-message" role="status">{message}</p>}
    </div>;
}
export default DocumentActions;
