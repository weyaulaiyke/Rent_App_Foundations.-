
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Users,
  Wallet,
  AlertCircle,
  Archive
} from "lucide-react";

function Sidebar() {
  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <img
          src="/REMOTE-logo.jpg"
          alt="REMOTE logo"
          className="remote-logo"
        />
        <h2>REMOTE</h2>
      </div>
      <nav>
        <NavLink to="/" className={({ isActive }) => isActive ? "active" : ""}>
          <LayoutDashboard size={18} />
          Dashboard
        </NavLink>

        <NavLink to="/properties" className={({ isActive }) => isActive ? "active" : ""}>
          <Building2 size={18} />
          Properties
        </NavLink>

        <NavLink to="/renters" end className={({ isActive }) => isActive ? "active" : ""}>
          <Users size={18} />
          Renters
        </NavLink>

        <NavLink to="/renters/archived" className={({ isActive }) => isActive ? "active" : ""}>
          <Archive size={18} />
          Archived Renters
        </NavLink>

        <NavLink to="/payments" className={({ isActive }) => isActive ? "active" : ""}>
          <Wallet size={18} />
          Payments
        </NavLink>

        <NavLink to="/Arrears" className={({ isActive }) => isActive ? "active" : ""}>
          <AlertCircle size={18} />
          Arrears
        </NavLink>
      </nav>
    </div>
  );
}

export default Sidebar;
