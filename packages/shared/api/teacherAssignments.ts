// packages/shared/api/teacherAssignments.ts
import { supabase } from "./supabaseClient";

export interface AssignmentRecord {
    id: string;
    teacher_id: string;
    subject_id: string;
    class_id: string;
    created_at: string;
    profiles?: { id: string; full_name: string; role: string };
    subjects?: { id: string; name: string };
    classes?: { id: string; name: string; level: string };
}

export interface AssignmentInput {
    teacher_id: string;
    subject_id: string;
    class_id: string;
}

/**
 * Liste les attributions, avec filtres optionnels.
 * Réservé aux rôles principal/directeur_etudes (RLS bloque le reste).
 */
export async function listAssignments(filters?: {
    classId?: string;
    teacherId?: string;
}): Promise<AssignmentRecord[]> {
    let query = supabase
        .from("teacher_assignments")
        .select(`
      id, teacher_id, subject_id, class_id, created_at,
      profiles:teacher_id (id, full_name, role),
      subjects:subject_id (id, name),
      classes:class_id (id, name, level)
    `);

    if (filters?.classId) query = query.eq("class_id", filters.classId);
    if (filters?.teacherId) query = query.eq("teacher_id", filters.teacherId);

    const { data, error } = await query;
    if (error) throw error;
    return (data as unknown as AssignmentRecord[]) ?? [];
}

/**
 * Crée une attribution. Le trigger PostgreSQL vérifie automatiquement
 * que teacher_id a bien le rôle 'enseignant' et que la matière correspond
 * à la division de la classe — pas besoin de revalider ici, mais les erreurs
 * remontées peuvent contenir ces messages.
 */
export async function createAssignment(
    input: AssignmentInput
): Promise<AssignmentRecord> {
    const { data, error } = await supabase
        .from("teacher_assignments")
        .insert(input)
        .select()
        .single();
    if (error) throw error;
    return data as AssignmentRecord;
}

export async function deleteAssignment(id: string): Promise<void> {
    const { error } = await supabase.from("teacher_assignments").delete().eq("id", id);
    if (error) throw error;
}

/**
 * Liste tous les comptes ayant le rôle 'enseignant', pour peupler
 * les menus déroulants d'attribution.
 */
export async function listTeachers(): Promise<
    { id: string; full_name: string }[]
> {
    const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "enseignant")
        .order("full_name");
    if (error) throw error;
    return data ?? [];
}