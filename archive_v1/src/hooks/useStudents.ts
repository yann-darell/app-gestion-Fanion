import { useState, useCallback } from "react";
import { Student, CreateStudentInput, UpdateStudentInput } from "../../electron/types/students";

export function useStudents() {
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const fetchStudents = useCallback(async (filters?: { classId?: number; search?: string }) => {
        setLoading(true);
        setError(null);
        try {
            const res = await window.api.students.list(filters);
            if (res.ok) {
                setStudents(res.data);
            } else {
                setError(res.error);
            }
        } catch (err: any) {
            setError(err.message || "Erreur de chargement des élèves");
        } finally {
            setLoading(false);
        }
    }, []);

    const createStudent = async (input: CreateStudentInput): Promise<{ ok: boolean; error?: string }> => {
        setLoading(true);
        try {
            const res = await window.api.students.create(input);
            return res.ok ? { ok: true } : { ok: false, error: res.error };
        } catch (err: any) {
            return { ok: false, error: err.message || "Erreur IPC lors de la création" };
        } finally {
            setLoading(false);
        }
    };

    const updateStudent = async (id: number, input: UpdateStudentInput): Promise<{ ok: boolean; error?: string }> => {
        setLoading(true);
        try {
            const res = await window.api.students.update(id, input);
            return res.ok ? { ok: true } : { ok: false, error: res.error };
        } catch (err: any) {
            return { ok: false, error: err.message || "Erreur IPC lors de la mise à jour" };
        } finally {
            setLoading(false);
        }
    };

    const deleteStudent = async (id: number): Promise<{ ok: boolean; error?: string }> => {
        setLoading(true);
        try {
            const res = await window.api.students.delete(id);
            return res.ok ? { ok: true } : { ok: false, error: res.error };
        } catch (err: any) {
            return { ok: false, error: err.message || "Erreur IPC lors de la suppression" };
        } finally {
            setLoading(false);
        }
    };

    const pickPhoto = async (): Promise<{ ok: boolean; data: { path: string; base64: string } | null; error?: string }> => {
        try {
            const res = await window.api.students.pickPhoto();
            return res.ok ? { ok: true, data: res.data } : { ok: false, data: null, error: res.error };
        } catch (err: any) {
            return { ok: false, data: null, error: err.message || "Erreur de sélection de photo" };
        }
    };

    return {
        students,
        loading,
        error,
        fetchStudents,
        createStudent,
        updateStudent,
        deleteStudent,
        pickPhoto
    };
}

export default useStudents;
