import { supabase } from "./supabaseClient";

export interface GradeRecord {
  id: string;
  student_id: string;
  subject_id: string;
  sequence_id: string;
  score: number;
  created_at: string;
  updated_at: string;
}

export interface ListGradesFilters {
  student_id?: string;
  subject_id?: string;
  sequence_id?: string;
  class_id?: string;
}

export interface UpsertGradeInput {
  student_id: string;
  subject_id: string;
  sequence_id: string;
  score: number;
}

/**
 * Récupère la liste des notes en fonction des filtres spécifiés.
 */
export async function listGrades(filters?: ListGradesFilters): Promise<GradeRecord[]> {
  let query = supabase.from("grades").select("*");

  if (filters?.student_id) {
    query = query.eq("student_id", filters.student_id);
  }
  if (filters?.subject_id) {
    query = query.eq("subject_id", filters.subject_id);
  }
  if (filters?.sequence_id) {
    query = query.eq("sequence_id", filters.sequence_id);
  }

  // Si un filtre par classe est demandé, joindre via la table students
  if (filters?.class_id && !filters?.student_id) {
    const { data: students, error: studErr } = await supabase
      .from("students")
      .select("id")
      .eq("class_id", filters.class_id);

    if (studErr) throw studErr;

    if (!students || students.length === 0) {
      return [];
    }

    const studentIds = students.map((s) => s.id);
    query = query.in("student_id", studentIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Insère ou met à jour une note pour un élève, une matière et une séquence données.
 * Utilise la contrainte UNIQUE (student_id, subject_id, sequence_id) pour réaliser l'UPSERT atomic PostgreSQL.
 */
export async function upsertGrade(input: UpsertGradeInput): Promise<GradeRecord> {
  if (input.score < 0 || input.score > 20) {
    throw new Error("La note doit être comprise entre 0 et 20.");
  }

  const { data, error } = await supabase
    .from("grades")
    .upsert(
      {
        student_id: input.student_id,
        subject_id: input.subject_id,
        sequence_id: input.sequence_id,
        score: input.score,
      },
      {
        onConflict: "student_id,subject_id,sequence_id",
      }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Supprime une note par son ID.
 */
export async function deleteGrade(id: string): Promise<void> {
  const { error } = await supabase.from("grades").delete().eq("id", id);
  if (error) throw error;
}
