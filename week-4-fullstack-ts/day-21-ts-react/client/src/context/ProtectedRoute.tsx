import { useContext, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import AuthContext from "./AuthContext";

function ProtectedRoute({children}: {children: ReactNode}){
   const auth = useContext(AuthContext);
   if(!auth) throw new Error("AuthProvider misssing");
   const {user, loading} = auth;
    if(loading){
        return <p>Checking login...</p>
    }
    if (!user){
        return <Navigate to="/login" replace/>
    }
    return children;
}

export default ProtectedRoute;