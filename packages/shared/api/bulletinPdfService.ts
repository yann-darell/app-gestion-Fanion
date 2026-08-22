import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { supabase } from "./supabaseClient";
import { generateClassReport } from "../services/classReportService";
import { getSubjectLetterGrade, getAppreciationCode } from "./gradeCalculations";
import { listCoefficients, listSubjectGroups } from "./subjects";
import { listAssignments } from "./teacherAssignments";

export interface GenerateBulletinOptions {
  studentId: string;
  periodId: string;
  periodType?: "sequence" | "term";
}

export interface BulletinCompletenessDiagnostic {
  isComplete: boolean;
  totalExpectedGrades: number;
  filledGradesCount: number;
  missingSubjects: string[];
}

/**
 * Diagnostic de complétude des notes d'un élève pour un trimestre ou une séquence donné(e).
 */
export async function checkStudentBulletinCompleteness(
  studentId: string,
  periodId: string,
  periodType: "sequence" | "term" = "term"
): Promise<BulletinCompletenessDiagnostic> {
  // Récupérer l'élève pour avoir sa classe
  const { data: student, error: studErr } = await supabase
    .from("students")
    .select("*, classes(*)")
    .eq("id", studentId)
    .single();

  if (studErr || !student) throw new Error("Élève introuvable");

  const classId = student.class_id;
  const coefficients = await listCoefficients(classId);

  // Générer le bordereau (séquentiel ou trimestriel) de la classe pour obtenir la matrice des notes
  const report = await generateClassReport(classId, periodType, periodId);
  const studentRow = report.rows.find((r) => r.student.id === studentId);

  let filledCount = 0;
  const missingSubjects: string[] = [];

  coefficients.forEach((c) => {
    const sub = report.subjects.find((s) => s.id === c.subject_id);
    const subName = sub ? sub.name : "Matière inconnue";

    const item = studentRow?.gradesBySubject[c.subject_id];
    if (item && !item.isNC && item.score !== null) {
      filledCount++;
    } else {
      missingSubjects.push(subName);
    }
  });

  return {
    isComplete: missingSubjects.length === 0,
    totalExpectedGrades: coefficients.length,
    filledGradesCount: filledCount,
    missingSubjects,
  };
}

/**
 * Génère le buffer du document PDF pour un bulletin d'élève.
 */
export async function createStudentBulletinPdfBuffer(
  studentId: string,
  periodId: string,
  periodType: "sequence" | "term" = "term"
): Promise<Uint8Array> {
  // 1. Récupération des données de l'élève
  const { data: student, error: studErr } = await supabase
    .from("students")
    .select("*, classes(*)")
    .eq("id", studentId)
    .single();

  if (studErr || !student) throw new Error("Élève non trouvé pour la génération du bulletin.");

  const classId = student.class_id;

  // Récupérer le libellé de la période (Terme ou Séquence)
  let periodTitleLabel = periodType === "term" ? "TRIMESTRE" : "SÉQUENCE";
  if (periodType === "term") {
    const { data: termData } = await supabase.from("terms").select("label").eq("id", periodId).single();
    if (termData?.label) {
      periodTitleLabel = termData.label.toUpperCase();
    }
  } else {
    const { data: seqData } = await supabase.from("sequences").select("name, sequence_number").eq("id", periodId).single();
    if (seqData?.name) {
      periodTitleLabel = seqData.name.toUpperCase();
    } else if (seqData?.sequence_number) {
      periodTitleLabel = `${seqData.sequence_number}ème SÉQUENCE`;
    }
  }

  // 2. Calcul du bordereau de classe pour avoir les moyennes, rangs, etc.
  const report = await generateClassReport(classId, periodType, periodId);
  const studentRow = report.rows.find((r) => r.student.id === studentId);

  if (!studentRow) throw new Error("Données de l'élève introuvables dans le bordereau.");

  // Récupérer la liste des enseignants assignés à cette classe
  const classAssignments = await listAssignments({ classId });

  const getTeacherName = (subjectId: string): string => {
    const assign = classAssignments.find((a) => a.subject_id === subjectId);
    if (!assign || !assign.profiles?.full_name) return "-";
    return assign.profiles.full_name;
  };

  // Récupérer les 4 groupes de matières (I, II, III, IV) et coefficients de la classe
  const coefficients = await listCoefficients(classId);
  const groups = await listSubjectGroups();

  // 3. Création du PDF via pdf-lib
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // Format A4 (210 x 297 mm)
  const { width, height } = page.getSize();

  // Chargement des polices standard
  const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  // Charger le logo officiel PNG (logo_fanion.png)
  let logoImage: any = null;
  try {
    const fs = require("fs");
    const path = require("path");
    const logoPath = path.resolve(process.cwd(), "logo_fanion.png");
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      logoImage = await pdfDoc.embedPng(logoBuffer);
    }
  } catch (e) {
    console.warn("Logo PNG introuvable ou erreur d'embédage:", e);
  }

  // Détection du premier cycle (6ème et 5ème) pour la variante 9 colonnes (avec compétences)
  const className = (student.classes?.name || "").toUpperCase();
  const isFirstCycleCompetence = className.includes("6") || className.includes("5") || className.includes("SIXIEME") || className.includes("CINQUIEME");
  const columnCount = isFirstCycleCompetence ? 9 : 8;

  // Filigrane Sécurisé (Zone restreinte : de la 4ème ligne du Groupe I au bas du bloc Saumon)
  // Sera dessiné dynamiquement pendant le tracé du tableau

  // ==========================================
  // 1. EN-TÊTE BILINGUE OFFICIEL & LOGO CENTRÉ
  // ==========================================
  const headerTopY = height - 30;

  // Colonne Gauche (Français)
  page.drawText("RÉPUBLIQUE DU CAMEROUN", { x: 30, y: headerTopY, size: 7.5, font: fontBold });
  page.drawText("Paix – Travail – Patrie", { x: 48, y: headerTopY - 10, size: 7, font: fontRegular });
  
  // Pointillés 1 (sous Devise)
  page.drawText("- - - - - - - - - - - - - -", { x: 42, y: headerTopY - 16, size: 6, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });

  page.drawText("MINISTÈRE DES ENSEIGNEMENTS SECONDAIRES", { x: 15, y: headerTopY - 25, size: 6.5, font: fontBold });
  // Pointillés 2 (sous Ministère)
  page.drawText("- - - - - - - - - - - - - - - - - - - - -", { x: 28, y: headerTopY - 31, size: 6, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });

  page.drawText("COLLÈGE PRIVÉ LE FANION", { x: 38, y: headerTopY - 40, size: 7.5, font: fontBold });
  page.drawText("Tel : 696 81 07 22 / 690 54 95 99", { x: 30, y: headerTopY - 50, size: 6.5, font: fontRegular });
  // Pointillés 3 (sous Téléphone)
  page.drawText("- - - - - - - - - - - - - - - - - - - - -", { x: 28, y: headerTopY - 56, size: 6, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });

  // Logo Centré Net (non filigrane)
  if (logoImage) {
    page.drawImage(logoImage, {
      x: width / 2 - 30,
      y: headerTopY - 55,
      width: 60,
      height: 60,
    });
  }

  // Colonne Droite (Anglais - décalée vers la gauche pour faire place nette à la photo)
  const rightColX = width - 235;
  page.drawText("REPUBLIC OF CAMEROON", { x: rightColX + 25, y: headerTopY, size: 7.5, font: fontBold });
  page.drawText("Peace – Work – Fatherland", { x: rightColX + 28, y: headerTopY - 10, size: 7, font: fontRegular });
  
  // Pointillés 1 (sous Devise Anglaise)
  page.drawText("- - - - - - - - - - - - - -", { x: rightColX + 32, y: headerTopY - 16, size: 6, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });

  page.drawText("MINISTRY OF SECONDARY EDUCATION", { x: rightColX, y: headerTopY - 25, size: 6.5, font: fontBold });
  // Pointillés 2 (sous Ministère Anglais)
  page.drawText("- - - - - - - - - - - - - - - - - - - - -", { x: rightColX + 15, y: headerTopY - 31, size: 6, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });

  page.drawText("SECULAR PRIVATE COLLEGE LE FANION", { x: rightColX - 5, y: headerTopY - 40, size: 7, font: fontBold });

  // Cadre Emplacement PHOTO (Coin Supérieur Droit Extrême - parfaitement dégagé)
  const photoX = width - 80;
  const photoY = headerTopY - 62;
  page.drawRectangle({
    x: photoX,
    y: photoY,
    width: 60,
    height: 72,
    borderColor: rgb(0, 0, 0),
    borderWidth: 0.8,
    color: rgb(1, 1, 1),
  });
  page.drawText("PHOTO", {
    x: photoX + 16,
    y: photoY + 32,
    size: 8,
    font: fontBold,
    color: rgb(0.4, 0.4, 0.4),
  });

  // ==========================================
  // 2. CADRE TITRE RECTANGULAIRE 3D & ANNÉE
  // ==========================================
  const titleBoxY = headerTopY - 80;
  // Formater proprement le titre (ex: BULLETIN DE LA 1ERE SEQUENCE ou BULLETIN DU 1ER TRIMESTRE)
  let formattedTitle = periodTitleLabel;
  if (!formattedTitle.startsWith("BULLETIN")) {
    if (formattedTitle.includes("SÉQUENCE") || formattedTitle.includes("SEQUENCE")) {
      formattedTitle = `BULLETIN DE LA ${formattedTitle}`;
    } else {
      formattedTitle = `BULLETIN DU ${formattedTitle}`;
    }
  }
  const bulletinTitleText = formattedTitle;

  // Ombre interne / Effet 3D (Double bordure bas et droite)
  page.drawRectangle({
    x: width / 2 - 148,
    y: titleBoxY - 2,
    width: 296,
    height: 22,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1.5,
    color: rgb(1, 1, 1),
  });
  page.drawRectangle({
    x: width / 2 - 150,
    y: titleBoxY,
    width: 296,
    height: 22,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });

  page.drawText(bulletinTitleText, {
    x: width / 2 - (bulletinTitleText.length * 3.2),
    y: titleBoxY + 6,
    size: 10,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  // Année Scolaire (sous le cadre titre en italique)
  page.drawText("Année Scolaire : 2025/2026", {
    x: width / 2 - 45,
    y: titleBoxY - 12,
    size: 8,
    font: fontItalic,
  });

  // ==========================================
  // 3. BLOC IDENTITÉ ÉLÈVE (3 LIGNES AGRANDIES & AÉRÉES)
  // ==========================================
  const idBoxY = titleBoxY - 65;
  const marginX = 20;
  const contentWidth = width - 40;
  const idBoxHeight = 48; // Agrandissement de la boîte d'information élève

  page.drawRectangle({
    x: marginX,
    y: idBoxY,
    width: contentWidth,
    height: idBoxHeight,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });

  // Ligne 1 Identité (Haut)
  page.drawText(`CLASSE : ${student.classes?.name || "-"}`, { x: marginX + 6, y: idBoxY + 34, size: 8.5, font: fontBold });
  page.drawText(`EFFECTIF : ${report.stats.totalStudents}`, { x: marginX + 160, y: idBoxY + 34, size: 8.5, font: fontBold });
  page.drawText(`PROFESSEUR PRINCIPAL : ${student.classes?.head_teacher_name || "-"}`, { x: marginX + 300, y: idBoxY + 34, size: 8.5, font: fontBold });

  // Ligne 2 Identité (Milieu)
  page.drawText(`NOMS : ${student.last_name}`, { x: marginX + 6, y: idBoxY + 19, size: 8.5, font: fontBold });
  page.drawText(`PRÉNOMS : ${student.first_name}`, { x: marginX + 160, y: idBoxY + 19, size: 8.5, font: fontBold });
  page.drawText(`MAT : ${student.matricule}`, { x: marginX + 360, y: idBoxY + 19, size: 8.5, font: fontBold });
  page.drawText(`REDOUBLANT : ${student.is_repeating ? "Oui" : "Non"}`, { x: marginX + 460, y: idBoxY + 19, size: 8.5, font: fontBold });

  // Ligne 3 Identité (Bas)
  page.drawText(`DATE ET LIEU DE NAISSANCE : ${student.birth_date || "-"} à ${student.birth_place || "-"}`, { x: marginX + 6, y: idBoxY + 5, size: 8.5, font: fontBold });
  page.drawText(`NAT : ${student.nationality || "Camerounaise"}`, { x: marginX + 360, y: idBoxY + 5, size: 8.5, font: fontBold });

  // ==========================================
  // FILIGRANE DU LOGO CENTRÉ (Opacité bien visible 20%)
  // ==========================================
  if (logoImage) {
    page.drawImage(logoImage, {
      x: width / 2 - 110,
      y: height / 2 - 120,
      width: 220,
      height: 220,
      opacity: 0.20, // Visible et lisible sans masquer le texte
    });
  }

  // ==========================================
  // 4. GRILLE DE NOTES PAR GROUPE (I À IV)
  // ==========================================
  let tableY = idBoxY - 15;

  // Calcul des largeurs de colonnes
  // 9 colonnes (6e/5e) vs 8 colonnes (autres)
  const colWidths = isFirstCycleCompetence
    ? [125, 110, 35, 30, 35, 45, 45, 40, 90] // Total: 555
    : [180, 45, 35, 45, 55, 55, 45, 95];    // Total: 555

  const headers = isFirstCycleCompetence
    ? ["MATIÈRES", "COMPÉTENCES ÉVALUÉES", "TRIM", "SEQ", "COEF", "MOY × COEF", "MOY DE CLASSE", "RANG", "APPRÉCIATION"]
    : ["MATIÈRES", "TRIM", "SEQ", "COEF", "MOY × COEF", "MOY DE CLASSE", "RANG", "APPRÉCIATION"];

  // Dessiner l'en-tête du tableau
  page.drawRectangle({
    x: marginX,
    y: tableY - 14,
    width: contentWidth,
    height: 14,
    borderColor: rgb(0, 0, 0),
    borderWidth: 0.8,
    color: rgb(1, 1, 1),
  });

  let curX = marginX;
  headers.forEach((h, idx) => {
    page.drawText(h, { x: curX + 2, y: tableY - 10, size: 6, font: fontBold });
    curX += colWidths[idx];
    if (idx < headers.length - 1) {
      page.drawLine({ start: { x: curX, y: tableY }, end: { x: curX, y: tableY - 14 }, color: rgb(0, 0, 0), thickness: 0.5 });
    }
  });

  tableY -= 14;

  let rowCounter = 0;
  const formatFr = (val: number | null | string): string => {
    if (val === null || val === undefined || val === "NC") return "NC";
    const num = typeof val === "number" ? val : parseFloat(val);
    if (isNaN(num)) return "NC";
    return num.toFixed(2).replace(".", ",");
  };

  // Parcourir les 4 Groupes
  groups.forEach((grp) => {
    const grpCoeffs = coefficients.filter((c) => c.subject_group_id === grp.id);
    if (grpCoeffs.length === 0) return;

    // Espace de séparation visuelle entre les groupes
    tableY -= 4;

    // Entête de Groupe (Fond Blanc, Texte Gras)
    page.drawRectangle({
      x: marginX,
      y: tableY - 12,
      width: contentWidth,
      height: 12,
      borderColor: rgb(0, 0, 0),
      borderWidth: 0.8,
      color: rgb(1, 1, 1),
    });
    page.drawText(`GROUPE ${grp.label} : MATIÈRES ${grp.name?.toUpperCase() || ""}`, {
      x: marginX + 5,
      y: tableY - 9,
      size: 6.5,
      font: fontBold,
    });
    tableY -= 12;

    let grpPointsSum = 0;
    let grpCoeffSum = 0;

    grpCoeffs.forEach((c) => {
      rowCounter++;
      const sub = report.subjects.find((s) => s.id === c.subject_id);
      const subName = sub ? sub.name : "Matière";
      const teacherName = getTeacherName(c.subject_id);

      // Si filigrane actif à partir de la 4ème ligne
      if (rowCounter === 4 && logoImage) {
        page.drawImage(logoImage, {
          x: width / 2 - 100,
          y: tableY - 180,
          width: 200,
          height: 200,
          opacity: 0.12,
        });
      }

      const gradeItem = studentRow.gradesBySubject[c.subject_id];
      const score = gradeItem && !gradeItem.isNC ? gradeItem.score : null;
      const displayScore = formatFr(score);
      const coef = c.coefficient;
      const totalPoints = score !== null ? formatFr(score * coef) : "NC";

      if (score !== null) {
        grpPointsSum += score * coef;
        grpCoeffSum += coef;
      }

      const rowHeight = 16;
      page.drawRectangle({
        x: marginX,
        y: tableY - rowHeight,
        width: contentWidth,
        height: rowHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5,
        color: rgb(1, 1, 1),
      });

      // Rendu des séparateurs verticaux pour chaque colonne de la ligne
      let lineX = marginX;
      for (let i = 0; i < colWidths.length - 1; i++) {
        lineX += colWidths[i];
        page.drawLine({
          start: { x: lineX, y: tableY },
          end: { x: lineX, y: tableY - rowHeight },
          color: rgb(0, 0, 0),
          thickness: 0.5,
        });
      }

      // Rendu Colonne Matière (2 Lignes : L1 Nom Gras, L2 Enseignant Italique)
      page.drawText(subName.substring(0, 24), { x: marginX + 2, y: tableY - 7, size: 6.5, font: fontBold });
      page.drawText(teacherName !== "-" ? teacherName.substring(0, 22) : "", { x: marginX + 2, y: tableY - 14, size: 5.5, font: fontItalic });

      // Rendu des autres colonnes
      let rX = marginX + colWidths[0];
      let cIdx = 1;

      if (isFirstCycleCompetence) {
        // Colonne Compétences Évaluées
        page.drawText("Maîtriser les savoirs essentiels", { x: rX + 2, y: tableY - 10, size: 5.5, font: fontRegular });
        rX += colWidths[cIdx++];
      }

      // TRIM (Optionnel / vide en séquence)
      page.drawText(periodType === "term" ? displayScore : "--", { x: rX + 4, y: tableY - 10, size: 6.5, font: fontRegular });
      rX += colWidths[cIdx++];

      // SEQ
      page.drawText(periodType === "sequence" ? displayScore : "--", { x: rX + 4, y: tableY - 10, size: 6.5, font: fontRegular });
      rX += colWidths[cIdx++];

      // COEF
      page.drawText(coef.toString(), { x: rX + 6, y: tableY - 10, size: 6.5, font: fontRegular });
      rX += colWidths[cIdx++];

      // MOY × COEF
      page.drawText(totalPoints, { x: rX + 4, y: tableY - 10, size: 6.5, font: fontBold });
      rX += colWidths[cIdx++];

      // MOY DE CLASSE
      page.drawText(formatFr(report.stats.classAverage), { x: rX + 4, y: tableY - 10, size: 6.5, font: fontRegular });
      rX += colWidths[cIdx++];

      // RANG
      page.drawText(studentRow.rankDisplay || "1er", { x: rX + 4, y: tableY - 10, size: 6.5, font: fontRegular });
      rX += colWidths[cIdx++];

      // APPRÉCIATION
      const appText = score !== null ? (score >= 16 ? "Très Bien" : score >= 14 ? "Bien" : score >= 12 ? "Assez Bien" : score >= 10 ? "Passable" : "Médiocre") : "NC";
      page.drawText(appText, { x: rX + 4, y: tableY - 10, size: 6.5, font: fontBold });

      tableY -= rowHeight;
    });

    // Ligne Sous-Total du GROUPE (Fond Blanc, Sans Gris)
    const grpMoy = grpCoeffSum > 0 ? formatFr(grpPointsSum / grpCoeffSum) : "NC";
    page.drawRectangle({
      x: marginX,
      y: tableY - 12,
      width: contentWidth,
      height: 12,
      borderColor: rgb(0, 0, 0),
      borderWidth: 0.8,
      color: rgb(1, 1, 1),
    });
    page.drawText(`Total du GROUPE ${grp.label} :`, { x: marginX + 5, y: tableY - 9, size: 6.5, font: fontBold });
    page.drawText(`Points : ${formatFr(grpPointsSum)}   Coef : ${grpCoeffSum}   Moyenne du Groupe : ${grpMoy}/20   Rang : 1er`, {
      x: marginX + 180,
      y: tableY - 9,
      size: 6.5,
      font: fontBold,
    });
    tableY -= 12;
  });

  // ==========================================
  // 5. TOTAL GÉNÉRAL (2 COLONNES SANS TEINTE)
  // ==========================================
  tableY -= 4;
  const col1GenWidth = isFirstCycleCompetence ? colWidths[0] + colWidths[1] : colWidths[0];
  const col2GenWidth = contentWidth - col1GenWidth;

  page.drawRectangle({
    x: marginX,
    y: tableY - 14,
    width: contentWidth,
    height: 14,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
    color: rgb(1, 1, 1), // Fond blanc pur
  });
  page.drawLine({ start: { x: marginX + col1GenWidth, y: tableY }, end: { x: marginX + col1GenWidth, y: tableY - 14 }, color: rgb(0, 0, 0), thickness: 1 });

  page.drawText(`Total Général (GI + GII + GIII + GIV) = ${formatFr(studentRow.totalPoints)}`, {
    x: marginX + 5,
    y: tableY - 10,
    size: 7,
    font: fontBold,
  });

  page.drawText(`Moy Gle de la Classe : ${formatFr(report.stats.classAverage)}    Moy du 1er : ${formatFr(report.stats.maxAverage)}    Moy du Dernier : ${formatFr(report.stats.minAverage)}`, {
    x: marginX + col1GenWidth + 10,
    y: tableY - 10,
    size: 7,
    font: fontBold,
  });

  tableY -= 18;

  // ==========================================
  // 6. BLOC SYNTHÈSE MOYENNES (2 COLONNES SAUMON #E7B5B4 - HAUTEUR 48 PT)
  // ==========================================
  const saumonBoxHeight = 48; // Boîte portée à 48 pt à la demande de l'utilisateur
  const saumonCol1Width = contentWidth * 0.7;
  const saumonCol2Width = contentWidth * 0.3;

  // Col 1 : Fond Saumon (#E7B5B4 -> R: 231/255=0.906, G: 181/255=0.710, B: 180/255=0.706)
  page.drawRectangle({
    x: marginX,
    y: tableY - saumonBoxHeight,
    width: saumonCol1Width,
    height: saumonBoxHeight,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
    color: rgb(0.906, 0.710, 0.706), // Teinte officielle #E7B5B4
  });

  // Col 2 : Fond Blanc (Rangs)
  page.drawRectangle({
    x: marginX + saumonCol1Width,
    y: tableY - saumonBoxHeight,
    width: saumonCol2Width,
    height: saumonBoxHeight,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });

  // Col 1 Contenu (Aéré sur 48pt)
  page.drawText(`Moyennes de l'Élève :   ${periodTitleLabel} : ${formatFr(studentRow.average)}/20`, {
    x: marginX + 10,
    y: tableY - 17,
    size: 8.5,
    font: fontBold,
  });
  page.drawText(`Trim 1 : ${periodType === "term" ? formatFr(studentRow.average) : "--"}    Trim 2 : --    Trim 3 : --    ANNUEL : ${formatFr(studentRow.average)}/20`, {
    x: marginX + 10,
    y: tableY - 34,
    size: 8,
    font: fontBold,
  });

  // Col 2 Contenu (Rangs - Aéré sur 48pt)
  page.drawText(`Rang de l'élève : ${studentRow.rankDisplay}`, {
    x: marginX + saumonCol1Width + 12,
    y: tableY - 17,
    size: 8.5,
    font: fontBold,
  });
  page.drawText(`Rang Annuel : ${studentRow.rankDisplay}`, {
    x: marginX + saumonCol1Width + 12,
    y: tableY - 34,
    size: 8,
    font: fontBold,
  });

  tableY -= saumonBoxHeight + 7;
  const subText = "• La moyenne Trimestrielle n'est pas égale à la moyenne arithmétique des séquences";
  page.drawText(subText, {
    x: width / 2 - 135,
    y: tableY,
    size: 6.5,
    font: fontItalic,
  });

  // ==========================================
  // 7. BLOC DECISIONS ET OBSERVATIONS (Modèle Officiel Image)
  // ==========================================
  tableY -= 12;
  const discHeight = 78;
  const headerBarHeight = 12;
  const totalDiscHeight = discHeight + headerBarHeight;

  // 1. Bandeau supérieur "DECISIONS ET OBSERVATIONS / Décisions And Observations"
  page.drawRectangle({
    x: marginX,
    y: tableY - headerBarHeight,
    width: contentWidth,
    height: headerBarHeight,
    borderColor: rgb(0, 0, 0),
    borderWidth: 0.8,
    color: rgb(1, 1, 1),
  });
  page.drawText("DECISIONS ET OBSERVATIONS / Décisions And Observations", {
    x: width / 2 - 110,
    y: tableY - 9,
    size: 7,
    font: fontBold,
  });

  const mainBoxY = tableY - headerBarHeight;
  const cWidth = contentWidth / 4;

  // Contour global des 4 colonnes sous l'entête
  for (let i = 0; i < 4; i++) {
    page.drawRectangle({
      x: marginX + i * cWidth,
      y: mainBoxY - discHeight,
      width: cWidth,
      height: discHeight,
      borderColor: rgb(0, 0, 0),
      borderWidth: 0.8,
      color: rgb(1, 1, 1),
    });
  }

  // --- COLONNE 1 : DISCIPLINE (7 Lignes encadrées horizontales) ---
  const col1X = marginX;
  const col1LineH = 11; // Hauteur fixe par ligne

  // L1: DISCIPLINE / Disciplin
  let c1YPos = mainBoxY;
  page.drawLine({ start: { x: col1X, y: c1YPos - col1LineH }, end: { x: col1X + cWidth, y: c1YPos - col1LineH }, color: rgb(0, 0, 0), thickness: 0.5 });
  page.drawText("DISCIPLINE / Disciplin", { x: col1X + 3, y: c1YPos - col1LineH + 3, size: 5.5, font: fontBold });

  // L2: Nb d'Heures :
  c1YPos -= col1LineH;
  page.drawLine({ start: { x: col1X, y: c1YPos - col1LineH }, end: { x: col1X + cWidth, y: c1YPos - col1LineH }, color: rgb(0, 0, 0), thickness: 0.5 });
  page.drawText("Nb d'Heures :", { x: col1X + 3, y: c1YPos - col1LineH + 3, size: 5.5, font: fontRegular });

  // L3: Nb de jrnées :
  c1YPos -= col1LineH;
  page.drawLine({ start: { x: col1X, y: c1YPos - col1LineH }, end: { x: col1X + cWidth, y: c1YPos - col1LineH }, color: rgb(0, 0, 0), thickness: 0.5 });
  page.drawText("Nb de jrnées :", { x: col1X + 3, y: c1YPos - col1LineH + 3, size: 5.5, font: fontRegular });

  // L4: Exclusions / Suspensions
  c1YPos -= col1LineH;
  page.drawLine({ start: { x: col1X, y: c1YPos - col1LineH }, end: { x: col1X + cWidth, y: c1YPos - col1LineH }, color: rgb(0, 0, 0), thickness: 0.5 });
  page.drawText("Exclusions / Suspensions", { x: col1X + 3, y: c1YPos - col1LineH + 3, size: 5.5, font: fontItalic });

  // L5: Blâme / Blame
  c1YPos -= col1LineH;
  page.drawLine({ start: { x: col1X, y: c1YPos - col1LineH }, end: { x: col1X + cWidth, y: c1YPos - col1LineH }, color: rgb(0, 0, 0), thickness: 0.5 });
  page.drawText("Blâme / Blame", { x: col1X + 3, y: c1YPos - col1LineH + 3, size: 5.5, font: fontItalic });

  // L6: Avertissements / Warnings
  c1YPos -= col1LineH;
  page.drawLine({ start: { x: col1X, y: c1YPos - col1LineH }, end: { x: col1X + cWidth, y: c1YPos - col1LineH }, color: rgb(0, 0, 0), thickness: 0.5 });
  page.drawText("Avertissements / Warnings", { x: col1X + 3, y: c1YPos - col1LineH + 3, size: 5.5, font: fontItalic });

  // L7: Observations et Remarques du parent de l'élève (Zone basse plus large)
  c1YPos -= col1LineH;
  page.drawText("Observations et Remarques du parent", { x: col1X + 3, y: c1YPos - 7, size: 5, font: fontBold });
  page.drawText("de l'élève", { x: col1X + 3, y: c1YPos - 14, size: 5, font: fontBold });


  // --- COLONNE 2 : LIGNES MANUSCRITES (Traits horizontaux horizontaux légers) ---
  const col2X = marginX + cWidth;
  // Tracé des sous-lignes horizontales très claires
  const lineGap = discHeight / 6;
  for (let k = 1; k < 6; k++) {
    page.drawLine({
      start: { x: col2X, y: mainBoxY - k * lineGap },
      end: { x: col2X + cWidth, y: mainBoxY - k * lineGap },
      color: rgb(0.85, 0.85, 0.85),
      thickness: 0.5,
    });
  }


  // --- COLONNE 3 : APPRÉCIATION ET OBSERVATIONS PROF PRINCIPAL ---
  const col3X = marginX + 2 * cWidth;
  
  // Entête: Appréciation du travail de l'élève
  page.drawLine({ start: { x: col3X, y: mainBoxY - 12 }, end: { x: col3X + cWidth, y: mainBoxY - 12 }, color: rgb(0, 0, 0), thickness: 0.5 });
  page.drawText("Appréciation du travail de l'élève", { x: col3X + 12, y: mainBoxY - 9, size: 5.5, font: fontRegular });

  // Code calculé (ex: CA)
  const appCode = studentRow.average !== null ? getAppreciationCode(studentRow.average) : "NC";
  page.drawText(appCode, { x: col3X + cWidth / 2 - 8, y: mainBoxY - 26, size: 10, font: fontBold });

  // Ligne de séparation pour "Observations et Remarques du Professeur Principal"
  page.drawLine({ start: { x: col3X, y: mainBoxY - 34 }, end: { x: col3X + cWidth, y: mainBoxY - 34 }, color: rgb(0, 0, 0), thickness: 0.5 });
  page.drawText("Observations et Remarques du", { x: col3X + 14, y: mainBoxY - 42, size: 5.5, font: fontBold });
  page.drawText("Professeur Principal", { x: col3X + 24, y: mainBoxY - 49, size: 5.5, font: fontBold });

  // Trait inférieur de la sous-boîte
  page.drawLine({ start: { x: col3X, y: mainBoxY - 52 }, end: { x: col3X + cWidth, y: mainBoxY - 52 }, color: rgb(0, 0, 0), thickness: 0.5 });


  // --- COLONNE 4 : TRAVAIL & VISA (Grande Ligne Supérieure + 2 sous-colonnes A et B) ---
  const col4X = marginX + 3 * cWidth;

  // Grande ligne supérieure : TRAVAIL / Academic Work (Pleine largeur Colonne 4)
  page.drawLine({ start: { x: col4X, y: mainBoxY - 12 }, end: { x: col4X + cWidth, y: mainBoxY - 12 }, color: rgb(0, 0, 0), thickness: 0.5 });
  page.drawText("TRAVAIL / Academic Work", { x: col4X + 25, y: mainBoxY - 9, size: 6, font: fontBold });

  // Division verticale exacte sous l'entête TRAVAIL (Sous-colonne A et Sous-colonne B)
  const subWidthA = cWidth * 0.58;
  const subWidthB = cWidth * 0.42;
  const splitX = col4X + subWidthA;

  page.drawLine({ start: { x: splitX, y: mainBoxY - 12 }, end: { x: splitX, y: mainBoxY - discHeight }, color: rgb(0, 0, 0), thickness: 0.5 });

  // --- Sous-colonne A (5 Lignes encadrées horizontales) ---
  const subARowH = (discHeight - 12) / 4;

  // L1: Tableau d'honneur / Honour roll
  page.drawLine({ start: { x: col4X, y: mainBoxY - 12 - subARowH }, end: { x: splitX, y: mainBoxY - 12 - subARowH }, color: rgb(0, 0, 0), thickness: 0.5 });
  page.drawText("Tableau d'honneur / Honour roll", { x: col4X + 3, y: mainBoxY - 12 - subARowH + 4, size: 5, font: fontBold });

  // L2: Encouragements / Encouragements
  page.drawLine({ start: { x: col4X, y: mainBoxY - 12 - 2 * subARowH }, end: { x: splitX, y: mainBoxY - 12 - 2 * subARowH }, color: rgb(0, 0, 0), thickness: 0.5 });
  page.drawText("Encouragements / Encouragements", { x: col4X + 3, y: mainBoxY - 12 - 2 * subARowH + 4, size: 5, font: fontItalic });

  // L3: Félicitations / Congratulations
  page.drawLine({ start: { x: col4X, y: mainBoxY - 12 - 3 * subARowH }, end: { x: splitX, y: mainBoxY - 12 - 3 * subARowH }, color: rgb(0, 0, 0), thickness: 0.5 });
  page.drawText("Félicitations / Congratulations", { x: col4X + 3, y: mainBoxY - 12 - 3 * subARowH + 4, size: 5, font: fontBold });

  // L4: Décisions du Conseil de Classe
  page.drawText("Décisions du Conseil de Classe", { x: col4X + 3, y: mainBoxY - discHeight + 8, size: 5, font: fontBold });

  // --- Sous-colonne B (Observations et Visa du Principal) ---
  let bY = mainBoxY - 12;
  page.drawText("Observations et Visa du", { x: splitX + 3, y: bY - 7, size: 5, font: fontBold });
  page.drawText("Observations and Signature", { x: splitX + 3, y: bY - 13, size: 4.5, font: fontItalic });

  // Séparateur horizontal sous l'intitulé Observations et Visa
  page.drawLine({ start: { x: splitX, y: bY - 16 }, end: { x: col4X + cWidth, y: bY - 16 }, color: rgb(0, 0, 0), thickness: 0.5 });

  page.drawText("Yaoundé le", { x: splitX + 3, y: bY - 24, size: 5, font: fontItalic });
  page.drawText("Le Principal", { x: splitX + 3, y: bY - 33, size: 5, font: fontItalic });

  // Sous-lignes légères pour écriture dans le visa du principal
  for (let m = 1; m <= 3; m++) {
    page.drawLine({
      start: { x: splitX + 3, y: mainBoxY - discHeight + m * 7 },
      end: { x: col4X + cWidth - 3, y: mainBoxY - discHeight + m * 7 },
      color: rgb(0.85, 0.85, 0.85),
      thickness: 0.5,
    });
  }

  // ==========================================
  // 8. NOTE LÉGALE DE BAS DE PAGE
  // ==========================================
  const nbText = "NB : Les élèves ont un délai de 15 jours pour toutes revendications dès réception du bulletin.";
  page.drawText(nbText, {
    x: width / 2 - 180,
    y: 12,
    size: 7,
    font: fontBold,
  });

  return await pdfDoc.save();
}

/**
 * Service atomic complet d'upload & enregistrement de bulletin PDF.
 * Respecte strictement l'atomicité et l'écrasement déterministe (upsert: true).
 */
export async function generateAndSaveStudentBulletin(
  options: GenerateBulletinOptions
): Promise<{ pdfPath: string; recordId: string; pdfBuffer: Uint8Array }> {
  const studentId = options.studentId;
  const periodId = options.periodId;
  const periodType = options.periodType || "term";

  // 1. Récupérer l'année scolaire de l'élève pour le chemin déterministe
  const { data: student, error: studErr } = await supabase
    .from("students")
    .select("class_id, classes(school_year_id)")
    .eq("id", studentId)
    .single();

  if (studErr || !student) throw new Error("Élève introuvable pour la génération.");

  const studentClass = student.classes as any;
  const schoolYearId = studentClass?.school_year_id || "default_year";
  
  // Chemin Storage déterministe fixe pour écrasement direct lors des régénérations
  const storageRelativePath = `${schoolYearId}/${periodId}/${studentId}.pdf`;

  // 2. Générer le buffer PDF en mémoire
  const pdfBytes = await createStudentBulletinPdfBuffer(studentId, periodId, periodType);

  // 3. Étape A : Upload Supabase Storage avec upsert = true
  const { error: uploadErr } = await supabase.storage
    .from("bulletins")
    .upload(storageRelativePath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadErr) {
    console.error("Erreur d'upload du bulletin sur Supabase Storage:", uploadErr);
    throw new Error(`Échec de l'enregistrement du PDF dans Storage: ${uploadErr.message}`);
  }

  // 4. Étape B : Insertion/Upsert atomic en base de données bulletin_generations
  let termIdForDb = periodId;
  if (periodType === "sequence") {
    const { data: seqObj } = await supabase.from("sequences").select("term_id").eq("id", periodId).single();
    if (seqObj?.term_id) {
      termIdForDb = seqObj.term_id;
    }
  }

  const { data: dbRecord, error: dbErr } = await supabase
    .from("bulletin_generations")
    .upsert(
      {
        student_id: studentId,
        term_id: termIdForDb,
        pdf_path: storageRelativePath,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "student_id,term_id" }
    )
    .select()
    .single();

  if (dbErr) {
    console.error("Erreur d'enregistrement DB, tentative de nettoyage Storage (rollback)...", dbErr);
    // ROLLBACK ATOMIQUE : Suppression du fichier Storage si la DB échoue pour éviter tout fichier orphelin
    await supabase.storage.from("bulletins").remove([storageRelativePath]);
    throw new Error(`Échec de l'enregistrement de la génération en base: ${dbErr.message}`);
  }

  return {
    pdfPath: storageRelativePath,
    recordId: dbRecord.id,
    pdfBuffer: pdfBytes,
  };
}

/**
 * Récupère une URL signée temporaire pour visualiser/télécharger le bulletin PDF.
 */
export async function getBulletinSignedUrl(pdfPath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("bulletins")
    .createSignedUrl(pdfPath, 3600); // Valide 1 heure

  if (error || !data?.signedUrl) {
    throw new Error(`Impossible de générer l'URL signée pour le bulletin: ${error?.message || "Inconnue"}`);
  }

  return data.signedUrl;
}
