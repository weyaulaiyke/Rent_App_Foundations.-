import { useState, useEffect } from "react";
import { useApiFetch, useOrganization } from "../context/OrganizationContext";
import { readResponse } from "../lib/api";

function useFetch<T>(url: string, enabled = true) {
    const { organization, loading: organizationLoading } = useOrganization();
    const apiFetch = useApiFetch();
    const active = enabled && Boolean(organization) && !organizationLoading;
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(active);
    const [error, setError] = useState<string | null>(null);
    const [revision, setRevision] = useState(0);

    useEffect(function() {
        const controller = new AbortController();
        setData(null);
        setError(null);
        setLoading(active);
        if (!active) return () => controller.abort();
        apiFetch(url, { signal: controller.signal })
            .then(readResponse<T>)
            .then((result) => {
                if (!controller.signal.aborted) { setData(result); setLoading(false); }
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                setError(error instanceof Error ? error.message : "Request failed.");
                setLoading(false);
            });
        return () => controller.abort();
    }, [url, active, apiFetch, revision]);

    return { data, setData, loading, error, reload: () => setRevision((value) => value + 1) };
}
export default useFetch;
