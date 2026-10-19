import { supabase } from "./supabaseClient";
import { OFFICIAL_PRIMARY_COMPETENCES, CompetenceConfig } from "./primaryBulletinPdfService";

export interface ApcScaleRecord {
  id?: string;
  class_id?: string;
  level: string;
  sub_evaluation_id?: string;
  competence_code: string;
  criterion_label: string;
  max_score: number;
}

/**
 * Récupère la liste des compétences et leurs barèmes pour une classe ou un niveau
 */
export async function getPrimaryScalesForClass(
  classId: string,
  classLevel: string
): Promise<CompetenceConfig[]> {
  // 1. Récupérer les échelles enregistrées en base pour cette classe ou ce niveau
  const { data: scales } = await supabase
    .from("primary_scales")
    .select("id, class_id, level, sub_evaluation_id, max_score, primary_sub_evaluations(id, label, domain_id, primary_domains(code, name))")
    .or(`class_id.eq.${classId},level.eq.${classLevel}`);

  // Mapper par [code_competence + criterion_label]
  const scaleMap: Record<string, number> = {};
  (scales || []).forEach((sc: any) => {
    const sub = sc.primary_sub_evaluations;
    if (sub?.label && sub?.primary_domains?.code) {
      const key = `${sub.primary_domains.code}_${sub.label}`;
      if (sc.class_id === classId || scaleMap[key] === undefined) {
        scaleMap[key] = Number(sc.max_score);
      }
    }
  });

  // 2. Construire la configuration complète basée sur les 11 compétences officielles
  return OFFICIAL_PRIMARY_COMPETENCES.map((comp) => ({
    ...comp,
    criteria: comp.criteria.map((crit) => {
      const key = `${comp.code.replace("COMPÉTENCES ", "")}_${crit.label}`;
      const customMax = scaleMap[key];
      return {
        ...crit,
        defaultMax: customMax !== undefined ? customMax : crit.defaultMax,
      };
    }),
  }));
}

/**
 * Enregistre les barèmes personnalisés pour une classe
 */
export async function savePrimaryScalesForClass(
  classId: string,
  classLevel: string,
  competences: CompetenceConfig[]
): Promise<void> {
  // Pour chaque critère, mettre à jour ou insérer dans primary_scales
  // 1. Récupérer les sub_evaluation_id correspondants si existants
  const { data: domains } = await supabase
    .from("primary_domains")
    .select("id, code");
  const { data: subs } = await supabase
    .from("primary_sub_evaluations")
    .select("id, domain_id, label");

  const domainMap: Record<string, string> = {};
  (domains || []).forEach((d) => { domainMap[d.code] = d.id; });

  const subMap: Record<string, string> = {};
  (subs || []).forEach((s) => {
    subMap[`${s.domain_id}_${s.label}`] = s.id;
  });

  // 2. Préparer les données à insérer ou mettre à jour pour cette classe
  const recordsToUpsert: {
    class_id: string;
    level: string;
    sub_evaluation_id: string;
    max_score: number;
  }[] = [];

  for (const comp of competences) {
    const rawCode = comp.code.replace("COMPÉTENCES ", "");
    const domainId = domainMap[rawCode];

    for (const crit of comp.criteria) {
      const subId = domainId ? subMap[`${domainId}_${crit.label}`] : null;
      if (subId) {
        recordsToUpsert.push({
          class_id: classId,
          level: classLevel,
          sub_evaluation_id: subId,
          max_score: crit.defaultMax,
        });
      }
    }
  }

  if (recordsToUpsert.length === 0) return;

  // Récupérer les ids des enregistrements existants pour cette classe
  const { data: existingRecords, error: fetchErr } = await supabase
    .from("primary_scales")
    .select("id, sub_evaluation_id")
    .eq("class_id", classId);

  if (fetchErr) {
    console.error("Erreur lecture primary_scales existantes:", fetchErr);
  }

  const existingMap = new Map<string, string>();
  (existingRecords || []).forEach((r: any) => {
    existingMap.set(r.sub_evaluation_id, r.id);
  });

  const updates: any[] = [];
  const inserts: any[] = [];

  for (const rec of recordsToUpsert) {
    const existingId = existingMap.get(rec.sub_evaluation_id);
    if (existingId) {
      updates.push({ ...rec, id: existingId });
    } else {
      inserts.push(rec);
    }
  }

  if (updates.length > 0) {
    const { error: upErr } = await supabase
      .from("primary_scales")
      .upsert(updates);
    if (upErr) throw upErr;
  }

  if (inserts.length > 0) {
    const { error: insErr } = await supabase
      .from("primary_scales")
      .insert(inserts);
    if (insErr) throw insErr;
  }
}
