import {
    useCallback,
    useContext,
    useEffect,
    useState
} from "react";
import { useNavigate } from "react-router-dom";
import AuthContext from "../context/AuthContext";
import ThemeSwitcher from "../components/ThemeSwitcher";
import "./SettingsPage.css";

const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:3000";

type ActiveSession = {
    id: string;
    userAgent: string | null;
    createdAt: string;
    lastSeenAt: string;
    expiresAt: string;
    isCurrent: boolean;
};

function getBrowserName(userAgent: string | null) {
    if (!userAgent) return "Unknown device";
    if (userAgent.includes("Edg/")) return "Microsoft Edge";
    if (userAgent.includes("Chrome/")) return "Google Chrome";
    if (userAgent.includes("Firefox/")) return "Mozilla Firefox";
    if (userAgent.includes("Safari/")) return "Safari";

    return "Web browser";
}

function SettingsPage() {
    const auth = useContext(AuthContext);
    const navigate = useNavigate();

    const [sessions, setSessions] = useState<ActiveSession[]>([]);
    const [sessionsLoading, setSessionsLoading] = useState(true);
    const [sessionsError, setSessionsError] = useState("");
    const [revokingSessionId, setRevokingSessionId] = useState("");
    const [signingOutAll, setSigningOutAll] = useState(false);

    if (!auth) {
        throw new Error("AuthProvider missing");
    }

    const { setUser } = auth;

    const loadSessions = useCallback(async function() {
        try {
            setSessionsLoading(true);
            setSessionsError("");

            const response = await fetch(`${API_URL}/auth/sessions`, {
                credentials: "include"
            });

            if (!response.ok) {
                throw new Error("Could not load active devices");
            }

            const result = await response.json();

            setSessions(result.data);
        } catch (error) {
            console.error("Loading sessions failed:", error);
            setSessionsError("Could not load your active devices.");
        } finally {
            setSessionsLoading(false);
        }
    }, []);

    useEffect(function() {
        void loadSessions();
    }, [loadSessions]);

    async function handleSignOutDevice(sessionId: string) {
        try {
            setRevokingSessionId(sessionId);
            setSessionsError("");

            const response = await fetch(
                `${API_URL}/auth/sessions/${encodeURIComponent(sessionId)}`,
                {
                    method: "DELETE",
                    credentials: "include"
                }
            );

            if (!response.ok) {
                throw new Error("Could not sign out device");
            }

            await loadSessions();
        } catch (error) {
            console.error("Signing out device failed:", error);
            setSessionsError("Could not sign out that device.");
        } finally {
            setRevokingSessionId("");
        }
    }

    async function handleSignOutAll() {
        try {
            setSigningOutAll(true);
            setSessionsError("");

            const response = await fetch(`${API_URL}/auth/logout-all`, {
                method: "POST",
                credentials: "include"
            });

            if (!response.ok) {
                throw new Error("Could not sign out all devices");
            }

            setUser(null);
            navigate("/login", {
                replace: true
            });
        } catch (error) {
            console.error("Signing out all devices failed:", error);
            setSessionsError("Could not sign out all devices.");
            setSigningOutAll(false);
        }
    }

    return (
        <div className="settings-page">
            <h1 className="dashboard-heading">Settings</h1>

            <section
                className="settings-appearance"
                aria-labelledby="appearance-heading"
            >
                <div className="settings-appearance-copy">
                    <h2 id="appearance-heading">Appearance</h2>

                    <p>
                        Choose Light, Dark, or System to follow your device.
                    </p>

                    <p className="settings-help">
                        Changes apply immediately and are saved in this browser.
                    </p>
                </div>

                <div className="settings-theme-control">
                    <ThemeSwitcher />
                </div>
            </section>

            <section
                className="settings-sessions"
                aria-labelledby="sessions-heading"
            >
                <div className="settings-sessions-header">
                    <div>
                        <h2 id="sessions-heading">Active devices</h2>

                        <p>
                            Review the devices currently signed into your
                            account.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="settings-sign-out-all"
                        disabled={signingOutAll}
                        onClick={handleSignOutAll}
                    >
                        {signingOutAll
                            ? "Signing out..."
                            : "Sign out all devices"}
                    </button>
                </div>

                {sessionsLoading && <p>Loading active devices...</p>}

                {sessionsError && (
                    <p className="settings-error" role="alert">
                        {sessionsError}
                    </p>
                )}

                {!sessionsLoading && sessions.length === 0 && (
                    <p>No active devices were found.</p>
                )}

                <div className="settings-session-list">
                    {sessions.map(function(session) {
                        return (
                            <article
                                key={session.id}
                                className="settings-session"
                            >
                                <div>
                                    <div className="settings-session-name">
                                        <strong>
                                            {getBrowserName(session.userAgent)}
                                        </strong>

                                        {session.isCurrent && (
                                            <span className="settings-current">
                                                Current device
                                            </span>
                                        )}
                                    </div>

                                    <p>
                                        Last active:{" "}
                                        {new Date(
                                            session.lastSeenAt
                                        ).toLocaleString("en-UG")}
                                    </p>
                                </div>

                                {!session.isCurrent && (
                                    <button
                                        type="button"
                                        disabled={
                                            revokingSessionId === session.id
                                        }
                                        onClick={function() {
                                            void handleSignOutDevice(
                                                session.id
                                            );
                                        }}
                                    >
                                        {revokingSessionId === session.id
                                            ? "Signing out..."
                                            : "Sign out"}
                                    </button>
                                )}
                            </article>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}

export default SettingsPage;