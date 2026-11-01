import { Link, NavLink } from "react-router-dom";
function Sidebar(){
    return(
        <aside className="sidebar">
            <h2>Rent App</h2>
            <nav>
            <NavLink to="/" end className={({isActive}) =>isActive ? "active" : ""}>Dashboard</NavLink>
            <NavLink to="/properties" className={({isActive}) => isActive ? "active" : ""}>Properties</NavLink>
            <NavLink to="/renters" className={({isActive}) => isActive ? "active" : ""}>Renters</NavLink>
            <NavLink to="/payments" className={({isActive}) => isActive ? "active" : ""}>Payments</NavLink>
            <NavLink to="/Arrears" className={({isActive}) => isActive ? "active" : ""}>Arrears</NavLink>
            </nav>
        </aside>
    );
}
export default Sidebar;