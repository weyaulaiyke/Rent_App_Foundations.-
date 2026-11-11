import { useContext, type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import AuthContext from "./AuthContext";
import { useOrganization } from "./OrganizationContext";
import { CreateWorkspaceForm } from "../components/WorkspaceSelector";

function ProtectedRoute({ children, permission }: { children: ReactNode; permission?: string }) {
    const auth = useContext(AuthContext);
    const location = useLocation();
    const workspace = useOrganization();
    if (!auth) throw new Error("AuthProvider missing");
    if (auth.loading || !auth.user) {
        return <Navigate to="/login" replace state={{ from: location.pathname + location.search + location.hash }} />;
    }
    if (workspace.loading && !workspace.organization) return <p role="status">Loading your workspace…</p>;
    if (workspace.error && !workspace.organization) return <section className="workspace-panel">
        <h1>Could not load workspaces</h1><p role="alert">{workspace.error}</p>
        <button type="button" onClick={() => void workspace.reloadOrganizations()}>Try again</button>
    </section>;
    if (!workspace.organization) return <section className="workspace-panel">
        <h1>Create your first workspace</h1><p>A workspace keeps your properties and team together.</p>
        <CreateWorkspaceForm />
    </section>;
    if (permission && !workspace.can(permission)) return <section className="workspace-panel">
        <h1>Access restricted</h1><p>Your role in this workspace does not include this page.</p>
        <Link to="/">Back to dashboard</Link>
    </section>;
    return <>{children}</>;
}
export default ProtectedRoute;
