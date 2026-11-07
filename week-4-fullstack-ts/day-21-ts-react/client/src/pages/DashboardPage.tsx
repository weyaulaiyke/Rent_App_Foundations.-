import SummaryCard from "../components/SummaryCard";
import useFetch from "../hooks/useFetch";

type Renter = {
    id: number;
};

type Unit = {
    id:number;
};

type Lease = {
    renterId: number;
    monthlyRent: number;
};

type Payment = {
    id: number;
    renterid: number;
    amount: number;
    paymentDate: string;
};

type ArrearsItem = {
    renterId: number;
    renter: string;
    arrears: number;
};

type Maintenance = {
    id: number;
    status: string;
};

function DashboardPage() {
    const {
        data: renters,
        loading: rentersLoading,
        error: rentersError
    } = useFetch<Renter[]>("/renters");

    const {
        data: properties,
        loading: propertiesLoading,
        error: propertiesError
    } = useFetch<unknown[]>("/properties");

    const {
        data: units,
        loading:unitsLoading,
        error: unitsError
    }= useFetch<Unit[]>("/units");

    const {
        data: leases,
        loading: leasesLoading,
        error: leasesError
    } = useFetch<Lease[]>("/leases");

    const {
        data:payments,
        loading: paymentsLoading,
        error: paymentsError
    }= useFetch<Payment[]>("/payments");

    const {
        data: arrears,
        loading: arrearsLoading,
        error: arrearsError
    } = useFetch<ArrearsItem[]>("/reports/arrears");

    const {
        data: maintenance,
        loading: maintenanceLoading,
        error: maintenanceError
    } = useFetch<Maintenance[]>("/maintenance");

    if (
        rentersLoading ||
        propertiesLoading ||
        leasesLoading ||
        arrearsLoading ||
        unitsLoading ||
        paymentsLoading ||
        maintenanceLoading
    ) {
        return <p>Loading dashboard...</p>;
    }

    if (
        rentersError ||
        propertiesError ||
        leasesError ||
        arrearsError||
        unitsError||
        paymentsError||
        maintenanceError
    ) {
        return <p>Failed to load dashboard.</p>;
    }

    const arrearsRenterIds = new Set(
        (arrears || []).map(function(item) {
            return item.renterId;
        })
    );

    const leasedRenterIds = new Set(
        (leases || []).map(function(lease) {
            return lease.renterId;
        })
    );

    const potentialRent = (leases || []).reduce(
        function(total, lease){
            return total + lease.monthlyRent;
        },0 );

    const outstandingRent = (arrears || []).reduce(
        function(total, item){
            return total + item.arrears;
        }, 0);

    const today = new Date();
    const monthlyPayments = (payments || []).filter(function(payment){
        const paymentDate = new Date(payment.paymentDate);

        return (
            paymentDate.getMonth() === today.getMonth() && paymentDate.getFullYear() === today.getFullYear()
        );
    });

    const openMaintenance = (maintenance || []).filter(
        (request) => request.status !== "RESOLVED"
    ).length;

    const collectedThisMonth = monthlyPayments.reduce(
        function(total, payment){
            return total + payment.amount;
        },0 );

    return (
        <>
            <h1 className="dashboard-heading">Dashboard</h1>

            <div className="summary-cards">
                <SummaryCard
                    title="Properties"
                    value={(properties || []).length}
                />

                <SummaryCard
                    title="Active Tenants"
                    value={leasedRenterIds.size}
                />

                <SummaryCard
                    title="Total Units"
                    value={(units || []).length}
                />

                <SummaryCard
                title="Potential Rent (UGX)"
                value={potentialRent.toLocaleString("en-UG")}
                />

                <SummaryCard
                    title="Collected This Month (UGX)"
                    value={collectedThisMonth.toLocaleString("en-UG")}
                />

                <SummaryCard
                    title="Outstanding Rent (UGX)"
                    value={outstandingRent.toLocaleString("en-UG")}
                />

                <SummaryCard
                    title="Open Maintenance"
                    value={openMaintenance}
                />

                <SummaryCard
                    title="Overdue Accounts"
                    value={arrearsRenterIds.size}
                />
            </div>
        </>
    );
}

export default DashboardPage;