import SummaryCard from "../components/SummaryCard";
import useFetch from "../hooks/useFetch";

function DashboardPage() {
    const {
        data: renters,
        loading: rentersLoading,
        error: rentersError
    } = useFetch("/renters");

    const {
        data: properties,
        loading: propertiesLoading,
        error: propertiesError
    } = useFetch("/properties");

    const {
        data: leases,
        loading: leasesLoading,
        error: leasesError
    } = useFetch("/leases");

    const {
        data: arrears,
        loading: arrearsLoading,
        error: arrearsError
    } = useFetch("/reports/arrears");

    if (
        rentersLoading ||
        propertiesLoading ||
        leasesLoading ||
        arrearsLoading
    ) {
        return <p>Loading dashboard...</p>;
    }

    if (
        rentersError ||
        propertiesError ||
        leasesError ||
        arrearsError
    ) {
        return <p>Failed to load dashboard.</p>;
    }

    const arrearsRenterIds = new Set(
        (arrears || []).map(function(item) {
            return item.renter.id;
        })
    );

    const leasedRenterIds = new Set(
        (leases || []).map(function(lease) {
            return lease.renterId;
        })
    );

    const paidRenters = (renters || []).filter(function(renter) {
        return (
            leasedRenterIds.has(renter.id) &&
            !arrearsRenterIds.has(renter.id)
        );
    });

    return (
        <>
            <h1>Dashboard</h1>

            <div className="summary-cards">
                <SummaryCard
                    title="Properties"
                    value={(properties || []).length}
                />

                <SummaryCard
                    title="Renters"
                    value={(renters || []).length}
                />

                <SummaryCard
                    title="Paid"
                    value={paidRenters.length}
                />

                <SummaryCard
                    title="Arrears"
                    value={arrearsRenterIds.size}
                />
            </div>
        </>
    );
}

export default DashboardPage;