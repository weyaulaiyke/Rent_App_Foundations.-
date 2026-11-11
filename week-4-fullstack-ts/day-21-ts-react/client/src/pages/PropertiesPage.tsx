import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import useFetch from "../hooks/useFetch";
import { useApiFetch, useOrganization } from "../context/OrganizationContext";
import { errorMessage, readResponse } from "../lib/api";

type Property = { id: number; name: string; location?: string };
function PropertiesPage() {
    const apiFetch = useApiFetch();
    const { can } = useOrganization();
    const writable = can("property:write");
    const [name, setName] = useState("");
    const [location, setLocation] = useState("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState("");
    const [editLocation, setEditLocation] = useState("");
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState("");
    const { data: properties, setData, loading, error } = useFetch<Property[]>("/properties");
    async function add(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!writable || busy) return;
        setBusy(true); setActionError("");
        try {
            const saved = await readResponse<Property>(await apiFetch("/properties", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim(), location: location.trim() })
            }));
            setData((current) => [...(current ?? []), saved]); setName(""); setLocation("");
        } catch (error) { setActionError(errorMessage(error)); }
        finally { setBusy(false); }
    }
    async function update(event: FormEvent<HTMLFormElement>, id: number) {
        event.preventDefault();
        if (!writable || busy) return;
        setBusy(true); setActionError("");
        try {
            const saved = await readResponse<Property>(await apiFetch(`/properties/${id}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: editName.trim(), location: editLocation.trim() })
            }));
            setData((current) => current?.map((item) => item.id === id ? saved : item) ?? null);
            setEditingId(null);
        } catch (error) { setActionError(errorMessage(error)); }
        finally { setBusy(false); }
    }
    async function remove(id: number) {
        if (!writable || busy || !window.confirm("Delete this property?")) return;
        setBusy(true); setActionError("");
        try {
            await readResponse(await apiFetch(`/properties/${id}`, { method: "DELETE" }));
            setData((current) => current?.filter((item) => item.id !== id) ?? null);
        } catch (error) { setActionError(errorMessage(error)); }
        finally { setBusy(false); }
    }
    if (loading) return <p role="status">Loading properties…</p>;
    if (error) return <p role="alert">{error}</p>;
    return <>
        <h1 className="dashboard-heading">Properties</h1>
        {actionError && <p className="workspace-error" role="alert">{actionError}</p>}
        {writable && <form className="property-form" onSubmit={add}>
            <label htmlFor="property-name">Property name</label>
            <input id="property-name" value={name} onChange={(event) => setName(event.target.value)} required disabled={busy} />
            <label htmlFor="property-location">Location</label>
            <input id="property-location" value={location} onChange={(event) => setLocation(event.target.value)} disabled={busy} />
            <button type="submit" disabled={busy}>{busy ? "Saving…" : "Add Property"}</button>
        </form>}
        {!properties?.length && <p>No properties in this workspace yet.</p>}
        {(properties ?? []).map((property) => <div key={property.id} className="property-card">
            {writable && editingId === property.id ? <form className="workspace-form" onSubmit={(event) => void update(event, property.id)}>
                <label htmlFor={`edit-property-name-${property.id}`}>Property name</label>
                <input id={`edit-property-name-${property.id}`} value={editName} onChange={(event) => setEditName(event.target.value)} required disabled={busy} />
                <label htmlFor={`edit-property-location-${property.id}`}>Location</label>
                <input id={`edit-property-location-${property.id}`} value={editLocation} onChange={(event) => setEditLocation(event.target.value)} disabled={busy} />
                <button type="submit" disabled={busy}>Save changes</button>
                <button type="button" className="btn-cancel" onClick={() => setEditingId(null)} disabled={busy}>Cancel</button>
            </form> : <>
                <Link to={`/properties/${property.id}`}>{property.name}</Link>
                <p>{property.location || ""}</p>
                {writable && <>
                    <button className="btn-edit" type="button" disabled={busy} onClick={() => {
                        setEditingId(property.id); setEditName(property.name); setEditLocation(property.location ?? "");
                    }}>Edit</button>
                    <button className="btn-delete" type="button" disabled={busy} onClick={() => void remove(property.id)}>Delete</button>
                </>}
            </>}
        </div>)}
    </>;
}
export default PropertiesPage;
