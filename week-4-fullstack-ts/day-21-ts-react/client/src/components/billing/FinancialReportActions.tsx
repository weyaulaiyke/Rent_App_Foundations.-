import { useId, useState } from "react";
import DocumentActions from "./DocumentActions";
import { currentMonth } from "../../lib/billing";
function FinancialReportActions({ defaultType = "arrears" }: { defaultType?: "collections" | "arrears" }) {
    const id = useId();
    const [type, setType] = useState<"collections" | "arrears">(defaultType);
    const [month, setMonth] = useState(currentMonth);
    return <section className="financial-report" aria-labelledby={`${id}-heading`}>
        <h2 id={`${id}-heading`}>Financial report</h2>
        <div className="financial-filter-row"><div><label htmlFor={`${id}-type`}>Report</label>
            <select id={`${id}-type`} value={type} onChange={(event) => setType(event.target.value as "collections" | "arrears")}>
                <option value="collections">Collections</option><option value="arrears">Arrears</option>
            </select></div>
            <div><label htmlFor={`${id}-month`}>Report month</label><input id={`${id}-month`} type="month" value={month} onChange={(event) => setMonth(event.target.value)} required /></div>
        </div>
        {/^[0-9]{4}-[0-9]{2}$/.test(month) && <DocumentActions key={`${type}:${month}`}
            pdfPath={`/reports/financial.pdf?type=${type}&month=${encodeURIComponent(month)}`}
            fileName={`REMOTE-${type}-${month}.pdf`} sendPath="/reports/send" sendBody={{ type, month }} />}
    </section>;
}
export default FinancialReportActions;
