import {
    createContext,
    useEffect,
    useState,
    type ReactNode
} from "react";

const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:3000";

export type WorkspaceType = "PERSONAL" | "COMPANY";

export type OrganizationRole =
    | "OWNER"
    | "PROPERTY_MANAGER"
    | "STAFF";

export type AuthUser = {
    id: number;
    email: string;
    organizationId: number;
    organizationName: string;
    workspaceType: WorkspaceType;
    role: OrganizationRole;
};

type AuthValue = {
    user: AuthUser | null;
    setUser: (user: AuthUser | null) => void;
    loading: boolean;
};

const AuthContext = createContext<AuthValue | null>(null);

function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(function() {
        fetch(`${API_URL}/auth/me`, {
            credentials: "include"
        })
            .then(function(response) {
                if (!response.ok) {
                    throw new Error("Not logged in");
                }

                return response.json();
            })
            .then(function(data: AuthUser) {
                setUser(data);
                setLoading(false);
            })
            .catch(function() {
                setUser(null);
                setLoading(false);
            });
    }, []);

    return (
        <AuthContext.Provider value={{ user, setUser, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export { AuthProvider };
export default AuthContext;