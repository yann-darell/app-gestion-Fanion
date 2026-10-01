import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { supabase } from "./supabaseClient";
import { LOGO_PRIMAIRE_BASE64 } from "../assets/logoPrimaireBase64";
import { getSchoolSettings } from "../services/settingsService";

// ============================================================
// Types
// ============================================================

export interface PrimaryBulletinOptions {
  studentId: string;
  periodId: string;
  periodType: "month" | "term";
}

export interface CriterionConfig {
  label: string;
  order: number;
  defaultMax: number;
  subCode?: string;
}

export interface CompetenceConfig {
  code: string;
  name: string;
  order: number;
  criteria: CriterionConfig[];
}

// Les 11 compétences de référence de l'école primaire camerounaise APC
export const OFFICIAL_PRIMARY_COMPETENCES: CompetenceConfig[] = [
  {
    code: "COMPÉTENCES 1A",
    name: "COMMUNIQUER EN FRANÇAIS",
    order: 1,
    criteria: [
      { label: "1 : Orale", order: 1, defaultMax: 20 },
      { label: "2 : Écrite", order: 2, defaultMax: 15 },
      { label: "3 : Savoir-être", order: 3, defaultMax: 5 },
    ],
  },
  {
    code: "COMPÉTENCES 1B",
    name: "COMMUNIQUER EN ANGLAIS",
    order: 2,
    criteria: [
      { label: "1 : Oral", order: 1, defaultMax: 20 },
      { label: "2 : Written", order: 2, defaultMax: 15 },
      { label: "3 : Attitude", order: 3, defaultMax: 5 },
    ],
  },
  {
    code: "COMPÉTENCES 1C",
    name: "PRATIQUER UNE LANGUE NATIONALE",
    order: 3,
    criteria: [
      { label: "1 : Orale", order: 1, defaultMax: 10 },
      { label: "2 : Écrite", order: 2, defaultMax: 5 },
      { label: "3 : Pratique", order: 3, defaultMax: 3 },
      { label: "4 : Savoir-être", order: 4, defaultMax: 2 },
    ],
  },
  {
    code: "COMPÉTENCES 2A",
    name: "UTILISER LES NOTIONS DE BASE EN MATHÉMATIQUES",
    order: 4,
    criteria: [
      { label: "1 : Orale", order: 1, defaultMax: 5 },
      { label: "2 : Écrite", order: 2, defaultMax: 20 },
      { label: "3 : Savoir-être", order: 3, defaultMax: 5 },
    ],
  },
  {
    code: "COMPÉTENCES 2B",
    name: "UTILISER LES NOTIONS DE BASE EN SCIENCES ET TECHNOLOGIES",
    order: 5,
    criteria: [
      { label: "1 : Orale", order: 1, defaultMax: 5 },
      { label: "2 : Écrite", order: 2, defaultMax: 5 },
      { label: "3 : Pratique", order: 3, defaultMax: 15 },
      { label: "4 : Savoir-être", order: 4, defaultMax: 5 },
    ],
  },
  {
    code: "COMPÉTENCES 3B",
    name: "PRATIQUER LES VALEURS CITOYENNES",
    order: 6,
    criteria: [
      { label: "1 : Orale", order: 1, defaultMax: 5 },
      { label: "2 : Écrite", order: 2, defaultMax: 5 },
      { label: "3 : Pratique", order: 3, defaultMax: 8 },
      { label: "4 : Savoir-être", order: 4, defaultMax: 2 },
    ],
  },
  {
    code: "COMPÉTENCES 4",
    name: "DÉMONTRER L'AUTONOMIE, L'ESPRIT D'INITIATIVE, DE CRÉATIVITÉ ET D'ENTREPRENEURIAT",
    order: 7,
    criteria: [
      { label: "1 : Orale", order: 1, defaultMax: 5 },
      { label: "2 : Écrite", order: 2, defaultMax: 3 },
      { label: "3 : Pratique", order: 3, defaultMax: 10 },
      { label: "4 : Savoir-être", order: 4, defaultMax: 2 },
    ],
  },
  {
    code: "COMPÉTENCES 5",
    name: "UTILISER LES CONCEPTS DE BASE ET LES OUTILS DES TIC",
    order: 8,
    criteria: [
      { label: "1 : Orale", order: 1, defaultMax: 3 },
      { label: "2 : Écrite", order: 2, defaultMax: 3 },
      { label: "3 : Pratique", order: 3, defaultMax: 10 },
      { label: "4 : Savoir-être", order: 4, defaultMax: 4 },
    ],
  },
  {
    code: "COMPÉTENCES 6A1",
    name: "PRATIQUER LES ACTIVITÉS PHYSIQUES ET SPORTIVES POUR LES APPRENANTS APTES",
    order: 9,
    criteria: [
      { label: "1 : Orale", order: 1, defaultMax: 3 },
      { label: "2 : Écrite", order: 2, defaultMax: 3 },
      { label: "3 : Pratique", order: 3, defaultMax: 10 },
      { label: "4 : Savoir-être", order: 4, defaultMax: 4 },
    ],
  },
  {
    code: "COMPÉTENCES 6B",
    name: "PRATIQUER LES ACTIVITÉS ARTISTIQUES",
    order: 10,
    criteria: [
      { label: "1 : Orale", order: 1, defaultMax: 4 },
      { label: "2 : Écrite", order: 2, defaultMax: 3 },
      { label: "3 : Pratique", order: 3, defaultMax: 10 },
      { label: "4 : Savoir-être", order: 4, defaultMax: 3 },
    ],
  },
  {
    code: "COMPÉTENCES 6A2",
    name: "LEADERSHIP & BON CARACTÈRE",
    order: 11,
    criteria: [
      { label: "1 : Orale", order: 1, defaultMax: 6 },
      { label: "2 : Écrite", order: 2, defaultMax: 12 },
      { label: "3 : Savoir-être", order: 3, defaultMax: 2 },
    ],
  },
];

// Helper : calcul de la cote selon les seuils officiels
export function calcApcCote(score: number | null, maxScore: number): string {
  if (score === null || maxScore <= 0) return "—";
  const pct = (score / maxScore) * 100;
  if (pct >= 90) return "A+";
  if (pct >= 75) return "A";
  if (pct >= 50) return "ECA";
  return "NA";
}

// Helper : niveau d'acquisition global
export function calcApcNiveauAcquisition(cote: string): string {
  switch (cote) {
    case "A+": return "Expert";
    case "A": return "Acquis";
    case "ECA": return "En cours d'acquisition";
    case "NA": return "Non acquis";
    default: return "—";
  }
}

function fmtNum(n: number | null, padZero = true): string {
  if (n === null || isNaN(n)) return "—";
  const s = n.toFixed(2);
  const parts = s.split(".");
  const intPart = padZero && parts[0].length === 1 ? "0" + parts[0] : parts[0];
  return `${intPart},${parts[1]}`;
}

// ============================================================
// Service Principal
// ============================================================

export async function createPrimaryBulletinPdfBuffer(
  studentId: string,
  periodId: string,
  periodType: "month" | "term" = "month"
): Promise<Uint8Array> {
  // 0. Paramètres de l'établissement
  const schoolSettings = await getSchoolSettings();
  const schoolName = schoolSettings.name || "Établissement Scolaire";
  const schoolCity = schoolSettings.city || "Yaoundé";
  const directorLabel = schoolSettings.director_name || "La Directrice";

  // 1. Informations sur l'élève et sa classe
  const { data: student, error: studErr } = await supabase
    .from("students")
    .select("*, classes(id, name, level, division_id, head_teacher_name)")
    .eq("id", studentId)
    .single();

  if (studErr || !student) {
    throw new Error("Élève introuvable pour la génération du bulletin primaire.");
  }

  const classId = student.class_id;
  const classLevel: string = student.classes?.level || "SIL";
  const className: string = student.classes?.name || "Classe Primaire";
  const teacherName: string = student.classes?.head_teacher_name || "—";

  // 2. Année scolaire et effectif
  const { data: schoolYear } = await supabase
    .from("school_years")
    .select("label")
    .eq("is_active", true)
    .maybeSingle();

  const schoolYearLabel = schoolYear?.label || "2025/2026";

  const { count: classEffectif } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId)
    .eq("status", "active");

  // 3. Détermination du trimestre et des mois M1, M2, M3
  let termLabel = "TRIMESTRE 1";
  let termId = periodId;

  if (periodType === "month") {
    const { data: monthData } = await supabase
      .from("primary_months")
      .select("label, term_id, terms(label)")
      .eq("id", periodId)
      .maybeSingle();

    if (monthData?.term_id) {
      termId = monthData.term_id;
      termLabel = (monthData as any)?.terms?.label?.toUpperCase() || "TRIMESTRE";
    }
  } else {
    const { data: termData } = await supabase
      .from("terms")
      .select("label")
      .eq("id", periodId)
      .maybeSingle();
    if (termData?.label) {
      termLabel = termData.label.toUpperCase();
    }
  }

  // Récupérer les mois du trimestre pour les colonnes M1, M2, M3
  const { data: termMonthsData } = await supabase
    .from("primary_months")
    .select("id, label, order_index")
    .eq("term_id", termId)
    .order("order_index", { ascending: true });

  const termMonths = termMonthsData || [];
  const m1Month = termMonths[0];
  const m2Month = termMonths[1];
  const m3Month = termMonths[2];

  // 4. Récupérer les compétences et barèmes depuis la base
  // Barèmes personnalisés par classe ou par niveau
  const { data: customScales } = await supabase
    .from("primary_scales")
    .select("sub_evaluation_id, max_score, class_id, level")
    .or(`class_id.eq.${classId},level.eq.${classLevel}`);

  const scaleMap: Record<string, number> = {};
  (customScales || []).forEach((sc: any) => {
    // Si déjà présent avec class_id précis, priorité
    if (sc.class_id === classId || !scaleMap[sc.sub_evaluation_id]) {
      scaleMap[sc.sub_evaluation_id] = Number(sc.max_score);
    }
  });

  // 5. Récupérer les évaluations et notes pour les 3 mois
  const monthIdsToFetch = [m1Month?.id, m2Month?.id, m3Month?.id].filter(Boolean);

  let evaluationsByMonth: Record<string, string[]> = {};
  if (monthIdsToFetch.length > 0) {
    const { data: evals } = await supabase
      .from("primary_evaluations")
      .select("id, primary_month_id")
      .in("primary_month_id", monthIdsToFetch);

    (evals || []).forEach((e: any) => {
      if (!evaluationsByMonth[e.primary_month_id]) evaluationsByMonth[e.primary_month_id] = [];
      evaluationsByMonth[e.primary_month_id].push(e.id);
    });
  }

  const allEvalIds = Object.values(evaluationsByMonth).flat();
  let studentGrades: { sub_evaluation_id: string; score: number; primary_evaluation_id: string }[] = [];

  if (allEvalIds.length > 0) {
    const { data: gData } = await supabase
      .from("primary_grades")
      .select("sub_evaluation_id, score, primary_evaluation_id")
      .eq("student_id", studentId)
      .in("primary_evaluation_id", allEvalIds);

    studentGrades = (gData || []).map((g: any) => ({
      sub_evaluation_id: g.sub_evaluation_id,
      score: Number(g.score),
      primary_evaluation_id: g.primary_evaluation_id,
    }));
  }

  // Helper pour trouver la note d'un élève pour une sous-éval et un mois donné
  function getScoreForMonth(subId: string, monthId?: string): number | null {
    if (!monthId) return null;
    const evalIds = evaluationsByMonth[monthId] || [];
    if (evalIds.length === 0) return null;
    const g = studentGrades.find(
      (gr) => gr.sub_evaluation_id === subId && evalIds.includes(gr.primary_evaluation_id)
    );
    return g ? g.score : null;
  }

  // ============================================================
  // PDF — Création
  // ============================================================
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Palette graphique
  const black = rgb(0, 0, 0);
  const borderGray = rgb(0.42, 0.42, 0.42);
  const lightGray = rgb(0.96, 0.96, 0.96);
  const blueNote = rgb(0.12, 0.28, 0.55);
  const white = rgb(1, 1, 1);

  // Logo centré
  let logoImage: any = null;
  try {
    const base64Data = LOGO_PRIMAIRE_BASE64.replace(/^data:image\/jpeg;base64,/, "");
    const logoBuffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    logoImage = await pdfDoc.embedJpg(logoBuffer);
  } catch (e) {
    console.warn("Logo primaire non chargé:", e);
  }

  // Photo élève
  let studentPhotoImg: any = null;
  if (student.photo_path) {
    try {
      const { data: photoBlob, error: photoErr } = await supabase.storage
        .from("student-photos")
        .download(student.photo_path);
      if (!photoErr && photoBlob) {
        const photoAB = await photoBlob.arrayBuffer();
        if (student.photo_path.toLowerCase().endsWith(".png")) {
          studentPhotoImg = await pdfDoc.embedPng(photoAB);
        } else {
          studentPhotoImg = await pdfDoc.embedJpg(photoAB);
        }
      }
    } catch (e) {
      console.warn("Photo élève non chargée:", e);
    }
  }



  // ============================================================
  // EN-TÊTE BILINGUE OFFICIEL (MFOUNDI INCLUS)
  // ============================================================
  const marginX = 20;
  const contentW = width - 40; // 555.28 pt
  const headerTopY = height - 20;

  // Colonne Gauche : Français
  page.drawText("RÉPUBLIQUE DU CAMEROUN", { x: marginX, y: headerTopY - 10, size: 7, font: fontBold, color: black });
  page.drawText("Paix – Travail – Patrie", { x: marginX + 8, y: headerTopY - 18, size: 6, font: fontItalic, color: black });
  page.drawText("MINISTÈRE DE L'ÉDUCATION DE BASE", { x: marginX, y: headerTopY - 27, size: 6.5, font: fontBold, color: black });
  page.drawText("DÉLÉGATION DÉPARTEMENTALE DU MFOUNDI", { x: marginX, y: headerTopY - 35, size: 6, font: fontBold, color: black });
  page.drawText(schoolName.toUpperCase(), { x: marginX, y: headerTopY - 44, size: 6.8, font: fontBold, color: black });

  // Logo au centre
  if (logoImage) {
    page.drawImage(logoImage, {
      x: width / 2 - 25,
      y: headerTopY - 50,
      width: 50,
      height: 50,
    });
  }

  // Colonne Droite : Anglais
  const rightX = width - marginX - 170;
  page.drawText("REPUBLIC OF CAMEROON", { x: rightX + 25, y: headerTopY - 10, size: 7, font: fontBold, color: black });
  page.drawText("Peace – Work – Fatherland", { x: rightX + 25, y: headerTopY - 18, size: 6, font: fontItalic, color: black });
  page.drawText("MINISTRY OF BASIC EDUCATION", { x: rightX + 15, y: headerTopY - 27, size: 6.5, font: fontBold, color: black });
  page.drawText("DIVISIONAL DELEGATION OF MFOUNDI", { x: rightX + 10, y: headerTopY - 35, size: 6, font: fontBold, color: black });
  page.drawText(schoolName.toUpperCase(), { x: rightX, y: headerTopY - 44, size: 6.8, font: fontBold, color: black });

  // Cadre Photo à droite
  const photoW = 42;
  const photoH = 50;
  const photoX = width - marginX - photoW;
  const photoY = headerTopY - 52;
  page.drawRectangle({
    x: photoX,
    y: photoY,
    width: photoW,
    height: photoH,
    borderColor: borderGray,
    borderWidth: 0.6,
    color: white,
  });
  if (studentPhotoImg) {
    page.drawImage(studentPhotoImg, { x: photoX + 1, y: photoY + 1, width: photoW - 2, height: photoH - 2 });
  } else {
    page.drawText("PHOTO", { x: photoX + 8, y: photoY + 22, size: 6.5, font: fontRegular, color: borderGray });
  }

  // ============================================================
  // CARTOUCHE IDENTITÉ DE L'ÉLÈVE
  // ============================================================
  const idBoxY = headerTopY - 60;
  const idBoxH = 26;
  page.drawRectangle({
    x: marginX,
    y: idBoxY - idBoxH,
    width: contentW - photoW - 6,
    height: idBoxH,
    borderColor: borderGray,
    borderWidth: 0.6,
    color: lightGray,
  });

  page.drawText(`CLASSE : ${className} (${classLevel})`, { x: marginX + 6, y: idBoxY - 10, size: 7, font: fontBold, color: black });
  page.drawText(`EFFECTIF : ${classEffectif || "—"}`, { x: marginX + 140, y: idBoxY - 10, size: 7, font: fontBold, color: black });
  page.drawText(`ANNÉE SCOLAIRE : ${schoolYearLabel}`, { x: marginX + 240, y: idBoxY - 10, size: 7, font: fontBold, color: black });
  page.drawText(`BULLETIN APC — ${termLabel}`, { x: marginX + 380, y: idBoxY - 10, size: 7, font: fontBold, color: black });

  const studentFullName = `${student.last_name || ""} ${student.first_name || ""}`.trim().toUpperCase();
  page.drawText(`NOM & PRÉNOM : ${studentFullName}`, { x: marginX + 6, y: idBoxY - 22, size: 7.5, font: fontBold, color: black });
  page.drawText(`MATRICULE : ${student.matricule || "—"}`, { x: marginX + 240, y: idBoxY - 22, size: 7, font: fontBold, color: black });
  page.drawText(`MAÎTRE(SSE) : ${teacherName}`, { x: marginX + 380, y: idBoxY - 22, size: 7, font: fontBold, color: black });

  // ============================================================
  // TABLEAU OFFICIEL DES COMPÉTENCES (8 COLONNES PRINCIPALES)
  // Structure:
  // 1: Compétences (sans titre) [145 pt]
  // 2: ÉVALUATIONS              [68 pt]
  // 3: M1 (Note [26], COTE [24]) [50 pt]
  // 4: M2 (Note [26], COTE [24]) [50 pt]
  // 5: M3 (Note [26], COTE [24]) [50 pt]
  // 6: Sur                      [24 pt]
  // 7: T1 (Note [32], COTE [26]) [58 pt]
  // 8: Niveau d'acquisition      [110 pt] (sans titre)
  // Total = 555 pt
  // ============================================================
  const tableTopY = idBoxY - idBoxH - 6;

  const w_comp = 145;
  const w_eval = 68;
  const w_m1_note = 26;
  const w_m1_cote = 24;
  const w_m2_note = 26;
  const w_m2_cote = 24;
  const w_m3_note = 26;
  const w_m3_cote = 24;
  const w_sur = 24;
  const w_t1_note = 32;
  const w_t1_cote = 26;
  const w_acq = 110;

  const colWidths = [
    w_comp,
    w_eval,
    w_m1_note, w_m1_cote,
    w_m2_note, w_m2_cote,
    w_m3_note, w_m3_cote,
    w_sur,
    w_t1_note, w_t1_cote,
    w_acq,
  ];

  const colX: number[] = [];
  let curColX = marginX;
  for (const w of colWidths) {
    colX.push(curColX);
    curColX += w;
  }
  const tableRightX = curColX;

  const thead1H = 12;
  const thead2H = 10;
  const totalTheadH = thead1H + thead2H;
  const theadBottomY = tableTopY - totalTheadH;
  const h1Y = tableTopY - thead1H;

  // Bordure globale d'en-tête (transparente pour le filigrane)
  page.drawRectangle({
    x: marginX,
    y: theadBottomY,
    width: contentW,
    height: totalTheadH,
    borderColor: borderGray,
    borderWidth: 0.6,
  });

  // Lignes horizontales séparant les 2 niveaux d'en-tête
  page.drawLine({ start: { x: colX[2], y: h1Y }, end: { x: colX[8], y: h1Y }, color: borderGray, thickness: 0.6 });
  page.drawLine({ start: { x: colX[9], y: h1Y }, end: { x: colX[11], y: h1Y }, color: borderGray, thickness: 0.6 });

  // Titres ligne 1 : M1, M2, M3, T1
  page.drawText("M1", { x: colX[2] + 18, y: h1Y + 3, size: 6.5, font: fontBold, color: black });
  page.drawText("M2", { x: colX[4] + 18, y: h1Y + 3, size: 6.5, font: fontBold, color: black });
  page.drawText("M3", { x: colX[6] + 18, y: h1Y + 3, size: 6.5, font: fontBold, color: black });
  page.drawText("T1", { x: colX[9] + 24, y: h1Y + 3, size: 6.5, font: fontBold, color: black });

  // Titres ligne 2 :
  page.drawText("ÉVALUATIONS", { x: colX[1] + 6, y: theadBottomY + 3, size: 6, font: fontBold, color: black });
  page.drawText("Note", { x: colX[2] + 4, y: theadBottomY + 3, size: 5.5, font: fontBold, color: black });
  page.drawText("COTE", { x: colX[3] + 2, y: theadBottomY + 3, size: 5.5, font: fontBold, color: black });
  page.drawText("Note", { x: colX[4] + 4, y: theadBottomY + 3, size: 5.5, font: fontBold, color: black });
  page.drawText("COTE", { x: colX[5] + 2, y: theadBottomY + 3, size: 5.5, font: fontBold, color: black });
  page.drawText("Note", { x: colX[6] + 4, y: theadBottomY + 3, size: 5.5, font: fontBold, color: black });
  page.drawText("COTE", { x: colX[7] + 2, y: theadBottomY + 3, size: 5.5, font: fontBold, color: black });
  page.drawText("Sur", { x: colX[8] + 4, y: theadBottomY + 3, size: 5.5, font: fontBold, color: black });
  page.drawText("Note", { x: colX[9] + 6, y: theadBottomY + 3, size: 5.5, font: fontBold, color: black });
  page.drawText("COTE", { x: colX[10] + 3, y: theadBottomY + 3, size: 5.5, font: fontBold, color: black });

  // Séparateurs verticaux en-tête
  page.drawLine({ start: { x: colX[1], y: tableTopY }, end: { x: colX[1], y: theadBottomY }, color: borderGray, thickness: 0.6 });
  page.drawLine({ start: { x: colX[2], y: tableTopY }, end: { x: colX[2], y: theadBottomY }, color: borderGray, thickness: 0.6 });
  page.drawLine({ start: { x: colX[3], y: h1Y }, end: { x: colX[3], y: theadBottomY }, color: borderGray, thickness: 0.6 });
  page.drawLine({ start: { x: colX[4], y: tableTopY }, end: { x: colX[4], y: theadBottomY }, color: borderGray, thickness: 0.6 });
  page.drawLine({ start: { x: colX[5], y: h1Y }, end: { x: colX[5], y: theadBottomY }, color: borderGray, thickness: 0.6 });
  page.drawLine({ start: { x: colX[6], y: tableTopY }, end: { x: colX[6], y: theadBottomY }, color: borderGray, thickness: 0.6 });
  page.drawLine({ start: { x: colX[7], y: h1Y }, end: { x: colX[7], y: theadBottomY }, color: borderGray, thickness: 0.6 });
  page.drawLine({ start: { x: colX[8], y: tableTopY }, end: { x: colX[8], y: theadBottomY }, color: borderGray, thickness: 0.6 });
  page.drawLine({ start: { x: colX[9], y: tableTopY }, end: { x: colX[9], y: theadBottomY }, color: borderGray, thickness: 0.6 });
  page.drawLine({ start: { x: colX[10], y: h1Y }, end: { x: colX[10], y: theadBottomY }, color: borderGray, thickness: 0.6 });
  page.drawLine({ start: { x: colX[11], y: tableTopY }, end: { x: colX[11], y: theadBottomY }, color: borderGray, thickness: 0.6 });

  // ============================================================
  // CORPS DU TABLEAU : LES 11 COMPÉTENCES
  // ============================================================
  let curY = theadBottomY;
  const rowH = 11.2;

  let grandTotalM1 = 0;
  let grandTotalM2 = 0;
  let grandTotalM3 = 0;
  let hasAnyM1 = false;
  let hasAnyM2 = false;
  let hasAnyM3 = false;
  let grandTotalT1 = 0;
  let grandTotalSur = 0;

  for (const comp of OFFICIAL_PRIMARY_COMPETENCES) {
    const numCrit = comp.criteria.length;
    const numRows = numCrit + 1; // critères + TOTAL
    const blockH = numRows * rowH;
    const critH = numCrit * rowH;

    const blockTopY = curY;
    const blockBottomY = curY - blockH;
    const totalRowTopY = curY - critH;

    // Fond de la ligne TOTAL
    page.drawRectangle({
      x: colX[1],
      y: blockBottomY,
      width: contentW - w_comp - w_acq,
      height: rowH,
      color: lightGray,
    });

    // 1. COLONNE 1 : NOM DE LA COMPÉTENCE (Fusionnée verticalement, transparente)
    page.drawRectangle({
      x: colX[0],
      y: blockBottomY,
      width: w_comp,
      height: blockH,
      borderColor: borderGray,
      borderWidth: 0.6,
    });

    const titleText = `${comp.code} : ${comp.name}`;
    const words = titleText.split(" ");
    let line1 = "", line2 = "", line3 = "";
    for (const w of words) {
      if ((line1 + " " + w).length <= 26) {
        line1 = line1 ? line1 + " " + w : w;
      } else if ((line2 + " " + w).length <= 26) {
        line2 = line2 ? line2 + " " + w : w;
      } else {
        line3 = line3 ? line3 + " " + w : w;
      }
    }

    const linesCount = line3 ? 3 : line2 ? 2 : 1;
    const lineSpacing = 8;
    const startTextY = blockTopY - (blockH / 2) + ((linesCount - 1) * lineSpacing / 2) - 2;

    page.drawText(line1, { x: colX[0] + 4, y: startTextY, size: 5.8, font: fontBold, color: black });
    if (line2) page.drawText(line2, { x: colX[0] + 4, y: startTextY - lineSpacing, size: 5.8, font: fontBold, color: black });
    if (line3) page.drawText(line3, { x: colX[0] + 4, y: startTextY - lineSpacing * 2, size: 5.8, font: fontBold, color: black });

    // Calculs de somme
    let sumM1 = 0, sumM2 = 0, sumM3 = 0;
    let hasM1 = false, hasM2 = false, hasM3 = false;
    let sumSur = 0, sumT1 = 0;

    for (let i = 0; i < numCrit; i++) {
      const crit = comp.criteria[i];
      const rY = blockTopY - (i + 1) * rowH;

      // Récupérer barème personnalisé ou défaut
      const maxScore = scaleMap[crit.subCode || ""] || crit.defaultMax;
      sumSur += maxScore;

      // Notes réelles ou nulles
      const m1Score = getScoreForMonth(crit.subCode || "", m1Month?.id);
      const m2Score = getScoreForMonth(crit.subCode || "", m2Month?.id);
      const m3Score = getScoreForMonth(crit.subCode || "", m3Month?.id);

      if (m1Score !== null) { sumM1 += m1Score; hasM1 = true; grandTotalM1 += m1Score; hasAnyM1 = true; }
      if (m2Score !== null) { sumM2 += m2Score; hasM2 = true; grandTotalM2 += m2Score; hasAnyM2 = true; }
      if (m3Score !== null) { sumM3 += m3Score; hasM3 = true; grandTotalM3 += m3Score; hasAnyM3 = true; }

      // Calcul moyenne trimestrielle T1 par critère
      const evaluatedMonths = [m1Score, m2Score, m3Score].filter((s) => s !== null) as number[];
      const avgT1 = evaluatedMonths.length > 0
        ? evaluatedMonths.reduce((a, b) => a + b, 0) / evaluatedMonths.length
        : null;

      if (avgT1 !== null) sumT1 += avgT1;

      // Affichage critère
      page.drawText(crit.label, { x: colX[1] + 4, y: rY + 3, size: 6, font: fontRegular, color: black });
      page.drawText(fmtNum(m1Score), { x: colX[2] + 4, y: rY + 3, size: 6, font: fontRegular, color: blueNote });
      page.drawText(fmtNum(m2Score), { x: colX[4] + 4, y: rY + 3, size: 6, font: fontRegular, color: blueNote });
      page.drawText(fmtNum(m3Score), { x: colX[6] + 4, y: rY + 3, size: 6, font: fontRegular, color: blueNote });
      page.drawText(`${maxScore}`, { x: colX[8] + 6, y: rY + 3, size: 6, font: fontRegular, color: black });
      page.drawText(fmtNum(avgT1), { x: colX[9] + 6, y: rY + 3, size: 6, font: fontBold, color: blueNote });

      // Séparateurs horizontaux de critères
      page.drawLine({ start: { x: colX[1], y: rY }, end: { x: colX[3], y: rY }, color: borderGray, thickness: 0.35 });
      page.drawLine({ start: { x: colX[4], y: rY }, end: { x: colX[5], y: rY }, color: borderGray, thickness: 0.35 });
      page.drawLine({ start: { x: colX[6], y: rY }, end: { x: colX[7], y: rY }, color: borderGray, thickness: 0.35 });
      page.drawLine({ start: { x: colX[8], y: rY }, end: { x: colX[10], y: rY }, color: borderGray, thickness: 0.35 });
    }

    // Cotes
    const coteM1 = hasM1 ? calcApcCote(sumM1, sumSur) : "—";
    const coteM2 = hasM2 ? calcApcCote(sumM2, sumSur) : "—";
    const coteM3 = hasM3 ? calcApcCote(sumM3, sumSur) : "—";
    const coteT1 = sumT1 > 0 ? calcApcCote(sumT1, sumSur) : "—";
    const acqNiveau = calcApcNiveauAcquisition(coteT1);

    grandTotalT1 += sumT1;
    grandTotalSur += sumSur;

    // 2. SOUS-COLONNES COTE (Fusionnées verticalement sur les critères, transparentes)
    const coteCenterY = blockTopY - critH / 2 - 2;

    page.drawRectangle({ x: colX[3], y: totalRowTopY, width: w_m1_cote, height: critH, borderColor: borderGray, borderWidth: 0.6 });
    page.drawText(coteM1, { x: colX[3] + (w_m1_cote - coteM1.length * 4.5) / 2, y: coteCenterY, size: 7, font: fontBold, color: black });

    page.drawRectangle({ x: colX[5], y: totalRowTopY, width: w_m2_cote, height: critH, borderColor: borderGray, borderWidth: 0.6 });
    page.drawText(coteM2, { x: colX[5] + (w_m2_cote - coteM2.length * 4.5) / 2, y: coteCenterY, size: 7, font: fontBold, color: black });

    page.drawRectangle({ x: colX[7], y: totalRowTopY, width: w_m3_cote, height: critH, borderColor: borderGray, borderWidth: 0.6 });
    page.drawText(coteM3, { x: colX[7] + (w_m3_cote - coteM3.length * 4.5) / 2, y: coteCenterY, size: 7, font: fontBold, color: black });

    page.drawRectangle({ x: colX[10], y: totalRowTopY, width: w_t1_cote, height: critH, borderColor: borderGray, borderWidth: 0.6 });
    page.drawText(coteT1, { x: colX[10] + (w_t1_cote - coteT1.length * 4.5) / 2, y: coteCenterY, size: 7, font: fontBold, color: black });

    // 3. LIGNE TOTAL
    const totY = blockBottomY + 3;
    page.drawText("TOTAL", { x: colX[1] + 4, y: totY, size: 6.2, font: fontBold, color: black });
    page.drawText(hasM1 ? fmtNum(sumM1) : "—", { x: colX[2] + 4, y: totY, size: 6.2, font: fontBold, color: blueNote });
    page.drawText(hasM2 ? fmtNum(sumM2) : "—", { x: colX[4] + 4, y: totY, size: 6.2, font: fontBold, color: blueNote });
    page.drawText(hasM3 ? fmtNum(sumM3) : "—", { x: colX[6] + 4, y: totY, size: 6.2, font: fontBold, color: blueNote });
    page.drawText(`${sumSur}`, { x: colX[8] + 6, y: totY, size: 6.2, font: fontBold, color: black });
    page.drawText(sumT1 > 0 ? fmtNum(sumT1) : "—", { x: colX[9] + 6, y: totY, size: 6.2, font: fontBold, color: blueNote });

    // 4. COLONNE NIVEAU D'ACQUISITION (Fusionnée sur tout le bloc, transparente)
    page.drawRectangle({ x: colX[11], y: blockBottomY, width: w_acq, height: blockH, borderColor: borderGray, borderWidth: 0.6 });
    const acqCenterY = blockTopY - blockH / 2 - 2;
    page.drawText(acqNiveau, { x: colX[11] + 10, y: acqCenterY, size: 6.8, font: fontBold, color: black });

    // Séparateurs verticaux
    for (let c = 1; c <= 11; c++) {
      page.drawLine({ start: { x: colX[c], y: blockTopY }, end: { x: colX[c], y: blockBottomY }, color: borderGray, thickness: 0.6 });
    }
    page.drawLine({ start: { x: tableRightX, y: blockTopY }, end: { x: tableRightX, y: blockBottomY }, color: borderGray, thickness: 0.6 });

    // Séparateur horizontal de fin de compétence
    page.drawLine({ start: { x: marginX, y: blockBottomY }, end: { x: tableRightX, y: blockBottomY }, color: borderGray, thickness: 0.8 });

    curY = blockBottomY;
  }

  // ============================================================
  // CALCUL DES RANGS DE CLASSE (M1, M2, M3, T1)
  // ============================================================
  let rankM1 = "-";
  let rankM2 = "-";
  let rankM3 = "-";
  let rankT1 = "-";

  if (allEvalIds.length > 0) {
    try {
      const { data: allClassGrades } = await supabase
        .from("primary_grades")
        .select("student_id, primary_evaluation_id, score")
        .in("primary_evaluation_id", allEvalIds);

      const m1EvalIds = evaluationsByMonth[m1Month?.id || ""] || [];
      const m2EvalIds = evaluationsByMonth[m2Month?.id || ""] || [];
      const m3EvalIds = evaluationsByMonth[m3Month?.id || ""] || [];

      const studentTotals: Record<string, { m1: number; m2: number; m3: number; countM1: number; countM2: number; countM3: number }> = {};
      (allClassGrades || []).forEach((g: any) => {
        const sId = g.student_id;
        if (!studentTotals[sId]) studentTotals[sId] = { m1: 0, m2: 0, m3: 0, countM1: 0, countM2: 0, countM3: 0 };
        const score = Number(g.score) || 0;
        const eId = g.primary_evaluation_id;
        if (m1EvalIds.includes(eId)) {
          studentTotals[sId].m1 += score;
          studentTotals[sId].countM1++;
        } else if (m2EvalIds.includes(eId)) {
          studentTotals[sId].m2 += score;
          studentTotals[sId].countM2++;
        } else if (m3EvalIds.includes(eId)) {
          studentTotals[sId].m3 += score;
          studentTotals[sId].countM3++;
        }
      });

      const getRank = (key: "m1" | "m2" | "m3" | "t1") => {
        const entries = Object.entries(studentTotals).map(([id, st]) => {
          let val = 0;
          let hasVal = false;
          if (key === "m1" && st.countM1 > 0) { val = st.m1; hasVal = true; }
          else if (key === "m2" && st.countM2 > 0) { val = st.m2; hasVal = true; }
          else if (key === "m3" && st.countM3 > 0) { val = st.m3; hasVal = true; }
          else if (key === "t1") {
            const sum = (st.countM1 > 0 ? st.m1 : 0) + (st.countM2 > 0 ? st.m2 : 0) + (st.countM3 > 0 ? st.m3 : 0);
            const count = (st.countM1 > 0 ? 1 : 0) + (st.countM2 > 0 ? 1 : 0) + (st.countM3 > 0 ? 1 : 0);
            if (count > 0) { val = sum / count; hasVal = true; }
          }
          return { id, val, hasVal };
        }).filter(e => e.hasVal);

        entries.sort((a, b) => b.val - a.val);
        const idx = entries.findIndex(e => e.id === studentId);
        return idx >= 0 ? `${idx + 1}` : "-";
      };

      rankM1 = getRank("m1");
      rankM2 = getRank("m2");
      rankM3 = getRank("m3");
      rankT1 = getRank("t1");
    } catch (e) {
      console.warn("Calcul rangs primaire non disponible:", e);
    }
  }

  // ============================================================
  // BAS DU BULLETIN : LÉGENDE, TOTAL, MOYENNE, RANG & SIGNATURES
  // ============================================================
  const botTopY = curY - 10;

  // 1. À GAUCHE : LÉGENDE DES NIVEAUX D'ACQUISITION
  const legX = marginX + 2;
  const legY = botTopY;

  const colAplus = black;
  const colA = rgb(0.08, 0.35, 0.75); // Bleu
  const colEca = rgb(0.78, 0.45, 0.1); // Orange / marron
  const colNa = rgb(0.8, 0.15, 0.15); // Rouge

  page.drawText("N >= 90.0%", { x: legX, y: legY, size: 5.5, font: fontRegular, color: black });
  page.drawText("A+", { x: legX + 38, y: legY, size: 5.8, font: fontBold, color: colAplus });
  page.drawText("Expert", { x: legX + 56, y: legY, size: 5.5, font: fontRegular, color: black });

  page.drawText("N >= 75.0%", { x: legX, y: legY - 9, size: 5.5, font: fontRegular, color: black });
  page.drawText("A", { x: legX + 38, y: legY - 9, size: 5.8, font: fontBold, color: colA });
  page.drawText("Acquis", { x: legX + 56, y: legY - 9, size: 5.5, font: fontRegular, color: black });

  page.drawText("N >= 50.0%", { x: legX, y: legY - 18, size: 5.5, font: fontRegular, color: black });
  page.drawText("ECA", { x: legX + 38, y: legY - 18, size: 5.8, font: fontBold, color: colEca });
  page.drawText("En cours d'acquisition", { x: legX + 56, y: legY - 18, size: 5.5, font: fontRegular, color: black });

  page.drawText("N >= 0.0%", { x: legX, y: legY - 27, size: 5.5, font: fontRegular, color: black });
  page.drawText("NA", { x: legX + 38, y: legY - 27, size: 5.8, font: fontBold, color: colNa });
  page.drawText("Non acquis", { x: legX + 56, y: legY - 27, size: 5.5, font: fontRegular, color: black });

  page.drawText("(N = Note en pourcentage)", { x: legX, y: legY - 36, size: 5, font: fontItalic, color: borderGray });

  // 2. AU CENTRE : STATISTIQUES (TOTAL, MOYENNE, RANG)
  const valTotM1 = hasAnyM1 ? fmtNum(grandTotalM1) : "-";
  const valTotM2 = hasAnyM2 ? fmtNum(grandTotalM2) : "-";
  const valTotM3 = hasAnyM3 ? fmtNum(grandTotalM3) : "-";
  const valTotSur = grandTotalSur > 0 ? `${grandTotalSur}` : "-";
  const valTotT1 = grandTotalT1 > 0 ? fmtNum(grandTotalT1) : "-";

  // Moyennes ramenées sur 20
  const moyM1Num = hasAnyM1 && grandTotalSur > 0 ? (grandTotalM1 / grandTotalSur) * 20 : null;
  const moyM2Num = hasAnyM2 && grandTotalSur > 0 ? (grandTotalM2 / grandTotalSur) * 20 : null;
  const moyM3Num = hasAnyM3 && grandTotalSur > 0 ? (grandTotalM3 / grandTotalSur) * 20 : null;
  const moyT1Num = grandTotalT1 > 0 && grandTotalSur > 0 ? (grandTotalT1 / grandTotalSur) * 20 : null;

  const valMoyM1 = moyM1Num !== null ? moyM1Num.toFixed(2).replace(".", ",") : "-";
  const valMoyM2 = moyM2Num !== null ? moyM2Num.toFixed(2).replace(".", ",") : "-";
  const valMoyM3 = moyM3Num !== null ? moyM3Num.toFixed(2).replace(".", ",") : "-";
  const valMoyT1 = moyT1Num !== null ? moyT1Num.toFixed(2).replace(".", ",") : "-";

  const wBlockM1 = w_m1_note + w_m1_cote; // 50 pt
  const wBlockM2 = w_m2_note + w_m2_cote; // 50 pt
  const wBlockM3 = w_m3_note + w_m3_cote; // 50 pt
  const wBlockT1 = w_t1_note + w_t1_cote; // 58 pt

  // LIGNE 1 : TOTAL
  const yTotal = legY;
  page.drawText("TOTAL", { x: colX[1] + 6, y: yTotal, size: 7, font: fontBold, color: black });

  const xTotM1 = colX[2] + (wBlockM1 - fontBold.widthOfTextAtSize(valTotM1, 7)) / 2;
  page.drawText(valTotM1, { x: xTotM1, y: yTotal, size: 7, font: fontBold, color: black });

  const xTotM2 = colX[4] + (wBlockM2 - fontBold.widthOfTextAtSize(valTotM2, 7)) / 2;
  page.drawText(valTotM2, { x: xTotM2, y: yTotal, size: 7, font: fontBold, color: black });

  const xTotM3 = colX[6] + (wBlockM3 - fontBold.widthOfTextAtSize(valTotM3, 7)) / 2;
  page.drawText(valTotM3, { x: xTotM3, y: yTotal, size: 7, font: fontBold, color: black });

  const xTotSur = colX[8] + (w_sur - fontBold.widthOfTextAtSize(valTotSur, 7)) / 2;
  page.drawText(valTotSur, { x: xTotSur, y: yTotal, size: 7, font: fontBold, color: black });

  const xTotT1 = colX[9] + (wBlockT1 - fontBold.widthOfTextAtSize(valTotT1, 7)) / 2;
  page.drawText(valTotT1, { x: xTotT1, y: yTotal, size: 7, font: fontBold, color: black });

  // Dimensions des boîtes
  const statBoxW = 34;
  const statBoxH = 11;
  const t1BoxW = 38;

  // LIGNE 2 : MOYENNE
  const yMoy = legY - 14;
  page.drawText("Moyenne", { x: colX[1] + 6, y: yMoy + 2.5, size: 6.8, font: fontRegular, color: black });

  const xBoxM1 = colX[2] + (wBlockM1 - statBoxW) / 2;
  page.drawRectangle({
    x: xBoxM1,
    y: yMoy,
    width: statBoxW,
    height: statBoxH,
    borderColor: borderGray,
    borderWidth: 0.7,
    color: white,
  });
  const xTxtMoyM1 = xBoxM1 + (statBoxW - fontBold.widthOfTextAtSize(valMoyM1, 6.8)) / 2;
  page.drawText(valMoyM1, { x: xTxtMoyM1, y: yMoy + 3, size: 6.8, font: fontBold, color: blueNote });

  const xBoxM2 = colX[4] + (wBlockM2 - statBoxW) / 2;
  page.drawRectangle({
    x: xBoxM2,
    y: yMoy,
    width: statBoxW,
    height: statBoxH,
    borderColor: borderGray,
    borderWidth: 0.7,
    color: white,
  });
  const xTxtMoyM2 = xBoxM2 + (statBoxW - fontBold.widthOfTextAtSize(valMoyM2, 6.8)) / 2;
  page.drawText(valMoyM2, { x: xTxtMoyM2, y: yMoy + 3, size: 6.8, font: fontBold, color: blueNote });

  const xBoxM3 = colX[6] + (wBlockM3 - statBoxW) / 2;
  page.drawRectangle({
    x: xBoxM3,
    y: yMoy,
    width: statBoxW,
    height: statBoxH,
    borderColor: borderGray,
    borderWidth: 0.7,
    color: white,
  });
  const xTxtMoyM3 = xBoxM3 + (statBoxW - fontBold.widthOfTextAtSize(valMoyM3, 6.8)) / 2;
  page.drawText(valMoyM3, { x: xTxtMoyM3, y: yMoy + 3, size: 6.8, font: fontBold, color: blueNote });

  const xBoxT1 = colX[9] + (wBlockT1 - t1BoxW) / 2;
  page.drawRectangle({
    x: xBoxT1,
    y: yMoy,
    width: t1BoxW,
    height: statBoxH,
    borderColor: borderGray,
    borderWidth: 0.8,
    color: white,
  });
  const xTxtMoyT1 = xBoxT1 + (t1BoxW - fontBold.widthOfTextAtSize(valMoyT1, 7.2)) / 2;
  page.drawText(valMoyT1, { x: xTxtMoyT1, y: yMoy + 3, size: 7.2, font: fontBold, color: blueNote });

  // LIGNE 3 : RANG
  const yRang = legY - 28;
  page.drawText("Rang", { x: colX[1] + 6, y: yRang + 2.5, size: 6.8, font: fontRegular, color: black });

  function drawRankCell(bx: number, by: number, bw: number, bh: number, rankStr: string) {
    page.drawRectangle({
      x: bx,
      y: by,
      width: bw,
      height: bh,
      borderColor: borderGray,
      borderWidth: 0.7,
      color: white,
    });
    if (rankStr === "-") {
      const numW = fontBold.widthOfTextAtSize("-", 6.8);
      page.drawText("-", { x: bx + (bw - numW) / 2, y: by + 3, size: 6.8, font: fontBold, color: black });
    } else {
      const numW = fontBold.widthOfTextAtSize(rankStr, 6.8);
      const startX = bx + (bw - (numW + 4)) / 2;
      page.drawText(rankStr, { x: startX, y: by + 3, size: 6.8, font: fontBold, color: black });
      page.drawCircle({
        x: startX + numW + 2,
        y: by + 7.5,
        size: 1.2,
        borderColor: black,
        borderWidth: 0.6,
        color: white,
      });
    }
  }

  drawRankCell(xBoxM1, yRang, statBoxW, statBoxH, rankM1);
  drawRankCell(xBoxM2, yRang, statBoxW, statBoxH, rankM2);
  drawRankCell(xBoxM3, yRang, statBoxW, statBoxH, rankM3);
  drawRankCell(xBoxT1, yRang, t1BoxW, statBoxH, rankT1);

  // 3. À DROITE : GRAND CADRE DE COTE GLOBALE TRIMESTRIELLE
  const coteGlobale = calcApcCote(grandTotalT1, grandTotalSur);
  const grandBoxW = w_acq;
  const grandBoxH = (yMoy + statBoxH) - yRang;
  const grandBoxY = yRang;

  page.drawRectangle({
    x: colX[11],
    y: grandBoxY,
    width: grandBoxW,
    height: grandBoxH,
    borderColor: borderGray,
    borderWidth: 0.8,
    color: white,
  });

  page.drawText(coteGlobale, {
    x: colX[11] + (grandBoxW - fontBold.widthOfTextAtSize(coteGlobale, 15)) / 2,
    y: grandBoxY + (grandBoxH - 12) / 2,
    size: 15,
    font: fontBold,
    color: black,
  });

  // ============================================================
  // 4. SIGNATURES : LE PARENT, L'ENSEIGNANT, LA DIRECTRICE
  // ============================================================
  const sigY = yRang - 18;
  const frMonths = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  const now = new Date();
  const dateStr = `${schoolCity}, le ${now.getDate()} ${frMonths[now.getMonth()]} ${now.getFullYear()}`;

  // Le Parent (gauche)
  page.drawText("Le Parent", { x: marginX + 15, y: sigY, size: 7.5, font: fontBold, color: black });

  // L'Enseignant (centre)
  page.drawText(`L'Enseignant(e)`, { x: marginX + 148, y: sigY, size: 7.5, font: fontBold, color: black });
  if (teacherName && teacherName !== "—") {
    page.drawText(teacherName, { x: marginX + 148, y: sigY - 10, size: 6.5, font: fontItalic, color: borderGray });
  }

  // Date et La Directrice (droite)
  const dirCenterX = width - marginX - 110;
  page.drawText(dateStr, {
    x: dirCenterX - fontBold.widthOfTextAtSize(dateStr, 7) / 2,
    y: sigY + 8,
    size: 7,
    font: fontRegular,
    color: black,
  });
  page.drawText(directorLabel, {
    x: dirCenterX - fontBold.widthOfTextAtSize(directorLabel, 7.5) / 2,
    y: sigY - 2,
    size: 7.5,
    font: fontBold,
    color: black,
  });

  // ============================================================
  // FILIGRANE CENTRAL DU LOGO (DESSINÉ SUR LA ZONE DU TABLEAU)
  // ============================================================
  if (logoImage) {
    const wmSize = 260;
    page.drawImage(logoImage, {
      x: width / 2 - wmSize / 2,
      y: (tableTopY + curY) / 2 - wmSize / 2 + 10,
      width: wmSize,
      height: wmSize,
      opacity: 0.10,
    });
  }

  // 5. Pied de page discret
  const footY = 12;
  const studentFootInfo = `${schoolName} / ${schoolYearLabel} / ${className} / ${termLabel} / ${student.last_name} ${student.first_name}`;
  page.drawText(studentFootInfo, {
    x: marginX,
    y: footY,
    size: 5.5,
    font: fontRegular,
    color: borderGray,
  });

  return await pdfDoc.save();
}

/**
 * Sauvegarde et génère le bulletin primaire
 */
export async function generateAndSavePrimaryBulletin(
  options: PrimaryBulletinOptions
): Promise<{ pdfPath: string }> {
  const { studentId, periodId, periodType } = options;

  const pdfBytes = await createPrimaryBulletinPdfBuffer(studentId, periodId, periodType);

  const storageRelativePath = `primaire/${periodType}/${periodId}/${studentId}.pdf`;

  const { error: uploadErr } = await supabase.storage
    .from("bulletins")
    .upload(storageRelativePath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadErr) throw new Error(`Échec upload bulletin primaire: ${uploadErr.message}`);

  const { error: dbErr } = await supabase
    .from("primary_bulletin_generations")
    .upsert(
      {
        student_id: studentId,
        period_id: periodId,
        period_type: periodType,
        pdf_path: storageRelativePath,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "student_id,period_id,period_type" }
    );

  if (dbErr) {
    console.error("Erreur enregistrement bulletin primaire:", dbErr);
    throw new Error(`Échec enregistrement du bulletin en base: ${dbErr.message}`);
  }

  return { pdfPath: storageRelativePath };
}

/**
 * Récupère l'URL signée du PDF
 */
export async function getPrimaryBulletinSignedUrl(pdfPath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("bulletins")
    .createSignedUrl(pdfPath, 3600);

  if (error || !data?.signedUrl) {
    throw new Error(`Impossible de générer l'URL signée: ${error?.message || "Inconnue"}`);
  }

  return data.signedUrl;
}

/**
 * Liste les mois du primaire
 */
export async function listPrimaryMonths(
  schoolYearId?: string
): Promise<{ id: string; label: string; order_index: number; term_id: string; termLabel?: string }[]> {
  let query = supabase
    .from("primary_months")
    .select("id, label, order_index, term_id, terms(label)")
    .order("order_index", { ascending: true });

  if (schoolYearId) {
    query = query.eq("school_year_id", schoolYearId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((m: any) => ({
    id: m.id,
    label: m.label,
    order_index: m.order_index,
    term_id: m.term_id,
    termLabel: m.terms?.label || "",
  }));
}
