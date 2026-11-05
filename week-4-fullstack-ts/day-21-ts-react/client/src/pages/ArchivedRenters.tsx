import useFetch from "../hooks/useFetch";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

type ArchivedRenter = {
    id: number;
    name: string;
    isArchived: boolean;
};

function ArchivedRentersPage() {
    const {
        data: renters,
        setData: setRenters,
        loading,
        error
    } = useFetch<ArchivedRenter[]>("/renters/archived");

    async function handleRestore(id: number){
        try{
            const response = await fetch(`${API_URL}/renters/${id}/restore`,
                {
                    method:"PATCH",
                    credentials:"include"
                }
            );
            if (!response.ok){
                throw new Error("Failed to restore renter");
            }
            setRenters((current) =>
            (current || []).filter((renter) => renter.id !== id)
        );

        } catch (error){
            console.error("Restore failed:", error);
            alert("Could not restore renter")
        }
    }

    if (loading) {
        return <p>Loading archived renters...</p>;
    }

    if (error) {
        return <p>{error}</p>;
    }

    return (
        <div className="archived-page">
            <h1>Archived Renters</h1>
            <p>View and restore previously archived renters.</p>
            {renters?.length === 0 && (
                <p className="empty-state">
                    No archived renters yet.
                </p>
            )}

            {(renters || []).map(function (renter) {
                return (
                    <div key={renter.id} className="property-card">
                        <p>{renter.name}</p>
                        <button 
                        type="button"
                        className="btn-restore" 
                        onClick={() => handleRestore(renter.id)}
                        >
                            Restore
                        </button>
                    </div>
                );
            })}
        </div>
    );
}

export default ArchivedRentersPage;
