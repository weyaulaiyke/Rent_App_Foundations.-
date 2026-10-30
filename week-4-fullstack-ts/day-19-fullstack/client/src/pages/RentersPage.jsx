import { useState } from "react";
import useFetch from "../hooks/useFetch";

const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:3000";

function RentersPage() {
    const [name, setName] = useState("");
    const [unit, setUnit] = useState("");
    const [monthlyRent, setMonthlyRent] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [actionError, setActionError] = useState("");

    const {
        data: renters,
        setData: setRenters,
        loading: rentersLoading,
        error: rentersError
    } = useFetch("/renters");

    const {
        data: units,
        loading: unitsLoading,
        error: unitsError
    } = useFetch("/units");

    const {
        data: leases,
        setData: setLeases,
        loading: leasesLoading,
        error: leasesError
    } = useFetch("/leases");

    async function handleSubmit(event) {
        event.preventDefault();
        setActionError("");

        try {
            if (editingId) {
                // Update renter name
                const response = await fetch(
                    `${API_URL}/renters/${editingId}`,
                    {
                        method: "PATCH",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        credentials: "include",
                        body: JSON.stringify({
                            name: name
                        })
                    }
                );

                const updatedRenter = await response.json();

                if (!response.ok) {
                    throw new Error("Could not update renter");
                }

                setRenters(
                    renters.map(function (renter) {
                        if (renter.id === editingId) {
                            return updatedRenter.data;
                        }

                        return renter;
                    })
                );

                // Find this renter's existing lease
                const existingLease = (leases || []).find(
                    function (lease) {
                        return lease.renterId === editingId;
                    }
                );

                const leaseData = {
                    renterId: editingId,
                    unitId: Number(unit),
                    monthlyRent: Number(monthlyRent)
                };

                const selectedUnit = (units || []).find(
                    function (unitItem) {
                        return unitItem.id === Number(unit);
                    }
                );

                if (existingLease) {
                    // Update existing lease
                    const leaseResponse = await fetch(
                        `${API_URL}/leases/${existingLease.id}`,
                        {
                            method: "PATCH",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            credentials: "include",
                            body: JSON.stringify(leaseData)
                        }
                    );

                    const updatedLease = await leaseResponse.json();

                    if (!leaseResponse.ok) {
                        throw new Error("Could not update lease");
                    }

                    setLeases(
                        leases.map(function (lease) {
                            if (lease.id === existingLease.id) {
                                return {
                                    ...updatedLease.data,
                                    unit: selectedUnit
                                };
                            }

                            return lease;
                        })
                    );
                } else {
                    // Renter exists but has no lease yet
                    const leaseResponse = await fetch(
                        `${API_URL}/leases`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            credentials: "include",
                            body: JSON.stringify(leaseData)
                        }
                    );

                    const savedLease = await leaseResponse.json();

                    if (!leaseResponse.ok) {
                        throw new Error("Could not create lease");
                    }

                    setLeases([
                        ...(leases || []),
                        {
                            ...savedLease.data,
                            unit: selectedUnit
                        }
                    ]);
                }

                setEditingId(null);
            } else {
                // Create renter
                const response = await fetch(
                    `${API_URL}/renters`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        credentials: "include",
                        body: JSON.stringify({
                            name: name
                        })
                    }
                );

                const savedRenter = await response.json();

                if (!response.ok) {
                    throw new Error("Could not create renter");
                }

                // Create lease for the new renter
                const leaseResponse = await fetch(
                    `${API_URL}/leases`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        credentials: "include",
                        body: JSON.stringify({
                            renterId: savedRenter.data.id,
                            unitId: Number(unit),
                            monthlyRent: Number(monthlyRent)
                        })
                    }
                );

                const savedLease = await leaseResponse.json();

                if (!leaseResponse.ok) {
                    throw new Error("Renter created, but lease failed");
                }

                const selectedUnit = (units || []).find(
                    function (unitItem) {
                        return unitItem.id === Number(unit);
                    }
                );

                setRenters([
                    ...renters,
                    savedRenter.data
                ]);

                setLeases([
                    ...(leases || []),
                    {
                        ...savedLease.data,
                        unit: selectedUnit
                    }
                ]);
            }

            setName("");
            setUnit("");
            setMonthlyRent("");
        } catch (error) {
            console.error(error);
            setActionError(error.message);
        }
    }

    function handleEdit(renter) {
        const renterLease = (leases || []).find(
            function (lease) {
                return lease.renterId === renter.id;
            }
        );

        setName(renter.name);

        if (renterLease) {
            setUnit(String(renterLease.unitId));
            setMonthlyRent(String(renterLease.monthlyRent));
        } else {
            setUnit("");
            setMonthlyRent("");
        }

        setEditingId(renter.id);
    }

    async function handleDelete(id) {
        setActionError("");

        try {
            const renterLeases = (leases || []).filter(
                function (lease) {
                    return lease.renterId === id;
                }
            );

            // Delete leases first
            for (const lease of renterLeases) {
                const leaseResponse = await fetch(
                    `${API_URL}/leases/${lease.id}`,
                    {
                        method: "DELETE",
                        credentials: "include"
                    }
                );

                if (!leaseResponse.ok) {
                    throw new Error("Could not delete renter lease");
                }
            }

            const response = await fetch(
                `${API_URL}/renters/${id}`,
                {
                    method: "DELETE",
                    credentials: "include"
                }
            );

            if (!response.ok) {
                throw new Error("Could not delete renter");
            }

            setRenters(
                renters.filter(function (renter) {
                    return renter.id !== id;
                })
            );

            setLeases(
                (leases || []).filter(function (lease) {
                    return lease.renterId !== id;
                })
            );
        } catch (error) {
            console.error(error);
            setActionError(error.message);
        }
    }

    if (
        rentersLoading ||
        unitsLoading ||
        leasesLoading
    ) {
        return <p>Loading renters...</p>;
    }

    if (
        rentersError ||
        unitsError ||
        leasesError
    ) {
        return <p>Failed to load renters.</p>;
    }

    return (
        <>
            <h1>Renters</h1>

            {actionError && (
                <p>{actionError}</p>
            )}

            <form onSubmit={handleSubmit}>
                <label>Name</label>

                <input
                    type="text"
                    value={name}
                    onChange={(event) =>
                        setName(event.target.value)
                    }
                    required
                />

                <label>Unit</label>

                <select
                    value={unit}
                    onChange={(event) =>
                        setUnit(event.target.value)
                    }
                    required
                >
                    <option value="">
                        Select unit
                    </option>

                    {(units || []).map(function (unitItem) {
                        return (
                            <option
                                key={unitItem.id}
                                value={unitItem.id}
                            >
                                {unitItem.number}
                            </option>
                        );
                    })}
                </select>

                <label>Monthly Rent</label>

                <input
                    type="number"
                    value={monthlyRent}
                    onChange={(event) =>
                        setMonthlyRent(event.target.value)
                    }
                    required
                />

                <button type="submit">
                    {editingId
                        ? "Save Changes"
                        : "Add Renter"}
                </button>
            </form>

            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Unit</th>
                        <th>Monthly Rent</th>
                        <th>Actions</th>
                    </tr>
                </thead>

                <tbody>
                    {(renters || []).map(function (renter) {
                        const renterLease =
                            (leases || []).find(
                                function (lease) {
                                    return (
                                        lease.renterId ===
                                        renter.id
                                    );
                                }
                            );

                        return (
                            <tr key={renter.id}>
                                <td>{renter.name}</td>

                                <td>
                                    {renterLease?.unit?.number ||
                                        "-"}
                                </td>

                                <td>
                                    {renterLease?.monthlyRent ||
                                        "-"}
                                </td>

                                <td>
                                    <button
                                        onClick={() =>
                                            handleEdit(renter)
                                        }
                                    >
                                        Edit
                                    </button>

                                    <button
                                        onClick={() =>
                                            handleDelete(
                                                renter.id
                                            )
                                        }
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </>
    );
}

export default RentersPage;