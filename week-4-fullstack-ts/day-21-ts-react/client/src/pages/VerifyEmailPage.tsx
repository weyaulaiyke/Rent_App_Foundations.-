import {
    useContext,
    useState,
    type FormEvent
} from "react";
import {
    useNavigate,
    useSearchParams
} from "react-router-dom";
import AuthContext, {
    type AuthUser
} from "../context/AuthContext";
import "./AuthPage.css";

const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:3000";

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

function getApiMessage(value: unknown) {
    if (
        typeof value === "object" &&
        value !== null
    ) {
        if (
            "error" in value &&
            typeof value.error === "string"
        ) {
            return value.error;
        }

        if (
            "message" in value &&
            typeof value.message === "string"
        ) {
            return value.message;
        }
    }

    return null;
}

function VerifyEmailPage() {
    const auth = useContext(AuthContext);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [email, setEmail] = useState(
        searchParams.get("email") ?? ""
    );
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);
    const [resending, setResending] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState(
        "Check your inbox for your six-digit verification code."
    );

    if (!auth) {
        throw new Error("AuthProvider missing");
    }

    const { setUser } = auth;

    async function handleVerify(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        if (
            busy ||
            resending ||
            !email.trim() ||
            !/^\d{6}$/.test(code)
        ) {
            return;
        }

        setBusy(true);
        setError("");
        setNotice("");

        try {
            const response = await fetch(
                `${API_URL}/auth/verify-email`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    credentials: "include",
                    body: JSON.stringify({
                        email: email.trim().toLowerCase(),
                        code: code
                    })
                }
            );

            const result: unknown = await response
                .json()
                .catch(() => null);

            if (!response.ok) {
                throw new Error(
                    getApiMessage(result) ??
                    "Could not verify this code."
                );
            }

            if (
                typeof result !== "object" ||
                result === null ||
                !("user" in result) ||
                !isAuthUser(result.user)
            ) {
                throw new Error(
                    "Email was verified, but sign-in could not be confirmed."
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
                error instanceof Error
                    ? error.message
                    : "Could not verify email."
            );
        } finally {
            setBusy(false);
        }
    }

    async function handleResend() {
        if (
            busy ||
            resending ||
            !email.trim()
        ) {
            return;
        }

        setResending(true);
        setError("");
        setNotice("");

        try {
            const response = await fetch(
                `${API_URL}/auth/resend-verification`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email: email.trim().toLowerCase()
                    })
                }
            );

            const result: unknown = await response
                .json()
                .catch(() => null);

            if (!response.ok) {
                throw new Error(
                    getApiMessage(result) ??
                    "Could not resend the code."
                );
            }

            setNotice(
                getApiMessage(result) ??
                "If the account is unverified, a new code will be sent."
            );
        } catch (error: unknown) {
            setError(
                error instanceof Error
                    ? error.message
                    : "Could not resend the code."
            );
        } finally {
            setResending(false);
        }
    }

    return (
        <div className="remote-auth-page">
            <section
                className="remote-auth-card"
                aria-labelledby="verify-email-heading"
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
                    id="verify-email-heading"
                    className="remote-auth-heading"
                >
                    Verify your email
                </h1>

                <p className="remote-auth-intro">
                    Enter the six-digit code sent to your email
                    address. The code expires after 10 minutes.
                </p>

                <form
                    className="remote-auth-form"
                    onSubmit={handleVerify}
                    aria-busy={busy}
                >
                    <div className="remote-auth-field">
                        <label
                            className="remote-auth-label"
                            htmlFor="verification-email"
                        >
                            Email address
                        </label>

                        <input
                            className="remote-auth-input"
                            id="verification-email"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(event) =>
                                setEmail(event.target.value)
                            }
                            disabled={busy || resending}
                            required
                        />
                    </div>

                    <div className="remote-auth-field">
                        <label
                            className="remote-auth-label"
                            htmlFor="verification-code"
                        >
                            Verification code
                        </label>

                        <input
                            className="remote-auth-input remote-auth-code-input"
                            id="verification-code"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            pattern="[0-9]{6}"
                            maxLength={6}
                            placeholder="000000"
                            value={code}
                            onChange={(event) =>
                                setCode(
                                    event.target.value
                                        .replace(/\D/g, "")
                                        .slice(0, 6)
                                )
                            }
                            disabled={busy || resending}
                            required
                        />
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
                        disabled={
                            busy ||
                            resending ||
                            code.length !== 6
                        }
                    >
                        {busy
                            ? "Verifying…"
                            : "Verify and continue"}
                    </button>
                </form>

                <p className="remote-auth-switch">
                    Didn’t receive the code?{" "}

                    <button
                        type="button"
                        onClick={() => void handleResend()}
                        disabled={busy || resending}
                    >
                        {resending
                            ? "Sending…"
                            : "Resend code"}
                    </button>
                </p>

                <p className="remote-auth-switch">
                    Wrong email?{" "}

                    <button
                        type="button"
                        onClick={() => navigate("/register")}
                        disabled={busy || resending}
                    >
                        Return to registration
                    </button>
                </p>
            </section>
        </div>
    );
}

export default VerifyEmailPage;