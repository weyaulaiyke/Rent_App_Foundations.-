import {
  useContext,
  useEffect,
  useState,
  type FocusEvent,
  type MouseEvent
} from "react";
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
  LogOut,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";

import "./Sidebar.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

const STORAGE_KEY = "remote-sidebar-collapsed";

function Sidebar() {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(function() {
      try {
          return localStorage.getItem(STORAGE_KEY) === "true";
      } catch {
          return false;
      }
  });

  const [tooltip, setTooltip] = useState<{
      text: string;
      top: number;
      left: number;
  } | null>(null);

  useEffect(function() {
      try {
          localStorage.setItem(STORAGE_KEY, String(collapsed));
      } catch {
          // The toggle still works when storage is unavailable.
      }
  }, [collapsed]);

  if (!auth) throw new Error("AuthProvider missing");

  const { setUser } = auth;

  function toggleSidebar() {
      setTooltip(null);
      setCollapsed(function(current) {
          return !current;
      });
  }

  function showLabel(
      event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>
  ) {
      if (!collapsed) return;

      const target =
          event.target instanceof Element
              ? event.target.closest<HTMLElement>("[data-tooltip]")
              : null;

      if (!target) {
          setTooltip(null);
          return;
      }

      const rect = target.getBoundingClientRect();

      setTooltip({
          text: target.dataset.tooltip || "",
          top: Math.max(
              24,
              Math.min(
                  rect.top + rect.height / 2,
                  window.innerHeight - 24
              )
          ),
          left: Math.max(
              8,
              Math.min(rect.right + 10, window.innerWidth - 208)
          )
      });
  }

  async function handleLogout() {
      try {
          const response = await fetch(`${API_URL}/auth/logout`, {
              method: "POST",
              credentials: "include"
          });

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
          icon: <LayoutDashboard size={19} />
      },
      {
          label: "Properties",
          path: "/properties",
          icon: <Building2 size={19} />
      },
      {
          label: "Units",
          path: null,
          icon: <DoorOpen size={19} />
      },
      {
          label: "Tenants",
          path: "/renters",
          icon: <Users size={19} />
      },
      {
          label: "Leases",
          path: null,
          icon: <FileText size={19} />
      },
      {
          label: "Rent Collection",
          path: "/payments",
          icon: <Wallet size={19} />
      },
      {
          label: "Deposits & Charges",
          path: null,
          icon: <Receipt size={19} />
      },
      {
          label: "Maintenance",
          path: "/maintenance",
          icon: <Wrench size={19} />
      },
      {
          label: "Reports",
          path: "/arrears",
          icon: <BarChart3 size={19} />
      },
      {
          label: "Users",
          path: null,
          icon: <UserCog size={19} />
      },
      {
          label: "Activity Logs",
          path: null,
          icon: <History size={19} />
      },
      {
          label: "Settings",
          path: null,
          icon: <Settings size={19} />
      }
  ];

  return (
      <aside
          className={`sidebar collapsible-sidebar${
              collapsed ? " sidebar--collapsed" : ""
          }`}
          onMouseOver={showLabel}
          onMouseLeave={() => setTooltip(null)}
          onFocus={showLabel}
          onBlur={() => setTooltip(null)}
          onScrollCapture={() => setTooltip(null)}
          onKeyDown={(event) => {
              if (event.key === "Escape") {
                  setTooltip(null);
              }
          }}
      >
          <div className="sidebar-brand">
              <span className="remote-brand-mark" aria-hidden="true">
                  R
              </span>

              <div className="sidebar-brand-details">
                  <h2>REMOTE</h2>
                  <p>Property Management</p>
              </div>

              <button
                  className="sidebar-toggle"
                  type="button"
                  onClick={toggleSidebar}
                  aria-expanded={!collapsed}
                  aria-controls="sidebar-navigation"
                  aria-label={
                      collapsed ? "Expand sidebar" : "Collapse sidebar"
                  }
                  data-tooltip={
                      collapsed ? "Expand sidebar" : "Collapse sidebar"
                  }
              >
                  {collapsed ? (
                      <PanelLeftOpen size={20} aria-hidden="true" />
                  ) : (
                      <PanelLeftClose size={20} aria-hidden="true" />
                  )}
              </button>
          </div>

          <nav id="sidebar-navigation" aria-label="Main navigation">
              {menuItems.map(function(item) {
                  if (!item.path) {
                      return (
                          <span
                              key={item.label}
                              className="sidebar-pending"
                              role="link"
                              aria-disabled="true"
                              aria-label={`${item.label} — coming soon`}
                              data-tooltip={`${item.label} — coming soon`}
                          >
                              <span
                                  className="sidebar-icon"
                                  aria-hidden="true"
                              >
                                  {item.icon}
                              </span>
                              <span className="sidebar-label">
                                  {item.label}
                              </span>
                          </span>
                      );
                  }

                  return (
                      <NavLink
                          key={item.label}
                          to={item.path}
                          end={
                              item.path === "/" ||
                              item.path === "/renters"
                          }
                          className={({ isActive }) =>
                              isActive ? "active" : ""
                          }
                          aria-label={item.label}
                          data-tooltip={item.label}
                      >
                          <span
                              className="sidebar-icon"
                              aria-hidden="true"
                          >
                              {item.icon}
                          </span>
                          <span className="sidebar-label">
                              {item.label}
                          </span>
                      </NavLink>
                  );
              })}

              <NavLink
                  to="/renters/archived"
                  className={({ isActive }) =>
                      isActive
                          ? "active sidebar-sub-link"
                          : "sidebar-sub-link"
                  }
                  aria-label="Archived Renters"
                  data-tooltip="Archived Renters"
              >
                  <span className="sidebar-icon" aria-hidden="true">
                      <Archive size={19} />
                  </span>
                  <span className="sidebar-label">
                      Archived Renters
                  </span>
              </NavLink>
          </nav>

          <div className="sidebar-footer">
              <div
                  className="sidebar-account"
                  data-tooltip="REMOTE Account — signed in"
              >
                  <div className="sidebar-avatar" aria-hidden="true">
                      R
                  </div>

                  <div className="sidebar-account-details">
                      <strong>REMOTE Account</strong>
                      <small>Signed in</small>
                  </div>
              </div>

              <button
                  className="logout-button"
                  type="button"
                  onClick={handleLogout}
                  aria-label="Sign out"
                  data-tooltip="Sign out"
              >
                  <span className="sidebar-icon" aria-hidden="true">
                      <LogOut size={19} />
                  </span>
                  <span className="sidebar-label">Sign Out</span>
              </button>
          </div>

          {collapsed && tooltip && (
              <div
                  className="sidebar-tooltip"
                  aria-hidden="true"
                  style={{
                      top: tooltip.top,
                      left: tooltip.left
                  }}
              >
                  {tooltip.text}
              </div>
          )}
      </aside>
  );
}

export default Sidebar;