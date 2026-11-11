import { useState } from "react";
import useFetch from "../hooks/useFetch";
import { useApiFetch, useOrganization } from "../context/OrganizationContext";
import { errorMessage, readResponse } from "../lib/api";

type Renter = { id: number; name: string; isArchived: boolean };
function ArchivedRentersPage() {
    const apiFetch = useApiFetch();
    const { can } = useOrganization();
    const { data: renters, setData, loading, error } = useFetch<Renter[]>("/renters/archived");
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState("");
    async function restore(id: number) {
        if (busy || !can("renter:write")) return;
        setBusy(true); setActionError("");
        try {
            await readResponse(await apiFetch(`/renters/${id}/restore`, { method: "PATCH" }));
            setData((current) => current?.filter((item) => item.id !== id) ?? null);
        } catch (error) { setActionError(errorMessage(error)); }
        finally { setBusy(false); }
    }
    if (loading) return <p role="status">Loading archived renters…</p>;
    if (error) return <p role="alert">{error}</p>;
    return <div className="archived-page">
        <h1>Archived Renters</h1>
        <p>{can("renter:write") ? "View and restore previously archived renters." : "View previously archived renters."}</p>
        {actionError && <p className="workspace-error" role="alert">{actionError}</p>}
        {!renters?.length && <p className="empty-state">No archived renters yet.</p>}
        {(renters ?? []).map((renter) => <div key={renter.id} className="property-card">
            <p>{renter.name}</p>
            {can("renter:write") && <button type="button" className="btn-restore" disabled={busy} onClick={() => void restore(renter.id)}>Restore</button>}
        </div>)}
    </div>;
}
export default ArchivedRentersPage;
