import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Building2, Check, ChevronDown } from "lucide-react";
import { ROLE_LABELS, useOrganization } from "../context/OrganizationContext";
import { errorMessage } from "../lib/api";

export function CreateWorkspaceForm({ onCreated }: { onCreated?: () => void }) {
    const { createOrganization } = useOrganization();
    const id = useId();
    const [name, setName] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy || !name.trim()) return;
        setBusy(true); setError("");
        try { await createOrganization(name); setName(""); onCreated?.(); }
        catch (error) { setError(errorMessage(error)); }
        finally { setBusy(false); }
    }
    return <form className="workspace-form" onSubmit={submit}>
        <label htmlFor={id}>New workspace name</label>
        <input id={id} value={name} onChange={(event) => setName(event.target.value)}
            maxLength={120} required disabled={busy} placeholder="e.g. Kampala Properties" />
        <button type="submit" disabled={busy}>{busy ? "Creating…" : "Create workspace"}</button>
        {error && <p className="workspace-error" role="alert">{error}</p>}
    </form>;
}

function WorkspaceSelector({ compact }: { compact: boolean }) {
    const { organization, organizations, loading, selectOrganization, reloadOrganizations, error } = useOrganization();
    const details = useRef<HTMLDetailsElement>(null);
    useEffect(function() {
        function close(event: PointerEvent) {
            if (event.target instanceof Node && !details.current?.contains(event.target)) details.current?.removeAttribute("open");
        }
        document.addEventListener("pointerdown", close);
        return () => document.removeEventListener("pointerdown", close);
    }, []);
    function close() { details.current?.removeAttribute("open"); details.current?.querySelector("summary")?.focus(); }
    return <details ref={details} className={`workspace-selector${compact ? " workspace-selector--compact" : ""}`}
        onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); close(); } }}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) details.current?.removeAttribute("open"); }}>
        <summary aria-label={`Workspace: ${organization?.name ?? "Choose a workspace"}`}
            title={organization?.name ?? "Choose a workspace"}>
            <Building2 size={18} aria-hidden="true" />
            <span className="workspace-selector-label"><strong>{organization?.name ?? (loading ? "Loading…" : "Choose workspace")}</strong>
                <small>{organization ? ROLE_LABELS[organization.role] : "Your workspaces"}</small></span>
            <ChevronDown size={15} className="workspace-chevron" aria-hidden="true" />
        </summary>
        <div className="workspace-selector-menu">
            <p className="workspace-menu-heading">Switch workspace</p>
            {organizations.map((item) => <button key={item.id} type="button" className="workspace-option"
                aria-pressed={item.id === organization?.id} onClick={() => { selectOrganization(item.id); close(); }}>
                <span><strong>{item.name}</strong><small>{ROLE_LABELS[item.role]}</small></span>
                {item.id === organization?.id && <Check size={16} aria-hidden="true" />}
            </button>)}
            {error && <p className="workspace-error" role="alert">{error}</p>}
            <button className="workspace-refresh" type="button" onClick={() => void reloadOrganizations()}>Refresh workspaces</button>
            <CreateWorkspaceForm onCreated={close} />
        </div>
    </details>;
}
export default WorkspaceSelector;
