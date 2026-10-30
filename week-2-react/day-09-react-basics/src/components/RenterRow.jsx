function RenterRow(props){
    return(
        <tr>
            <td>{props.name}</td>
            <td>{props.unit}</td>
            <td>{props.status === "PAID" ? "PAID" : "OVERDUE"}</td>
        </tr>
    );
}
export default RenterRow;