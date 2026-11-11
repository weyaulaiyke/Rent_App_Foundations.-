import { useEffect, useState, type FormEvent } from "react";
import { useApiFetch, useOrganization } from "../../context/OrganizationContext";
import useFetch from "../../hooks/useFetch";
import { errorMessage, readResponse } from "../../lib/api";
import type { BillingSettings, ProviderStatus } from "../../lib/billing";
function OrganizationBillingSettings() {
    const apiFetch = useApiFetch(); const { can } = useOrganization(); const owner = can("organization:manage");
    const settings = useFetch<BillingSettings>("/organization/billing-settings", owner);
    const provider = useFetch<ProviderStatus>("/billing/payment-provider", can("finance:read"));
    const [billingDay, setBillingDay] = useState("1"); const [monthlyEnabled, setMonthlyEnabled] = useState(false); const [reminders, setReminders] = useState(false);
    const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
    useEffect(function() {
        if (!settings.data) return;
        setBillingDay(String(settings.data.billingDay)); setMonthlyEnabled(settings.data.monthlyBillingEnabled); setReminders(settings.data.remindersEnabled);
    }, [settings.data]);
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); if (busy || !owner) return;
        const day = Number(billingDay);
        if (!Number.isInteger(day) || day < 1 || day > 28) { setError("Choose a billing day from 1 to 28."); return; }
        setBusy(true); setError(""); setMessage("");
        try {
            const saved = await readResponse<BillingSettings>(await apiFetch("/organization/billing-settings", {
                method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ billingDay: day, monthlyBillingEnabled: monthlyEnabled, remindersEnabled: reminders })
            }));
            settings.setData(saved); setMessage("Billing settings saved.");
        } catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
    }
    if (!owner && !can("finance:read")) return null;
    return <section className="workspace-panel settings-workspace" aria-labelledby="billing-settings-heading">
        <h2 id="billing-settings-heading">Billing &amp; mobile money</h2>
        <p>Monthly rent is billed in UGX using Africa/Kampala time. Invoice automation and reminder emails are optional.</p>
        {settings.loading && <p role="status">Loading billing settings…</p>}{settings.error && <p className="workspace-error" role="alert">{settings.error}</p>}
        {owner && settings.data && <form className="workspace-form" onSubmit={submit}>
            <label htmlFor="billing-day">Monthly billing / due day (1–28)</label>
            <input id="billing-day" type="number" min="1" max="28" step="1" value={billingDay} onChange={(event) => setBillingDay(event.target.value)} required disabled={busy} />
            <label className="billing-checkbox"><input type="checkbox" checked={monthlyEnabled} onChange={(event) => setMonthlyEnabled(event.target.checked)} disabled={busy} />Create monthly invoices automatically</label>
            <label className="billing-checkbox"><input type="checkbox" checked={reminders} onChange={(event) => setReminders(event.target.checked)} disabled={busy} />Send due and overdue reminders</label>
            <p className="financial-help">Reminders require a tenant email address and configured email delivery. Monthly billing starts with the current month.</p>
            <dl className="financial-definition"><div><dt>Currency</dt><dd>{settings.data.currency}</dd></div><div><dt>Time zone</dt><dd>{settings.data.timeZone}</dd></div></dl>
            <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save billing settings"}</button>
        </form>}
        {error && <p className="workspace-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
        <div className="financial-provider">
            <h3>MTN / Airtel collection setup</h3>
            <p>{provider.loading ? "Checking availability…" : provider.data?.message || provider.error || "Provider setup is required."}</p>
            <p className="financial-help">The platform operator must approve and connect this landlord’s settlement account. Payment links remain unavailable until the provider and this workspace’s settlement account are ready.</p>
        </div>
    </section>;
}
export default OrganizationBillingSettings;
