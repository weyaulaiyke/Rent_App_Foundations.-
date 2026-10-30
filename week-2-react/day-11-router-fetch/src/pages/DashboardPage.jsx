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
            <div>
                <h3>Properties</h3>
                <p>{properties.length}</p>
            </div>
        <div>
            <h3>Renters</h3>
            <p>{renters.length}</p>
        </div>
        <div>
            <h3>Paid</h3>
            <p>{paidRenters.length}</p>
        </div>
        <div>
            <h3>Arrears</h3>
            <p>{overdueRenters.length}</p>
        </div>
        </div>
        </>
    )
}

export default DashboardPage;