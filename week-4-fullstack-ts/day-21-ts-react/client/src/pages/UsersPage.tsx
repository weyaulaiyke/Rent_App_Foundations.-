import { useState, type FormEvent } from "react";
import useFetch from "../hooks/useFetch";
import { ROLE_LABELS, useApiFetch, useOrganization, type Role } from "../context/OrganizationContext";
import { errorMessage, readResponse } from "../lib/api";

type Member = { userId: number; email: string; role: Role; joinedAt?: string };
const roles: Role[] = ["OWNER", "PROPERTY_MANAGER", "STAFF"];

function UsersPage() {
    const apiFetch = useApiFetch();
    const { organization, reloadOrganizations } = useOrganization();
    const { data: members, setData: setMembers, loading, error } = useFetch<Member[]>("/organization/members");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<Role>("STAFF");
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState("");
    const [message, setMessage] = useState("");
    async function addMember(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy || loading) return;
        setBusy(true); setActionError(""); setMessage("");
        try {
            const added = await readResponse<Member>(await apiFetch("/organization/members", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim(), role })
            }));
            setMembers((current) => [...(current ?? []), added]);
            setEmail(""); setRole("STAFF"); setMessage("Team member added.");
        } catch (error) { setActionError(errorMessage(error)); }
        finally { setBusy(false); }
    }
    async function changeRole(member: Member, nextRole: Role) {
        if (busy || member.role === nextRole) return;
        setBusy(true); setActionError(""); setMessage("");
        try {
            const updated = await readResponse<Member>(await apiFetch(`/organization/members/${member.userId}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: nextRole })
            }));
            setMembers((current) => current?.map((item) => item.userId === member.userId ? updated : item) ?? null);
            setMessage("Role updated.");
            await reloadOrganizations();
        } catch (error) { setActionError(errorMessage(error)); }
        finally { setBusy(false); }
    }
    async function removeMember(member: Member) {
        if (busy || !window.confirm(`Remove ${member.email} from ${organization?.name ?? "this workspace"}?`)) return;
        setBusy(true); setActionError(""); setMessage("");
        try {
            await readResponse(await apiFetch(`/organization/members/${member.userId}`, { method: "DELETE" }));
            setMembers((current) => current?.filter((item) => item.userId !== member.userId) ?? null);
            setMessage("Team member removed.");
            await reloadOrganizations();
        } catch (error) { setActionError(errorMessage(error)); }
        finally { setBusy(false); }
    }
    return <>
        <h1 className="dashboard-heading">Users</h1>
        <section className="workspace-panel" aria-labelledby="team-heading">
            <h2 id="team-heading">Team members</h2>
            <p>Add someone who already has a REMOTE account. Access is added immediately; no invitation email is sent.</p>
            <p className="workspace-help">Owners manage the workspace and team. Property managers manage properties, tenants, leases and payments. Staff can view properties and tenants, and manage maintenance.</p>
            <form className="team-form" onSubmit={addMember}>
                <div><label htmlFor="member-email">Account email</label>
                    <input id="member-email" type="email" autoComplete="email" required value={email}
                        onChange={(event) => setEmail(event.target.value)} disabled={busy} /></div>
                <div><label htmlFor="member-role">Role</label>
                    <select id="member-role" value={role} onChange={(event) => setRole(event.target.value as Role)} disabled={busy}>
                        {roles.map((value) => <option key={value} value={value}>{ROLE_LABELS[value]}</option>)}
                    </select></div>
                <button type="submit" disabled={busy || loading}>{busy ? "Saving…" : "Add existing member"}</button>
            </form>
            {actionError && <p className="workspace-error" role="alert">{actionError}</p>}
            {message && <p role="status">{message}</p>}
            {loading && <p role="status">Loading team members…</p>}
            {error && <p className="workspace-error" role="alert">{error}</p>}
            <div className="table-scroll"><table className="team-table">
                <thead><tr><th>Email</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead>
                <tbody>{(members ?? []).map((member) => <tr key={member.userId}>
                    <td>{member.email}</td>
                    <td><select aria-label={`Role for ${member.email}`} value={member.role} disabled={busy}
                        onChange={(event) => void changeRole(member, event.target.value as Role)}>
                        {roles.map((value) => <option key={value} value={value}>{ROLE_LABELS[value]}</option>)}
                    </select></td>
                    <td>{member.joinedAt ? new Date(member.joinedAt).toLocaleDateString("en-UG") : "—"}</td>
                    <td><button type="button" className="btn-delete" disabled={busy}
                        aria-label={`Remove ${member.email}`} onClick={() => void removeMember(member)}>Remove</button></td>
                </tr>)}</tbody>
            </table></div>
        </section>
    </>;
}
export default UsersPage;
