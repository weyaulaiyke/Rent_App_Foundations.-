import {
    useContext,
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
    type FocusEvent,
    type MouseEvent
  } from "react";
  import { NavLink, useLocation, useNavigate } from "react-router-dom";
  import AuthContext from "../context/AuthContext";
  
  
  import {
    LayoutDashboard,
    Building2,
    Wallet,
    Users,
    Wrench,
    BarChart3,
    Settings,
    Archive,
    LogOut,
    Menu,
    X,
    PanelLeftClose,
    PanelLeftOpen
  } from "lucide-react";
  
  import "./Sidebar.css";
  
  const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:3000";
  
  const STORAGE_KEY = "remote-sidebar-collapsed";
  const mobileViewport = window.matchMedia("(max-width: 900px)");
  
  function subscribeToViewport(notify: () => void) {
    mobileViewport.addEventListener("change", notify);
    return () => mobileViewport.removeEventListener("change", notify);
  }
  
  function isMobileViewport() {
    return mobileViewport.matches;
  }
  
  function Sidebar() {
    const auth = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const isMobile = useSyncExternalStore(subscribeToViewport, isMobileViewport);
    const drawer = useRef<HTMLDialogElement>(null);
  
    const [desktopCollapsed, setCollapsed] = useState(function() {
        try {
            return localStorage.getItem(STORAGE_KEY) === "true";
        } catch {
            return false;
        }
    });
  
    const collapsed = !isMobile && desktopCollapsed;
    const [tooltip, setTooltip] = useState<{
        text: string;
        top: number;
        left: number;
    } | null>(null);
  
    useEffect(function() {
        try {
            localStorage.setItem(STORAGE_KEY, String(desktopCollapsed));
        } catch {
  
        }
    }, [desktopCollapsed]);
  
    useEffect(() => {
        drawer.current?.close();
        setTooltip(null);
    }, [location.key, isMobile]);
  
    if (!auth) throw new Error("AuthProvider missing");
  
    const { user, setUser } = auth;
  
    const dashboardPath =
      user?.workspaceType === "COMPANY" ? "/company" : "/";
  
    const accountLabel = 
      typeof user?.email === "string" ? user.email : "REMOTE Account"
  
   const accountInitial = 
      accountLabel.trim().charAt(0).toUpperCase() || "R"
  
    function toggleSidebar() {
        setTooltip(null);
        if (isMobile) {
            drawer.current?.close();
            return;
        }
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
  
          if (!response.ok && response.status !== 401) {
              throw new Error("Logout failed");
          }
  
          setUser(null);
  
          navigate("/login", {
              replace: true
          });
      } catch (error) {
          console.error("Logout failed:", error);
          alert("Could not sign out. Please try again.");
      }
  }
  
    const menuItems = [
        {
            label: "Dashboard",
            path: dashboardPath,
            icon: <LayoutDashboard size={17} />
        },
        {
            label: "Properties",
            path: "/properties",
            icon: <Building2 size={19} />
        },
        {
            label: "Tenants",
            path: "/renters",
            icon: <Users size={17} />
        },
        {
            label: "Rent Collection",
            path: "/payments",
            icon: <Wallet size={19} />
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
            label: "Settings",
            path: "/settings",
            icon: <Settings size={19} />
        }
    ];
  
    const panel = (
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
                    aria-expanded={isMobile ? undefined : !collapsed}
                    aria-controls={isMobile ? "mobile-navigation" : "sidebar-navigation"}
                    aria-label={
                        isMobile ? "Close menu" : collapsed ? "Expand sidebar" : "Collapse sidebar"
                    }
                    data-tooltip={
                        collapsed ? "Expand sidebar" : "Collapse sidebar"
                    }
                >
                    {isMobile ? (
                        <X size={20} aria-hidden="true" />
                    ) : collapsed ? (
                        <PanelLeftOpen size={20} aria-hidden="true" />
                    ) : (
                        <PanelLeftClose size={20} aria-hidden="true" />
                    )}
                </button>
            </div>
  
            <nav
                id="sidebar-navigation"
                aria-label="Main navigation"
                onClick={(event) => {
                    if (isMobile && !event.ctrlKey && !event.metaKey && !event.shiftKey &&
                        !event.altKey && event.target instanceof Element && event.target.closest("a")) {
                        drawer.current?.close();
                    }
                }}
            >
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
                                item.path === dashboardPath ||
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
                        {accountInitial}
                    </div>
  
                    <div className="sidebar-account-details">
                        <strong title={accountLabel}>{accountLabel}</strong>
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
  
    if (!isMobile) return panel;
  
    return (
        <>
            <header className="remote-mobile-bar">
                <button
                    type="button"
                    aria-label="Open menu"
                    aria-haspopup="dialog"
                    aria-controls="mobile-navigation"
                    onClick={() => drawer.current?.showModal()}
                >
                    <Menu size={22} aria-hidden="true" />
                </button>
                <span>REMOTE</span>
            </header>
            <dialog
                ref={drawer}
                id="mobile-navigation"
                className="remote-nav-drawer"
                aria-label="Navigation menu"
                onClick={(event) => {
                    if (event.target === event.currentTarget) drawer.current?.close();
                }}
            >
                {panel}
            </dialog>
        </>
    );
  }
  
  export default Sidebar;
  