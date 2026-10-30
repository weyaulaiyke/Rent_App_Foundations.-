import { useParams } from "react-router-dom";
import useFetch from "../hooks/useFetch";
function PropertyPage(){
    const{id}= useParams();
    const{
        data: property,
        loading,
        error
    }= useFetch(`http://localhost:3000/properties/${id}`);
    if(loading){
        return <p>Loading property...</p>
    }
    if(error){
        return <p>{error}</p>
    }
    return(
        <>
        <h1>{property.name}</h1>
        <p>Location: {property.location }</p>
        </>
    )
}
export default PropertyPage;