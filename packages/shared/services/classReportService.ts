import { listGrades } from "../api/grades";
import { listStudents, StudentRecord } from "../api/students";
import {
  listSubjects,
  listCoefficients,
  listSequences,
  SubjectRecord,
} from "../api/subjects";

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
  periodType: "sequence" | "term";
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
  periodType: "sequence" | "term",
  periodId: string
): Promise<ClassReportData> {
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
