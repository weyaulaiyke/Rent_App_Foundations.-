import useFetch from "../hooks/useFetch";
function ArrearsPage(){
    const{
        data: renters,
        loading,
        error
    }= useFetch("http://localhost:3000/renters")
    if (loading){
        return <p>Loading arrears...</p>
    }
    if (error){
        return <p>{error}</p>
    }
    const arrears = renters.filter(function(renter){
        return renter.status === "OVERDUE";
    })
    return(
        <>
        <h1>Arrears</h1>
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Unit</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                {arrears.map(function(renter){
                    return (
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
export default ArrearsPage;