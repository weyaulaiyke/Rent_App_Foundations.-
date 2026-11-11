import { useApiFetch, useOrganization } from "../context/OrganizationContext";
import useFetch from "../hooks/useFetch";
import { useState } from "react";


type Maintenance = {
    id: number;
    unitId: number;
    title: string;
    description: string;
    status: string;
    createdAt: string;
    unit: {
        number: string;
    };
};

type Unit = {
    id: number;
    number: string;
};

function MaintenancePage() {
    const apiFetch = useApiFetch();
    const { can } = useOrganization();
    const writable = can("maintenance:write");
    const {
        data: requests,
        setData: setRequests,
        loading,
        error
    } = useFetch<Maintenance[]>("/maintenance");

    const {
        data: units,
        loading: unitsLoading,
        error: unitsError
    } = useFetch<Unit[]>("/units");

    const [unitId, setUnitId] = useState("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    const [message, setMessage] = useState("");
    const [updatingId, setUpdatingId] = useState<number | null>(null);
    const [statusError, setStatusError] = useState("")

    async function handleSubmit() {
        if (!writable || saving || updatingId !== null) return;

        if (!unitId || !title.trim() || !description.trim()) {
            setSaveError("Select a unit and complete all fields.");
            return;
        }

        setSaving(true);
        setSaveError("");
        setMessage("");

        try {
            const response = await apiFetch("/maintenance", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    unitId: Number(unitId),
                    title: title.trim(),
                    description: description.trim()
                })
            });

            if (!response.ok) {
                throw new Error(
                    `Could not save the request (${response.status}).`
                );
            }

            setUnitId("");
            setTitle("");
            setDescription("");
            setMessage("Maintenance request created.");

            try {
                const listResponse = await apiFetch(
                    "/maintenance",
                    { credentials: "include" }
                );

                if (!listResponse.ok) {
                    throw new Error("Could not refresh the list.");
                }

                const result = await listResponse.json();
                const updatedRequests = Array.isArray(result)
                    ? result
                    : result?.data;

                if (!Array.isArray(updatedRequests)) {
                    throw new Error("Unexpected maintenance response.");
                }

                setRequests(updatedRequests);
            } catch {
                setMessage(
                    "Request created. Reload the page to refresh the table."
                );
            }
        } catch (error: unknown) {
            setSaveError(
                error instanceof Error
                    ? error.message
                    : "Could not save the maintenance request."
            );
        } finally {
            setSaving(false);
        }
    }

    async function updateStatus(id: number, status: string){
        if(!writable || updatingId !== null || saving) return;

        setUpdatingId(id);
        setStatusError("");

        try{
            const response = await apiFetch(`/maintenance/${id}`, {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ status })
            });

            if (!response.ok) {
                throw new Error(
                    `Could not update status (${response.status}).`
                );
            }
            setRequests(function(current) {
                return current?.map(function(request) {
                    return request.id === id
                    ? {...request, status: status }
                    : request;
                }) ?? null;
            });
    } catch (error: unknown) {
        setStatusError(
            error instanceof Error
            ? error.message
            : "Could not update status."
        );
    } finally{
        setUpdatingId(null);
    }
}

    return (
        <div>
            <h1 className="dashbord-heading">Maintenance</h1>

            {writable && <form
                className="maintenance-form"
                onSubmit={(event) => {
                    event.preventDefault();
                    void handleSubmit();
                }}
            >
                <h2>New Maintenance Request</h2>

                {unitsError && (
                    <p role="alert">Failed to load units.</p>
                )}

                <label htmlFor="maintenance-unit">Unit</label>
                <select
                    id="maintenance-unit"
                    value={unitId}
                    onChange={(event) => setUnitId(event.target.value)}
                    disabled={unitsLoading || saving || Boolean(unitsError)}
                    required
                >
                    <option value="">
                        {unitsLoading ? "Loading units..." : "Select a unit"}
                    </option>

                    {(units || []).map(function(unit) {
                        return (
                            <option key={unit.id} value={unit.id}>
                                {unit.number}
                            </option>
                        );
                    })}
                </select>

                <label htmlFor="maintenance-title">Title</label>
                <input
                    id="maintenance-title"
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g. Leaking kitchen tap"
                    disabled={saving}
                    required
                />

                <label htmlFor="maintenance-description">
                    Description
                </label>
                <textarea
                    id="maintenance-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe the maintenance issue"
                    disabled={saving}
                    required
                />

                <button
                    type="submit"
                    disabled={
                        saving ||
                        updatingId !== null || 
                        unitsLoading ||
                        Boolean(unitsError) ||
                        !units?.length
                    }
                >
                    {saving ? "Saving..." : "Create Maintenance Request"}
                </button>

                {saveError && <p role="alert">{saveError}</p>}
                {message && <p role="status">{message}</p>}
            </form>}

            {loading && <p>Loading maintenance requests...</p>}
            {error && (
                <p role="alert">Failed to load maintenance requests.</p>
            )}
        {statusError && <p role="alert">{statusError}</p>}

        {updatingId !== null && (
            <p role = "status">Updating status...</p>
        )}
            <table>
                <thead>
                    <tr>
                        <th>Unit</th>
                        <th>Title</th>
                        <th>Description</th>
                        <th>Status</th>
                        <th>Date</th>
                    </tr>
                </thead>

                <tbody>
                    {(requests || []).map(function(request) {
                        return (
                            <tr key={request.id}>
                                <td>{request.unit.number}</td>
                                <td>{request.title}</td>
                                <td>{request.description}</td>
                                <td>
                                    <select
                                aria-label={`Status for ${request.title}`}
                                value={request.status}
                                disabled={!writable || updatingId !== null || saving}
                                onChange={(event) => {
                                    void updateStatus(request.id, event.target.value);
                                }}
                                >
                                    <option value="OPEN">Open</option>
                                    <option value="IN_PROGRESS">In progress</option>
                                    <option value="COMPLETED">Completed</option>
                                    </select>
                                </td>
                                <td>
                                    {new Date(
                                        request.createdAt
                                    ).toLocaleDateString("en-UG")}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export default MaintenancePage;