import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });
import * as fs from 'fs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { LOGO_PRIMAIRE_BASE64 } from './packages/shared/assets/logoPrimaireBase64.ts';

// Modèle de définition des 11 compétences APC avec critères et barèmes officiels
export interface CompetenceModel {
  code: string;
  fullName: string;
  criteria: {
    label: string;
    max: number;
    m1: number;
    m2: number;
    m3: number;
  }[];
}

export const SAMPLE_COMPETENCES: CompetenceModel[] = [
  {
    code: "COMPÉTENCES 1A",
    fullName: "COMMUNIQUER EN FRANÇAIS",
    criteria: [
      { label: "1 : Orale", max: 20, m1: 17, m2: 17, m3: 15 },
      { label: "2 : Écrite", max: 15, m1: 14, m2: 13, m3: 14 },
      { label: "3 : Savoir-être", max: 5, m1: 5, m2: 4, m3: 5 },
    ],
  },
  {
    code: "COMPÉTENCES 1B",
    fullName: "COMMUNIQUER EN ANGLAIS",
    criteria: [
      { label: "1 : Oral", max: 20, m1: 15, m2: 9, m3: 10 },
      { label: "2 : Written", max: 15, m1: 13, m2: 9, m3: 15 },
      { label: "3 : Attitude", max: 5, m1: 4, m2: 3, m3: 5 },
    ],
  },
  {
    code: "COMPÉTENCES 1C",
    fullName: "PRATIQUER UNE LANGUE NATIONALE",
    criteria: [
      { label: "1 : Orale", max: 10, m1: 7, m2: 5, m3: 8 },
      { label: "2 : Écrite", max: 5, m1: 1, m2: 0, m3: 5 },
      { label: "3 : Pratique", max: 3, m1: 2, m2: 1, m3: 1 },
      { label: "4 : Savoir-être", max: 2, m1: 2, m2: 1, m3: 2 },
    ],
  },
  {
    code: "COMPÉTENCES 2A",
    fullName: "UTILISER LES NOTIONS DE BASE EN MATHÉMATIQUES",
    criteria: [
      { label: "1 : Orale", max: 5, m1: 5, m2: 4, m3: 4 },
      { label: "2 : Écrite", max: 20, m1: 16, m2: 19, m3: 17 },
      { label: "3 : Savoir-être", max: 5, m1: 5, m2: 4, m3: 5 },
    ],
  },
  {
    code: "COMPÉTENCES 2B",
    fullName: "UTILISER LES NOTIONS DE BASE EN SCIENCES ET TECHNOLOGIES",
    criteria: [
      { label: "1 : Orale", max: 5, m1: 4, m2: 4, m3: 4 },
      { label: "2 : Écrite", max: 5, m1: 4, m2: 5, m3: 4 },
      { label: "3 : Pratique", max: 15, m1: 14, m2: 13, m3: 14 },
      { label: "4 : Savoir-être", max: 5, m1: 4, m2: 4, m3: 5 },
    ],
  },
  {
    code: "COMPÉTENCES 3B",
    fullName: "PRATIQUER LES VALEURS CITOYENNES",
    criteria: [
      { label: "1 : Orale", max: 5, m1: 4, m2: 5, m3: 4 },
      { label: "2 : Écrite", max: 5, m1: 5, m2: 3, m3: 5 },
      { label: "3 : Pratique", max: 8, m1: 7, m2: 7, m3: 8 },
      { label: "4 : Savoir-être", max: 2, m1: 2, m2: 2, m3: 2 },
    ],
  },
  {
    code: "COMPÉTENCES 4",
    fullName: "DÉMONTRER L'AUTONOMIE, L'ESPRIT D'INITIATIVE, DE CRÉATIVITÉ ET D'ENTREPRENEURIAT",
    criteria: [
      { label: "1 : Orale", max: 5, m1: 4, m2: 2, m3: 4 },
      { label: "2 : Écrite", max: 3, m1: 3, m2: 2, m3: 3 },
      { label: "3 : Pratique", max: 10, m1: 7, m2: 10, m3: 10 },
      { label: "4 : Savoir-être", max: 2, m1: 2, m2: 2, m3: 2 },
    ],
  },
  {
    code: "COMPÉTENCES 5",
    fullName: "UTILISER LES CONCEPTS DE BASE ET LES OUTILS DES TIC",
    criteria: [
      { label: "1 : Orale", max: 3, m1: 3, m2: 3, m3: 2 },
      { label: "2 : Écrite", max: 3, m1: 3, m2: 3, m3: 3 },
      { label: "3 : Pratique", max: 10, m1: 10, m2: 10, m3: 10 },
      { label: "4 : Savoir-être", max: 4, m1: 4, m2: 4, m3: 4 },
    ],
  },
  {
    code: "COMPÉTENCES 6A1",
    fullName: "PRATIQUER LES ACTIVITÉS PHYSIQUES ET SPORTIVES POUR LES APPRENANTS APTES",
    criteria: [
      { label: "1 : Orale", max: 3, m1: 3, m2: 2, m3: 3 },
      { label: "2 : Écrite", max: 3, m1: 3, m2: 3, m3: 2 },
      { label: "3 : Pratique", max: 10, m1: 8, m2: 6, m3: 9 },
      { label: "4 : Savoir-être", max: 4, m1: 4, m2: 3, m3: 4 },
    ],
  },
  {
    code: "COMPÉTENCES 6B",
    fullName: "PRATIQUER LES ACTIVITÉS ARTISTIQUES",
    criteria: [
      { label: "1 : Orale", max: 4, m1: 4, m2: 4, m3: 3 },
      { label: "2 : Écrite", max: 3, m1: 1, m2: 3, m3: 3 },
      { label: "3 : Pratique", max: 10, m1: 4, m2: 7, m3: 7 },
      { label: "4 : Savoir-être", max: 3, m1: 2, m2: 2, m3: 3 },
    ],
  },
  {
    code: "COMPÉTENCES 6A2",
    fullName: "LEADERSHIP & BON CARACTÈRE",
    criteria: [
      { label: "1 : Orale", max: 6, m1: 6, m2: 5, m3: 6 },
      { label: "2 : Écrite", max: 12, m1: 11, m2: 12, m3: 11 },
      { label: "3 : Savoir-être", max: 2, m1: 2, m2: 2, m3: 2 },
    ],
  },
];

function calcCote(score: number, max: number): string {
  if (max <= 0) return "—";
  const pct = (score / max) * 100;
  if (pct >= 90) return "A+";
  if (pct >= 75) return "A";
  if (pct >= 50) return "ECA";
  return "NA";
}

function calcNiveauAcquisition(cote: string): string {
  switch (cote) {
    case "A+": return "Expert";
    case "A": return "Acquis";
    case "ECA": return "En cours d'acquisition";
    case "NA": return "Non acquis";
    default: return "—";
  }
}

function fmtNum(n: number, padZero = true): string {
  const s = n.toFixed(2);
  const parts = s.split(".");
  const intPart = padZero && parts[0].length === 1 ? "0" + parts[0] : parts[0];
  return `${intPart},${parts[1]}`;
}

function wrapText(text: string, maxWidth: number, font: any, size: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, size);
    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// ============================================================
// PARAMÈTRES CONFIGURABLES (modifiez selon votre établissement)
// ============================================================
export const PREVIEW_CONFIG = {
  schoolName: "CENTRE ÉDUCATIF TYRANNUS",
  schoolNameEn: "TYRANNUS EDUCATIONAL CENTER",
  city: "Yaoundé",
  className: "CP (Niveau 1)",
  effectif: "25",
  schoolYear: "2025 - 2026",
  term: "TRIMESTRE 1",
  studentName: "ENGOME EBOA Ida Grâce-Divine",
  matricule: "2025-CP-0142",
  teacherName: "Mme TCHUENTE",
  directorLabel: "La Directrice",
};

export async function generateTestBulletin(): Promise<string> {
  console.log("--> Génération du bulletin primaire selon le modèle officiel complet...");

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Palette officielle sobre et nette
  const black = rgb(0, 0, 0);
  const borderGray = rgb(0.4, 0.4, 0.4);
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
    console.warn("Logo non chargé:", e);
  }

  // ============================================================
  // EN-TÊTE OFFICIEL BILINGUE
  // ============================================================
  const marginX = 20;
  const contentW = width - 40; // 555.28 pt
  const headerTopY = height - 20;

  // Photo élève à l'extrême droite
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
  page.drawText("PHOTO", { x: photoX + 8, y: photoY + 22, size: 6.5, font: fontRegular, color: borderGray });

  // Colonne Gauche : Français
  page.drawText("RÉPUBLIQUE DU CAMEROUN", { x: marginX, y: headerTopY - 10, size: 7, font: fontBold, color: black });
  page.drawText("Paix – Travail – Patrie", { x: marginX + 8, y: headerTopY - 18, size: 6, font: fontItalic, color: black });
  page.drawText("MINISTÈRE DE L'ÉDUCATION DE BASE", { x: marginX, y: headerTopY - 27, size: 6.5, font: fontBold, color: black });
  page.drawText("DÉLÉGATION DÉPARTEMENTALE DU MFOUNDI", { x: marginX, y: headerTopY - 35, size: 6, font: fontBold, color: black });
  page.drawText(PREVIEW_CONFIG.schoolName, { x: marginX, y: headerTopY - 44, size: 7, font: fontBold, color: black });

  // Logo au centre
  if (logoImage) {
    page.drawImage(logoImage, {
      x: width / 2 - 25,
      y: headerTopY - 50,
      width: 50,
      height: 50,
    });
  }

  // Colonne Droite : Anglais (calée à gauche de la photo)
  const rightColWidth = 175;
  const rightX = photoX - 8 - rightColWidth;
  page.drawText("REPUBLIC OF CAMEROON", { x: rightX + 25, y: headerTopY - 10, size: 7, font: fontBold, color: black });
  page.drawText("Peace – Work – Fatherland", { x: rightX + 25, y: headerTopY - 18, size: 6, font: fontItalic, color: black });
  page.drawText("MINISTRY OF BASIC EDUCATION", { x: rightX + 15, y: headerTopY - 27, size: 6.5, font: fontBold, color: black });
  page.drawText("DIVISIONAL DELEGATION OF MFOUNDI", { x: rightX + 10, y: headerTopY - 35, size: 6, font: fontBold, color: black });
  page.drawText(PREVIEW_CONFIG.schoolNameEn, { x: rightX + 15, y: headerTopY - 44, size: 6.8, font: fontBold, color: black });

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

  page.drawText(`CLASSE : ${PREVIEW_CONFIG.className}`, { x: marginX + 6, y: idBoxY - 10, size: 7, font: fontBold, color: black });
  page.drawText(`EFFECTIF : ${PREVIEW_CONFIG.effectif}`, { x: marginX + 130, y: idBoxY - 10, size: 7, font: fontBold, color: black });
  page.drawText(`ANNÉE SCOLAIRE : ${PREVIEW_CONFIG.schoolYear}`, { x: marginX + 225, y: idBoxY - 10, size: 7, font: fontBold, color: black });
  page.drawText(`BULLETIN APC — ${PREVIEW_CONFIG.term}`, { x: marginX + 370, y: idBoxY - 10, size: 7, font: fontBold, color: black });

  page.drawText(`NOM & PRÉNOM : ${PREVIEW_CONFIG.studentName}`, { x: marginX + 6, y: idBoxY - 22, size: 7.5, font: fontBold, color: black });
  page.drawText(`MATRICULE : ${PREVIEW_CONFIG.matricule}`, { x: marginX + 225, y: idBoxY - 22, size: 7, font: fontBold, color: black });
  page.drawText(`MAÎTRE(SSE) : ${PREVIEW_CONFIG.teacherName}`, { x: marginX + 370, y: idBoxY - 22, size: 7, font: fontBold, color: black });

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
  // Total = 145 + 68 + 50 + 50 + 50 + 24 + 58 + 110 = 555 pt (contentW = 555.28 pt)
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

  // Hauteur des lignes d'en-tête (2 niveaux)
  const thead1H = 12; // Ligne 1: M1, M2, M3, T1
  const thead2H = 10; // Ligne 2: ÉVALUATIONS, Note, COTE, Sur...
  const totalTheadH = thead1H + thead2H;

  const theadBottomY = tableTopY - totalTheadH;

  // Ligne 1 d'en-tête
  const h1Y = tableTopY - thead1H;

  // Tracer la bordure d'en-tête (sans fond blanc opaque pour laisser transparaître le filigrane)
  page.drawRectangle({
    x: marginX,
    y: theadBottomY,
    width: contentW,
    height: totalTheadH,
    borderColor: borderGray,
    borderWidth: 0.6,
  });

  // Ligne horizontale séparant les 2 niveaux d'en-tête
  page.drawLine({
    start: { x: colX[2], y: h1Y },
    end: { x: colX[8], y: h1Y },
    color: borderGray,
    thickness: 0.6,
  });
  page.drawLine({
    start: { x: colX[9], y: h1Y },
    end: { x: colX[11], y: h1Y },
    color: borderGray,
    thickness: 0.6,
  });

  // Titres ligne 1 : M1, M2, M3, T1
  // M1
  page.drawText("M1", { x: colX[2] + 18, y: h1Y + 3, size: 6.5, font: fontBold, color: black });
  // M2
  page.drawText("M2", { x: colX[4] + 18, y: h1Y + 3, size: 6.5, font: fontBold, color: black });
  // M3
  page.drawText("M3", { x: colX[6] + 18, y: h1Y + 3, size: 6.5, font: fontBold, color: black });
  // T1
  page.drawText("T1", { x: colX[9] + 24, y: h1Y + 3, size: 6.5, font: fontBold, color: black });

  // Titres ligne 2 :
  // Col 1 : ÉVALUATIONS
  page.drawText("ÉVALUATIONS", { x: colX[1] + 6, y: theadBottomY + 3, size: 6, font: fontBold, color: black });

  // Sous-colonnes Note & COTE
  page.drawText("Note", { x: colX[2] + 4, y: theadBottomY + 3, size: 5.5, font: fontBold, color: black });
  page.drawText("COTE", { x: colX[3] + 2, y: theadBottomY + 3, size: 5.5, font: fontBold, color: black });

  page.drawText("Note", { x: colX[4] + 4, y: theadBottomY + 3, size: 5.5, font: fontBold, color: black });
  page.drawText("COTE", { x: colX[5] + 2, y: theadBottomY + 3, size: 5.5, font: fontBold, color: black });

  page.drawText("Note", { x: colX[6] + 4, y: theadBottomY + 3, size: 5.5, font: fontBold, color: black });
  page.drawText("COTE", { x: colX[7] + 2, y: theadBottomY + 3, size: 5.5, font: fontBold, color: black });

  // Sur
  page.drawText("Sur", { x: colX[8] + 4, y: theadBottomY + 3, size: 5.5, font: fontBold, color: black });

  // T1 Note & COTE
  page.drawText("Note", { x: colX[9] + 6, y: theadBottomY + 3, size: 5.5, font: fontBold, color: black });
  page.drawText("COTE", { x: colX[10] + 3, y: theadBottomY + 3, size: 5.5, font: fontBold, color: black });

  // Séparateurs verticaux de l'en-tête
  // Col 1 (ÉVALUATIONS) va du haut jusqu'au bas de thead
  page.drawLine({ start: { x: colX[1], y: tableTopY }, end: { x: colX[1], y: theadBottomY }, color: borderGray, thickness: 0.6 });
  page.drawLine({ start: { x: colX[2], y: tableTopY }, end: { x: colX[2], y: theadBottomY }, color: borderGray, thickness: 0.6 });

  // Séparateurs M1 / M2 / M3 / Sur / T1 / Niveau
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
  // CORPS DU TABLEAU : LES 11 COMPÉTENCES AVEC LEURS CRITÈRES
  // ============================================================
  let curY = theadBottomY;
  const rowH = 11.2; // hauteur par critère (51 lignes * 11.2 ≈ 571 pt)

  // Totaux globaux pour bilan
  let grandTotalT1 = 0;
  let grandTotalSur = 0;

  for (const comp of SAMPLE_COMPETENCES) {
    const numCrit = comp.criteria.length;
    const numRows = numCrit + 1; // critères + 1 ligne TOTAL
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

    // 1. COLONNE 1 : NOM DE LA COMPÉTENCE (Fusionnée verticalement sur critères + TOTAL)
    // Cadre extérieur de la cellule (transparent)
    page.drawRectangle({
      x: colX[0],
      y: blockBottomY,
      width: w_comp,
      height: blockH,
      borderColor: borderGray,
      borderWidth: 0.6,
    });

    // Écriture du nom de la compétence (enveloppée proprement pour ne pas déborder)
    const titleText = `${comp.code} : ${comp.fullName}`;
    const titleLines = wrapText(titleText, w_comp - 8, fontBold, 5.2);
    const lineSpacing = 7;
    const startTextY = blockTopY - (blockH / 2) + ((titleLines.length - 1) * lineSpacing / 2) - 1.5;

    for (let li = 0; li < titleLines.length; li++) {
      page.drawText(titleLines[li], {
        x: colX[0] + 4,
        y: startTextY - li * lineSpacing,
        size: 5.2,
        font: fontBold,
        color: black,
      });
    }

    // Calculs de somme pour la compétence
    let sumM1 = 0;
    let sumM2 = 0;
    let sumM3 = 0;
    let sumSur = 0;
    let sumT1 = 0;

    // Remplissage des lignes de critères
    for (let i = 0; i < numCrit; i++) {
      const crit = comp.criteria[i];
      const rY = blockTopY - (i + 1) * rowH;

      sumM1 += crit.m1;
      sumM2 += crit.m2;
      sumM3 += crit.m3;
      sumSur += crit.max;

      // Moyenne trimestrielle T1 par critère : (M1 + M2 + M3) / 3
      const avgT1 = (crit.m1 + crit.m2 + crit.m3) / 3;
      sumT1 += avgT1;

      // Col 1 : Critère label
      page.drawText(crit.label, { x: colX[1] + 4, y: rY + 3, size: 6, font: fontRegular, color: black });

      // Col 2 : M1 Note
      page.drawText(fmtNum(crit.m1), { x: colX[2] + 4, y: rY + 3, size: 6, font: fontRegular, color: blueNote });

      // Col 4 : M2 Note
      page.drawText(fmtNum(crit.m2), { x: colX[4] + 4, y: rY + 3, size: 6, font: fontRegular, color: blueNote });

      // Col 6 : M3 Note
      page.drawText(fmtNum(crit.m3), { x: colX[6] + 4, y: rY + 3, size: 6, font: fontRegular, color: blueNote });

      // Col 8 : Sur (barème maximal)
      page.drawText(`${crit.max}`, { x: colX[8] + 6, y: rY + 3, size: 6, font: fontRegular, color: black });

      // Col 9 : T1 Note (moyenne trimestrielle)
      page.drawText(fmtNum(avgT1), { x: colX[9] + 6, y: rY + 3, size: 6, font: fontBold, color: blueNote });

      // Ligne horizontale séparant les critères
      page.drawLine({
        start: { x: colX[1], y: rY },
        end: { x: colX[3], y: rY },
        color: borderGray,
        thickness: 0.35,
      });
      page.drawLine({
        start: { x: colX[4], y: rY },
        end: { x: colX[5], y: rY },
        color: borderGray,
        thickness: 0.35,
      });
      page.drawLine({
        start: { x: colX[6], y: rY },
        end: { x: colX[7], y: rY },
        color: borderGray,
        thickness: 0.35,
      });
      page.drawLine({
        start: { x: colX[8], y: rY },
        end: { x: colX[10], y: rY },
        color: borderGray,
        thickness: 0.35,
      });
    }

    // Calcul des cotes globales de la compétence
    const coteM1 = calcCote(sumM1, sumSur);
    const coteM2 = calcCote(sumM2, sumSur);
    const coteM3 = calcCote(sumM3, sumSur);
    const coteT1 = calcCote(sumT1, sumSur);
    const acqNiveau = calcNiveauAcquisition(coteT1);

    grandTotalT1 += sumT1;
    grandTotalSur += sumSur;

    // 2. SOUS-COLONNES COTE (Fusionnées verticalement sur les critères, transparentes)
    const coteCenterY = blockTopY - critH / 2 - 2;

    // COTE M1
    page.drawRectangle({
      x: colX[3],
      y: totalRowTopY,
      width: w_m1_cote,
      height: critH,
      borderColor: borderGray,
      borderWidth: 0.6,
    });
    page.drawText(coteM1, { x: colX[3] + (w_m1_cote - coteM1.length * 4.5) / 2, y: coteCenterY, size: 7, font: fontBold, color: black });

    // COTE M2
    page.drawRectangle({
      x: colX[5],
      y: totalRowTopY,
      width: w_m2_cote,
      height: critH,
      borderColor: borderGray,
      borderWidth: 0.6,
    });
    page.drawText(coteM2, { x: colX[5] + (w_m2_cote - coteM2.length * 4.5) / 2, y: coteCenterY, size: 7, font: fontBold, color: black });

    // COTE M3
    page.drawRectangle({
      x: colX[7],
      y: totalRowTopY,
      width: w_m3_cote,
      height: critH,
      borderColor: borderGray,
      borderWidth: 0.6,
    });
    page.drawText(coteM3, { x: colX[7] + (w_m3_cote - coteM3.length * 4.5) / 2, y: coteCenterY, size: 7, font: fontBold, color: black });

    // COTE T1
    page.drawRectangle({
      x: colX[10],
      y: totalRowTopY,
      width: w_t1_cote,
      height: critH,
      borderColor: borderGray,
      borderWidth: 0.6,
    });
    page.drawText(coteT1, { x: colX[10] + (w_t1_cote - coteT1.length * 4.5) / 2, y: coteCenterY, size: 7, font: fontBold, color: black });

    // 3. LIGNE TOTAL DE LA COMPÉTENCE
    const totY = blockBottomY + 3;
    page.drawText("TOTAL", { x: colX[1] + 4, y: totY, size: 6.2, font: fontBold, color: black });
    page.drawText(fmtNum(sumM1), { x: colX[2] + 4, y: totY, size: 6.2, font: fontBold, color: blueNote });
    page.drawText(fmtNum(sumM2), { x: colX[4] + 4, y: totY, size: 6.2, font: fontBold, color: blueNote });
    page.drawText(fmtNum(sumM3), { x: colX[6] + 4, y: totY, size: 6.2, font: fontBold, color: blueNote });
    page.drawText(`${sumSur}`, { x: colX[8] + 6, y: totY, size: 6.2, font: fontBold, color: black });
    page.drawText(fmtNum(sumT1), { x: colX[9] + 6, y: totY, size: 6.2, font: fontBold, color: blueNote });

    // 4. COLONNE FINALE : NIVEAU D'ACQUISITION (Fusionnée verticalement, transparente)
    page.drawRectangle({
      x: colX[11],
      y: blockBottomY,
      width: w_acq,
      height: blockH,
      borderColor: borderGray,
      borderWidth: 0.6,
    });
    const acqCenterY = blockTopY - blockH / 2 - 2;
    page.drawText(acqNiveau, {
      x: colX[11] + 10,
      y: acqCenterY,
      size: 6.8,
      font: fontBold,
      color: black,
    });

    // Lignes verticales de séparation du bloc
    // Col 1/2
    page.drawLine({ start: { x: colX[1], y: blockTopY }, end: { x: colX[1], y: blockBottomY }, color: borderGray, thickness: 0.6 });
    // Col 2/3
    page.drawLine({ start: { x: colX[2], y: blockTopY }, end: { x: colX[2], y: blockBottomY }, color: borderGray, thickness: 0.6 });
    // Col 3/4
    page.drawLine({ start: { x: colX[3], y: blockTopY }, end: { x: colX[3], y: blockBottomY }, color: borderGray, thickness: 0.6 });
    // Col 4/5
    page.drawLine({ start: { x: colX[4], y: blockTopY }, end: { x: colX[4], y: blockBottomY }, color: borderGray, thickness: 0.6 });
    // Col 5/6
    page.drawLine({ start: { x: colX[5], y: blockTopY }, end: { x: colX[5], y: blockBottomY }, color: borderGray, thickness: 0.6 });
    // Col 6/7
    page.drawLine({ start: { x: colX[6], y: blockTopY }, end: { x: colX[6], y: blockBottomY }, color: borderGray, thickness: 0.6 });
    // Col 7/8
    page.drawLine({ start: { x: colX[7], y: blockTopY }, end: { x: colX[7], y: blockBottomY }, color: borderGray, thickness: 0.6 });
    // Col 8/9
    page.drawLine({ start: { x: colX[8], y: blockTopY }, end: { x: colX[8], y: blockBottomY }, color: borderGray, thickness: 0.6 });
    // Col 9/10
    page.drawLine({ start: { x: colX[9], y: blockTopY }, end: { x: colX[9], y: blockBottomY }, color: borderGray, thickness: 0.6 });
    // Col 10/11
    page.drawLine({ start: { x: colX[10], y: blockTopY }, end: { x: colX[10], y: blockBottomY }, color: borderGray, thickness: 0.6 });
    // Col 11/12
    page.drawLine({ start: { x: colX[11], y: blockTopY }, end: { x: colX[11], y: blockBottomY }, color: borderGray, thickness: 0.6 });
    // Bord droit
    page.drawLine({ start: { x: tableRightX, y: blockTopY }, end: { x: tableRightX, y: blockBottomY }, color: borderGray, thickness: 0.6 });

    // Ligne horizontale sous le TOTAL (séparateur de compétence)
    page.drawLine({ start: { x: marginX, y: blockBottomY }, end: { x: tableRightX, y: blockBottomY }, color: borderGray, thickness: 0.8 });

    curY = blockBottomY;
  }

  // ============================================================
  // BAS DU BULLETIN : LÉGENDE, TOTAL, MOYENNE, RANG & SIGNATURES
  // ============================================================
  const botTopY = curY - 10;

  // 1. À GAUCHE : LÉGENDE DES NIVEAUX D'ACQUISITION
  const legX = marginX + 2;
  const legY = botTopY;

  // Couleurs de la légende
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
  const valTotM1 = "234,00";
  const valTotM2 = "217,00";
  const valTotM3 = "243,00";
  const valTotSur = "280";
  const valTotT1 = "-";

  const valMoyM1 = "16,71";
  const valMoyM2 = "15,50";
  const valMoyM3 = "17,36";
  const valMoyT1 = "16,52";

  // Largeurs des blocs de colonnes
  const wBlockM1 = w_m1_note + w_m1_cote; // 50 pt
  const wBlockM2 = w_m2_note + w_m2_cote; // 50 pt
  const wBlockM3 = w_m3_note + w_m3_cote; // 50 pt
  const wBlockT1 = w_t1_note + w_t1_cote; // 58 pt

  // LIGNE 1 : TOTAL (parfaitement centré sous chaque bloc de colonne)
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

  // Dimensions des boîtes de Moyenne et Rang
  const statBoxW = 34;
  const statBoxH = 11;
  const t1BoxW = 38;

  // LIGNE 2 : MOYENNE
  const yMoy = legY - 14;
  page.drawText("Moyenne", { x: colX[1] + 6, y: yMoy + 2.5, size: 6.8, font: fontRegular, color: black });

  // Box Moyenne M1
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

  // Box Moyenne M2
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

  // Box Moyenne M3
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

  // Box Moyenne T1
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
    // Texte du chiffre + symbole degré
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

  // Box Rang M1 (7°)
  drawRankCell(xBoxM1, yRang, statBoxW, statBoxH, "7");

  // Box Rang M2 (9°)
  drawRankCell(xBoxM2, yRang, statBoxW, statBoxH, "9");

  // Box Rang M3 (5°)
  drawRankCell(xBoxM3, yRang, statBoxW, statBoxH, "5");

  // Box Rang T1 (7°)
  drawRankCell(xBoxT1, yRang, t1BoxW, statBoxH, "7");

  // 3. À DROITE : GRAND CADRE DE COTE GLOBALE TRIMESTRIELLE ('A')
  // S'aligne parfaitement sous la colonne Niveau d'acquisition
  // et s'étend en hauteur du haut de Moyenne jusqu'au bas de Rang
  const grandBoxW = w_acq;
  const grandBoxH = (yMoy + statBoxH) - yRang; // Hauteur couvrant Moyenne et Rang
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

  // Affichage de 'A' centré et bien visible
  page.drawText("A", {
    x: colX[11] + (grandBoxW - fontBold.widthOfTextAtSize("A", 15)) / 2,
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
  const dateStr = `${PREVIEW_CONFIG.city}, le ${now.getDate()} ${frMonths[now.getMonth()]} ${now.getFullYear()}`;

  // Le Parent (gauche)
  page.drawText("Le Parent", { x: marginX + 15, y: sigY, size: 7.5, font: fontBold, color: black });

  // L'Enseignant (centre)
  page.drawText(`L'Enseignant(e)`, { x: marginX + 148, y: sigY, size: 7.5, font: fontBold, color: black });
  page.drawText(PREVIEW_CONFIG.teacherName, { x: marginX + 148, y: sigY - 10, size: 6.5, font: fontItalic, color: borderGray });

  // Date et La Directrice (droite)
  const dirCenterX = width - marginX - 110;
  page.drawText(dateStr, {
    x: dirCenterX - fontBold.widthOfTextAtSize(dateStr, 7) / 2,
    y: sigY + 8,
    size: 7,
    font: fontRegular,
    color: black,
  });
  const dirTitle = PREVIEW_CONFIG.directorLabel;
  page.drawText(dirTitle, {
    x: dirCenterX - fontBold.widthOfTextAtSize(dirTitle, 7.5) / 2,
    y: sigY - 2,
    size: 7.5,
    font: fontBold,
    color: black,
  });

  // ============================================================
  // FILIGRANE CENTRAL (DESSINÉ SOUS LE TEXTE AVEC CELLULES TRANSPARENTES)
  // ============================================================
  if (logoImage) {
    const wmSize = 260;
    // On dessine le filigrane au centre du tableau
    page.drawImage(logoImage, {
      x: width / 2 - wmSize / 2,
      y: (tableTopY + curY) / 2 - wmSize / 2 + 10,
      width: wmSize,
      height: wmSize,
      opacity: 0.10,
    });
  }

  // ============================================================
  // 5. PIED DE PAGE TOUT EN BAS
  // ============================================================
  const footY = 12;
  const studentFootInfo = `${PREVIEW_CONFIG.schoolName} / ${PREVIEW_CONFIG.schoolYear} / ${PREVIEW_CONFIG.className} / ${PREVIEW_CONFIG.term} / ${PREVIEW_CONFIG.studentName}`;
  page.drawText(studentFootInfo, {
    x: marginX,
    y: footY,
    size: 5.5,
    font: fontRegular,
    color: borderGray,
  });

  const pdfBytes = await pdfDoc.save();
  const outputPath = path.join(__dirname, "bulletin_primaire_preview.pdf");
  fs.writeFileSync(outputPath, pdfBytes);
  console.log(`✓ Bulletin PDF officiel généré avec succès : ${outputPath}`);
  return outputPath;
}

if (process.argv[1] === __filename) {
  generateTestBulletin().catch(console.error);
}
