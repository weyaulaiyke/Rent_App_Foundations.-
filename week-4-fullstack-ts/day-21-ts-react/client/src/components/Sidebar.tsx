import { useContext } from "react";
import AuthContext from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Users,
  Wallet,
  AlertCircle,
  Archive,
  LogOut
} from "lucide-react";

function Sidebar() {
  const auth = useContext(AuthContext);
  if(!auth) throw new Error("AuthProvider missing");

  const { setUser} = auth;
  const navigate = useNavigate();

  const handleLogout = async () => {
    try{
      const response = await fetch(`${API_URL}/auth/logout`,{
        method: "POST",
        credentials:"include"
      });
      if(!response.ok){
        throw new Error("Logout failed");
      }
      setUser(null);
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };
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

        <NavLink to="/arrears" className={({ isActive }) => isActive ? "active" : ""}>
          <AlertCircle size={18} />
          Arrears
        </NavLink>
        <button
        type="button"
        className="logout-button"
        onClick={handleLogout}
        >
          <LogOut size={18}/>
          Logout
        </button>
      </nav>
    </div>
  );
}

export default Sidebar;
