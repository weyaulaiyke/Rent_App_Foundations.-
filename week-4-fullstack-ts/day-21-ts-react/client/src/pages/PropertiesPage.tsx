const API_URL = "http://localhost:3000";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import useFetch from "../hooks/useFetch";

type Property = {
    id: number;
    name: string;
    location: string;
};

function PropertiesPage() {
    const [name, setName] = useState("");
    const [location, setLocation] = useState("");

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState("");
    const [editLocation, setEditLocation] = useState("");

    const {
        data: properties,
        setData,
        loading,
        error
    } = useFetch<Property[]>("/properties");

    function handleAddProperty(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const newProperty = {
            name: name,
            location: location
        };

        fetch(`${API_URL}/properties`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials:"include",
            body: JSON.stringify(newProperty)
        })
            .then(function(response) {
                return response.json();
            })
            .then(function(savedProperty) {
                setData([
                    ...(properties ?? []),
                    savedProperty.data
                ]);

                setName("");
                setLocation("");
            });
    }

    function handleUpdateProperty(id: number) {
        const updatedProperty = {
            name: editName,
            location: editLocation
        };

        fetch(`${API_URL}/properties/${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            credentials:"include",
            body: JSON.stringify(updatedProperty)
        })
            .then(function(response) {
                return response.json();
            })
            .then(function(savedProperty) {
                const updatedProperties = (properties ?? []).map(function(property) {
                    if (property.id === id) {
                        return savedProperty.data;
                    }

                    return property;
                });

                setData(updatedProperties);

                setEditingId(null);
                setEditName("");
                setEditLocation("");
            });
    }

    if (loading) {
        return <p>Loading properties...</p>;
    }

    if (error) {
        return <p>{error}</p>;
    }

    function handleDeleteProperty(id: number){
        fetch(`${API_URL}/properties/${id}`,{
            method:"DELETE",
            credentials:"include"
        })
        .then(function(){
            const remainingProperties = (properties ?? []).filter(function(property){
                return property.id !== id;
            })
            setData(remainingProperties)
        })
    }
    return (
        <>
            <h1>Properties</h1>

            <form className="property-form" onSubmit={handleAddProperty}>
                <label htmlFor="property-name">
                    Property name
                </label>

                <input
                    id="property-name"
                    type="text"
                    value={name}
                    onChange={function(event) {
                        setName(event.target.value);
                    }}
                />

                <label htmlFor="property-location">
                    Location
                </label>

                <input
                    id="property-location"
                    type="text"
                    value={location}
                    onChange={function(event) {
                        setLocation(event.target.value);
                    }}
                />

                <button type="submit">
                    Add Property
                </button>
            </form>

            {(properties ??[]).map(function(property) {
                return (
                    <div key={property.id} className="property-card">
                        {editingId === property.id ? (
                            <>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={function(event) {
                                        setEditName(event.target.value);
                                    }}
                                />

                                <input
                                    type="text"
                                    value={editLocation}
                                    onChange={function(event) {
                                        setEditLocation(event.target.value);
                                    }}
                                />

                                <button
                                    type="button"
                                    onClick={function() {
                                        handleUpdateProperty(property.id);
                                    }}
                                >
                                    Update
                                </button>

                                <button
                                    type="button"
                                    onClick={function() {
                                        setEditingId(null);
                                    }}
                                >
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <>
                                <Link to={`/properties/${property.id}`}>
                                    {property.name}
                                </Link>

                                <p>{property.location}</p>

                                <button
                                    type="button"
                                    className="btn-edit"
                                    onClick={function() {
                                        setEditingId(property.id);
                                        setEditName(property.name);
                                        setEditLocation(property.location);
                                    }}
                                >
                                    Edit
                                </button>
                                <button
                                type="button"
                                className="btn-delete"
                                onClick={function(){
                                    handleDeleteProperty(property.id);
                                }}>
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
export default PropertiesPage;