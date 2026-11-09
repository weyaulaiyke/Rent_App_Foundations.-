import { useContext, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import AuthContext from "../context/AuthContext";
import "./AuthPage.css";

const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:3000";

type Mode = "login" | "register";

function AuthPage({
    initialMode = "login"
}: {
    initialMode?: Mode;
}) {
    const auth = useContext(AuthContext);
    const navigate = useNavigate();

    const [mode, setMode] = useState<Mode>(initialMode);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    if (!auth) throw new Error("AuthProvider missing");

    const { user, setUser } = auth;
    const isRegister = mode === "register";

    function switchMode() {
        if (busy) return;

        setMode(isRegister ? "login" : "register");
        setPassword("");
        setShowPassword(false);
        setError("");
        setNotice("");
    }

    async function postAuth(path: string) {
        const response = await fetch(`${API_URL}${path}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
                email: email.trim(),
                password
            })
        });

        const result = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error(
                typeof result?.error === "string"
                    ? result.error
                    : `Request failed (${response.status}). Please try again.`
            );
        }

        return result;
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;

        setBusy(true);
        setError("");
        setNotice("");

        let accountCreated = false;

        try {
            if (isRegister) {
                await postAuth("/auth/register");
                accountCreated = true;
            }

            const result = await postAuth("/auth/login");

            if (
                !result?.user ||
                typeof result.user.id !== "number" ||
                typeof result.user.email !== "string"
            ) {
                throw new Error(
                    "Could not confirm your sign-in. Please try again."
                );
            }

            setUser(result.user);
            navigate("/", { replace: true });
        } catch (error: unknown) {
            if (accountCreated) {
                setMode("login");
                setPassword("");
                setShowPassword(false);
                setNotice(
                    "Your account was created. Please sign in below."
                );
            }

            setError(
                error instanceof TypeError
                    ? "Cannot reach the server. Check your connection and try again."
                    : error instanceof Error
                      ? error.message
                      : "Something went wrong. Please try again."
            );
        } finally {
            setBusy(false);
        }
    }

    if (user) return <Navigate to="/" replace />;

    return (
        <div className="remote-auth-page">
            <section
                className="remote-auth-card"
                aria-labelledby="auth-heading"
            >
                <div className="remote-auth-brand">
                    <span
                        className="remote-auth-brand-mark"
                        aria-hidden="true"
                    >
                        R
                    </span>

                    <div>
                        <span className="remote-auth-brand-name">
                            REMOTE
                        </span>
                        <span className="remote-auth-brand-caption">
                            Property Management
                        </span>
                    </div>
                </div>

                <h1 id="auth-heading" className="remote-auth-heading">
                    {isRegister ? "Create your account" : "Welcome back"}
                </h1>

                <p className="remote-auth-intro">
                    {isRegister
                        ? "Get started with a simpler way to manage your properties."
                        : "Sign in to manage your properties, tenants and maintenance."}
                </p>

                <form
                    className="remote-auth-form"
                    onSubmit={handleSubmit}
                    aria-busy={busy}
                >
                    <div className="remote-auth-field">
                        <label
                            className="remote-auth-label"
                            htmlFor="auth-email"
                        >
                            Email address
                        </label>

                        <input
                            className="remote-auth-input"
                            id="auth-email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            autoCapitalize="none"
                            spellCheck={false}
                            placeholder="you@example.com"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            disabled={busy}
                            required
                        />
                    </div>

                    <div className="remote-auth-field">
                        <label
                            className="remote-auth-label"
                            htmlFor="auth-password"
                        >
                            Password
                        </label>

                        <div className="remote-auth-password">
                            <input
                                className="remote-auth-input"
                                id="auth-password"
                                name="password"
                                type={showPassword ? "text" : "password"}
                                autoComplete={
                                    isRegister
                                        ? "new-password"
                                        : "current-password"
                                }
                                placeholder={
                                    isRegister
                                        ? "Create a password"
                                        : "Enter your password"
                                }
                                value={password}
                                onChange={(event) =>
                                    setPassword(event.target.value)
                                }
                                disabled={busy}
                                required
                            />

                            <button
                                className="remote-auth-password-toggle"
                                type="button"
                                aria-label={
                                    showPassword
                                        ? "Hide password"
                                        : "Show password"
                                }
                                aria-controls="auth-password"
                                aria-pressed={showPassword}
                                onClick={() => setShowPassword(!showPassword)}
                                disabled={busy}
                            >
                                {showPassword ? "Hide" : "Show"}
                            </button>
                        </div>
                    </div>

                    {notice && (
                        <p className="remote-auth-notice" role="status">
                            {notice}
                        </p>
                    )}

                    {error && (
                        <p className="remote-auth-error" role="alert">
                            {error}
                        </p>
                    )}

                    <button
                        className="remote-auth-submit"
                        type="submit"
                        disabled={busy}
                    >
                        {busy
                            ? isRegister
                                ? "Creating account…"
                                : "Signing in…"
                            : isRegister
                              ? "Create account"
                              : "Sign in"}
                    </button>
                </form>

                <p className="remote-auth-switch">
                    {isRegister
                        ? "Already have an account? "
                        : "Don’t have an account? "}

                    <button
                        type="button"
                        onClick={switchMode}
                        disabled={busy}
                    >
                        {isRegister ? "Sign in" : "Sign up"}
                    </button>
                </p>

                <footer className="remote-auth-footer">
                    © {new Date().getFullYear()} REMOTE · Property Management
                </footer>
            </section>
        </div>
    );
}

export default AuthPage;