/**
 * Fonctions de calcul centralisées pour les notes, moyennes et lettres/appréciations.
 * Plateforme Le Fanion.
 */

/**
 * Calcule la lettre de matière à partir d'un score (0 à 20).
 * Barème confirmé :
 * < 10 -> D | 10–11.99 -> C | 12–13.99 -> C+ | 14–14.99 -> B | 15–15.99 -> B+ | 16–17.99 -> A | 18–20 -> A+
 */
export function getSubjectLetterGrade(score: number): string {
  if (score < 10) return "D";
  if (score < 12) return "C";
  if (score < 14) return "C+";
  if (score < 15) return "B";
  if (score < 16) return "B+";
  if (score < 18) return "A";
  return "A+";
}

/**
 * Calcule le code d'appréciation global à partir de la moyenne trimestrielle générale (0 à 20).
 * Formule officielle Le Fanion :
 * < 10 -> CNA | 10–11.99 -> CMA | 12–13.99 -> CA | 14–15.99 -> CBA | 16–20 -> CTBA
 */
export function getAppreciationCode(termAverage: number): string {
  if (termAverage < 10) return "CNA";
  if (termAverage < 12) return "CMA";
  if (termAverage < 14) return "CA";
  if (termAverage < 16) return "CBA";
  return "CTBA";
}

/**
 * Libellé complet du code d'appréciation
 */
export function getAppreciationLabel(code: string): string {
  switch (code) {
    case "CNA":
      return "Compétence Non Acquise";
    case "CMA":
      return "Compétence Minimale Acquise";
    case "CA":
      return "Compétence Acquise";
    case "CBA":
      return "Compétence Bien Acquise";
    case "CTBA":
      return "Compétence Très Bien Acquise";
    default:
      return code;
  }
}

export interface SubjectScoreItem {
  score: number;
  coefficient: number;
}

/**
 * Calcule la moyenne d'une séquence pour un ensemble de notes et coefficients.
 * Moyenne = Σ(note × coef) / Σ(coef)
 */
export function calculateSequenceAverage(items: SubjectScoreItem[]): number | null {
  if (!items || items.length === 0) return null;

  let totalPoints = 0;
  let totalCoefs = 0;

  for (const item of items) {
    if (typeof item.score === "number" && typeof item.coefficient === "number" && item.coefficient > 0) {
      totalPoints += item.score * item.coefficient;
      totalCoefs += item.coefficient;
    }
  }

  if (totalCoefs === 0) return null;
  return Math.round((totalPoints / totalCoefs) * 100) / 100;
}

export interface SubjectTermItem {
  seq1Score?: number | null;
  seq2Score?: number | null;
  coefficient: number;
}

/**
 * Calcule la moyenne trimestrielle d'un élève.
 * Pour chaque matière : score_trimestre = (score_seq1 + score_seq2) / 2
 * Moyenne trimestrielle générale = Σ(score_trimestre × coef) / Σ(coef)
 */
export function calculateTermAverage(subjects: SubjectTermItem[]): number | null {
  if (!subjects || subjects.length === 0) return null;

  let totalPoints = 0;
  let totalCoefs = 0;

  for (const item of subjects) {
    const s1 = typeof item.seq1Score === "number" ? item.seq1Score : null;
    const s2 = typeof item.seq2Score === "number" ? item.seq2Score : null;

    let subjectAverage: number | null = null;
    if (s1 !== null && s2 !== null) {
      subjectAverage = (s1 + s2) / 2;
    } else if (s1 !== null) {
      subjectAverage = s1;
    } else if (s2 !== null) {
      subjectAverage = s2;
    }

    if (subjectAverage !== null && typeof item.coefficient === "number" && item.coefficient > 0) {
      totalPoints += subjectAverage * item.coefficient;
      totalCoefs += item.coefficient;
    }
  }

  if (totalCoefs === 0) return null;
  return Math.round((totalPoints / totalCoefs) * 100) / 100;
}
