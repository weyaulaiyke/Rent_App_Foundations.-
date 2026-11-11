const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

/** Auth and workspace discovery are unscoped; all business calls require a validated workspace. */
export function apiFetch(path: string, options: RequestInit = {}, organizationId?: number) {
    const headers = new Headers(options.headers);
    const unscoped = path.startsWith("/auth/") || /^\/organizations(?:\/|$|\?)/.test(path);
    if (unscoped) {
        headers.delete("X-Organization-Id");
    } else {
        if (!Number.isSafeInteger(organizationId) || !organizationId || organizationId <= 0) {
            return Promise.reject(new Error("Select a workspace before continuing."));
        }
        headers.set("X-Organization-Id", String(organizationId));
    }
    return fetch(`${API_URL}${path}`, { ...options, headers, credentials: "include" });
}

export async function readResponse<T>(response: Response): Promise<T> {
    const result: unknown = await response.json().catch(() => null);
    if (!response.ok) {
        const message = result && typeof result === "object" && "error" in result
            && typeof result.error === "string" ? result.error : `Request failed (${response.status}).`;
        throw new Error(message);
    }
    if (result && typeof result === "object" && "data" in result) return result.data as T;
    return result as T;
}

export function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : "The request failed. Please try again.";
}

/** Public payment verification has no tenant session or workspace dependency. */
export function publicApiFetch(path: string, options: RequestInit = {}) {
    if (!/^\/payment-status\/[^/?]+(?:\/confirm)?$/.test(path)) {
        return Promise.reject(new Error("Unsupported public request."));
    }
    const headers = new Headers(options.headers);
    headers.delete("X-Organization-Id");
    headers.delete("Authorization");
    return fetch(`${API_URL}${path}`, { ...options, headers, credentials: "omit" });
}
