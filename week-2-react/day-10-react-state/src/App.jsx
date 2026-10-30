import { useState, useEffect } from "react";
import RenterForm from "./components/RenterForm";
import RenterTable from "./components/RenterTable";
import SummaryCard from "./components/SummaryCard";
import Sidebar from "./components/Sidebar";

function App() {
    const [renters, setRenters] = useState(function() {
        const savedRenters = localStorage.getItem("renters");

        if (savedRenters) {
            return JSON.parse(savedRenters);
        }
        return [
            {
                id: 1,
                name: "John",
                unit: "A1",
                status: "PAID"
            },
            {
                id: 2,
                name: "Mary",
                unit: "A2",
                status: "OVERDUE"
            }
        ];
    });
    const [search, setSearch] = useState("");
    useEffect(function() {
        localStorage.setItem("renters", JSON.stringify(renters));
    }, [renters]);
    function handleAddRenter(newRenter) {
        setRenters([
            ...renters,
            newRenter
        ]);
    }
    function handleToggleStatus(id) {
        const updatedRenters = renters.map(function(renter) {
            if (renter.id === id) {
                return {
                    ...renter,
                    status: renter.status === "PAID"
                        ? "OVERDUE"
                        : "PAID"
                };
            }

            return renter;
        });

        setRenters(updatedRenters);
    }
    const filteredRenters = renters.filter(function(renter) {
        return renter.name
            .toLowerCase()
            .includes(search.toLowerCase());
    });
    const paidRenters = renters.filter(function(renter) {
        return renter.status === "PAID";
    });
    const overdueRenters = renters.filter(function(renter) {
        return renter.status === "OVERDUE";
    });
    const summaryCards = [
        {
            id: 1,
            title: "Total Units",
            value: 24
        },
        {
            id: 2,
            title: "Occupied Units",
            value: renters.length
        },
        {
            id: 3,
            title: "Rent Collected",
            value: paidRenters.length
        },
        {
            id: 4,
            title: "Arrears",
            value: overdueRenters.length
        }
    ];
    return (
        <>
            <Sidebar />
            <main className="main-content">
                <header className="topbar">
                    <h1>Landlord Dashboard</h1>
                </header>

                <section className="summary-cards">
                    {summaryCards.map(function(card) {
                        return (
                            <SummaryCard
                                key={card.id}
                                title={card.title}
                                value={card.value}
                            />
                        );
                    })}
                </section>
                <input
                    type="text"
                    placeholder="Search renters"
                    value={search}
                    onChange={function(event) {
                        setSearch(event.target.value);
                    }}
                />
                <RenterForm
                    onAddRenter={handleAddRenter}
                />
                <RenterTable
                    renters={filteredRenters}
                    onToggleStatus={handleToggleStatus}
                />
            </main>
        </>
    );
}
export default App;