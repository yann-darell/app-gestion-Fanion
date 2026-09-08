// packages/shared/services/supplyService.ts
import { supabase } from "../api/supabaseClient";

export interface SupplyRequirement {
  id: string;
  division_id: string;
  school_year_id: string;
  label: string;
  created_at: string;
}

export interface StudentSupplyItem {
  requirement_id: string;
  label: string;
  division_id: string;
  school_year_id: string;
  status: "donne" | "manquant";
  supply_id?: string;
  updated_at?: string;
}

export interface StudentSupplySummary {
  student_id: string;
  total_required: number;
  given_count: number;
}

/**
 * Récupère la liste des fournitures requises configurées pour une division et une année scolaire.
 */
export async function listSupplyRequirements(
  divisionId: string,
  schoolYearId: string
): Promise<SupplyRequirement[]> {
  const { data, error } = await supabase
    .from("supply_requirements")
    .select("*")
    .eq("division_id", divisionId)
    .eq("school_year_id", schoolYearId)
    .order("label", { ascending: true });

  if (error) {
    console.error("Erreur listSupplyRequirements:", error);
    throw new Error(`Impossible de charger les fournitures requises: ${error.message}`);
  }

  return (data || []) as SupplyRequirement[];
}

/**
 * Crée une nouvelle fourniture requise pour une division et une année scolaire.
 */
export async function createSupplyRequirement(
  divisionId: string,
  schoolYearId: string,
  label: string
): Promise<SupplyRequirement> {
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error("Le libellé de la fourniture ne peut pas être vide.");
  }

  const { data, error } = await supabase
    .from("supply_requirements")
    .insert({
      division_id: divisionId,
      school_year_id: schoolYearId,
      label: trimmed,
    })
    .select()
    .single();

  if (error) {
    console.error("Erreur createSupplyRequirement:", error);
    if (error.code === "23505") {
      throw new Error("Cette fourniture est déjà enregistrée pour cette division et année.");
    }
    throw new Error(`Impossible d'ajouter la fourniture requise: ${error.message}`);
  }

  return data as SupplyRequirement;
}

/**
 * Supprime une fourniture requise.
 */
export async function deleteSupplyRequirement(id: string): Promise<void> {
  const { error } = await supabase
    .from("supply_requirements")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Erreur deleteSupplyRequirement:", error);
    throw new Error(`Impossible de supprimer la fourniture requise: ${error.message}`);
  }
}

/**
 * Récupère l'état complet des fournitures requises pour un élève donné.
 * Si une ligne n'existe pas encore dans student_supplies, son statut par défaut est 'manquant'.
 */
export async function getStudentSupplies(
  studentId: string,
  divisionId: string,
  schoolYearId: string
): Promise<StudentSupplyItem[]> {
  // 1. Charger les exigences pour cette division et année
  const requirements = await listSupplyRequirements(divisionId, schoolYearId);
  if (requirements.length === 0) {
    return [];
  }

  // 2. Charger les fournitures cochées pour cet élève
  const { data: records, error } = await supabase
    .from("student_supplies")
    .select("id, supply_requirement_id, status, updated_at")
    .eq("student_id", studentId);

  if (error) {
    console.error("Erreur getStudentSupplies:", error);
    throw new Error(`Impossible de charger l'état des fournitures de l'élève: ${error.message}`);
  }

  const statusMap = new Map<string, { id: string; status: "donne" | "manquant"; updated_at: string }>();
  (records || []).forEach((r: any) => {
    statusMap.set(r.supply_requirement_id, {
      id: r.id,
      status: r.status as "donne" | "manquant",
      updated_at: r.updated_at,
    });
  });

  return requirements.map((req) => {
    const existing = statusMap.get(req.id);
    return {
      requirement_id: req.id,
      label: req.label,
      division_id: req.division_id,
      school_year_id: req.school_year_id,
      status: existing ? existing.status : "manquant",
      supply_id: existing ? existing.id : undefined,
      updated_at: existing ? existing.updated_at : undefined,
    };
  });
}

/**
 * Bascule ou met à jour le statut d'une fourniture pour un élève (sauvegarde immédiate).
 */
export async function setStudentSupplyStatus(
  studentId: string,
  supplyRequirementId: string,
  newStatus: "donne" | "manquant"
): Promise<void> {
  const { error } = await supabase
    .from("student_supplies")
    .upsert(
      {
        student_id: studentId,
        supply_requirement_id: supplyRequirementId,
        status: newStatus,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "student_id,supply_requirement_id",
      }
    );

  if (error) {
    console.error("Erreur setStudentSupplyStatus:", error);
    throw new Error(`Impossible de mettre à jour la fourniture: ${error.message}`);
  }
}

/**
 * Récupère le résumé des fournitures pour un lot d'élèves (utilisé dans la liste StudentsPage).
 * Renvoie un dictionnaire student_id -> { total_required, given_count }.
 */
export async function getStudentsSuppliesSummaryMap(
  studentIds: string[],
  classes: { id: string; division_id: string; school_year_id: string }[]
): Promise<Record<string, StudentSupplySummary>> {
  if (!studentIds || studentIds.length === 0) {
    return {};
  }

  // Mapper class_id -> { division_id, school_year_id }
  const classInfoMap = new Map<string, { division_id: string; school_year_id: string }>();
  classes.forEach((c) => {
    classInfoMap.set(c.id, {
      division_id: c.division_id,
      school_year_id: c.school_year_id,
    });
  });

  // 1. Récupérer toutes les exigences configurées
  const { data: allReqs, error: reqErr } = await supabase
    .from("supply_requirements")
    .select("id, division_id, school_year_id");

  if (reqErr) {
    console.error("Erreur chargement exigences pour summary:", reqErr);
    return {};
  }

  // Calculer le total requis par couple (division_id, school_year_id)
  const totalByScope = new Map<string, number>();
  (allReqs || []).forEach((r) => {
    const key = `${r.division_id}_${r.school_year_id}`;
    totalByScope.set(key, (totalByScope.get(key) || 0) + 1);
  });

  // 2. Récupérer les statuts 'donne' pour les élèves listés
  // Pour éviter les limitations d'URL en GET avec de très longues listes d'IDs, on découpe par lots si nécessaire
  const chunkSize = 100;
  const givenSuppliesMap = new Map<string, number>();

  for (let i = 0; i < studentIds.length; i += chunkSize) {
    const chunk = studentIds.slice(i, i + chunkSize);
    const { data: supplies, error: supErr } = await supabase
      .from("student_supplies")
      .select("student_id, status")
      .in("student_id", chunk)
      .eq("status", "donne");

    if (supErr) {
      console.error("Erreur chargement student_supplies pour summary:", supErr);
      break;
    }

    (supplies || []).forEach((s) => {
      givenSuppliesMap.set(s.student_id, (givenSuppliesMap.get(s.student_id) || 0) + 1);
    });
  }

  // 3. Associer chaque élève à sa classe pour déterminer son total_required
  const { data: studentsInfo, error: stErr } = await supabase
    .from("students")
    .select("id, class_id")
    .in("id", studentIds);

  if (stErr) {
    console.error("Erreur chargement studentsInfo pour summary:", stErr);
    return {};
  }

  const result: Record<string, StudentSupplySummary> = {};

  (studentsInfo || []).forEach((st) => {
    const classInfo = classInfoMap.get(st.class_id);
    let totalRequired = 0;
    if (classInfo) {
      const scopeKey = `${classInfo.division_id}_${classInfo.school_year_id}`;
      totalRequired = totalByScope.get(scopeKey) || 0;
    }

    const givenCount = givenSuppliesMap.get(st.id) || 0;
    result[st.id] = {
      student_id: st.id,
      total_required: totalRequired,
      given_count: givenCount,
    };
  });

  return result;
}
