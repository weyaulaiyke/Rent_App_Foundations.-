import { useState } from "react";
import { useParams } from "react-router-dom";
import useFetch from "../hooks/useFetch";
function PropertyPage(){
    const [unitNumber, setUnitNumber]= useState("");
    const [editingUnitId, setEditingUnitId]= useState(null);
    const [editUnitNumber, setEditUnitNumber]= useState("");
    const{id}= useParams();
    const{
        data: property,
        loading: propertyLoading,
        error: propertyError
    }= useFetch(`http://localhost:3000/properties/${id}`);
    const{
        data: units,
        setData: setUnits,
        loading: unitsLoading,
        error: unitsError
    }= useFetch(`http://localhost:3000/units?propertyId=${id}`);
    if(propertyLoading || unitsLoading){
        return <p>Loading property...</p>
    }
    if(propertyError || unitsError){
        return <p>Failed to load property.</p>
    }
    function handleAddUnit(event){
        event.preventDefault();
        const newUnit = {
            number: unitNumber,
            propertyId: Number(id)
        }
        fetch("http://localhost:3000/units",{
            method: "POST",
            headers:{
                "Content-Type": "application/json"
            },
            body: JSON.stringify(newUnit)
        })
        .then(function(response){
            return response.json();
        })
        .then(function(savedUnit){
            setUnits([
                ...units,savedUnit
            ]);
            setUnitNumber("");
        })
    }
    function handleUpdateUnit(id){
        const updatedUnit = {
            number: editUnitNumber
        };
        fetch(`http://localhost:3000/units/${id}`,{
            method: "PATCH",
            headers:{
                "Content-Type": "application/json"
            },
            body: JSON.stringify(updatedUnit)
    })
    .then(function(response){
        return response.json()
    })
    .then(function(savedUnit){
        const updatedUnits = units.map(function(unit){
            if (unit.id === id){
                return savedUnit;
            }
            return unit;
        })
        setUnits(updatedUnits)
        setEditingUnitId(null)
        setEditUnitNumber("")
    })
}
function handleDeleteUnit(id){
    fetch(`http://localhost:3000/units/${id}`,{
        method: "DELETE"
    })
    .then(function(){
        const remainingUnits = units.filter(function(unit){
            return unit.id !== id;
        });
        setUnits(remainingUnits);
    })
}
    return(
        <>
        <h1>{property.name}</h1>
        <p>Location: {property.location }</p>

        <h2>Units</h2>
        <form onSubmit={handleAddUnit}>
            <label htmlFor="unit-number">Unit number</label>
            <input
            id="unit-number"
            type="text"
            value={unitNumber}
            onChange={function(event){
                setUnitNumber(event.target.value);
            }}
            />
            <button type="submit">
                Add Unit
            </button>
        </form>
        {units.map(function(unit) {
            return (
                <div key={unit.id}>
                    {editingUnitId === unit.id ? (
                        <>
                            <input
                                type="text"
                                value={editUnitNumber}
                                onChange={function(event) {
                                    setEditUnitNumber(event.target.value);
                                }}/>
                            <button
                                type="button"
                                onClick={function() {
                                    handleUpdateUnit(unit.id);
                                }}>

                                Update

                            </button>
                            <button
                                type="button"
                                onClick={function() {
                                    setEditingUnitId(null);
                                }}>

                                Cancel

                            </button>
                        </>
                    ) : (
                        <>
                            <p>Unit {unit.number}</p>
                            <button
                                type="button"
                                onClick={function() {
                                    setEditingUnitId(unit.id);
                                    setEditUnitNumber(unit.number);
                                }} >

                                Edit

                            </button>
                            <button
                            type="button"
                            onClick={function(){
                                handleDeleteUnit(unit.id)
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
    )
}
export default PropertyPage;