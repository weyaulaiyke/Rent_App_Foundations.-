import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import useFetch from "../hooks/useFetch";
import { useApiFetch, useOrganization } from "../context/OrganizationContext";
import { errorMessage, readResponse } from "../lib/api";

type Property = { id: number; name: string };
type Unit = { id: number; number: string; propertyId: number };
function PropertyPage() {
    const { id } = useParams();
    const apiFetch = useApiFetch();
    const { can } = useOrganization();
    const writable = can("property:write");
    const [number, setNumber] = useState("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editNumber, setEditNumber] = useState("");
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState("");
    const properties = useFetch<Property[]>("/properties");
    const units = useFetch<Unit[]>("/units");
    const property = properties.data?.find((item) => item.id === Number(id));
    async function save(event: FormEvent<HTMLFormElement>, unitId?: number) {
        event.preventDefault();
        if (!writable || busy) return;
        setBusy(true); setActionError("");
        try {
            const saved = await readResponse<Unit>(await apiFetch(unitId ? `/units/${unitId}` : "/units", {
                method: unitId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(unitId ? { number: editNumber.trim() } : { number: number.trim(), propertyId: Number(id) })
            }));
            units.setData((current) => unitId ? current?.map((item) => item.id === unitId ? saved : item) ?? null : [...(current ?? []), saved]);
            setNumber(""); setEditingId(null); setEditNumber("");
        } catch (error) { setActionError(errorMessage(error)); }
        finally { setBusy(false); }
    }
    async function remove(unitId: number) {
        if (!writable || busy || !window.confirm("Delete this unit?")) return;
        setBusy(true); setActionError("");
        try {
            await readResponse(await apiFetch(`/units/${unitId}`, { method: "DELETE" }));
            units.setData((current) => current?.filter((item) => item.id !== unitId) ?? null);
        } catch (error) { setActionError(errorMessage(error)); }
        finally { setBusy(false); }
    }
    if (properties.loading || units.loading) return <p role="status">Loading property…</p>;
    if (properties.error || units.error) return <p role="alert">{properties.error || units.error}</p>;
    if (!property) return <><h1>Property not found in this workspace</h1><Link to="/properties">View properties</Link></>;
    const propertyUnits = units.data?.filter((item) => item.propertyId === property.id) ?? [];
    return <>
        <h1 className="dashboard-heading">{property.name}</h1><h2>Units</h2>
        {actionError && <p className="workspace-error" role="alert">{actionError}</p>}
        {writable && <form className="unit-form" onSubmit={(event) => void save(event)}>
            <label htmlFor="unit-number">Unit number</label>
            <input id="unit-number" value={number} onChange={(event) => setNumber(event.target.value)} required disabled={busy} />
            <button type="submit" disabled={busy}>Add Unit</button>
        </form>}
        {!propertyUnits.length && <p>No units added yet.</p>}
        {propertyUnits.map((unit) => <div key={unit.id} className="unit-card">
            {writable && editingId === unit.id ? <form className="unit-form" onSubmit={(event) => void save(event, unit.id)}>
                <label htmlFor={`unit-edit-${unit.id}`}>Unit number</label>
                <input id={`unit-edit-${unit.id}`} value={editNumber} onChange={(event) => setEditNumber(event.target.value)} required disabled={busy} />
                <button type="submit" disabled={busy}>Save changes</button>
                <button className="btn-cancel" type="button" disabled={busy} onClick={() => setEditingId(null)}>Cancel</button>
            </form> : <>
                <p>Unit {unit.number}</p>
                {writable && <>
                    <button className="btn-edit" type="button" disabled={busy} onClick={() => { setEditingId(unit.id); setEditNumber(unit.number); }}>Edit</button>
                    <button className="btn-delete" type="button" disabled={busy} onClick={() => void remove(unit.id)}>Delete</button>
                </>}
            </>}
        </div>)}
    </>;
}
export default PropertyPage;
