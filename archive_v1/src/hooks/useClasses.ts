import { useState, useEffect, useCallback } from "react";
import { Class, CreateClassInput } from "../../electron/types/students";

export function useClasses() {
    const [classes, setClasses] = useState<Class[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const fetchClasses = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await window.api.classes.list();
            if (res.ok) {
                setClasses(res.data);
            } else {
                setError(res.error);
            }
        } catch (err: any) {
            setError(
                err.message ||
                    "Erreur inconnue lors du chargement des classes"
            );
        } finally {
            setLoading(false);
        }
    }, []);

    const createClass = async (
        input: CreateClassInput
    ): Promise<{ ok: boolean; error?: string }> => {
        setError(null);
        try {
            const res = await window.api.classes.create(input);
            if (res.ok) {
                await fetchClasses();
                return { ok: true };
            } else {
                return { ok: false, error: res.error };
            }
        } catch (err: any) {
            return {
                ok: false,
                error:
                    err.message || "Erreur lors de la création de la classe"
            };
        }
    };

    useEffect(() => {
        fetchClasses();
    }, [fetchClasses]);

    return {
        classes,
        loading,
        error,
        fetchClasses,
        createClass
    };
}

export default useClasses;
