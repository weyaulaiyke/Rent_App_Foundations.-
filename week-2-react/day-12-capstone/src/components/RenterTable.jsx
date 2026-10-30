import RenterRow from "./RenterRow";
function RenterTable(props){
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
