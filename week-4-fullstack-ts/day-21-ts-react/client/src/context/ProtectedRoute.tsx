import { useContext, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import AuthContext, { type WorkspaceType } from "./AuthContext";

type ProtectedRouteProps = {
    children: ReactNode;
    requiredWorkspaceType?: WorkspaceType;
};

function ProtectedRoute({
    children,
    requiredWorkspaceType
}: ProtectedRouteProps) {
    const auth = useContext(AuthContext);
    const location = useLocation();

    if (!auth) {
        throw new Error("AuthProvider missing");
    }

    const { user, loading } = auth;

    if (loading) {
        return null;
    }

    if (!user) {
        return (
            <Navigate
                to="/login"
                replace
                state={{
                    from:
                        location.pathname +
                        location.search +
                        location.hash
                }}
            />
        );
    }

    if (
        requiredWorkspaceType !== undefined &&
        user.workspaceType !== requiredWorkspaceType
    ) {
        return (
            <Navigate
                to={user.workspaceType === "COMPANY" ? "/company" : "/"}
                replace
            />
        );
    }

    return <>{children}</>;
}

export default ProtectedRoute;