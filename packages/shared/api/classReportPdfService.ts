import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import { ClassReportData } from "../services/classReportService";
import { getSchoolSettings, SchoolSettings } from "../services/settingsService";
import { LOGO_FANION_BASE64 } from "../assets/logoBase64";

export interface GenerateClassReportPdfOptions {
  reportData: ClassReportData;
  className: string;
  periodLabel: string;
  chartImageBase64?: string | null; // Image PNG du graphique de distribution capturée depuis le DOM
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
  const { reportData, className, periodLabel, chartImageBase64 } = options;
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

  // Logo officiel Le Fanion
  let logoImage: any = null;
  try {
    const base64Data = LOGO_FANION_BASE64.replace(/^data:image\/png;base64,/, "");
    const logoBuffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    logoImage = await pdfDoc.embedPng(logoBuffer);
  } catch (e) {
    console.warn("Avertissement: Logo Le Fanion non chargé sur le bordereau:", e);
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
