import SummaryCard from "../components/SummaryCard";
import useFetch from "../hooks/useFetch";
function DashboardPage(){
    const {
        data: renters,
        loading: rentersLoading,
        error: rentersError
    }= useFetch("http://localhost:3000/renters");

    const {
        data: properties,
        loading: propertiesLoading,
        error: propertiesError
    } = useFetch("http://localhost:3000/properties")
    if(rentersLoading || propertiesLoading){
        return <p>Loading dashboard...</p>
    }
    if(rentersError || propertiesError){
    return <p>Failed to load dashboard.</p>
    }
    const paidRenters = renters.filter(function(renter){
        return renter.status === "PAID";
    })
    const overdueRenters = renters.filter(function(renter){
        return renter.status === "OVERDUE"
    })
    return(
        <>
        <h1>Dashboard</h1>
        <div className="summary-cards">
    <SummaryCard
        title="Properties"
        value={properties.length}
    />

    <SummaryCard
        title="Renters"
        value={renters.length}
    />

    <SummaryCard
        title="Paid"
        value={paidRenters.length}
    />

    <SummaryCard
        title="Arrears"
        value={overdueRenters.length}
    />
</div>
        </>
    )
}

export default DashboardPage;