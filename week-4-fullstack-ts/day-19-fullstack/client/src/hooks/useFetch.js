import { useState, useEffect } from "react";
const API_URL = "http://localhost:3000";

function useFetch(url) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
            .then(function(result) {
                if (result.data !== undefined) {
                    setData(result.data);
                } else {
                    setData(result)
                }
                setLoading(false);
            })
            .catch(function(error) {
                console.error(error);
                setError(error.message);
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