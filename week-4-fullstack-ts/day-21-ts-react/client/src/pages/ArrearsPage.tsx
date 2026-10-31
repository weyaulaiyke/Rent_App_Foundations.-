import useFetch from "../hooks/useFetch";

type ArrearsItem = {
    renter: {
        id: number;
        name: string;
    };
    property: {
        name: string;
    };
    unit: {
        id: number;
        number: string;
    };
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

    if (loading) {
        return <p>Loading arrears...</p>;
    }

    if (error) {
        return <p>{error}</p>;
    }

    return (
        <>
            <h1>Arrears</h1>

            <table>
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
                            <tr key={`${item.renter.id}-${item.unit.id}`}>
                                <td>
                                    {item.renter.name}
                                </td>

                                <td>
                                    {item.property.name}
                                </td>

                                <td>
                                    {item.unit.number}
                                </td>

                                <td>
                                    UGX {item.monthlyRent}
                                </td>

                                <td>
                                    UGX {item.totalPaid}
                                </td>

                                <td>
                                    UGX {item.arrears}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </>
    );
}

export default ArrearsPage;