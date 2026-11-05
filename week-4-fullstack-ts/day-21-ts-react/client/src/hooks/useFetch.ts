import { useState, useEffect } from "react";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

function useFetch<T>(url: string) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(function() {
        setLoading(true);
        setError(null);

        fetch(`${API_URL}${url}`, {
                credentials: "include"
            })
            .then(function(response) {
                if (!response.ok) {
                    throw new Error("Request failed");
                }

                return response.json();
            })
            .then(function(result: unknown) {
                if (typeof result === "object" &&
                result !== null &&
                "data" in result &&
                result.data !== undefined) {
                    setData(result.data as T);
                } else {
                    setData(result as T)
                }
                setLoading(false);
            })
            .catch(function(error: unknown) {
                console.error(error);
                setError(error instanceof Error ? error.message : "Request failed");
                setLoading(false);
            });
    }, [url]);

    return {
        data,
        setData,
        loading,
        error
    };
}

export default useFetch;