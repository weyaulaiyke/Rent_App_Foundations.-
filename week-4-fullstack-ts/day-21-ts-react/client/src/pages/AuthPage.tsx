import {
    useContext,
    useState,
    type FormEvent
} from "react";
import { Navigate, useNavigate } from "react-router-dom";
import AuthContext, {
    type AuthUser,
    type WorkspaceType
} from "../context/AuthContext";
import "./AuthPage.css";

const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:3000";

type Mode = "login" | "register";

function isAuthUser(value: unknown): value is AuthUser {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const candidate = value as Record<string, unknown>;

    return (
        typeof candidate.id === "number" &&
        typeof candidate.email === "string" &&
        typeof candidate.organizationId === "number" &&
        typeof candidate.organizationName === "string" &&
        (
            candidate.workspaceType === "PERSONAL" ||
            candidate.workspaceType === "COMPANY"
        ) &&
        (
            candidate.role === "OWNER" ||
            candidate.role === "PROPERTY_MANAGER" ||
            candidate.role === "STAFF"
        )
    );
}

function getApiError(value: unknown) {
    if (
        typeof value === "object" &&
        value !== null &&
        "error" in value &&
        typeof value.error === "string"
    ) {
        return value.error;
    }

    return null;
}

function AuthPage({
    initialMode = "login"
}: {
    initialMode?: Mode;
}) {
    const auth = useContext(AuthContext);
    const navigate = useNavigate();

    const [mode, setMode] = useState<Mode>(initialMode);
    const [workspaceType, setWorkspaceType] =
        useState<WorkspaceType>("PERSONAL");
    const [companyName, setCompanyName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    if (!auth) {
        throw new Error("AuthProvider missing");
    }

    const { user, setUser, loading } = auth;
    const isRegister = mode === "register";
    const isCompany = workspaceType === "COMPANY";

    function selectWorkspaceType(nextType: WorkspaceType) {
        if (busy) {
            return;
        }

        setWorkspaceType(nextType);
        setError("");
        setNotice("");

        if (nextType === "PERSONAL") {
            setCompanyName("");
        }
    }

    function switchMode() {
        if (busy) {
            return;
        }

        setMode(isRegister ? "login" : "register");
        setPassword("");
        setShowPassword(false);
        setError("");
        setNotice("");
    }

    async function postAuth(path: string) {
        const payload: Record<string, string> = {
            email: email.trim(),
            password: password,
            workspaceType: workspaceType
        };

        if (
            path === "/auth/register" &&
            workspaceType === "COMPANY"
        ) {
            payload.companyName = companyName.trim();
        }

        const response = await fetch(`${API_URL}${path}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify(payload)
        });

        const result: unknown = await response
            .json()
            .catch(() => null);

        if (!response.ok) {
            throw new Error(
                getApiError(result) ??
                `Request failed (${response.status}). Please try again.`
            );
        }

        return result;
    }

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();
    
        if (busy || loading) {
            return;
        }
    
        if (
            isRegister &&
            isCompany &&
            !companyName.trim()
        ) {
            setError("Enter your company name.");
            return;
        }
    
        setBusy(true);
        setError("");
        setNotice("");
    
        try {
            if (isRegister) {
                await postAuth("/auth/register");
    
                const verificationEmail =
                    email.trim().toLowerCase();
    
                navigate(
                    `/verify-email?email=${encodeURIComponent(
                        verificationEmail
                    )}`,
                    {
                        replace: true
                    }
                );
    
                return;
            }
    
            const result = await postAuth("/auth/login");
    
            if (
                typeof result !== "object" ||
                result === null ||
                !("user" in result) ||
                !isAuthUser(result.user)
            ) {
                throw new Error(
                    "Could not confirm your sign-in. Please try again."
                );
            }
    
            setUser(result.user);
    
            navigate(
                result.user.workspaceType === "COMPANY"
                    ? "/company"
                    : "/",
                {
                    replace: true
                }
            );
        } catch (error: unknown) {
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
    
    if (!loading && user) {
        return (
            <Navigate
                to={
                    user.workspaceType === "COMPANY"
                        ? "/company"
                        : "/"
                }
                replace
            />
        );
    }

    const heading = isRegister
        ? isCompany
            ? "Create your company account"
            : "Create your account"
        : isCompany
          ? "Company sign in"
          : "Welcome back";

    const introduction = isRegister
        ? isCompany
            ? "Create a company workspace for your property management team."
            : "Create a personal workspace to manage your properties."
        : isCompany
          ? "Sign in to your company property management workspace."
          : "Sign in to manage your personal properties and tenants.";

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

                <h1
                    id="auth-heading"
                    className="remote-auth-heading"
                >
                    {heading}
                </h1>

                <p className="remote-auth-intro">
                    {introduction}
                </p>

                <form
                    className="remote-auth-form"
                    onSubmit={handleSubmit}
                    aria-busy={busy}
                >
                    <div className="remote-auth-workspace">
                        <span
                            id="workspace-type-label"
                            className="remote-auth-label"
                        >
                            Continue as
                        </span>

                        <div
                            className="remote-auth-workspace-options"
                            role="group"
                            aria-labelledby="workspace-type-label"
                        >
                            <button
                                type="button"
                                className={
                                    workspaceType === "PERSONAL"
                                        ? "remote-auth-workspace-option active"
                                        : "remote-auth-workspace-option"
                                }
                                aria-pressed={
                                    workspaceType === "PERSONAL"
                                }
                                onClick={() =>
                                    selectWorkspaceType("PERSONAL")
                                }
                                disabled={busy}
                            >
                                <strong>Personal</strong>
                                <small>Individual landlord</small>
                            </button>

                            <button
                                type="button"
                                className={
                                    workspaceType === "COMPANY"
                                        ? "remote-auth-workspace-option active"
                                        : "remote-auth-workspace-option"
                                }
                                aria-pressed={
                                    workspaceType === "COMPANY"
                                }
                                onClick={() =>
                                    selectWorkspaceType("COMPANY")
                                }
                                disabled={busy}
                            >
                                <strong>Company</strong>
                                <small>Organization or team</small>
                            </button>
                        </div>
                    </div>

                    {isRegister && isCompany && (
                        <div className="remote-auth-field">
                            <label
                                className="remote-auth-label"
                                htmlFor="auth-company-name"
                            >
                                Company name
                            </label>

                            <input
                                className="remote-auth-input"
                                id="auth-company-name"
                                name="companyName"
                                type="text"
                                autoComplete="organization"
                                placeholder="Enter your company name"
                                value={companyName}
                                onChange={(event) =>
                                    setCompanyName(
                                        event.target.value
                                    )
                                }
                                disabled={busy}
                                maxLength={120}
                                required
                            />
                        </div>
                    )}

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
                            onChange={(event) =>
                                setEmail(event.target.value)
                            }
                            disabled={busy}
                            maxLength={254}
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
                                type={
                                    showPassword
                                        ? "text"
                                        : "password"
                                }
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
                                    setPassword(
                                        event.target.value
                                    )
                                }
                                disabled={busy}
                                maxLength={72}
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
                                onClick={() =>
                                    setShowPassword(!showPassword)
                                }
                                disabled={busy || loading}
                            >
                                {showPassword ? "Hide" : "Show"}
                            </button>
                        </div>
                    </div>

                    {notice && (
                        <p
                            className="remote-auth-notice"
                            role="status"
                        >
                            {notice}
                        </p>
                    )}

                    {error && (
                        <p
                            className="remote-auth-error"
                            role="alert"
                        >
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
                              ? isCompany
                                  ? "Create company account"
                                  : "Create personal account"
                              : isCompany
                                ? "Sign in to company"
                                : "Sign in"}
                    </button>
                </form>

                <p className="remote-auth-switch">
                    {isRegister
                        ? "Already have an account? "
                        : "Don't have an account? "}

                    <button
                        type="button"
                        onClick={switchMode}
                        disabled={busy}
                    >
                        {isRegister ? "Sign in" : "Sign up"}
                    </button>
                </p>

                <footer className="remote-auth-footer">
                    © {new Date().getFullYear()} REMOTE · Property
                    Management
                </footer>
            </section>
        </div>
    );
}

export default AuthPage;