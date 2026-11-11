import {
    createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
    type ReactNode
} from "react";
import AuthContext from "./AuthContext";
import { apiFetch, readResponse } from "../lib/api";

export type Role = "OWNER" | "PROPERTY_MANAGER" | "STAFF";
export const ROLE_LABELS: Record<Role, string> = {
    OWNER: "Owner", PROPERTY_MANAGER: "Property manager", STAFF: "Staff"
};
export type Organization = { id: number; name: string; role: Role; permissions: string[] };
type State = {
    session: string; organizations: Organization[]; activeId: number | null;
    loading: boolean; error: string | null;
};
type OrganizationValue = {
    organizations: Organization[];
    organization: Organization | null;
    loading: boolean;
    error: string | null;
    can: (permission: string) => boolean;
    selectOrganization: (id: number) => void;
    reloadOrganizations: (preferredId?: number) => Promise<void>;
    createOrganization: (name: string) => Promise<void>;
    renameOrganization: (name: string) => Promise<void>;
};
const OrganizationContext = createContext<OrganizationValue | null>(null);
const emptyState = (session: string): State => ({
    session, organizations: [], activeId: null, loading: false, error: null
});
function storedId(session: string) {
    try {
        const value = Number(localStorage.getItem(`remote-workspace:${session}`));
        return Number.isSafeInteger(value) && value > 0 ? value : null;
    } catch { return null; }
}
function storeId(session: string, id: number | null) {
    try {
        if (id === null) localStorage.removeItem(`remote-workspace:${session}`);
        else localStorage.setItem(`remote-workspace:${session}`, String(id));
    } catch { /* Workspace switching still works when storage is unavailable. */ }
}
function isOrganization(value: unknown): value is Organization {
    if (!value || typeof value !== "object") return false;
    const org = value as Partial<Organization>;
    return Number.isSafeInteger(org.id) && Number(org.id) > 0 && typeof org.name === "string"
        && (org.role === "OWNER" || org.role === "PROPERTY_MANAGER" || org.role === "STAFF")
        && Array.isArray(org.permissions) && org.permissions.every((item) => typeof item === "string");
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
    const auth = useContext(AuthContext);
    if (!auth) throw new Error("AuthProvider missing");
    const authenticated = Boolean(auth.user);
    const authLoading = auth.loading;
    const session = auth.user ? String(auth.user.id ?? auth.user.email ?? "signed-in") : "";
    const [state, setState] = useState<State>(() => emptyState(""));
    const activeId = useRef<number | null>(null);
    const pending = useRef<AbortController | null>(null);
    const currentSession = useRef(session);
    currentSession.current = session;

    const reloadOrganizations = useCallback(async function(preferredId?: number) {
        if (authLoading || !authenticated || currentSession.current !== session) return;
        pending.current?.abort();
        const controller = new AbortController();
        pending.current = controller;
        setState((current) => current.session === session
            ? { ...current, loading: current.organizations.length === 0, error: null }
            : { ...emptyState(session), loading: true });
        try {
            const result = await readResponse<unknown>(await apiFetch("/organizations", { signal: controller.signal }));
            if (!Array.isArray(result) || !result.every(isOrganization)) {
                throw new Error("Could not read your workspaces. Please try again.");
            }
            if (controller.signal.aborted || pending.current !== controller || currentSession.current !== session) return;
            const requested = preferredId ?? activeId.current ?? storedId(session);
            const selected = result.find((item) => item.id === requested) ?? result[0] ?? null;
            activeId.current = selected?.id ?? null;
            storeId(session, activeId.current);
            setState({ session, organizations: result, activeId: activeId.current, loading: false, error: null });
        } catch (error) {
            if (controller.signal.aborted || pending.current !== controller || currentSession.current !== session) return;
            setState((current) => ({
                ...(current.session === session ? current : emptyState(session)),
                loading: false,
                error: error instanceof Error ? error.message : "Could not load workspaces."
            }));
        }
    }, [session, authenticated, authLoading]);

    useEffect(function() {
        activeId.current = null;
        if (!authenticated || authLoading) {
            pending.current?.abort();
            setState(emptyState(session));
            return;
        }
        void reloadOrganizations();
        return () => pending.current?.abort();
    }, [authenticated, authLoading, session, reloadOrganizations]);

    const current = state.session === session && authenticated && !authLoading ? state : emptyState(session);
    const organization = current.organizations.find((item) => item.id === current.activeId) ?? null;
    function selectOrganization(id: number) {
        if (!current.organizations.some((item) => item.id === id)) return;
        activeId.current = id;
        storeId(session, id);
        setState((value) => ({ ...value, activeId: id }));
    }
    async function createOrganization(name: string) {
        const created = await readResponse<{ id: number }>(await apiFetch("/organizations", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.trim() })
        }));
        await reloadOrganizations(created.id);
    }
    async function renameOrganization(name: string) {
        if (!organization) throw new Error("Select a workspace first.");
        await readResponse(await apiFetch(`/organizations/${organization.id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.trim() })
        }));
        await reloadOrganizations(organization.id);
    }
    return (
        <OrganizationContext.Provider value={{
            organizations: current.organizations, organization,
            loading: authenticated && !authLoading && (state.session !== session || current.loading),
            error: current.error,
            can: (permission) => organization?.permissions.includes(permission) ?? false,
            selectOrganization, reloadOrganizations, createOrganization, renameOrganization
        }}>
            {children}
        </OrganizationContext.Provider>
    );
}

export function useOrganization() {
    const value = useContext(OrganizationContext);
    if (!value) throw new Error("OrganizationProvider missing");
    return value;
}

/** Each callback captures its validated workspace, so an old async action cannot use a newly selected workspace. */
export function useApiFetch() {
    const { organization } = useOrganization();
    const organizationId = organization?.id;
    const scope = useMemo(() => ({ id: organizationId, active: true }), [organizationId]);
    useEffect(function() {
        scope.active = true;
        return () => { scope.active = false; };
    }, [scope]);
    return useCallback((path: string, options: RequestInit = {}) => {
        if (!scope.active) return Promise.reject(new Error("The workspace changed. Please try again."));
        return apiFetch(path, options, scope.id);
    }, [scope]);
}
