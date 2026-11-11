type RenterRowProps = {
    id: number;
    name: string;
    email?: string | undefined;
    phone?: string | undefined;
    unit: string;
    status: "PAID" | "OVERDUE";
    onToggleStatus: (id: number) => void;
};

function RenterRow(props: RenterRowProps){
    return(
        <tr>
            <td>{props.name}<small className="financial-subline">{[props.email, props.phone].filter(Boolean).join(" · ")}</small></td>
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