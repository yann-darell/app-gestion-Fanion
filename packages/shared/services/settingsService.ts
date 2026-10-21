// packages/shared/services/settingsService.ts
import { supabase } from "../api/supabaseClient";

export interface SchoolSettings {
  id?: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  legal_notice: string;
  director_name: string;
  primary_name?: string | null;
  primary_director_name?: string | null;
  primary_legal_notice?: string | null;
  logo_url?: string | null;
  watermark_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SequenceSetting {
  id: string;
  term_id: string;
  name: string;
  ordinal: number;
  start_date: string | null;
  end_date: string | null;
  is_locked: boolean;
  grace_period_days: number;
}

export interface TermSetting {
  id: string;
  name: string;
  ordinal: number;
  start_date: string | null;
  end_date: string | null;
  sequences: SequenceSetting[];
}

export interface TeacherAccount {
  id: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
  role: string;
  created_at: string;
}

const PRIMARY_SETTINGS_STORAGE_KEY = "fanion_primary_school_settings";

/**
 * Récupère les paramètres uniques de l'établissement (school_settings)
 */
export async function getSchoolSettings(): Promise<SchoolSettings> {
  let localPrimary: Partial<SchoolSettings> = {};
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const stored = window.localStorage.getItem(PRIMARY_SETTINGS_STORAGE_KEY);
      if (stored) localPrimary = JSON.parse(stored);
    }
  } catch (e) {
    // ignorer si indisponible
  }

  const { data, error } = await supabase
    .from("school_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(`Erreur récupération paramètres établissement: ${error.message}`);
  }

  const defaultSettings: SchoolSettings = {
    name: "Collège Privé Laïc Le Fanion",
    address: "Yaoundé, Cameroun",
    city: "Yaoundé",
    phone: "+237 600 00 00 00",
    legal_notice: "Établissement d'Enseignement Secondaire Général et Bilingue",
    director_name: "Le Principal",
    primary_name: "Complexe Scolaire Bilingue La Grâce",
    primary_director_name: "La Directrice",
    primary_legal_notice: "Enseignement Primaire et Maternel - Système APC",
  };

  if (!data) {
    return {
      ...defaultSettings,
      ...localPrimary,
    };
  }

  const record = data as SchoolSettings;
  return {
    ...record,
    primary_name: record.primary_name?.trim() || localPrimary.primary_name || defaultSettings.primary_name,
    primary_director_name: record.primary_director_name?.trim() || localPrimary.primary_director_name || defaultSettings.primary_director_name,
    primary_legal_notice: record.primary_legal_notice?.trim() || localPrimary.primary_legal_notice || defaultSettings.primary_legal_notice,
  };
}

/**
 * Met à jour les paramètres de l'établissement avec fallback résilient
 * si les nouvelles colonnes primary_* n'ont pas encore été migrées en base.
 */
export async function updateSchoolSettings(settings: Partial<SchoolSettings>): Promise<SchoolSettings> {
  // Sauvegarde locale de secours pour le primaire
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const toStore = {
        primary_name: settings.primary_name,
        primary_director_name: settings.primary_director_name,
        primary_legal_notice: settings.primary_legal_notice,
      };
      window.localStorage.setItem(PRIMARY_SETTINGS_STORAGE_KEY, JSON.stringify(toStore));
    }
  } catch (e) {
    // ignorer
  }

  const current = await getSchoolSettings();

  const performSave = async (payload: Partial<SchoolSettings>) => {
    if (current.id) {
      const { data, error } = await supabase
        .from("school_settings")
        .update(payload)
        .eq("id", current.id)
        .select()
        .single();

      if (error) throw error;
      return data as SchoolSettings;
    } else {
      const { data, error } = await supabase
        .from("school_settings")
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      return data as SchoolSettings;
    }
  };

  try {
    const saved = await performSave(settings);
    return {
      ...saved,
      primary_name: settings.primary_name || saved.primary_name || "Complexe Scolaire Bilingue La Grâce",
      primary_director_name: settings.primary_director_name || saved.primary_director_name || "La Directrice",
      primary_legal_notice: settings.primary_legal_notice || saved.primary_legal_notice || "Enseignement Primaire et Maternel - Système APC",
    };
  } catch (err: any) {
    // Si la colonne primary_* n'existe pas encore en DB (code PGRST204 ou 42703)
    if (err?.code === "PGRST204" || err?.code === "42703" || err?.message?.includes("primary_") || err?.message?.includes("column")) {
      console.warn("Colonnes primary_* non présentes dans la base distante. Sauvegarde des paramètres de base et conservation locale du primaire.");
      const { primary_name, primary_director_name, primary_legal_notice, ...baseSettings } = settings;
      const savedBase = await performSave(baseSettings);
      return {
        ...savedBase,
        primary_name: primary_name || "Complexe Scolaire Bilingue La Grâce",
        primary_director_name: primary_director_name || "La Directrice",
        primary_legal_notice: primary_legal_notice || "Enseignement Primaire et Maternel - Système APC",
      };
    }
    throw new Error(`Erreur mise à jour paramètres: ${err.message}`);
  }
}

/**
 * Récupère le calendrier académique (Terms & Séquences rattachées)
 */
export async function getAcademicCalendar(): Promise<TermSetting[]> {
  const { data: terms, error: termsErr } = await supabase
    .from("terms")
    .select("*")
    .order("order_index", { ascending: true });

  if (termsErr) throw new Error(`Erreur récupération trimestres: ${termsErr.message}`);

  const { data: seqs, error: seqsErr } = await supabase
    .from("sequences")
    .select("*")
    .order("order_index", { ascending: true });

  if (seqsErr) throw new Error(`Erreur récupération séquences: ${seqsErr.message}`);

  return (terms || []).map((term) => ({
    id: term.id,
    name: term.label || term.name || "Trimestre",
    ordinal: term.order_index ?? term.ordinal ?? 1,
    start_date: term.start_date || null,
    end_date: term.end_date || null,
    sequences: (seqs || [])
      .filter((s) => s.term_id === term.id)
      .map((s) => ({
        id: s.id,
        term_id: s.term_id,
        name: s.label || s.name || "Séquence",
        ordinal: s.order_index ?? s.ordinal ?? 1,
        start_date: s.start_date || null,
        end_date: s.end_date || null,
        is_locked: !!s.is_locked,
        grace_period_days: Number(s.grace_period_days || 0),
      })),
  }));
}

/**
 * Met à jour les dates d'un trimestre
 */
export async function updateTermDates(id: string, start_date: string | null, end_date: string | null): Promise<void> {
  const { error } = await supabase
    .from("terms")
    .update({ start_date, end_date })
    .eq("id", id);

  if (error) throw new Error(`Erreur mise à jour trimestre: ${error.message}`);
}

/**
 * Met à jour les dates, le délai de grâce et/ou l'état de verrouillage d'une séquence
 */
export async function updateSequenceSettings(
  id: string,
  updates: { start_date?: string | null; end_date?: string | null; is_locked?: boolean; grace_period_days?: number }
): Promise<void> {
  const { error } = await supabase
    .from("sequences")
    .update(updates)
    .eq("id", id);

  if (error) throw new Error(`Erreur mise à jour séquence: ${error.message}`);
}

/**
 * Récupère les enseignants (profiles avec role = 'enseignant')
 */
export async function getTeachersList(): Promise<TeacherAccount[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active, role, created_at")
    .eq("role", "enseignant")
    .order("full_name", { ascending: true });

  if (error) throw new Error(`Erreur récupération enseignants: ${error.message}`);

  return (data || []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: p.email || null,
    is_active: p.is_active !== false, // Défaut true si null
    role: p.role,
    created_at: p.created_at,
  }));
}

/**
 * Invoque l'Edge Function pour activer/désactiver un enseignant (Auth ban/unban + profile update)
 */
export async function toggleTeacherStatus(teacher_id: string, is_active: boolean): Promise<void> {
  const { data, error } = await supabase.functions.invoke("toggle-teacher-status", {
    body: { teacher_id, is_active },
  });

  if (error) {
    throw new Error(error.message || "Erreur lors du changement de statut de l'enseignant");
  }

  if (data?.error) {
    throw new Error(data.error);
  }
}
