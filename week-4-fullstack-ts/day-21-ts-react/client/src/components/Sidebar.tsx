
import { useContext } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import AuthContext from "../context/AuthContext";

import {
  LayoutDashboard,
  Building2,
  DoorOpen,
  Users,
  FileText,
  Wallet,
  Receipt,
  Wrench,
  BarChart3,
  UserCog,
  History,
  Settings,
  Archive,
  LogOut
} from "lucide-react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

function Sidebar() {
  const auth = useContext(AuthContext);

  if (!auth) {
    throw new Error("AuthProvider missing");
  }

  const { setUser } = auth;
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      const response = await fetch(
        `${API_URL}/auth/logout`,
        {
          method: "POST",
          credentials: "include"
        }
      );

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      setUser(null);
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      alert("Could not sign out. Please try again.");
    }
  }

  const menuItems = [
    {
      label: "Dashboard",
      path: "/",
      icon: <LayoutDashboard size={17} />
    },
    {
      label: "Properties",
      path: "/properties",
      icon: <Building2 size={17} />
    },
    {
      label: "Units",
      path: null,
      icon: <DoorOpen size={17} />
    },
    {
      label: "Tenants",
      path: "/renters",
      icon: <Users size={17} />
    },
    {
      label: "Leases",
      path: null,
      icon: <FileText size={17} />
    },
    {
      label: "Rent Collection",
      path: "/payments",
      icon: <Wallet size={17} />
    },
    {
      label: "Deposits & Charges",
      path: null,
      icon: <Receipt size={17} />
    },
    {
      label: "Maintenance",
      path: "/maintenance",
      icon: <Wrench size={17} />
    },
    {
      label: "Reports",
      path: "/arrears",
      icon: <BarChart3 size={17} />
    },
    {
      label: "Users",
      path: null,
      icon: <UserCog size={17} />
    },
    {
      label: "Activity Logs",
      path: null,
      icon: <History size={17} />
    },
    {
      label: "Settings",
      path: null,
      icon: <Settings size={17} />
    }
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
    <span className="remote-brand-mark" aria-hidden="true">
        R
    </span>

    <div>
        <h2>REMOTE</h2>
        <p>Property Management</p>
    </div>
</div>

      <nav aria-label="Main navigation">
        {menuItems.map(function(item) {
          if (!item.path) {
            return (
              <span
                key={item.label}
                className="sidebar-pending"
                title="Coming soon"
              >
                {item.icon}
                {item.label}
              </span>
            );
          }

          return (
            <NavLink
              key={item.label}
              to={item.path}
              end={item.path === "/" || item.path === "/renters"}
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          );
        })}

        <NavLink
          to="/renters/archived"
          className={({ isActive }) =>
            isActive ? "active sidebar-sub-link" : "sidebar-sub-link"
          }
        >
          <Archive size={16} />
          Archived Renters
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-account">
          <div className="sidebar-avatar">R</div>

          <div>
            <strong>REMOTE Account</strong>
            <small>Signed in</small>
          </div>
        </div>

        <button
          type="button"
          className="logout-button"
          onClick={handleLogout}
        >
          <LogOut size={17} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
