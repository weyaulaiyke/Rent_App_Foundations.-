import useFetch from "../hooks/useFetch";

type ArrearsItem = {
    renter: string;
    property: string;
    unit: string;
    monthlyRent: number;
    totalPaid: number;
    arrears: number;
};

function ArrearsPage() {
    const {
        data: arrears,
        loading,
        error
    } = useFetch<ArrearsItem[]>("/reports/arrears");
    console.log("Arrears data:", arrears);

    if (loading) {
        return <p>Loading arrears...</p>;
    }

    if (error) {
        return <p>{error}</p>;
    }

    return (
        <>
            <h1>Arrears</h1>
        <div className="table-scroll">
            <table className="arrears-table">
                <thead>
                    <tr>
                        <th>Renter</th>
                        <th>Property</th>
                        <th>Unit</th>
                        <th>Monthly Rent</th>
                        <th>Total Paid</th>
                        <th>Arrears</th>
                    </tr>
                </thead>

                <tbody>
                    {(arrears || []).map(function(item) {
                        return (
                            <tr key={`${item.renter}-${item.property}-${item.unit}`}>
                                <td>
                                    {item.renter}
                                </td>

                                <td>
                                    {item.property}
                                </td>

                                <td>
                                    {item.unit}
                                </td>

                                <td>
                                    UGX{Number(item.monthlyRent).toLocaleString("en-US")}
                                </td>

                                <td className="total-paid">
                                    UGX {item.totalPaid.toLocaleString("en-US")}
                                </td>

                                <td className="arrears-amount">
                                    UGX {Number(item.arrears).toLocaleString("en-US")}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
        </>
    );
}

export default ArrearsPage;