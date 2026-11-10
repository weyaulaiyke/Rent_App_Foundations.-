import { useContext, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import AuthContext from "./AuthContext";

function ProtectedRoute({children}: {children: ReactNode}){
   const auth = useContext(AuthContext);
   const location = useLocation();

   if(!auth) throw new Error("AuthProvider missing");

   const {user, loading} = auth;

    if(loading || !user){
        return (
            <Navigate
            to="/login"
            replace
            state={{
                from:location.pathname + location.search + location.hash
            }}
            />
        );
    }
    return <>{children}</>;
    
}

export default ProtectedRoute;