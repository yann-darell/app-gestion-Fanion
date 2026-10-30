import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import { ClassReportData } from "../services/classReportService";
import { getSchoolSettings, SchoolSettings } from "../services/settingsService";
import { LOGO_FANION_BASE64 } from "../assets/logoBase64";
import { LOGO_PRIMAIRE_BASE64 } from "../assets/logoPrimaireBase64";

export interface GenerateClassReportPdfOptions {
  reportData: ClassReportData;
  className: string;
  periodLabel: string;
  chartImageBase64?: string | null; // Image PNG du graphique de distribution capturée depuis le DOM
  isPrimary?: boolean;
}

/**
 * Dessine un filigrane diagonal (texte semi-transparent) sur la page.
 */
function drawWatermark(page: any, fontBold: any, width: number, height: number) {
  // Texte diagonal centré sur la page en gris très clair
  page.drawText("CONFIDENTIEL", {
    x: width / 2 - 130,
    y: height / 2 - 18,
    size: 52,
    font: fontBold,
    color: rgb(0.88, 0.88, 0.9),
    rotate: degrees(45),
    opacity: 0.18,
  });
}

/**
 * Dessine un graphique à barres horizontales (distribution) natif dans pdf-lib.
 */
function drawNativeBarChart(
  page: any,
  fontBold: any,
  fontRegular: any,
  distribution: ClassReportData["distribution"],
  originX: number,
  originY: number,
  chartWidth: number,
  chartHeight: number
) {
  const items = distribution.filter((d) => d.count > 0);
  const total = items.reduce((acc, d) => acc + d.count, 0);

  // Titre
  page.drawText("Distribution des Moyennes par Tranche", {
    x: originX,
    y: originY + chartHeight + 12,
    size: 7.5,
    font: fontBold,
    color: rgb(0.082, 0.039, 0.368),
  });

  if (total === 0) {
    page.drawText("Aucune donnee", {
      x: originX + chartWidth / 2 - 28,
      y: originY + chartHeight / 2,
      size: 7,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5),
    });
    return;
  }

  const maxCount = Math.max(...items.map((i) => i.count), 1);
  const barH = Math.min(11, (chartHeight - items.length * 3) / Math.max(items.length, 1));
  const labelColW = 80; // largeur réservée aux labels à gauche
  const barMaxW = chartWidth - labelColW - 30; // largeur maximale des barres

  let curY = originY + chartHeight - barH;

  items.forEach((item) => {
    // Couleur HEX
    const hex = item.color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const barW = Math.max(4, (item.count / maxCount) * barMaxW);
    const pct = ((item.count / total) * 100).toFixed(0);

    // Label (tranche) à gauche
    const shortLabel = item.range;
    page.drawText(shortLabel, {
      x: originX,
      y: curY + 2,
      size: 6,
      font: fontRegular,
      color: rgb(0.3, 0.3, 0.3),
    });

    // Barre colorée
    page.drawRectangle({
      x: originX + labelColW,
      y: curY,
      width: barW,
      height: barH - 2,
      color: rgb(r, g, b),
    });

    // Valeur à droite de la barre
    page.drawText(`${item.count} (${pct}%)`, {
      x: originX + labelColW + barW + 4,
      y: curY + 2,
      size: 6,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });

    curY -= (barH + 3);
  });
}

/**
 * Génère le buffer PDF du Bordereau de Classe (A4 Paysage)
 * avec tableau des notes, moyennes, rangs, statistiques, graphique à barres,
 * filigrane "CONFIDENTIEL", entête officiel et zone signature/cachet.
 */
export async function generateClassReportPdf(
  options: GenerateClassReportPdfOptions
): Promise<Uint8Array> {
  const { reportData, className, periodLabel, chartImageBase64, isPrimary } = options;
  const settings: SchoolSettings = await getSchoolSettings();

  // Dimensions A4 Paysage : 841.89 pt x 595.28 pt
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Couleurs de la charte
  const inkColor = rgb(0.082, 0.039, 0.368); // #150A5E
  const slateColor = rgb(0.356, 0.419, 0.51); // #5B6B82
  const lineColor = rgb(0.85, 0.85, 0.85);
  const headerBgColor = rgb(0.94, 0.94, 0.97);
  const zebraBgColor = rgb(0.985, 0.985, 0.99);
  const whiteColor = rgb(1, 1, 1);
  const emeraldColor = rgb(0.06, 0.5, 0.25);
  const roseColor = rgb(0.75, 0.15, 0.15);

  // Logo officiel Le Fanion (primaire ou collège)
  let logoImage: any = null;
  try {
    if (isPrimary) {
      const base64Data = LOGO_PRIMAIRE_BASE64.replace(/^data:image\/jpeg;base64,/, "");
      const logoBuffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      logoImage = await pdfDoc.embedJpg(logoBuffer);
    } else {
      const base64Data = LOGO_FANION_BASE64.replace(/^data:image\/png;base64,/, "");
      const logoBuffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      logoImage = await pdfDoc.embedPng(logoBuffer);
    }
  } catch (e) {
    console.warn("Avertissement: Logo non chargé sur le bordereau:", e);
  }

  // Image capturée du graphique (Recharts DOM) si fournie
  let chartImage: any = null;
  if (chartImageBase64) {
    try {
      const cleanBase64 = chartImageBase64.replace(/^data:image\/png;base64,/, "");
      const chartBuffer = Uint8Array.from(atob(cleanBase64), (c) => c.charCodeAt(0));
      chartImage = await pdfDoc.embedPng(chartBuffer);
    } catch (cErr) {
      console.warn("Avertissement: Impossible d'embarquer l'image PNG Recharts, bascule vers le tracé natif:", cErr);
    }
  }

  const rowsPerPage = 18;
  const totalStudents = reportData.rows.length;
  const totalPages = Math.max(1, Math.ceil(totalStudents / rowsPerPage));

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const page = pdfDoc.addPage([841.89, 595.28]);
    const { width, height } = page.getSize();

    // ── Filigrane diagonal (fond de page) ──
    drawWatermark(page, fontBold, width, height);

    // ── En-tête officiel établissement ──
    const topY = height - 20;

    if (logoImage) {
      page.drawImage(logoImage, {
        x: 35,
        y: topY - 45,
        width: 44,
        height: 44,
      });
    }

    // Coordonnées établissement (school_settings)
    page.drawText(settings.name.toUpperCase(), {
      x: 90,
      y: topY - 10,
      size: 11,
      font: fontBold,
      color: inkColor,
    });

    const contactStr = [settings.address, settings.phone ? `Tél : ${settings.phone}` : null]
      .filter(Boolean)
      .join(" • ");
    if (contactStr) {
      page.drawText(contactStr, {
        x: 90,
        y: topY - 22,
        size: 7.5,
        font: fontRegular,
        color: slateColor,
      });
    }

    // Titre du document encadré à droite
    const titleBoxWidth = 260;
    const titleBoxX = width - titleBoxWidth - 35;
    page.drawRectangle({
      x: titleBoxX,
      y: topY - 46,
      width: titleBoxWidth,
      height: 42,
      borderColor: inkColor,
      borderWidth: 1,
      color: headerBgColor,
    });

    page.drawText("BORDEREAU RÉCAPITULATIF DE CLASSE", {
      x: titleBoxX + 12,
      y: topY - 18,
      size: 9.5,
      font: fontBold,
      color: inkColor,
    });

    page.drawText(`CLASSE : ${className.toUpperCase()}  •  ${periodLabel.toUpperCase()}`, {
      x: titleBoxX + 12,
      y: topY - 32,
      size: 8,
      font: fontBold,
      color: slateColor,
    });

    // ── Ligne de séparation sous l'en-tête ──
    page.drawLine({
      start: { x: 35, y: topY - 54 },
      end: { x: width - 35, y: topY - 54 },
      thickness: 1,
      color: inkColor,
    });

    // ── Définition des colonnes du tableau ──
    const startX = 35;
    const tableWidth = width - 70; // 771.89 pt
    const numColWidth = 22;
    const nameColWidth = 140;
    const moyColWidth = 45;
    const rankColWidth = 40;

    const subjectsCount = reportData.subjects.length;
    const remainingWidth = tableWidth - (numColWidth + nameColWidth + moyColWidth + rankColWidth);
    const subColWidth = subjectsCount > 0 ? Math.max(28, remainingWidth / subjectsCount) : 40;

    const startY = topY - 62;
    const thHeight = 22;

    // En-tête du tableau
    page.drawRectangle({
      x: startX,
      y: startY - thHeight,
      width: tableWidth,
      height: thHeight,
      color: inkColor,
    });

    // Colonne N°
    page.drawText("N°", {
      x: startX + 4,
      y: startY - thHeight + 8,
      size: 7,
      font: fontBold,
      color: whiteColor,
    });

    // Colonne Élève
    page.drawText("ÉLÈVE", {
      x: startX + numColWidth + 6,
      y: startY - thHeight + 8,
      size: 7,
      font: fontBold,
      color: whiteColor,
    });

    // Colonnes Matières
    let curColX = startX + numColWidth + nameColWidth;
    reportData.subjects.forEach((sub) => {
      const shortName = sub.name.length > 7 ? sub.name.substring(0, 6) + "." : sub.name;
      page.drawText(shortName, {
        x: curColX + 2,
        y: startY - thHeight + 11,
        size: 5.5,
        font: fontBold,
        color: whiteColor,
      });
      page.drawText(`c.${sub.coefficient}`, {
        x: curColX + 2,
        y: startY - thHeight + 4,
        size: 5,
        font: fontRegular,
        color: rgb(0.85, 0.85, 0.9),
      });
      curColX += subColWidth;
    });

    // Colonne Moy.
    page.drawText("MOY.", {
      x: curColX + 8,
      y: startY - thHeight + 8,
      size: 7,
      font: fontBold,
      color: whiteColor,
    });
    curColX += moyColWidth;

    // Colonne Rang
    page.drawText("RANG", {
      x: curColX + 6,
      y: startY - thHeight + 8,
      size: 7,
      font: fontBold,
      color: whiteColor,
    });

    // ── Lignes d'élèves de cette page ──
    const startStudentIdx = pageIdx * rowsPerPage;
    const endStudentIdx = Math.min(totalStudents, startStudentIdx + rowsPerPage);
    const pageRows = reportData.rows.slice(startStudentIdx, endStudentIdx);

    const rowHeight = 16;
    let curRowY = startY - thHeight;

    pageRows.forEach((row, i) => {
      curRowY -= rowHeight;
      const globalIdx = startStudentIdx + i + 1;
      const isZebra = i % 2 === 1;

      if (isZebra) {
        page.drawRectangle({
          x: startX,
          y: curRowY,
          width: tableWidth,
          height: rowHeight,
          color: zebraBgColor,
        });
      }

      page.drawLine({
        start: { x: startX, y: curRowY },
        end: { x: startX + tableWidth, y: curRowY },
        thickness: 0.5,
        color: lineColor,
      });

      let cX = startX;

      // N°
      page.drawText(`${globalIdx}`, {
        x: cX + 4,
        y: curRowY + 5,
        size: 6.5,
        font: fontRegular,
        color: slateColor,
      });
      cX += numColWidth;

      // Nom de l'élève
      const fullName = `${row.student.last_name.toUpperCase()} ${row.student.first_name || ""}`;
      const truncatedName = fullName.length > 25 ? fullName.slice(0, 23) + "…" : fullName;
      page.drawText(truncatedName, {
        x: cX + 4,
        y: curRowY + 5,
        size: 6.5,
        font: fontBold,
        color: inkColor,
      });
      cX += nameColWidth;

      // Notes par matière
      reportData.subjects.forEach((sub) => {
        const item = row.gradesBySubject[sub.id];
        const valStr = item?.displayValue ?? "NC";
        page.drawText(valStr, {
          x: cX + 2,
          y: curRowY + 5,
          size: 6,
          font: item?.isNC ? fontItalic : fontRegular,
          color: item?.isNC ? slateColor : inkColor,
        });
        cX += subColWidth;
      });

      // Moyenne
      const moyColor = row.average !== null ? (row.average >= 10 ? emeraldColor : roseColor) : slateColor;
      page.drawText(row.averageDisplay, {
        x: cX + 6,
        y: curRowY + 5,
        size: 6.5,
        font: fontBold,
        color: moyColor,
      });
      cX += moyColWidth;

      // Rang
      page.drawText(row.rankDisplay || "NC", {
        x: cX + 6,
        y: curRowY + 5,
        size: 6.5,
        font: fontBold,
        color: row.rank === 1 ? emeraldColor : inkColor,
      });
    });

    // ── Ligne Moyenne de la Classe (après les élèves) ──
    const subjectAvgRowY = curRowY - rowHeight;

    // Fond de la ligne moyenne (légèrement bleuté)
    page.drawRectangle({
      x: startX,
      y: subjectAvgRowY,
      width: tableWidth,
      height: rowHeight,
      color: rgb(0.9, 0.9, 0.97),
    });

    // Bordure supérieure épaisse pour séparer du tableau
    page.drawLine({
      start: { x: startX, y: curRowY },
      end: { x: startX + tableWidth, y: curRowY },
      thickness: 1,
      color: inkColor,
    });

    let avgRowCX = startX;

    // Label "MOY. CLASSE" (sur les 2 premières colonnes)
    page.drawText("MOY. CLASSE", {
      x: avgRowCX + 4,
      y: subjectAvgRowY + 5,
      size: 6,
      font: fontBold,
      color: inkColor,
    });
    avgRowCX += numColWidth + nameColWidth;

    // Moyenne par matière
    reportData.subjects.forEach((sub) => {
      const sa = reportData.subjectAverages?.[sub.id];
      const dispVal = sa?.display ?? "NC";
      const avg = sa?.average ?? null;
      page.drawText(dispVal, {
        x: avgRowCX + 2,
        y: subjectAvgRowY + 5,
        size: 6,
        font: fontBold,
        color: avg !== null ? (avg >= 10 ? emeraldColor : roseColor) : slateColor,
      });
      avgRowCX += subColWidth;
    });

    // Moyenne générale de la classe
    page.drawText(reportData.stats.classAverageDisplay, {
      x: avgRowCX + 6,
      y: subjectAvgRowY + 5,
      size: 6.5,
      font: fontBold,
      color: reportData.stats.classAverage !== null
        ? (reportData.stats.classAverage >= 10 ? emeraldColor : roseColor)
        : slateColor,
    });

    curRowY = subjectAvgRowY;

    // ── Dernière page : intégration Métriques + Graphique Donut ──
    const isLastPage = pageIdx === totalPages - 1;
    if (isLastPage) {
      const bottomAreaTop = curRowY - 14;

      // Encadré Métriques de synthèse (à gauche)
      const metricsWidth = 320;
      page.drawRectangle({
        x: startX,
        y: bottomAreaTop - 75,
        width: metricsWidth,
        height: 75,
        borderColor: inkColor,
        borderWidth: 0.8,
        color: headerBgColor,
      });

      page.drawText("SYNTHÈSE DE LA CLASSE", {
        x: startX + 10,
        y: bottomAreaTop - 14,
        size: 8,
        font: fontBold,
        color: inkColor,
      });

      page.drawText(`• Effectif noté : ${reportData.stats.rankedStudentsCount} / ${reportData.stats.totalStudents} élèves`, {
        x: startX + 10,
        y: bottomAreaTop - 28,
        size: 7,
        font: fontRegular,
        color: inkColor,
      });

      page.drawText(`• Moyenne générale de la classe : ${reportData.stats.classAverageDisplay} / 20`, {
        x: startX + 10,
        y: bottomAreaTop - 40,
        size: 7,
        font: fontRegular,
        color: inkColor,
      });

      page.drawText(`• Extrêmes : Plus forte note = ${reportData.stats.maxAverageDisplay}  |  Plus faible = ${reportData.stats.minAverageDisplay}`, {
        x: startX + 10,
        y: bottomAreaTop - 52,
        size: 7,
        font: fontRegular,
        color: inkColor,
      });

      const txReussite = reportData.stats.successRate !== null ? `${reportData.stats.successRate.toFixed(1)}%` : "NC";
      page.drawText(`• Taux de réussite (moyennes >= 10/20) : ${txReussite}`, {
        x: startX + 10,
        y: bottomAreaTop - 64,
        size: 7,
        font: fontBold,
        color: emeraldColor,
      });

      // Intégration du Graphique à Barres (distribution) — à droite des métriques
      const chartAreaX = startX + metricsWidth + 25;
      const chartAreaWidth = tableWidth - metricsWidth - 25;

      if (chartImage) {
        // Option 1 : Image PNG haute fidélité capturée depuis Recharts
        const imgH = 80;
        const imgW = Math.min(chartAreaWidth, 260);
        page.drawImage(chartImage, {
          x: chartAreaX + (chartAreaWidth - imgW) / 2,
          y: bottomAreaTop - imgH - 5,
          width: imgW,
          height: imgH,
        });
      } else {
        // Option 2 : Rendu natif vectoriel à barres dans pdf-lib
        drawNativeBarChart(
          page,
          fontBold,
          fontRegular,
          reportData.distribution,
          chartAreaX,
          bottomAreaTop - 80,
          Math.min(chartAreaWidth, 360),
          68
        );
      }

      // ── Zone Signature + Cachet (dernière page, bas à droite) ──
      const sigBoxW = 220;
      const sigBoxH = 58;
      const sigBoxX = width - sigBoxW - startX;
      const sigBoxY = 38; // juste au-dessus du pied de page

      page.drawRectangle({
        x: sigBoxX,
        y: sigBoxY,
        width: sigBoxW,
        height: sigBoxH,
        borderColor: inkColor,
        borderWidth: 0.8,
        color: rgb(0.98, 0.98, 1),
      });

      page.drawText("Signature & Cachet de l'Administration", {
        x: sigBoxX + 8,
        y: sigBoxY + sigBoxH - 12,
        size: 6.5,
        font: fontBold,
        color: inkColor,
      });

      // Ligne de signature (trait fin)
      page.drawLine({
        start: { x: sigBoxX + 8, y: sigBoxY + 24 },
        end: { x: sigBoxX + sigBoxW - 8, y: sigBoxY + 24 },
        thickness: 0.5,
        color: rgb(0.6, 0.6, 0.7),
      });

      page.drawText("Le Principal / Directeur des Etudes", {
        x: sigBoxX + 8,
        y: sigBoxY + 8,
        size: 6,
        font: fontRegular,
        color: rgb(0.45, 0.45, 0.55),
      });
    }

    // ── Pied de page officiel ──
    page.drawLine({
      start: { x: 35, y: 24 },
      end: { x: width - 35, y: 24 },
      thickness: 0.5,
      color: lineColor,
    });

    const dateStr = new Date().toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    page.drawText(`Document généré le ${dateStr} — Collège Privé Le Fanion`, {
      x: 35,
      y: 12,
      size: 6.5,
      font: fontRegular,
      color: slateColor,
    });

    page.drawText(`Page ${pageIdx + 1} / ${totalPages}`, {
      x: width - 85,
      y: 12,
      size: 6.5,
      font: fontRegular,
      color: slateColor,
    });
  }

  return await pdfDoc.save();
}

// ──────────────────────────────────────────────────────────────────────────────
// NOUVEAU BORDEREAU DES MOYENNES (A4 Portrait)
// Rang, Nom, Matricule, Moyenne + Synthèse avec noms >= 10 et < 10
// ──────────────────────────────────────────────────────────────────────────────

export interface GenerateClassAveragesReportPdfOptions {
  reportData: ClassReportData;
  className: string;
  periodLabel: string;
  isPrimary?: boolean;
}

/**
 * Dessine le pied de page du bordereau des moyennes
 */
function drawAveragesFooter(
  page: any,
  fontRegular: any,
  startX: number,
  pageWidth: number,
  currentPage: number,
  totalPages: number,
  lineColor: any,
  slateColor: any
) {
  page.drawLine({
    start: { x: startX, y: 22 },
    end: { x: pageWidth - startX, y: 22 },
    thickness: 0.5,
    color: lineColor,
  });

  const dateStr = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  page.drawText(`Document officiel - Bordereau des Moyennes genere le ${dateStr} - College Prive Le Fanion`, {
    x: startX,
    y: 12,
    size: 6,
    font: fontRegular,
    color: slateColor,
  });

  page.drawText(`Page ${currentPage} / ${totalPages}`, {
    x: pageWidth - startX - 45,
    y: 12,
    size: 6,
    font: fontRegular,
    color: slateColor,
  });
}

/**
 * Dessine le bloc de synthèse complète avec la liste nominative des élèves
 * ayant une moyenne >= 10 et < 10.
 */
function drawAveragesSynthesisBlock(
  page: any,
  fontBold: any,
  fontRegular: any,
  fontItalic: any,
  startX: number,
  startY: number,
  tableWidth: number,
  reportData: ClassReportData,
  totalStudents: number,
  totalRanked: number,
  studentsAbove10: any[],
  studentsBelow10: any[],
  studentsUnranked: any[],
  pctAbove10: string,
  pctBelow10: string,
  inkColor: any,
  slateColor: any,
  emeraldColor: any,
  lightEmeraldBg: any,
  roseColor: any,
  lightRoseBg: any,
  headerBgColor: any,
  lineColor: any,
  whiteColor: any
) {
  let curY = startY;

  // 1. En-tête du bloc synthèse
  const synthHeaderH = 18;
  page.drawRectangle({
    x: startX,
    y: curY - synthHeaderH,
    width: tableWidth,
    height: synthHeaderH,
    color: inkColor,
  });

  page.drawText("SYNTHESE OFFICIELLE & REPARTITION DES RESULTATS", {
    x: startX + 10,
    y: curY - synthHeaderH + 5,
    size: 8,
    font: fontBold,
    color: whiteColor,
  });

  curY -= synthHeaderH;

  // 2. Bandeau récapitulatif des indicateurs généraux
  const kpiBarH = 24;
  page.drawRectangle({
    x: startX,
    y: curY - kpiBarH,
    width: tableWidth,
    height: kpiBarH,
    color: headerBgColor,
    borderColor: lineColor,
    borderWidth: 0.5,
  });

  const kpiText1 = `Effectif Total : ${totalStudents} eleves  |  Ayant compose : ${totalRanked}  |  Non classes : ${studentsUnranked.length}`;
  page.drawText(kpiText1, {
    x: startX + 8,
    y: curY - 10,
    size: 7,
    font: fontBold,
    color: inkColor,
  });

  const kpiText2 = `Moyenne generale : ${reportData.stats.classAverageDisplay}/20  |  Forte : ${reportData.stats.maxAverageDisplay}  |  Faible : ${reportData.stats.minAverageDisplay}`;
  page.drawText(kpiText2, {
    x: startX + 8,
    y: curY - 20,
    size: 6.5,
    font: fontRegular,
    color: slateColor,
  });

  curY -= kpiBarH + 6;

  // 3. Deux cartes de statistiques : Réussite (>= 10) vs Échec (< 10)
  const cardW = (tableWidth - 8) / 2;
  const cardH = 26;

  // Carte Réussite
  page.drawRectangle({
    x: startX,
    y: curY - cardH,
    width: cardW,
    height: cardH,
    color: lightEmeraldBg,
    borderColor: emeraldColor,
    borderWidth: 0.8,
  });

  page.drawText(`MOYENNE >= 10 / 20 (ADMIS)`, {
    x: startX + 8,
    y: curY - 11,
    size: 7,
    font: fontBold,
    color: emeraldColor,
  });

  page.drawText(`${studentsAbove10.length} eleve(s) sur ${totalRanked} composant(s)  -  Taux de reussite : ${pctAbove10}%`, {
    x: startX + 8,
    y: curY - 21,
    size: 6.5,
    font: fontRegular,
    color: emeraldColor,
  });

  // Carte Échec
  const card2X = startX + cardW + 8;
  page.drawRectangle({
    x: card2X,
    y: curY - cardH,
    width: cardW,
    height: cardH,
    color: lightRoseBg,
    borderColor: roseColor,
    borderWidth: 0.8,
  });

  page.drawText(`MOYENNE < 10 / 20 (SOUS LA MOYENNE)`, {
    x: card2X + 8,
    y: curY - 11,
    size: 7,
    font: fontBold,
    color: roseColor,
  });

  page.drawText(`${studentsBelow10.length} eleve(s) sur ${totalRanked} composant(s)  -  Taux d'echec : ${pctBelow10}%`, {
    x: card2X + 8,
    y: curY - 21,
    size: 6.5,
    font: fontRegular,
    color: roseColor,
  });

  curY -= cardH + 6;

  // 4. Listes nominatives des élèves : Élèves >= 10 et Élèves < 10
  // Hauteur dynamique selon le nombre d'élèves
  const maxRowsCount = Math.max(studentsAbove10.length, studentsBelow10.length, 1);
  const itemLineH = 9.5;
  const listAreaH = Math.min(140, Math.max(38, maxRowsCount * itemLineH + 16));

  // Colonne Gauche : Noms des élèves >= 10
  page.drawRectangle({
    x: startX,
    y: curY - listAreaH,
    width: cardW,
    height: listAreaH,
    color: whiteColor,
    borderColor: emeraldColor,
    borderWidth: 0.5,
  });

  // Titre colonne gauche
  page.drawRectangle({
    x: startX,
    y: curY - 14,
    width: cardW,
    height: 14,
    color: lightEmeraldBg,
  });
  page.drawText(`Noms des eleves avec note >= 10 (${studentsAbove10.length})`, {
    x: startX + 6,
    y: curY - 10,
    size: 6.5,
    font: fontBold,
    color: emeraldColor,
  });

  let nameY1 = curY - 22;
  if (studentsAbove10.length === 0) {
    page.drawText("Aucun eleve dans cette tranche", {
      x: startX + 8,
      y: nameY1,
      size: 6.5,
      font: fontItalic,
      color: slateColor,
    });
  } else {
    // Afficher les élèves (jusqu'à 12 par colonne si grand groupe)
    const displayList1 = studentsAbove10.slice(0, 13);
    displayList1.forEach((st, idx) => {
      const rawName = `${st.student.last_name || ""} ${st.student.first_name || ""}`.trim();
      const shortName = rawName.length > 24 ? rawName.substring(0, 22) + ".." : rawName;
      const rankBadge = st.ordinalRankDisplay ? `(${st.ordinalRankDisplay})` : "";
      page.drawText(`${idx + 1}. ${shortName} ${rankBadge}`, {
        x: startX + 6,
        y: nameY1,
        size: 6,
        font: fontRegular,
        color: inkColor,
      });
      page.drawText(`${st.average !== null ? st.average.toFixed(2) : "NC"}`, {
        x: startX + cardW - 28,
        y: nameY1,
        size: 6,
        font: fontBold,
        color: emeraldColor,
      });
      nameY1 -= itemLineH;
    });
    if (studentsAbove10.length > 13) {
      page.drawText(`... et ${studentsAbove10.length - 13} autre(s) eleve(s)`, {
        x: startX + 6,
        y: nameY1,
        size: 5.5,
        font: fontItalic,
        color: slateColor,
      });
    }
  }

  // Colonne Droite : Noms des élèves < 10
  page.drawRectangle({
    x: card2X,
    y: curY - listAreaH,
    width: cardW,
    height: listAreaH,
    color: whiteColor,
    borderColor: roseColor,
    borderWidth: 0.5,
  });

  // Titre colonne droite
  page.drawRectangle({
    x: card2X,
    y: curY - 14,
    width: cardW,
    height: 14,
    color: lightRoseBg,
  });
  page.drawText(`Noms des eleves avec note < 10 (${studentsBelow10.length})`, {
    x: card2X + 6,
    y: curY - 10,
    size: 6.5,
    font: fontBold,
    color: roseColor,
  });

  let nameY2 = curY - 22;
  if (studentsBelow10.length === 0) {
    page.drawText("Aucun eleve sous la moyenne", {
      x: card2X + 8,
      y: nameY2,
      size: 6.5,
      font: fontItalic,
      color: emeraldColor,
    });
  } else {
    const displayList2 = studentsBelow10.slice(0, 13);
    displayList2.forEach((st, idx) => {
      const rawName = `${st.student.last_name || ""} ${st.student.first_name || ""}`.trim();
      const shortName = rawName.length > 24 ? rawName.substring(0, 22) + ".." : rawName;
      const rankBadge = st.ordinalRankDisplay ? `(${st.ordinalRankDisplay})` : "";
      page.drawText(`${idx + 1}. ${shortName} ${rankBadge}`, {
        x: card2X + 6,
        y: nameY2,
        size: 6,
        font: fontRegular,
        color: inkColor,
      });
      page.drawText(`${st.average !== null ? st.average.toFixed(2) : "NC"}`, {
        x: card2X + cardW - 28,
        y: nameY2,
        size: 6,
        font: fontBold,
        color: roseColor,
      });
      nameY2 -= itemLineH;
    });
    if (studentsBelow10.length > 13) {
      page.drawText(`... et ${studentsBelow10.length - 13} autre(s) eleve(s)`, {
        x: card2X + 6,
        y: nameY2,
        size: 5.5,
        font: fontItalic,
        color: slateColor,
      });
    }
  }

  curY -= listAreaH + 6;

  // Élèves non classés (si présents)
  if (studentsUnranked.length > 0) {
    const unrankedNames = studentsUnranked
      .map((s) => `${s.student.last_name} ${s.student.first_name}`)
      .join(", ");
    const unrankedStr = `Eleves non classes (sans note) : ${unrankedNames.length > 90 ? unrankedNames.substring(0, 88) + "..." : unrankedNames}`;
    page.drawText(unrankedStr, {
      x: startX,
      y: curY - 4,
      size: 6,
      font: fontItalic,
      color: slateColor,
    });
    curY -= 12;
  }

  // 5. Zone Signature et Cachet officiel (en bas à droite)
  const sigBoxW = 200;
  const sigBoxH = 46;
  const sigBoxX = startX + tableWidth - sigBoxW;
  const sigBoxY = Math.max(34, curY - sigBoxH - 4);

  page.drawRectangle({
    x: sigBoxX,
    y: sigBoxY,
    width: sigBoxW,
    height: sigBoxH,
    color: rgb(0.98, 0.98, 1),
    borderColor: inkColor,
    borderWidth: 0.8,
  });

  page.drawText("Signature & Cachet de l'Administration", {
    x: sigBoxX + 8,
    y: sigBoxY + sigBoxH - 10,
    size: 6.5,
    font: fontBold,
    color: inkColor,
  });

  page.drawLine({
    start: { x: sigBoxX + 8, y: sigBoxY + 18 },
    end: { x: sigBoxX + sigBoxW - 8, y: sigBoxY + 18 },
    thickness: 0.5,
    color: lineColor,
  });

  page.drawText("Le Principal / Directeur des Etudes", {
    x: sigBoxX + 8,
    y: sigBoxY + 6,
    size: 6,
    font: fontRegular,
    color: slateColor,
  });
}

/**
 * Génère le buffer PDF du Bordereau Récapitulatif des Moyennes (A4 Portrait)
 * avec uniquement les colonnes :
 * - Rang
 * - Nom et Prénoms
 * - Matricule
 * - Moyenne (/20)
 * et une synthèse officielle comprenant la liste nominative des élèves avec
 * note supérieure (>= 10/20) et inférieure (< 10/20).
 */
export async function generateClassAveragesReportPdf(
  options: GenerateClassAveragesReportPdfOptions
): Promise<Uint8Array> {
  const { reportData, className, periodLabel, isPrimary } = options;
  const settings: SchoolSettings = await getSchoolSettings();

  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const inkColor = rgb(0.082, 0.039, 0.368); // #150A5E
  const slateColor = rgb(0.356, 0.419, 0.51); // #5B6B82
  const lineColor = rgb(0.85, 0.85, 0.85);
  const headerBgColor = rgb(0.94, 0.94, 0.97);
  const zebraBgColor = rgb(0.985, 0.985, 0.99);
  const whiteColor = rgb(1, 1, 1);
  const emeraldColor = rgb(0.06, 0.5, 0.25);
  const lightEmeraldBg = rgb(0.93, 0.98, 0.95);
  const roseColor = rgb(0.75, 0.15, 0.15);
  const lightRoseBg = rgb(0.99, 0.94, 0.94);

  let logoImage: any = null;
  try {
    if (isPrimary) {
      const base64Data = LOGO_PRIMAIRE_BASE64.replace(/^data:image\/jpeg;base64,/, "");
      const logoBuffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      logoImage = await pdfDoc.embedJpg(logoBuffer);
    } else {
      const base64Data = LOGO_FANION_BASE64.replace(/^data:image\/png;base64,/, "");
      const logoBuffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      logoImage = await pdfDoc.embedPng(logoBuffer);
    }
  } catch (e) {
    console.warn("Logo non charge sur le bordereau des moyennes:", e);
  }

  // Tri des élèves :
  // 1. Élèves classés par rang croissant (1er, 2e, 3e...)
  // 2. Élèves non classés (NC) par ordre alphabétique
  const sortedRows = [...reportData.rows].sort((a, b) => {
    if (a.isRanked && b.isRanked) {
      return (a.rank ?? 9999) - (b.rank ?? 9999);
    }
    if (a.isRanked && !b.isRanked) return -1;
    if (!a.isRanked && b.isRanked) return 1;
    return (a.student.last_name || "").localeCompare(b.student.last_name || "");
  });

  const studentsAbove10 = sortedRows.filter((r) => r.average !== null && r.average >= 10);
  const studentsBelow10 = sortedRows.filter((r) => r.average !== null && r.average < 10);
  const studentsUnranked = sortedRows.filter((r) => r.average === null);

  const totalStudents = sortedRows.length;
  const totalRanked = reportData.stats.rankedStudentsCount;
  const pctAbove10 = totalRanked > 0 ? ((studentsAbove10.length / totalRanked) * 100).toFixed(1) : "0";
  const pctBelow10 = totalRanked > 0 ? ((studentsBelow10.length / totalRanked) * 100).toFixed(1) : "0";

  // Dimensions A4 Portrait : 595.28 pt x 841.89 pt
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const startX = 36;
  const tableWidth = pageWidth - startX * 2; // 523.28 pt

  const colRankW = 60;
  const colNameW = 263.28;
  const colMatriculeW = 100;
  const colAverageW = 100;
  const rowHeight = 18;
  const thHeight = 22;

  // Calcul du nombre de lignes de tableau par page
  const fitsSinglePage = totalStudents <= 16;
  const rowsPerPage = fitsSinglePage ? totalStudents : 26;

  // Découpage en pages
  const chunks: (typeof sortedRows)[] = [];
  for (let i = 0; i < sortedRows.length; i += rowsPerPage) {
    chunks.push(sortedRows.slice(i, i + rowsPerPage));
  }
  if (chunks.length === 0) chunks.push([]);

  const lastChunkRows = chunks[chunks.length - 1].length;
  const needExtraSynthesisPage = !fitsSinglePage && lastChunkRows > 12;
  const totalPages = needExtraSynthesisPage ? chunks.length + 1 : chunks.length;

  for (let pageIdx = 0; pageIdx < chunks.length; pageIdx++) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    const { width, height } = page.getSize();

    drawWatermark(page, fontBold, width, height);

    // En-tête officiel
    const topY = height - 25;

    // En-tête bilingue officiel Cameroun
    page.drawText("REPUBLIQUE DU CAMEROUN", {
      x: startX,
      y: topY,
      size: 7,
      font: fontBold,
      color: inkColor,
    });
    page.drawText("Paix - Travail - Patrie", {
      x: startX,
      y: topY - 9,
      size: 6,
      font: fontRegular,
      color: slateColor,
    });
    page.drawText(isPrimary ? "MINISTERE DE L'EDUCATION DE BASE" : "MINISTERE DES ENSEIGNEMENTS SECONDAIRES", {
      x: startX,
      y: topY - 18,
      size: 5.5,
      font: fontBold,
      color: inkColor,
    });

    const rightHeaderX = width - startX - 160;
    page.drawText("REPUBLIC OF CAMEROON", {
      x: rightHeaderX,
      y: topY,
      size: 7,
      font: fontBold,
      color: inkColor,
    });
    page.drawText("Peace - Work - Fatherland", {
      x: rightHeaderX,
      y: topY - 9,
      size: 6,
      font: fontRegular,
      color: slateColor,
    });
    page.drawText(isPrimary ? "MINISTRY OF BASIC EDUCATION" : "MINISTRY OF SECONDARY EDUCATION", {
      x: rightHeaderX,
      y: topY - 18,
      size: 5.5,
      font: fontBold,
      color: inkColor,
    });

    // Logo officiel
    if (logoImage) {
      page.drawImage(logoImage, {
        x: width / 2 - 20,
        y: topY - 32,
        width: 40,
        height: 40,
      });
    }

    // Nom de l'établissement
    const schoolNameStr = settings.name.toUpperCase();
    const schoolNameW = fontBold.widthOfTextAtSize(schoolNameStr, 11);
    page.drawText(schoolNameStr, {
      x: (width - schoolNameW) / 2,
      y: topY - 48,
      size: 11,
      font: fontBold,
      color: inkColor,
    });

    const contactStr = [settings.address, settings.phone ? `Tel : ${settings.phone}` : null]
      .filter(Boolean)
      .join(" - ");
    if (contactStr) {
      const contactW = fontRegular.widthOfTextAtSize(contactStr, 6.5);
      page.drawText(contactStr, {
        x: (width - contactW) / 2,
        y: topY - 58,
        size: 6.5,
        font: fontRegular,
        color: slateColor,
      });
    }

    // Bandeau Titre
    const titleBoxH = 34;
    const titleBoxY = topY - 98;
    page.drawRectangle({
      x: startX,
      y: titleBoxY,
      width: tableWidth,
      height: titleBoxH,
      borderColor: inkColor,
      borderWidth: 1,
      color: headerBgColor,
    });

    const mainTitle = "BORDEREAU RECAPITULATIF DES MOYENNES ET RANGS";
    const mainTitleW = fontBold.widthOfTextAtSize(mainTitle, 9.5);
    page.drawText(mainTitle, {
      x: startX + (tableWidth - mainTitleW) / 2,
      y: titleBoxY + 19,
      size: 9.5,
      font: fontBold,
      color: inkColor,
    });

    const subTitle = `CLASSE : ${className.toUpperCase()}   |   PERIODE : ${periodLabel.toUpperCase()}   |   EFFECTIF : ${totalStudents} ELEVE(S)`;
    const subTitleW = fontBold.widthOfTextAtSize(subTitle, 7.5);
    page.drawText(subTitle, {
      x: startX + (tableWidth - subTitleW) / 2,
      y: titleBoxY + 7,
      size: 7.5,
      font: fontBold,
      color: slateColor,
    });

    // Tableau des élèves
    let currentY = titleBoxY - 8;

    // En-tête du tableau
    page.drawRectangle({
      x: startX,
      y: currentY - thHeight,
      width: tableWidth,
      height: thHeight,
      color: inkColor,
    });

    // Colonne 1 : RANG
    const thRankW = fontBold.widthOfTextAtSize("RANG", 7.5);
    page.drawText("RANG", {
      x: startX + (colRankW - thRankW) / 2,
      y: currentY - thHeight + 7,
      size: 7.5,
      font: fontBold,
      color: whiteColor,
    });

    // Colonne 2 : NOM ET PRENOMS
    page.drawText("NOM ET PRENOMS DE L'ELEVE", {
      x: startX + colRankW + 8,
      y: currentY - thHeight + 7,
      size: 7.5,
      font: fontBold,
      color: whiteColor,
    });

    // Colonne 3 : MATRICULE
    const thMatW = fontBold.widthOfTextAtSize("MATRICULE", 7.5);
    page.drawText("MATRICULE", {
      x: startX + colRankW + colNameW + (colMatriculeW - thMatW) / 2,
      y: currentY - thHeight + 7,
      size: 7.5,
      font: fontBold,
      color: whiteColor,
    });

    // Colonne 4 : MOYENNE / 20
    const thMoyW = fontBold.widthOfTextAtSize("MOYENNE / 20", 7.5);
    page.drawText("MOYENNE / 20", {
      x: startX + colRankW + colNameW + colMatriculeW + (colAverageW - thMoyW) / 2,
      y: currentY - thHeight + 7,
      size: 7.5,
      font: fontBold,
      color: whiteColor,
    });

    currentY -= thHeight;

    // Lignes d'élèves du chunk
    const pageRows = chunks[pageIdx];
    pageRows.forEach((row, rowIdx) => {
      const isEven = rowIdx % 2 === 0;
      page.drawRectangle({
        x: startX,
        y: currentY - rowHeight,
        width: tableWidth,
        height: rowHeight,
        color: isEven ? whiteColor : zebraBgColor,
      });

      page.drawLine({
        start: { x: startX, y: currentY - rowHeight },
        end: { x: startX + tableWidth, y: currentY - rowHeight },
        thickness: 0.5,
        color: lineColor,
      });

      // RANG
      const rankText = row.ordinalRankDisplay || (row.rank ? `${row.rank}e` : "NC");
      const isTop3 = row.rank !== null && row.rank <= 3;
      const rankW = fontBold.widthOfTextAtSize(rankText, 7.5);
      page.drawText(rankText, {
        x: startX + (colRankW - rankW) / 2,
        y: currentY - rowHeight + 5.5,
        size: 7.5,
        font: fontBold,
        color: isTop3 ? emeraldColor : (row.isRanked ? inkColor : slateColor),
      });

      // NOM ET PRENOMS
      const rawName = `${row.student.last_name || ""} ${row.student.first_name || ""}`.trim();
      const displayName = rawName.length > 36 ? rawName.substring(0, 34) + ".." : rawName;
      page.drawText(displayName, {
        x: startX + colRankW + 8,
        y: currentY - rowHeight + 5.5,
        size: 7.5,
        font: fontBold,
        color: inkColor,
      });

      // MATRICULE
      const matStr = row.student.matricule || "-";
      const matW = fontRegular.widthOfTextAtSize(matStr, 7);
      page.drawText(matStr, {
        x: startX + colRankW + colNameW + (colMatriculeW - matW) / 2,
        y: currentY - rowHeight + 5.5,
        size: 7,
        font: fontRegular,
        color: slateColor,
      });

      // MOYENNE / 20
      let avgStr = "NC";
      let avgColor = slateColor;
      let avgFont = fontItalic;

      if (row.average !== null) {
        avgStr = `${row.average.toFixed(2)} / 20`;
        avgFont = fontBold;
        avgColor = row.average >= 10 ? emeraldColor : roseColor;
      }

      const avgW = avgFont.widthOfTextAtSize(avgStr, 8);
      page.drawText(avgStr, {
        x: startX + colRankW + colNameW + colMatriculeW + (colAverageW - avgW) / 2,
        y: currentY - rowHeight + 5.5,
        size: 8,
        font: avgFont,
        color: avgColor,
      });

      currentY -= rowHeight;
    });

    const isLastTablePage = pageIdx === chunks.length - 1;
    if (isLastTablePage && !needExtraSynthesisPage) {
      drawAveragesSynthesisBlock(
        page,
        fontBold,
        fontRegular,
        fontItalic,
        startX,
        currentY - 10,
        tableWidth,
        reportData,
        totalStudents,
        totalRanked,
        studentsAbove10,
        studentsBelow10,
        studentsUnranked,
        pctAbove10,
        pctBelow10,
        inkColor,
        slateColor,
        emeraldColor,
        lightEmeraldBg,
        roseColor,
        lightRoseBg,
        headerBgColor,
        lineColor,
        whiteColor
      );
    }

    drawAveragesFooter(page, fontRegular, startX, width, pageIdx + 1, totalPages, lineColor, slateColor);
  }

  // Page supplémentaire pour la synthèse si nécessaire
  if (needExtraSynthesisPage) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    const { width, height } = page.getSize();

    drawWatermark(page, fontBold, width, height);

    const topY = height - 25;
    page.drawText(`${settings.name.toUpperCase()} - BORDEREAU DES MOYENNES (SUITE & SYNTHESE)`, {
      x: startX,
      y: topY,
      size: 9,
      font: fontBold,
      color: inkColor,
    });
    page.drawText(`CLASSE : ${className.toUpperCase()}  |  PERIODE : ${periodLabel.toUpperCase()}`, {
      x: startX,
      y: topY - 14,
      size: 7.5,
      font: fontRegular,
      color: slateColor,
    });

    page.drawLine({
      start: { x: startX, y: topY - 22 },
      end: { x: width - startX, y: topY - 22 },
      thickness: 1,
      color: inkColor,
    });

    drawAveragesSynthesisBlock(
      page,
      fontBold,
      fontRegular,
      fontItalic,
      startX,
      topY - 32,
      tableWidth,
      reportData,
      totalStudents,
      totalRanked,
      studentsAbove10,
      studentsBelow10,
      studentsUnranked,
      pctAbove10,
      pctBelow10,
      inkColor,
      slateColor,
      emeraldColor,
      lightEmeraldBg,
      roseColor,
      lightRoseBg,
      headerBgColor,
      lineColor,
      whiteColor
    );

    drawAveragesFooter(page, fontRegular, startX, width, totalPages, totalPages, lineColor, slateColor);
  }

  return await pdfDoc.save();
}

