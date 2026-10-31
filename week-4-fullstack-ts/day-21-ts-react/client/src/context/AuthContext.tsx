import { createContext, useEffect, useState} from "react";
type AuthValue = {
    user: Record<string, unknown> | null;
    setUser: (user: Record<string, unknown> | null) => void;
    loading: boolean;
};

const AuthContext = createContext<AuthValue | null>(null);
function AuthProvider({children}: {children: React.ReactNode}){
    
    const [user, setUser] = useState<Record<string, unknown> | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
   
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