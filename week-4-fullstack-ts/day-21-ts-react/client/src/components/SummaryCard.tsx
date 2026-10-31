type SummaryCardProps = {
    title: string;
    value: number | string;
};

function SummaryCard(props: SummaryCardProps){
    return(
        <div className="card">
            <h3>{props.title}</h3>
            <p>{props.value}</p>
        </div>
    );
}
export default SummaryCard;