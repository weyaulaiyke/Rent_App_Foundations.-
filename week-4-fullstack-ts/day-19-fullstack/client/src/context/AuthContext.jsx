import { createContext, useEffect, useState} from "react";
const AuthContext = createContext(null);
function AuthProvider({children}){
    
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(null);
    useEffect(function(){
        fetch("http://localhost:3000/auth/me",{
            credentials:"include"
        })
        .then(function(response){
            if(!response.ok){
                throw new Error("Not logged in")
            }
            return response.json();
        })
        .then(function(data){
            setUser(data);
            setLoading(false);
        })
        .catch(function(){
            setUser(null);
            setLoading(false);
        })
    },[])

    return (
        <AuthContext.Provider value={{user, setUser, loading}}>
            {children}
        </AuthContext.Provider>
    );
}
export {AuthProvider};

export default AuthContext;