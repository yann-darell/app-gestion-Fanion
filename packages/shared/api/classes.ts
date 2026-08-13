import { supabase } from "./supabaseClient";

export interface ClassInput {
  name: string;
  level: string;
  division_id: string;
  school_year_id: string;
  head_teacher_name?: string | null;
}

export interface ClassRecord extends ClassInput {
  id: string;
  created_at: string;
}

export interface DivisionRecord {
  id: string;
  nom: string;
}

export interface SchoolYearRecord {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

/**
 * Récupère la liste des classes, optionnellement filtrée par division,
 * triée par niveau puis par nom.
 */
export async function listClasses(divisionId?: string) {
  let query = supabase.from("classes").select("*");
  
  if (divisionId && divisionId !== "all") {
    query = query.eq("division_id", divisionId);
  }
  
  const { data, error } = await query.order("level").order("name");
  if (error) {
    console.error("Erreur listClasses:", error);
    throw error;
  }
  return data as ClassRecord[];
}

/**
 * Crée une nouvelle classe dans la base de données.
 */
export async function createClass(input: ClassInput) {
  const { data, error } = await supabase
    .from("classes")
    .insert(input)
    .select()
    .single();
    
  if (error) {
    console.error("Erreur createClass:", error);
    throw error;
  }
  return data as ClassRecord;
}

/**
 * Met à jour une classe existante.
 */
export async function updateClass(id: string, input: Partial<ClassInput>) {
  const { data, error } = await supabase
    .from("classes")
    .update(input)
    .eq("id", id)
    .select()
    .single();
    
  if (error) {
    console.error("Erreur updateClass:", error);
    throw error;
  }
  return data as ClassRecord;
}

/**
 * Récupère l'année scolaire active pour la pré-sélection par défaut.
 */
export async function getActiveSchoolYear() {
  const { data, error } = await supabase
    .from("school_years")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
    
  if (error) {
    console.error("Erreur getActiveSchoolYear:", error);
    throw error;
  }
  return data as SchoolYearRecord | null;
}

/**
 * Récupère toutes les divisions configurées.
 */
export async function listDivisions() {
  const { data, error } = await supabase
    .from("divisions")
    .select("*");
    
  if (error) {
    console.error("Erreur listDivisions:", error);
    throw error;
  }
  return data as DivisionRecord[];
}
