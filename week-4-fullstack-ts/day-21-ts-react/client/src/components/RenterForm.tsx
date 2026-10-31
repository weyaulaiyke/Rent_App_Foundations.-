import { useState, type FormEvent } from "react";

type Renter = {
    id: number;
    name: string;
    unit: string;
    status: "OVERDUE";
};

type RenterFormProps = {
    onAddRenter: (renter: Renter) => void;
};

function RenterForm(props: RenterFormProps) {
    const [name, setName] = useState("");
    const [unit, setUnit] = useState("");

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        props.onAddRenter({
            id: Date.now(),
            name: name,
            unit: unit,
            status: "OVERDUE"
        });

        setName("");
        setUnit("");
    }

    return (
        <form onSubmit={handleSubmit}>
            <input
                type="text"
                placeholder="Renter Name"
                value={name}
                onChange={function(event) {
                    setName(event.target.value);
                }}
            />

            <input
                type="text"
                placeholder="Unit"
                value={unit}
                onChange={function(event) {
                    setUnit(event.target.value);
                }}/>
            <button type="submit">Add Renter</button>
        </form>
    );
}

export default RenterForm;