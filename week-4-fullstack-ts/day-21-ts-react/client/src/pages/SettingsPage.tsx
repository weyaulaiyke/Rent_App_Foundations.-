import OrganizationBillingSettings from "../components/billing/OrganizationBillingSettings";
import { useState, type FormEvent } from "react";
import ThemeSwitcher from "../components/ThemeSwitcher";
import { ROLE_LABELS, useOrganization } from "../context/OrganizationContext";
import { errorMessage } from "../lib/api";
import "./SettingsPage.css";

function SettingsPage() {
    const { organization, can, renameOrganization } = useOrganization();
    const [name, setName] = useState(organization?.name ?? "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    async function rename(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy || !can("organization:manage") || !name.trim()) return;
        setBusy(true); setError(""); setMessage("");
        try { await renameOrganization(name); setName(name.trim()); setMessage("Workspace name updated."); }
        catch (error) { setError(errorMessage(error)); }
        finally { setBusy(false); }
    }
    return <div className="settings-page">
        <h1 className="dashboard-heading">Settings</h1>
        <section className="settings-appearance" aria-labelledby="appearance-heading">
            <div className="settings-appearance-copy">
                <h2 id="appearance-heading">Appearance</h2>
                <p>Choose Light, Dark, or System to follow your device.</p>
                <p className="settings-help">Changes apply immediately and are saved in this browser.</p>
            </div>
            <div className="settings-theme-control"><ThemeSwitcher /></div>
        </section>
        <OrganizationBillingSettings />
        <section className="workspace-panel settings-workspace" aria-labelledby="workspace-settings-heading">
            <h2 id="workspace-settings-heading">Workspace</h2>
            <p>{organization?.name} · {organization ? ROLE_LABELS[organization.role] : ""}</p>
            {can("organization:manage") && <form className="workspace-form" onSubmit={rename}>
                <label htmlFor="workspace-name">Workspace name</label>
                <input id="workspace-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required disabled={busy} />
                <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save workspace name"}</button>
            </form>}
            {error && <p className="workspace-error" role="alert">{error}</p>}
            {message && <p role="status">{message}</p>}
        </section>
    </div>;
}
export default SettingsPage;
