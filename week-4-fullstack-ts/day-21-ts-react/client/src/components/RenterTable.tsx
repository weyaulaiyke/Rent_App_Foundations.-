import RenterRow from "./RenterRow";

type Renter = {
    id: number;
    name: string;
    unit: string;
    status: "PAID" | "OVERDUE";
};

type RenterTableProps = {
    renters: Renter[];
    onToggleStatus: (id: number) => void;
};

function RenterTable(props: RenterTableProps){
    return(
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Unit</th>
                    <th>Status</th>
                </tr>
            </thead>

<tbody>
    {props.renters.map(function(renter){
        return(
            <RenterRow
            key={renter.id}
            name={renter.name}
            unit={renter.unit}
            status={renter.status}
            id={renter.id}
            onToggleStatus={props.onToggleStatus}
            />
        )
    })}
</tbody>
</table>
)}
export default RenterTable;
