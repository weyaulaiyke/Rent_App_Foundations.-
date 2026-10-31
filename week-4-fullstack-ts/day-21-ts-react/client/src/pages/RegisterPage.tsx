import { useContext, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import AuthContext from "../context/AuthContext";
const API_URL= import.meta.env.VITE_API_URL;

function RegisterPage(){
    const [email, setEmail]= useState("");
    const [password, setPassword]= useState("");
    const auth = useContext(AuthContext);
    const navigate = useNavigate();

    if(!auth) throw new Error("AuthProvider missing");
    const { setUser } = auth;


async function handleSubmit(event: FormEvent<HTMLFormElement>){
    event.preventDefault();
    const response = await fetch(`${API_URL}/auth/register`,{
        method: "POST",
        headers:{
            "Content-Type": "application/json"
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
        const loginResponse = await fetch(`${API_URL}/auth/login`,{
            method:"POST",
            headers:{
                "Content-Type": "application/json"
            },
            credentials:"include",
            body: JSON.stringify({
                email: email,
                password: password
            })
        });
        const loginResult = await loginResponse.json();
        console.log("login ressult:", loginResponse.status, loginResult)
        if(loginResponse.ok){
            setUser(loginResult.user);
            navigate("/");
        }
    }
}



return(
    <form onSubmit={handleSubmit}>
        <h1>Register Page</h1>
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
            setPassword(event.target.value)
        }}
        />
        <button type="submit">Register</button>
    </form>
)
}

export default RegisterPage;