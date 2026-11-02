import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import useFetch from "../hooks/useFetch";

type Property = {
    id: number;
    name: string;
};

type Unit = {
    id: number;
    number: string;
    propertyId: number;
};

const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:3000";
    
function PropertyPage() {
    const [unitNumber, setUnitNumber] = useState("");
    const [editingUnitId, setEditingUnitId] = useState<number | null>(null);
    const [editUnitNumber, setEditUnitNumber] = useState("");

    const { id } = useParams();

    const {
        data: properties,
        loading: propertyLoading,
        error: propertyError
    } = useFetch<Property[]>("/properties");

    const {
        data: allUnits,
        setData: setAllUnits,
        loading: unitsLoading,
        error: unitsError
    } = useFetch<Unit[]>("/units");

    const property = properties
        ? properties.find(function(property) {
              return property.id === Number(id);
          })
        : null;

    const units = allUnits
        ? allUnits.filter(function(unit) {
              return unit.propertyId === Number(id);
          })
        : [];

    if (propertyLoading || unitsLoading) {
        return <p>Loading property...</p>;
    }

    if (propertyError || unitsError) {
        return <p>Failed to load property.</p>;
    }

    if (!property) {
        return <p>Property not found.</p>;
    }

    function handleAddUnit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const newUnit = {
            number: unitNumber,
            propertyId: Number(id)
        };

        fetch(`${API_URL}/units`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify(newUnit)
        })
            .then(function(response) {
                return response.json();
            })
            .then(function(savedUnit) {
                setAllUnits([
                    ...(allUnits || []),
                    savedUnit.data
                ]);

                setUnitNumber("");
            });
    }

    function handleUpdateUnit(id: number) {
        const updatedUnit = {
            number: editUnitNumber
        };

        fetch(`${API_URL}/units/${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify(updatedUnit)
        })
            .then(function(response) {
                return response.json();
            })
            .then(function(savedUnit) {
                const updatedUnits = (allUnits || []).map(
                    function(unit) {
                        if (unit.id === id) {
                            return savedUnit.data;
                        }

                        return unit;
                    }
                );

                setAllUnits(updatedUnits);

                setEditingUnitId(null);
                setEditUnitNumber("");
            });
    }

    function handleDeleteUnit(id: number) {
        fetch(`${API_URL}/units/${id}`, {
            method: "DELETE",
            credentials: "include"
        }).then(function() {
            const remainingUnits = (allUnits || []).filter(
                function(unit) {
                    return unit.id !== id;
                }
            );

            setAllUnits(remainingUnits);
        });
    }

    return (
        <>
            <h1>{property.name}</h1>

            <h2>Units</h2>

            <form className= "unit-form" onSubmit={handleAddUnit}>
                <label htmlFor="unit-number">
                    Unit number
                </label>

                <input
                    id="unit-number"
                    type="text"
                    value={unitNumber}
                    onChange={function(event) {
                        setUnitNumber(event.target.value);
                    }}
                />

                <button type="submit">
                    Add Unit
                </button>
            </form>

            {units.map(function(unit) {
                return (
                    <div key={unit.id} className="unit-card">
                        {editingUnitId === unit.id ? (
                            <>
                                <input
                                    type="text"
                                    value={editUnitNumber}
                                    onChange={function(event) {
                                        setEditUnitNumber(
                                            event.target.value
                                        );
                                    }}
                                />

                                <button
                                    type="button"
                                    className="btn-edit"
                                    onClick={function() {
                                        handleUpdateUnit(unit.id);
                                    }}
                                >
                                    Update
                                </button>

                                <button
                                    type="button"
                                    className="btn-cancel"
                                    onClick={function() {
                                        setEditingUnitId(null);
                                    }}
                                >
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <>
                                <p>
                                    Unit {unit.number}
                                </p>

                                <button
                                    type="button"
                                    className="btn-edit"
                                    onClick={function() {
                                        setEditingUnitId(unit.id);
                                        setEditUnitNumber(
                                            unit.number
                                        );
                                    }}
                                >
                                    Edit
                                </button>

                                <button
                                    type="button"
                                    className="btn-delete"
                                    onClick={function() {
                                        handleDeleteUnit(unit.id);
                                    }}
                                >
                                    Delete
                                </button>
                            </>
                        )}
                    </div>
                );
            })}
        </>
    );
}

export default PropertyPage;