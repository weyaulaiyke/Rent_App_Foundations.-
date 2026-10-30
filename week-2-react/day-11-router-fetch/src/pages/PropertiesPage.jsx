import { Link } from "react-router-dom";
import useFetch from "../hooks/useFetch";
function PropertiesPage(){
    const {
        data: properties,
        loading,
        error
    }= useFetch("http://localhost:3000/properties");
    if (loading){
        return <p>Loading properties...</p>;
    }
    if(error){
        return <p>{error}</p>
    }
    return (
        <>
        <h1>Properties</h1>
        {properties.map(function(property){
            return(
                <div key={property.id}>
            <Link to={`/properties/${property.id}`}>{property.name}</Link>
            <p>{property.location}</p>
                </div>
            )
        })}
        </>
    )

}
export default PropertiesPage;