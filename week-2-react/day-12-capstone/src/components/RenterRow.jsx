function RenterRow(props){
    return(
        <tr>
            <td>{props.name}</td>
            <td>{props.unit}</td>
            <td>
                <button onClick={function(){
                    props.onToggleStatus(props.id);
                }}>
                {props.status === "PAID" ? "PAID" : "OVERDUE"}
                </button>
            </td>
        </tr>
    );
}
export default RenterRow;