import { useState, type FormEvent } from "react";
import useFetch from "../hooks/useFetch";
import { useApiFetch, useOrganization } from "../context/OrganizationContext";
import { errorMessage, readResponse } from "../lib/api";
import { wholeUgx, type RenterContact } from "../lib/billing";

type Renter = RenterContact;
type Unit = { id: number; number: string; propertyId: number };
type Lease = { id: number; renterId: number; unitId: number; monthlyRent: number; unit?: Unit | undefined };
function RentersPage() {
    const apiFetch = useApiFetch();
    const { can } = useOrganization();
    const finance = can("finance:read");
    const writable = can("renter:write") && can("lease:write");
    const renters = useFetch<Renter[]>("/renters");
    const units = useFetch<Unit[]>("/units", writable);
    const leases = useFetch<Lease[]>("/leases", finance);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [unit, setUnit] = useState("");
    const [monthlyRent, setMonthlyRent] = useState("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState("");
    function clearForm() { setName(""); setEmail(""); setPhone(""); setUnit(""); setMonthlyRent(""); setEditingId(null); }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!writable || busy) return;
        if (wholeUgx(monthlyRent) === null) { setActionError("Enter monthly rent as a positive whole-UGX amount."); return; }
        if (!units.data?.some((item) => item.id === Number(unit))) {
            setActionError("Select a unit from this workspace."); return;
        }
        setBusy(true); setActionError("");
        try {
            const saved = await readResponse<Renter>(await apiFetch(editingId ? `/renters/${editingId}` : "/renters", {
                method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim(), email: email.trim() || null, phone: phone.trim() || null })
            }));
            renters.setData((current) => editingId ? current?.map((item) => item.id === saved.id ? saved : item) ?? null : [...(current ?? []), saved]);
            // Keep the saved tenant selected if its separate lease request needs a retry.
            setEditingId(saved.id);
            const previousLease = leases.data?.find((item) => item.renterId === saved.id);
            try {
                const savedLease = await readResponse<Lease>(await apiFetch(previousLease ? `/leases/${previousLease.id}` : "/leases", {
                    method: previousLease ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ renterId: saved.id, unitId: Number(unit), monthlyRent: Number(monthlyRent) })
                }));
                const selectedUnit = units.data?.find((item) => item.id === Number(unit));
                const completeLease = { ...savedLease, unit: selectedUnit };
                leases.setData((current) => previousLease
                    ? current?.map((item) => item.id === previousLease.id ? completeLease : item) ?? null
                    : [...(current ?? []), completeLease]);
            } catch (error) {
                throw new Error(`Tenant saved, but the lease was not saved. ${errorMessage(error)} You can retry Save Changes.`);
            }
            clearForm();
        } catch (error) { setActionError(errorMessage(error)); }
        finally { setBusy(false); }
    }
    function edit(renter: Renter) {
        const lease = leases.data?.find((item) => item.renterId === renter.id);
        setEditingId(renter.id); setName(renter.name); setEmail(renter.email ?? ""); setPhone(renter.phone ?? "");
        setUnit(lease ? String(lease.unitId) : "");
        setMonthlyRent(lease ? String(lease.monthlyRent) : "");
        setActionError("");
    }
    async function archive(id: number) {
        if (!can("renter:write") || busy || !window.confirm("Archive this renter?")) return;
        setBusy(true); setActionError("");
        try {
            await readResponse(await apiFetch(`/renters/${id}`, { method: "DELETE" }));
            renters.setData((current) => current?.filter((item) => item.id !== id) ?? null);
            if (editingId === id) clearForm();
        } catch (error) { setActionError(errorMessage(error)); }
        finally { setBusy(false); }
    }
    if (renters.loading || units.loading || leases.loading) return <p role="status">Loading renters…</p>;
    if (renters.error || units.error || leases.error) return <p role="alert">{renters.error || units.error || leases.error}</p>;
    const columns = 2 + (finance ? 2 : 0) + (can("renter:write") ? 1 : 0);
    return <>
        <h1 className="dashboard-heading">Renters</h1>
        {actionError && <p className="workspace-error" role="alert">{actionError}</p>}
        {writable && <form className="renters-form" onSubmit={submit}>
            <label htmlFor="renter-name">Name</label>
            <input id="renter-name" value={name} onChange={(event) => setName(event.target.value)} required disabled={busy} />
            <label htmlFor="renter-email">Email (optional)</label>
            <input id="renter-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} />
            <label htmlFor="renter-phone">Phone (optional)</label>
            <input id="renter-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} disabled={busy} maxLength={40} />
            <label htmlFor="renter-unit">Unit</label>
            <select id="renter-unit" value={unit} onChange={(event) => setUnit(event.target.value)} required disabled={busy}>
                <option value="">Select unit</option>
                {(units.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.number}</option>)}
            </select>
            <label htmlFor="renter-monthly-rent">Monthly Rent (UGX)</label>
            <input id="renter-monthly-rent" type="number" min="1" max="2147483647" step="1" value={monthlyRent}
                onChange={(event) => setMonthlyRent(event.target.value)} required disabled={busy} />
            <button type="submit" disabled={busy || !units.data?.length}>{busy ? "Saving…" : editingId ? "Save Changes" : "Add Renter"}</button>
            {editingId && <button type="button" className="btn-cancel" disabled={busy} onClick={clearForm}>Cancel</button>}
        </form>}
        <div className="table-scroll"><table className="renters-table">
            <thead><tr><th>Name</th><th>Contact</th>{finance && <><th>Unit</th><th>Monthly Rent</th></>}{can("renter:write") && <th>Actions</th>}</tr></thead>
            <tbody>
                {!renters.data?.length && <tr><td colSpan={columns}>No renters added yet.</td></tr>}
                {(renters.data ?? []).map((renter) => {
                    const lease = leases.data?.find((item) => item.renterId === renter.id);
                    return <tr key={renter.id}>
                        <td>{renter.name}</td>
                        <td>{renter.email || "—"}<small className="financial-subline">{renter.phone || ""}</small></td>
                        {finance && <><td>{lease?.unit?.number ?? "—"}</td>
                            <td>{lease ? `UGX ${Number(lease.monthlyRent).toLocaleString("en-UG")}` : "—"}</td></>}
                        {can("renter:write") && <td>
                            {writable && <button type="button" className="btn-edit" disabled={busy} onClick={() => edit(renter)}>Edit</button>}
                            <button type="button" className="btn-delete" disabled={busy} onClick={() => void archive(renter.id)}>Archive</button>
                        </td>}
                    </tr>;
                })}
            </tbody>
        </table></div>
    </>;
}
export default RentersPage;
