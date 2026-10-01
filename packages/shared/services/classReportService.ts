import { listGrades } from "../api/grades";
import { listStudents, StudentRecord } from "../api/students";
import {
  listSubjects,
  listCoefficients,
  listSequences,
  SubjectRecord,
} from "../api/subjects";

import { supabase } from "../api/supabaseClient";

export interface StudentSubjectGrade {
  subject_id: string;
  score: number | null; // null si non noté ou NC
  displayValue: string; // "NC" ou string décimale (ex: "14.50")
  isNC: boolean;
}

export interface StudentReportRow {
  student: StudentRecord;
  gradesBySubject: Record<string, StudentSubjectGrade>;
  average: number | null; // null si non calculable / NC
  averageDisplay: string; // "NC" ou "13.22"
  rank: number | null;
  rankDisplay: string; // "1er/8", "2ex/8", ou "NC" / "-"
  isRanked: boolean;
}

export interface ReportDistributionCategory {
  label: string;
  range: string;
  count: number;
  color: string;
}

export interface ClassReportData {
  class_id: string;
  periodType: "sequence" | "term" | "month";
  periodId: string;
  subjects: Array<SubjectRecord & { coefficient: number }>;
  rows: StudentReportRow[];
  stats: {
    totalStudents: number;
    rankedStudentsCount: number;
    classAverage: number | null;
    classAverageDisplay: string;
    maxAverage: number | null;
    maxAverageDisplay: string;
    minAverage: number | null;
    minAverageDisplay: string;
    successRate: number | null; // % >= 10
  };
  distribution: ReportDistributionCategory[];
}

/**
 * RÈGLE MÉTIER NC (Notes non communiquées / non calculées) :
 * - Mode Séquence : Si la note d'une matière n'est pas saisie, elle est marquée NC (score: null).
 * - Mode Trimestre : Une note trimestrielle exige que les 2 séquences du trimestre soient saisies.
 *   Si une seule séquence est notée (ou aucune), la note trimestrielle est "NC" (score: null).
 *   Une note manquante n'est JAMAIS convertie en 0 par défaut.
 * - Moyenne générale : Calculée sur la somme des coefficients des matières dont la note est valide.
 *   Si aucune matière n'est notée ou si les données sont insuffisantes pour déterminer une moyenne significative,
 *   la moyenne générale est null ("NC") et l'élève est exclu du classement.
 */
export async function generateClassReport(
  classId: string,
  periodType: "sequence" | "term" | "month",
  periodId: string
): Promise<ClassReportData> {
  // Détection si classe primaire
  const { data: clsData } = await supabase
    .from("classes")
    .select("id, name, level, division_id, divisions(nom)")
    .eq("id", classId)
    .maybeSingle();

  const divisionName = ((clsData as any)?.divisions?.nom || "").toLowerCase();
  const isPrimary = periodType === "month" || divisionName.includes("primaire") || divisionName.includes("primary");

  if (isPrimary) {
    return generatePrimaryClassReportInternal(classId, clsData, periodType, periodId);
  }

  // 1. Récupérer la liste des élèves de la classe
  const students = await listStudents({ classId });

  // 2. Récupérer les coefficients des matières configurées pour cette classe
  const classCoeffs = await listCoefficients(classId);
  const allSubjects = await listSubjects();
  
  // Mapper les matières configurées avec leur coefficient
  const activeSubjects = classCoeffs
    .map((c) => {
      const sub = allSubjects.find((s) => s.id === c.subject_id);
      if (!sub) return null;
      return {
        ...sub,
        coefficient: c.coefficient,
      };
    })
    .filter((s): s is SubjectRecord & { coefficient: number } => s !== null);

  // 3. Récupérer les notes selon la période choisie (Séquence ou Trimestre)
  let targetSequenceIds: string[] = [];

  if (periodType === "sequence") {
    targetSequenceIds = [periodId];
  } else {
    // Si c'est un trimestre, trouver les 2 séquences de ce trimestre
    const allSequences = await listSequences();
    const termSequences = allSequences.filter((seq) => seq.term_id === periodId);
    targetSequenceIds = termSequences.map((seq) => seq.id);
  }

  // Récupérer l'ensemble des notes de la classe pour ces séquences
  const rawGrades = await listGrades({ class_id: classId });
  const filteredGrades = rawGrades.filter((g) => targetSequenceIds.includes(g.sequence_id));

  // 4. Calculer la matrice des notes et moyennes par élève
  const rows: StudentReportRow[] = students.map((student) => {
    const gradesBySubject: Record<string, StudentSubjectGrade> = {};
    let weightedSum = 0;
    let totalCoeff = 0;

    activeSubjects.forEach((sub) => {
      const studentSubGrades = filteredGrades.filter(
        (g) => g.student_id === student.id && g.subject_id === sub.id
      );

      let finalScore: number | null = null;
      let isNC = true;

      if (periodType === "sequence") {
        const seqGrade = studentSubGrades.find((g) => g.sequence_id === periodId);
        if (seqGrade && typeof seqGrade.score === "number") {
          finalScore = seqGrade.score;
          isNC = false;
        }
      } else {
        // Mode Trimestre : Exige la présence des 2 séquences (si 2 séquences existent dans le trimestre)
        if (targetSequenceIds.length >= 2) {
          const seq1Grade = studentSubGrades.find((g) => g.sequence_id === targetSequenceIds[0]);
          const seq2Grade = studentSubGrades.find((g) => g.sequence_id === targetSequenceIds[1]);

          if (
            seq1Grade &&
            typeof seq1Grade.score === "number" &&
            seq2Grade &&
            typeof seq2Grade.score === "number"
          ) {
            finalScore = (seq1Grade.score + seq2Grade.score) / 2;
            isNC = false;
          } else {
            // Si une des 2 séquences manque -> NC !
            finalScore = null;
            isNC = true;
          }
        } else if (targetSequenceIds.length === 1) {
          const singleGrade = studentSubGrades.find((g) => g.sequence_id === targetSequenceIds[0]);
          if (singleGrade && typeof singleGrade.score === "number") {
            finalScore = singleGrade.score;
            isNC = false;
          }
        }
      }

      gradesBySubject[sub.id] = {
        subject_id: sub.id,
        score: finalScore,
        displayValue: isNC || finalScore === null ? "NC" : finalScore.toFixed(2),
        isNC,
      };

      if (!isNC && finalScore !== null) {
        weightedSum += finalScore * sub.coefficient;
        totalCoeff += sub.coefficient;
      }
    });

    const average = totalCoeff > 0 ? weightedSum / totalCoeff : null;

    return {
      student,
      gradesBySubject,
      average,
      averageDisplay: average !== null ? average.toFixed(2) : "NC",
      rank: null,
      rankDisplay: "NC",
      isRanked: false,
    };
  });

  // 5. Appliquer le Classement (Règle confirmé : uniquement élèves avec moyenne calculable)
  const rankedRows = rows.filter((r) => r.average !== null);
  rankedRows.sort((a, b) => (b.average as number) - (a.average as number));

  const totalRanked = rankedRows.length;

  let currentRank = 1;
  for (let i = 0; i < rankedRows.length; i++) {
    if (i > 0 && rankedRows[i].average === rankedRows[i - 1].average) {
      // Ex-æquo : même rang que le précédent
      rankedRows[i].rank = rankedRows[i - 1].rank;
      const isTie = true;
      rankedRows[i].rankDisplay = `${rankedRows[i].rank}${isTie ? "ex" : ""}/${totalRanked}`;
    } else {
      currentRank = i + 1;
      rankedRows[i].rank = currentRank;

      // Détecter si le suivant est ex-æquo avec nous pour formater l'affichage
      const isTie = i < rankedRows.length - 1 && rankedRows[i + 1].average === rankedRows[i].average;
      rankedRows[i].rankDisplay = `${currentRank}${isTie ? "ex" : ""}/${totalRanked}`;
    }
    rankedRows[i].isRanked = true;
  }

  // Ajuster le suffixe "ex" pour le premier d'un groupe d'ex-æquo
  for (let i = 0; i < rankedRows.length; i++) {
    const hasNextTie = i < rankedRows.length - 1 && rankedRows[i + 1].average === rankedRows[i].average;
    const hasPrevTie = i > 0 && rankedRows[i - 1].average === rankedRows[i].average;
    if (hasNextTie || hasPrevTie) {
      rankedRows[i].rankDisplay = `${rankedRows[i].rank}ex/${totalRanked}`;
    } else {
      rankedRows[i].rankDisplay = `${rankedRows[i].rank}/${totalRanked}`;
    }
  }

  // Remettre à jour les lignes initiales avec les informations de classement
  const rowMap = new Map(rankedRows.map((r) => [r.student.id, r]));
  const finalRows = rows.map((r) => rowMap.get(r.student.id) || r);

  // 6. Calcul des Statistiques Générales
  const validAverages = finalRows
    .map((r) => r.average)
    .filter((avg): avg is number => avg !== null);

  const classAvgSum = validAverages.reduce((acc, v) => acc + v, 0);
  const classAverage = validAverages.length > 0 ? classAvgSum / validAverages.length : null;
  const maxAverage = validAverages.length > 0 ? Math.max(...validAverages) : null;
  const minAverage = validAverages.length > 0 ? Math.min(...validAverages) : null;
  
  const successCount = validAverages.filter((v) => v >= 10).length;
  const successRate = validAverages.length > 0 ? (successCount / validAverages.length) * 100 : null;

  // 7. Graphique de Distribution des Moyennes (Tranches officielles)
  const distribution: ReportDistributionCategory[] = [
    { label: "Non Acquis", range: "< 10", count: 0, color: "#EF4444" },
    { label: "Passable (CMA)", range: "10 - 11.99", count: 0, color: "#F59E0B" },
    { label: "Assez Bien (CA)", range: "12 - 13.99", count: 0, color: "#3B82F6" },
    { label: "Bien (CBA)", range: "14 - 15.99", count: 0, color: "#10B981" },
    { label: "Très Bien (CTBA)", range: "16 - 20", count: 0, color: "#8B5CF6" },
  ];

  validAverages.forEach((avg) => {
    if (avg < 10) distribution[0].count++;
    else if (avg < 12) distribution[1].count++;
    else if (avg < 14) distribution[2].count++;
    else if (avg < 16) distribution[3].count++;
    else distribution[4].count++;
  });

  return {
    class_id: classId,
    periodType,
    periodId,
    subjects: activeSubjects,
    rows: finalRows,
    stats: {
      totalStudents: students.length,
      rankedStudentsCount: totalRanked,
      classAverage,
      classAverageDisplay: classAverage !== null ? classAverage.toFixed(2) : "NC",
      maxAverage,
      maxAverageDisplay: maxAverage !== null ? maxAverage.toFixed(2) : "NC",
      minAverage,
      minAverageDisplay: minAverage !== null ? minAverage.toFixed(2) : "NC",
      successRate,
    },
    distribution,
  };
}

/**
 * Génère le bordereau de notes du Primaire (APC par domaines / mois)
 */
async function generatePrimaryClassReportInternal(
  classId: string,
  clsData: any,
  periodType: "sequence" | "term" | "month",
  periodId: string
): Promise<ClassReportData> {
  const students = await listStudents({ classId, status: "active" });
  const classLevel = clsData?.level || "SIL";

  // 1. Structure APC
  const [{ data: domains }, { data: subEvals }, { data: scales }] = await Promise.all([
    supabase.from("primary_domains").select("*").order("order_index", { ascending: true }),
    supabase.from("primary_sub_evaluations").select("*").order("order_index", { ascending: true }),
    supabase.from("primary_scales").select("*").eq("level", classLevel),
  ]);

  const domainList = domains || [];
  const subEvalList = subEvals || [];
  const scaleList = scales || [];

  const scaleMap = new Map<string, number>();
  scaleList.forEach((sc) => scaleMap.set(sc.sub_evaluation_id, Number(sc.max_score)));

  // Associer chaque sous-évaluation à son domaine
  const subToDomain = new Map<string, string>();
  subEvalList.forEach((sub) => subToDomain.set(sub.id, sub.domain_id));

  // Calculer le barème max de chaque domaine pour ce niveau
  const domainMaxMap = new Map<string, number>();
  subEvalList.forEach((sub) => {
    const dId = sub.domain_id;
    const max = scaleMap.get(sub.id) || 10;
    domainMaxMap.set(dId, (domainMaxMap.get(dId) || 0) + max);
  });

  const activeSubjects: Array<SubjectRecord & { coefficient: number }> = domainList.map((d) => ({
    id: d.id,
    name: d.name,
    code: d.code,
    division_id: clsData?.division_id || "primaire",
    coefficient: domainMaxMap.get(d.id) || 20,
    created_at: new Date().toISOString(),
  }));

  // 2. Évaluations primaires pour la période
  let evalIds: string[] = [];
  if (periodType === "month") {
    const { data: evals } = await supabase
      .from("primary_evaluations")
      .select("id")
      .eq("primary_month_id", periodId);
    evalIds = (evals || []).map((e) => e.id);
  } else {
    // Mode Trimestre : mois rattachés au trimestre
    const { data: months } = await supabase
      .from("primary_months")
      .select("id")
      .eq("term_id", periodId);
    const mIds = (months || []).map((m) => m.id);
    if (mIds.length > 0) {
      const { data: evals } = await supabase
        .from("primary_evaluations")
        .select("id")
        .in("primary_month_id", mIds);
      evalIds = (evals || []).map((e) => e.id);
    }
  }

  // 3. Notes primaires
  let grades: Array<{ student_id: string; sub_evaluation_id: string; score: number }> = [];
  if (evalIds.length > 0 && students.length > 0) {
    const { data: rawGrades } = await supabase
      .from("primary_grades")
      .select("student_id, sub_evaluation_id, score")
      .in("primary_evaluation_id", evalIds)
      .in("student_id", students.map((s) => s.id));
    grades = (rawGrades || []).map((g) => ({
      student_id: g.student_id,
      sub_evaluation_id: g.sub_evaluation_id,
      score: Number(g.score),
    }));
  }

  // Barème total maximum de tous les domaines réunis pour cette classe
  const totalClassMaxScore = Array.from(domainMaxMap.values()).reduce((sum, v) => sum + v, 0) || 100;

  // 4. Calcul de la matrice des notes par élève et domaine
  const rows: StudentReportRow[] = students.map((student) => {
    const gradesBySubject: Record<string, StudentSubjectGrade> = {};
    let studentTotalPoints = 0;
    let hasAnyGrade = false;

    activeSubjects.forEach((dom) => {
      const domMax = domainMaxMap.get(dom.id) || 20;

      // Sous-évaluations de ce domaine
      const domSubIds = new Set(
        subEvalList.filter((s) => s.domain_id === dom.id).map((s) => s.id)
      );

      // Notes de l'élève pour les sous-éval de ce domaine
      const stDomGrades = grades.filter(
        (g) => g.student_id === student.id && domSubIds.has(g.sub_evaluation_id)
      );

      if (stDomGrades.length > 0) {
        hasAnyGrade = true;
        const domScore = stDomGrades.reduce((sum, g) => sum + g.score, 0);
        studentTotalPoints += domScore;
        gradesBySubject[dom.id] = {
          subject_id: dom.id,
          score: domScore,
          displayValue: `${domScore.toFixed(1)} / ${domMax}`,
          isNC: false,
        };
      } else {
        gradesBySubject[dom.id] = {
          subject_id: dom.id,
          score: null,
          displayValue: "NC",
          isNC: true,
        };
      }
    });

    // Moyenne ramenée sur 20 pour conformité avec le système de classement et Recharts
    const average = hasAnyGrade && totalClassMaxScore > 0
      ? (studentTotalPoints / totalClassMaxScore) * 20
      : null;

    return {
      student,
      gradesBySubject,
      average,
      averageDisplay: average !== null ? average.toFixed(2) : "NC",
      rank: null,
      rankDisplay: "NC",
      isRanked: false,
    };
  });

  // 5. Classement
  const rankedRows = rows.filter((r) => r.average !== null);
  rankedRows.sort((a, b) => (b.average as number) - (a.average as number));
  const totalRanked = rankedRows.length;

  let currentRank = 1;
  for (let i = 0; i < rankedRows.length; i++) {
    if (i > 0 && rankedRows[i].average === rankedRows[i - 1].average) {
      rankedRows[i].rank = rankedRows[i - 1].rank;
      rankedRows[i].rankDisplay = `${rankedRows[i].rank}ex/${totalRanked}`;
    } else {
      currentRank = i + 1;
      rankedRows[i].rank = currentRank;
      const isTie = i < rankedRows.length - 1 && rankedRows[i + 1].average === rankedRows[i].average;
      rankedRows[i].rankDisplay = `${currentRank}${isTie ? "ex" : ""}/${totalRanked}`;
    }
    rankedRows[i].isRanked = true;
  }

  // Harmonisation ex-aequo
  for (let i = 0; i < rankedRows.length; i++) {
    const hasNextTie = i < rankedRows.length - 1 && rankedRows[i + 1].average === rankedRows[i].average;
    const hasPrevTie = i > 0 && rankedRows[i - 1].average === rankedRows[i].average;
    if (hasNextTie || hasPrevTie) {
      rankedRows[i].rankDisplay = `${rankedRows[i].rank}ex/${totalRanked}`;
    } else {
      rankedRows[i].rankDisplay = `${rankedRows[i].rank}/${totalRanked}`;
    }
  }

  const rowMap = new Map(rankedRows.map((r) => [r.student.id, r]));
  const finalRows = rows.map((r) => rowMap.get(r.student.id) || r);

  // 6. Statistiques générales
  const validAverages = finalRows
    .map((r) => r.average)
    .filter((avg): avg is number => avg !== null);

  const classAvgSum = validAverages.reduce((acc, v) => acc + v, 0);
  const classAverage = validAverages.length > 0 ? classAvgSum / validAverages.length : null;
  const maxAverage = validAverages.length > 0 ? Math.max(...validAverages) : null;
  const minAverage = validAverages.length > 0 ? Math.min(...validAverages) : null;
  const successCount = validAverages.filter((v) => v >= 10).length;
  const successRate = validAverages.length > 0 ? (successCount / validAverages.length) * 100 : null;

  // 7. Distribution Recharts
  const distribution: ReportDistributionCategory[] = [
    { label: "Non Acquis", range: "< 10", count: 0, color: "#EF4444" },
    { label: "Passable (CMA)", range: "10 - 11.99", count: 0, color: "#F59E0B" },
    { label: "Assez Bien (CA)", range: "12 - 13.99", count: 0, color: "#3B82F6" },
    { label: "Bien (CBA)", range: "14 - 15.99", count: 0, color: "#10B981" },
    { label: "Très Bien (CTBA)", range: "16 - 20", count: 0, color: "#8B5CF6" },
  ];

  validAverages.forEach((avg) => {
    if (avg < 10) distribution[0].count++;
    else if (avg < 12) distribution[1].count++;
    else if (avg < 14) distribution[2].count++;
    else if (avg < 16) distribution[3].count++;
    else distribution[4].count++;
  });

  return {
    class_id: classId,
    periodType,
    periodId,
    subjects: activeSubjects,
    rows: finalRows,
    stats: {
      totalStudents: students.length,
      rankedStudentsCount: totalRanked,
      classAverage,
      classAverageDisplay: classAverage !== null ? classAverage.toFixed(2) : "NC",
      maxAverage,
      maxAverageDisplay: maxAverage !== null ? maxAverage.toFixed(2) : "NC",
      minAverage,
      minAverageDisplay: minAverage !== null ? minAverage.toFixed(2) : "NC",
      successRate,
    },
    distribution,
  };
}
