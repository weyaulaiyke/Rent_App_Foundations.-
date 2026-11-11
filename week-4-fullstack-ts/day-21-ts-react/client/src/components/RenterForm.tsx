import { useState, type FormEvent } from "react";

type Renter = {
    id: number;
    name: string;
    email?: string;
    phone?: string;
    unit: string;
    status: "OVERDUE";
};

type RenterFormProps = {
    onAddRenter: (renter: Renter) => void;
};

function RenterForm(props: RenterFormProps) {
    const [name, setName] = useState("");
    const [unit, setUnit] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        props.onAddRenter({
            id: Date.now(),
            name: name,
            email: email.trim(),
            phone: phone.trim(),
            unit: unit,
            status: "OVERDUE"
        });

        setName("");
        setUnit("");
        setEmail("");
        setPhone("");
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
            <input type="email" aria-label="Email (optional)" placeholder="Email (optional)" value={email} onChange={(event) => setEmail(event.target.value)} />
            <input type="tel" aria-label="Phone (optional)" placeholder="Phone (optional)" value={phone} onChange={(event) => setPhone(event.target.value)} />
            <button type="submit">Add Renter</button>
        </form>
    );
}

export default RenterForm;