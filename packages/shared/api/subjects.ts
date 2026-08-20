import { supabase } from "./supabaseClient";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SubjectRecord {
  id: string;
  name: string;
  division_id: string;
  created_at: string;
}

export interface SubjectInput {
  name: string;
  division_id: string;
}

export interface SubjectGroupRecord {
  id: string;
  label: "I" | "II" | "III" | "IV";
}

export interface CoefficientRecord {
  id: string;
  class_id: string;
  subject_id: string;
  subject_group_id: string;
  coefficient: number;
  created_at: string;
  // Jointures optionnelles (quand on fetch avec select('*, subjects(*), subject_groups(*)'))
  subjects?: SubjectRecord;
  subject_groups?: SubjectGroupRecord;
}

export interface CoefficientInput {
  class_id: string;
  subject_id: string;
  subject_group_id: string;
  coefficient: number;
}

export interface TermRecord {
  id: string;
  school_year_id: string;
  label: string;
  order_index: number;
  created_at: string;
}

export interface SequenceRecord {
  id: string;
  term_id: string;
  label: string;
  order_index: number;
  created_at: string;
}

// ── Subjects ─────────────────────────────────────────────────────────────────

/**
 * Liste les matières, optionnellement filtrées par division, triées par nom.
 */
export async function listSubjects(divisionId?: string): Promise<SubjectRecord[]> {
  let query = supabase.from("subjects").select("*");
  if (divisionId) {
    query = query.eq("division_id", divisionId);
  }
  const { data, error } = await query.order("name");
  if (error) {
    console.error("Erreur listSubjects:", error);
    throw error;
  }
  return data as SubjectRecord[];
}

/**
 * Crée une nouvelle matière.
 */
export async function createSubject(input: SubjectInput): Promise<SubjectRecord> {
  const { data, error } = await supabase
    .from("subjects")
    .insert(input)
    .select()
    .single();
  if (error) {
    console.error("Erreur createSubject:", error);
    throw error;
  }
  return data as SubjectRecord;
}

/**
 * Met à jour une matière existante.
 */
export async function updateSubject(
  id: string,
  input: Partial<SubjectInput>
): Promise<SubjectRecord> {
  const { data, error } = await supabase
    .from("subjects")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("Erreur updateSubject:", error);
    throw error;
  }
  return data as SubjectRecord;
}

/**
 * Supprime une matière (uniquement si aucun coefficient ne lui est associé).
 * La contrainte ON DELETE CASCADE dans class_subject_coefficients gère la suppression en cascade.
 */
export async function deleteSubject(id: string): Promise<void> {
  const { error } = await supabase.from("subjects").delete().eq("id", id);
  if (error) {
    console.error("Erreur deleteSubject:", error);
    throw error;
  }
}

// ── Subject Groups ────────────────────────────────────────────────────────────

/**
 * Retourne les 4 groupes pédagogiques (I, II, III, IV), triés.
 */
export async function listSubjectGroups(): Promise<SubjectGroupRecord[]> {
  const { data, error } = await supabase
    .from("subject_groups")
    .select("*")
    .order("label");
  if (error) {
    console.error("Erreur listSubjectGroups:", error);
    throw error;
  }
  return data as SubjectGroupRecord[];
}

// ── Coefficients ──────────────────────────────────────────────────────────────

/**
 * Liste les coefficients d'une classe, avec les détails de la matière et du groupe.
 * Triés par groupe (I→IV) puis par nom de matière.
 */
export async function listCoefficients(classId: string): Promise<CoefficientRecord[]> {
  const { data, error } = await supabase
    .from("class_subject_coefficients")
    .select("*, subjects(*), subject_groups(*)")
    .eq("class_id", classId)
    .order("subject_groups(label)")
    .order("subjects(name)");
  if (error) {
    console.error("Erreur listCoefficients:", error);
    throw error;
  }
  return data as CoefficientRecord[];
}

/**
 * Crée ou met à jour un coefficient pour une classe/matière.
 * ON CONFLICT sur (class_id, subject_id) → met à jour coefficient + groupe.
 * Utilise un upsert natif Supabase.
 */
export async function upsertCoefficient(
  input: CoefficientInput
): Promise<CoefficientRecord> {
  const { data, error } = await supabase
    .from("class_subject_coefficients")
    .upsert(input, { onConflict: "class_id,subject_id" })
    .select("*, subjects(*), subject_groups(*)")
    .single();
  if (error) {
    console.error("Erreur upsertCoefficient:", error);
    throw error;
  }
  return data as CoefficientRecord;
}

/**
 * Supprime un coefficient par son id.
 */
export async function deleteCoefficient(id: string): Promise<void> {
  const { error } = await supabase
    .from("class_subject_coefficients")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("Erreur deleteCoefficient:", error);
    throw error;
  }
}

// ── Terms & Sequences ─────────────────────────────────────────────────────────

/**
 * Liste les trimestres d'une année scolaire, dans l'ordre.
 * Si schoolYearId n'est pas fourni, cherche l'année active par défaut.
 */
export async function listTerms(schoolYearId?: string): Promise<TermRecord[]> {
  let query = supabase.from("terms").select("*");
  if (schoolYearId) {
    query = query.eq("school_year_id", schoolYearId);
  }
  const { data, error } = await query.order("order_index");
  if (error) {
    console.error("Erreur listTerms:", error);
    throw error;
  }
  return data as TermRecord[];
}

/**
 * Liste les séquences d'un trimestre ou toutes les séquences si aucun termId n'est fourni.
 */
export async function listSequences(termId?: string): Promise<SequenceRecord[]> {
  let query = supabase.from("sequences").select("*");
  if (termId) {
    query = query.eq("term_id", termId);
  }
  const { data, error } = await query.order("order_index");
  if (error) {
    console.error("Erreur listSequences:", error);
    throw error;
  }
  return data as SequenceRecord[];
}

/**
 * Liste TOUTES les séquences d'une année scolaire (via ses trimestres).
 * Utile pour les sélecteurs de saisie de notes.
 */
export async function listAllSequences(
  schoolYearId?: string
): Promise<(SequenceRecord & { term_label: string; term_order: number })[]> {
  let query = supabase
    .from("sequences")
    .select("*, terms!inner(label, order_index, school_year_id)");

  if (schoolYearId) {
    query = query.eq("terms.school_year_id", schoolYearId);
  }

  const { data, error } = await query
    .order("terms(order_index)")
    .order("order_index");

  if (error) {
    console.error("Erreur listAllSequences:", error);
    throw error;
  }
  // Aplatir la jointure pour faciliter l'usage
  return (data as any[]).map((row) => ({
    ...row,
    term_label: row.terms?.label ?? "",
    term_order: row.terms?.order_index ?? 0,
  }));
}
