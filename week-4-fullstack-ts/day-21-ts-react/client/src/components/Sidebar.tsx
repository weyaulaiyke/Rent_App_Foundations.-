import { Link, NavLink } from "react-router-dom";
import { LayoutDashboard, Building2, Users, Wallet, AlertCircle, Archive } from "lucide-react";
function Sidebar(){
    return(
        <aside className="sidebar">
            <h2 className="sidebar-brand">REMOTE</h2>
            <nav>
            <NavLink to="/" className={({isActive}) =>isActive ? "active" : ""}><LayoutDashboard size={18}/>Dashboard</NavLink>
            <NavLink to="/properties" className={({isActive}) => isActive ? "active" : ""}><Building2 size={18}/>Properties</NavLink>
            <NavLink to="/renters" end className={({isActive}) => isActive ? "active" : ""}><Users size={18}/>Renters</NavLink>
            <NavLink to="/renters/archived" className={({isActive}) => isActive ? "active" : ""}><Archive size={18}/>Archived Renters</NavLink>
            <NavLink to="/payments" className={({isActive}) => isActive ? "active" : ""}><Wallet size={18}/>Payments</NavLink>
            <NavLink to="/Arrears" className={({isActive}) => isActive ? "active" : ""}><AlertCircle size={18}/>Arrears</NavLink>
            </nav>
        </aside>
    );
}
export default Sidebar;