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

export interface TeacherAssignmentRecord {
    id: string;
    teacher_id: string;
    subject_id: string;
    class_id: string;
    class_name: string;
    subject_name: string;
    created_at: string;
}

/**
 * Liste les attributions simplifiées.
 *
 * - Si teacher_id est fourni (rôle enseignant) : appelle la fonction
 *   SECURITY DEFINER get_my_teacher_assignments() via RPC, car la RLS
 *   de teacher_assignments bloque le SELECT direct pour ce rôle.
 * - Sinon (direction) : SELECT direct sur la table (RLS autorise).
 */
export async function listTeacherAssignments(filters?: {
    teacher_id?: string;
}): Promise<TeacherAssignmentRecord[]> {
    const results: TeacherAssignmentRecord[] = [];

    // Enseignant → RPC SECURITY DEFINER (contourne la RLS de teacher_assignments)
    if (filters?.teacher_id) {
        try {
            const { data, error } = await supabase.rpc("get_my_teacher_assignments");
            if (!error && data) {
                results.push(...data.map((row: any) => ({
                    id: row.id,
                    teacher_id: row.teacher_id,
                    subject_id: row.subject_id,
                    class_id: row.class_id,
                    class_name: row.class_name || "Classe inconnue",
                    subject_name: row.subject_name || "Matière inconnue",
                    created_at: row.created_at,
                })));
            }
        } catch (e) {
            console.error("Erreur get_my_teacher_assignments:", e);
        }

        // Récupérer également les attributions primaires de l'enseignant
        try {
            const { data: ptaData, error: ptaErr } = await supabase
                .from("primary_teacher_assignments")
                .select(`
                    id, teacher_id, class_id, created_at,
                    classes:class_id (name)
                `)
                .eq("teacher_id", filters.teacher_id);

            if (!ptaErr && ptaData) {
                ptaData.forEach((row: any) => {
                    results.push({
                        id: row.id,
                        teacher_id: row.teacher_id,
                        subject_id: "primaire-titulaire",
                        class_id: row.class_id,
                        class_name: row.classes?.name || "Classe Primaire",
                        subject_name: "Toutes matières (Titulaire)",
                        created_at: row.created_at,
                    });
                });
            }
        } catch (e) {
            console.error("Erreur primary_teacher_assignments pour enseignant:", e);
        }

        return results;
    }

    // Direction → SELECT direct (RLS autorise via ta_admin_all)
    let query = supabase
        .from("teacher_assignments")
        .select(`
            id, teacher_id, subject_id, class_id, created_at,
            classes:class_id (name),
            subjects:subject_id (name)
        `);

    const { data, error } = await query;
    if (error) throw error;

    const collegeList = (data || []).map((row: any) => ({
        id: row.id,
        teacher_id: row.teacher_id,
        subject_id: row.subject_id,
        class_id: row.class_id,
        class_name: row.classes?.name || "Classe inconnue",
        subject_name: row.subjects?.name || "Matière inconnue",
        created_at: row.created_at,
    }));

    // Ajouter les attributions primaires pour la direction
    const { data: ptaAll, error: ptaAllErr } = await supabase
        .from("primary_teacher_assignments")
        .select(`
            id, teacher_id, class_id, created_at,
            classes:class_id (name)
        `);

    if (!ptaAllErr && ptaAll) {
        ptaAll.forEach((row: any) => {
            collegeList.push({
                id: row.id,
                teacher_id: row.teacher_id,
                subject_id: "primaire-titulaire",
                class_id: row.class_id,
                class_name: row.classes?.name || "Classe Primaire",
                subject_name: "Toutes matières (Titulaire)",
                created_at: row.created_at,
            });
        });
    }

    return collegeList;
}

/**
 * Élève simplifié retourné par get_my_assigned_students().
 * Ne contient que les champs strictement nécessaires à la grille
 * de saisie (SECURITE.md : accès minimal, pas de photo/contacts).
 */
export interface AssignedStudentRecord {
    id: string;
    matricule: string;
    first_name: string;
    last_name: string;
    status: string;
}

/**
 * Liste les élèves d'une classe pour la grille de saisie enseignant.
 * Appelle la fonction SECURITY DEFINER get_my_assigned_students() qui
 * vérifie l'attribution de l'enseignant en interne et ne retourne que
 * les champs minimaux (pas de données sensibles).
 */
export async function listMyAssignedStudents(
    classId: string,
    subjectId: string,
): Promise<AssignedStudentRecord[]> {
    // Si attribution titulaire primaire
    if (subjectId === "primaire-titulaire" || !subjectId) {
        const { data, error } = await supabase
            .from("students")
            .select("id, matricule, first_name, last_name, status")
            .eq("class_id", classId)
            .eq("status", "active")
            .order("last_name")
            .order("first_name");
        if (error) throw error;
        return (data || []) as AssignedStudentRecord[];
    }

    try {
        const { data, error } = await supabase.rpc("get_my_assigned_students", {
            p_class_id: classId,
            p_subject_id: subjectId,
        });
        if (error) throw error;
        if (data && data.length > 0) return data as AssignedStudentRecord[];
    } catch (e) {
        console.warn("RPC get_my_assigned_students fallback:", e);
    }

    // Fallback : si c'est une classe primaire
    const { data: stds, error: stdsErr } = await supabase
        .from("students")
        .select("id, matricule, first_name, last_name, status")
        .eq("class_id", classId)
        .eq("status", "active")
        .order("last_name")
        .order("first_name");

    if (!stdsErr && stds) {
        return stds as AssignedStudentRecord[];
    }

    return [];
}

// ─────────────────────────────────────────────────────────────
// Attributions Enseignants PRIMAIRE (Titulaire de classe)
// ─────────────────────────────────────────────────────────────

export interface PrimaryTeacherAssignmentRecord {
    id: string;
    teacher_id: string;
    class_id: string;
    created_at: string;
    profiles?: { id: string; full_name: string; role: string };
    classes?: { id: string; name: string; level: string };
}

/**
 * Récupère l'attribution de l'enseignant titulaire d'une classe primaire.
 */
export async function getPrimaryTeacherAssignment(
    classId: string
): Promise<PrimaryTeacherAssignmentRecord | null> {
    const { data, error } = await supabase
        .from("primary_teacher_assignments")
        .select(`
            id, teacher_id, class_id, created_at,
            profiles:teacher_id (id, full_name, role),
            classes:class_id (id, name, level)
        `)
        .eq("class_id", classId)
        .maybeSingle();

    if (error) throw error;
    return (data as unknown as PrimaryTeacherAssignmentRecord) ?? null;
}

/**
 * Définit ou modifie l'enseignant titulaire d'une classe primaire.
 */
export async function setPrimaryTeacherAssignment(
    classId: string,
    teacherId: string
): Promise<PrimaryTeacherAssignmentRecord> {
    // Si une attribution existe déjà pour cette classe, on la supprime ou la remplace
    await supabase
        .from("primary_teacher_assignments")
        .delete()
        .eq("class_id", classId);

    const { data, error } = await supabase
        .from("primary_teacher_assignments")
        .insert({
            class_id: classId,
            teacher_id: teacherId,
        })
        .select(`
            id, teacher_id, class_id, created_at,
            profiles:teacher_id (id, full_name, role),
            classes:class_id (id, name, level)
        `)
        .single();

    if (error) throw error;
    return data as unknown as PrimaryTeacherAssignmentRecord;
}

/**
 * Supprime l'attribution titulaire d'une classe primaire.
 */
export async function removePrimaryTeacherAssignment(
    classId: string
): Promise<void> {
    const { error } = await supabase
        .from("primary_teacher_assignments")
        .delete()
        .eq("class_id", classId);

    if (error) throw error;
}
