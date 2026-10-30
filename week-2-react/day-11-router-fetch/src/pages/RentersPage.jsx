import useFetch from "../hooks/useFetch";
function RentersPage(){
    const{
        data: renters,
        loading,
        error
    }=useFetch("http://localhost:3000/renters");
    if(loading){
        return <p>Loading renters...</p>
    }
    if(error){
        return <p>{error}</p>;
    }
    return(
        <>
        <h1>Renters</h1>
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Unit</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                {renters.map(function(renter){
                    return(
                        <tr key={renter.id}>
                            <td>{renter.name}</td>
                            <td>{renter.unit}</td>
                            <td>{renter.status}</td>
                        </tr>
                    )
                })}
            </tbody>
        </table>
        </>
    )
}
export default RentersPage;