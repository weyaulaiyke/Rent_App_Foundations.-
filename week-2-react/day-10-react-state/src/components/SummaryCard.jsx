function SummaryCard(props){
    return(
        <div className="card">
            <h3>{props.title}</h3>
            <p>{props.value}</p>
        </div>
    );
}
export default SummaryCard;