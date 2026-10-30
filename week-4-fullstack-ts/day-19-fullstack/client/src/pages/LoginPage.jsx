import { useContext,useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthContext from "../context/AuthContext";
const API_URL= "http://localhost:3000";

function LoginPage(){
    const [email, setEmail]= useState("")
    const [password, setPassword]= useState("")
    const {setUser} = useContext(AuthContext);
    const navigate = useNavigate();

    async function handleSubmit(event){
        event.preventDefault()
        const response = await fetch(`${API_URL}/auth/login`,{
            method: "POST",
            headers:{
                "Content-type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
                email: email,
                password: password
            })
        });
        const result = await response.json();
        console.log(result);
        if(response.ok){
            setUser(result.user);
            navigate("/");
        }
    }

    return(
        <form onSubmit={handleSubmit}>
            <h1>Login Page</h1>
            <label>Email</label>
            <input
            type="email"
            value={email}
            onChange={function(event){
                setEmail(event.target.value)
            }}
            />
            <label>Password</label>
            <input
            type="password"
            value={password}
            onChange={function(event){
                setPassword(event.target.value);
            }}
            />

            <button type="submit">Login</button>
        </form>
    )
}

export default LoginPage;