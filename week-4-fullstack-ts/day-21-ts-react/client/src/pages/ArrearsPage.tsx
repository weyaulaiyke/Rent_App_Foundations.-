import useFetch from "../hooks/useFetch";
import FinancialReportActions from "../components/billing/FinancialReportActions";
import { ugx } from "../lib/billing";
type Arrears = {
    renter: string; property: string; unit: string; monthlyRent: number;
    invoicedAmount: number; totalPaid: number; arrears: number; overdueInvoiceCount: number;
};
function ArrearsPage() {
    const { data: arrears, loading, error } = useFetch<Arrears[]>("/reports/arrears");
    return <>
        <h1 className="dashboard-heading">Invoice Arrears</h1>
        <p className="financial-help">Balances below use due invoices and their allocated payments, up to today in Africa/Kampala time. Unallocated tenant credit remains available until applied to an invoice.</p>
        {loading && <p role="status">Loading arrears…</p>}{error && <p className="workspace-error" role="alert">{error}</p>}
        <div className="table-scroll"><table className="arrears-table">
            <thead><tr><th>Tenant</th><th>Property</th><th>Unit</th><th>Due invoices total</th><th>Allocated payments</th><th>Overdue balance</th><th>Overdue invoices</th></tr></thead>
            <tbody>{!loading && !arrears?.length && <tr><td colSpan={7}>No overdue invoice balances.</td></tr>}
                {(arrears ?? []).map((item) => <tr key={`${item.renter}-${item.property}-${item.unit}`}>
                    <td>{item.renter}</td><td>{item.property}</td><td>{item.unit}</td>
                    <td>{ugx(item.invoicedAmount ?? item.monthlyRent)}</td><td className="total-paid">{ugx(item.totalPaid)}</td>
                    <td className="arrears-amount">{ugx(item.arrears)}</td><td>{item.overdueInvoiceCount ?? "—"}</td>
                </tr>)}
            </tbody>
        </table></div>
        <FinancialReportActions defaultType="arrears" />
    </>;
}
export default ArrearsPage;
