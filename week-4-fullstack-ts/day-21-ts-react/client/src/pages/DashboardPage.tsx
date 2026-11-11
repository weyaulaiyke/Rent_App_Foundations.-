import { currentMonth } from "../lib/billing";
import SummaryCard from "../components/SummaryCard";
import useFetch from "../hooks/useFetch";
import { useOrganization } from "../context/OrganizationContext";

type Lease = { renterId: number; monthlyRent: number; renter?: { isArchived: boolean } };
type Payment = { id: number; amount: number; paymentDate: string; voidedAt?: string | null };
type Arrears = { renterId: number; arrears: number };
type Maintenance = { id: number; status: string };
function DashboardPage() {
    const { can } = useOrganization();
    const finance = can("finance:read");
    const renters = useFetch<{ id: number }[]>("/renters");
    const properties = useFetch<{ id: number }[]>("/properties");
    const units = useFetch<{ id: number }[]>("/units");
    const maintenance = useFetch<Maintenance[]>("/maintenance");
    const leases = useFetch<Lease[]>("/leases", finance);
    const payments = useFetch<Payment[]>("/payments", finance);
    const arrears = useFetch<Arrears[]>("/reports/arrears", finance);
    const results = [renters, properties, units, maintenance, leases, payments, arrears];
    if (results.some((result) => result.loading)) return <p role="status">Loading dashboard…</p>;
    const error = results.find((result) => result.error)?.error;
    if (error) return <p role="alert">{error}</p>;
    const month = currentMonth();
    const activeLeases = (leases.data ?? []).filter((lease) => !lease.renter?.isArchived);
    const collected = (payments.data ?? []).filter((payment) => {
        return !payment.voidedAt && currentMonth(new Date(payment.paymentDate)) === month;
    }).reduce((total, payment) => total + Number(payment.amount), 0);
    const outstanding = (arrears.data ?? []).reduce((total, item) => total + Number(item.arrears), 0);
    const potential = activeLeases.reduce((total, lease) => total + Number(lease.monthlyRent), 0);
    const activeTenants = new Set(activeLeases.map((lease) => lease.renterId)).size;
    const overdue = new Set((arrears.data ?? []).map((item) => item.renterId)).size;
    const openMaintenance = (maintenance.data ?? []).filter((item) => !["COMPLETED", "RESOLVED"].includes(item.status)).length;
    return <>
        <h1 className="dashboard-heading">Dashboard</h1>
        <div className="summary-cards">
            <SummaryCard title="Properties" value={properties.data?.length ?? 0} />
            <SummaryCard title={finance ? "Active Tenants" : "Tenants"} value={finance ? activeTenants : renters.data?.length ?? 0} />
            <SummaryCard title="Total Units" value={units.data?.length ?? 0} />
            <SummaryCard title="Open Maintenance" value={openMaintenance} />
            {finance && <>
                <SummaryCard title="Potential Rent (UGX)" value={potential.toLocaleString("en-UG")} />
                <SummaryCard title="Collected This Month (UGX)" value={collected.toLocaleString("en-UG")} />
                <SummaryCard title="Overdue Rent (UGX)" value={outstanding.toLocaleString("en-UG")} />
                <SummaryCard title="Overdue Accounts" value={overdue} />
            </>}
        </div>
    </>;
}
export default DashboardPage;
