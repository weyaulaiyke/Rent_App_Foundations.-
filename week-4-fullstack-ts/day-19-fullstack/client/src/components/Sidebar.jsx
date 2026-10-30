import { Link } from "react-router-dom";
function Sidebar(){
    return(
        <aside className="sidebar">
            <h2>Rent App</h2>
            <nav>
            <Link to="/">Dashboard</Link>
            <Link to="/properties">Properties</Link>
            <Link to="/renters">Renters</Link>
            <Link to="/payments">Payments</Link>
            <Link to="/arrears">Arrears</Link>
            </nav>
        </aside>
    );
}
export default Sidebar;