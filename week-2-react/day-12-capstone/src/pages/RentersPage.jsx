import { useState } from "react";
import useFetch from "../hooks/useFetch";

function RentersPage() {
    const [name, setName] = useState("");
    const [unit, setUnit] = useState("");
    const [status, setStatus] = useState("PAID");
    const [editingId, setEditingId] = useState(null);
    const {
        data: renters,
        setData: setRenters,
        loading,
        error
    } = useFetch("http://localhost:3000/renters");
    async function handleSubmit(e) {
        e.preventDefault();
        const renterData = {
            name,
            unit,
            status
        };
        if (editingId) {
            const response = await fetch(
                `http://localhost:3000/renters/${editingId}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(renterData)
                }
            );
            const updatedRenter = await response.json();
            setRenters(
                renters.map(function (renter) {
                    if (renter.id === editingId) {
                        return updatedRenter;
                    }
                    return renter;
                })
            );
            setEditingId(null);
        } else {
            const response = await fetch(
                "http://localhost:3000/renters",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(renterData)
                }
            );
            const savedRenter = await response.json();

            setRenters([...renters, savedRenter]);
        }
        setName("");
        setUnit("");
        setStatus("PAID");
    }
    function handleEdit(renter) {
        setName(renter.name);
        setUnit(renter.unit);
        setStatus(renter.status);
        setEditingId(renter.id);
    }
    async function handleDelete(id) {
        await fetch(`http://localhost:3000/renters/${id}`, {
            method: "DELETE"
        });
        setRenters(
            renters.filter(function (renter) {
                return renter.id !== id;
            })
        );
    }
    if (loading) {
        return <p>Loading renters...</p>;
    }
    if (error) {
        return <p>{error}</p>;
    }
    return (
        <>
            <h1>Renters</h1>
            <form onSubmit={handleSubmit}>
                <label>Name</label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
                <label>Unit</label>
                <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                />

                <label>Status</label>
                <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                >
                    <option value="PAID">PAID</option>
                    <option value="OVERDUE">OVERDUE</option>
                </select>
                <button type="submit">
                    {editingId ? "Save Changes" : "Add Renter"}
                </button>
            </form>
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Unit</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {renters.map(function (renter) {
                        return (
                            <tr key={renter.id}>
                                <td>{renter.name}</td>
                                <td>{renter.unit}</td>
                                <td>{renter.status}</td>
                                <td>
                                    <button
                                        onClick={() => handleEdit(renter)}
                                    >
                                        Edit
                                    </button>

                                    <button
                                        onClick={() => handleDelete(renter.id)}
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