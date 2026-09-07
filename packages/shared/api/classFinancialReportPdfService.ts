import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { ClassFinancialReport } from "./financialReportService";
import { getSchoolSettings, SchoolSettings } from "../services/settingsService";
import { LOGO_FANION_BASE64 } from "../assets/logoBase64";

function formatAmount(amt: number): string {
  return Math.round(amt || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Génère le buffer PDF (A4 Paysage) de la fiche de paiement et état financier d'une classe.
 */
export async function generateClassFinancialReportPdf(
  report: ClassFinancialReport,
  schoolYearLabel: string
): Promise<Uint8Array> {
  const settings: SchoolSettings = await getSchoolSettings();

  // Dimensions A4 Paysage : 841.89 pt x 595.28 pt
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Couleurs de la charte Fanion
  const inkColor = rgb(0.082, 0.039, 0.368); // #150A5E
  const slateColor = rgb(0.356, 0.419, 0.51); // #5B6B82
  const lineColor = rgb(0.85, 0.85, 0.85);
  const headerBgColor = rgb(0.94, 0.94, 0.97);
  const whiteColor = rgb(1, 1, 1);
  const greenColor = rgb(0.118, 0.478, 0.298); // #1E7A4C
  const goldColor = rgb(0.788, 0.604, 0.231); // #C99A3B
  const redColor = rgb(0.702, 0.263, 0.18); // #B3432E
  const zebraBgColor = rgb(0.985, 0.985, 0.99);

  // Logo officiel
  let logoImage: any = null;
  try {
    const base64Data = LOGO_FANION_BASE64.replace(/^data:image\/png;base64,/, "");
    const logoBuffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    logoImage = await pdfDoc.embedPng(logoBuffer);
  } catch (e) {
    console.warn("Avertissement: Logo non chargé sur l'état financier:", e);
  }

  const trancheLabels = (report.feeSchedule?.installments_json || []).map((t) => t.label);
  const hasTranches = trancheLabels.length > 0;

  // Calcul du nombre de lignes par page
  const rowsPerPage = 16;
  const totalStudents = report.students.length;
  const totalPages = Math.max(1, Math.ceil(totalStudents / rowsPerPage));

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const page = pdfDoc.addPage([841.89, 595.28]);
    const { width, height } = page.getSize();

    // ── En-tête officiel ──
    const topY = height - 25;

    // Logo
    if (logoImage) {
      page.drawImage(logoImage, {
        x: 35,
        y: topY - 50,
        width: 48,
        height: 48,
      });
    }

    // Coordonnées établissement (school_settings)
    page.drawText(settings.name.toUpperCase(), {
      x: 95,
      y: topY - 12,
      size: 11,
      font: fontBold,
      color: inkColor,
    });

    const contactStr = [settings.address, settings.phone ? `Tél : ${settings.phone}` : null]
      .filter(Boolean)
      .join(" • ");
    if (contactStr) {
      page.drawText(contactStr, {
        x: 95,
        y: topY - 26,
        size: 8,
        font: fontRegular,
        color: slateColor,
      });
    }

    if (settings.legal_notice) {
      page.drawText(settings.legal_notice, {
        x: 95,
        y: topY - 38,
        size: 7.5,
        font: fontItalic,
        color: slateColor,
      });
    }

    // Cartouche Titre Centré / Droite
    page.drawRectangle({
      x: width - 360,
      y: topY - 52,
      width: 325,
      height: 52,
      borderColor: inkColor,
      borderWidth: 1,
      color: headerBgColor,
    });

    page.drawText("ÉTAT FINANCIER & PAIEMENTS DE CLASSE", {
      x: width - 350,
      y: topY - 20,
      size: 10.5,
      font: fontBold,
      color: inkColor,
    });

    page.drawText(`CLASSE : ${report.className}   |   ANNÉE : ${schoolYearLabel}`, {
      x: width - 350,
      y: topY - 34,
      size: 8.5,
      font: fontBold,
      color: slateColor,
    });

    const dateStr = new Date().toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    page.drawText(`Édité le ${dateStr} • Page ${pageIdx + 1} / ${totalPages}`, {
      x: width - 350,
      y: topY - 46,
      size: 7.5,
      font: fontRegular,
      color: slateColor,
    });

    // ── Définition des colonnes du tableau ──
    // Largeur totale disponible = 841.89 - 70 = 771.89
    const startX = 35;
    const startY = topY - 70;
    const tableWidth = width - 70;

    // Colonnes : N° (25), Matricule (55), Nom & Prénoms (155), Inscription (65), Scolarité (65), Tranches (variable ~ 160), Total Versé (65), Reste Dû (65)
    const baseCols = [
      { id: "idx", label: "N°", width: 25 },
      { id: "matricule", label: "Matricule", width: 55 },
      { id: "name", label: "Élève (Nom & Prénoms)", width: 175 },
      { id: "reg", label: "Inscript.", width: 60 },
      { id: "tuition", label: "Scolarité", width: 70 },
    ];

    // Tranches
    const trancheColWidth = hasTranches ? Math.min(65, Math.floor(180 / trancheLabels.length)) : 0;
    const trancheCols = trancheLabels.map((t) => ({
      id: `tranche_${t}`,
      label: t,
      width: trancheColWidth,
    }));

    const endCols = [
      { id: "total_paid", label: "Total Versé", width: 75 },
      { id: "remaining", label: "Reste à payer", width: 75 },
      { id: "status", label: "Statut", width: tableWidth - (385 + (trancheLabels.length * trancheColWidth) + 150) },
    ];

    const allCols = [...baseCols, ...trancheCols, ...endCols];

    // Dessin En-tête Tableau
    const thHeight = 22;
    page.drawRectangle({
      x: startX,
      y: startY - thHeight,
      width: tableWidth,
      height: thHeight,
      borderColor: inkColor,
      borderWidth: 0.8,
      color: inkColor,
    });

    let curColX = startX;
    allCols.forEach((col) => {
      page.drawText(col.label, {
        x: curColX + 4,
        y: startY - thHeight + 7,
        size: 7.5,
        font: fontBold,
        color: whiteColor,
      });
      curColX += col.width;
    });

    // Dessin des lignes élèves de cette page
    const startStudentIdx = pageIdx * rowsPerPage;
    const endStudentIdx = Math.min(totalStudents, startStudentIdx + rowsPerPage);
    const pageStudents = report.students.slice(startStudentIdx, endStudentIdx);

    const rowHeight = 18;
    let curRowY = startY - thHeight;

    pageStudents.forEach((st, i) => {
      curRowY -= rowHeight;
      const globalIdx = startStudentIdx + i + 1;
      const isZebra = i % 2 === 1;

      // Fond zébré
      if (isZebra) {
        page.drawRectangle({
          x: startX,
          y: curRowY,
          width: tableWidth,
          height: rowHeight,
          color: zebraBgColor,
        });
      }

      // Ligne séparatrice inférieure
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
        size: 7,
        font: fontRegular,
        color: slateColor,
      });
      cX += allCols[0].width;

      // Matricule
      page.drawText(st.matricule || "—", {
        x: cX + 4,
        y: curRowY + 5,
        size: 7,
        font: fontRegular,
        color: slateColor,
      });
      cX += allCols[1].width;

      // Nom
      const fullName = `${st.lastName.toUpperCase()} ${st.firstName}`;
      const truncatedName = fullName.length > 32 ? fullName.slice(0, 30) + "…" : fullName;
      page.drawText(truncatedName, {
        x: cX + 4,
        y: curRowY + 5,
        size: 7.5,
        font: fontBold,
        color: inkColor,
      });
      cX += allCols[2].width;

      // Inscription
      const regText = `${formatAmount(st.registrationFeePaid)} / ${formatAmount(st.registrationFeeExpected)}`;
      page.drawText(regText, {
        x: cX + 2,
        y: curRowY + 5,
        size: 6.8,
        font: fontRegular,
        color: st.isRegistrationComplete ? greenColor : redColor,
      });
      cX += allCols[3].width;

      // Scolarité
      const overrideTag = st.hasTuitionOverride ? "*" : "";
      page.drawText(`${formatAmount(st.tuitionExpected)}${overrideTag}`, {
        x: cX + 4,
        y: curRowY + 5,
        size: 7,
        font: fontRegular,
        color: inkColor,
      });
      cX += allCols[4].width;

      // Tranches
      st.trancheBreakdown.forEach((tb) => {
        let statusCol = tb.status === "paid" ? greenColor : tb.status === "partial" ? goldColor : redColor;
        page.drawText(formatAmount(tb.paid), {
          x: cX + 4,
          y: curRowY + 5,
          size: 6.8,
          font: fontRegular,
          color: statusCol,
        });
        cX += trancheColWidth;
      });

      // Total versé
      page.drawText(formatAmount(st.totalPaid), {
        x: cX + 4,
        y: curRowY + 5,
        size: 7.5,
        font: fontBold,
        color: greenColor,
      });
      cX += allCols[allCols.length - 3].width;

      // Reste à payer
      page.drawText(formatAmount(st.remainingDue), {
        x: cX + 4,
        y: curRowY + 5,
        size: 7.5,
        font: fontBold,
        color: st.remainingDue === 0 ? greenColor : redColor,
      });
      cX += allCols[allCols.length - 2].width;

      // Statut badge
      const statusLabel =
        st.remainingDue === 0
          ? "Soldé"
          : st.totalPaid > 0
          ? "Partiel"
          : "Non commencé";
      const badgeColor =
        st.remainingDue === 0 ? greenColor : st.totalPaid > 0 ? goldColor : redColor;
      page.drawText(statusLabel, {
        x: cX + 4,
        y: curRowY + 5,
        size: 7,
        font: fontBold,
        color: badgeColor,
      });
    });

    // ── Si dernière page : Ligne de totaux et Cartouche Synthèse ──
    if (pageIdx === totalPages - 1) {
      curRowY -= 20;
      // Ligne Récapitulative Totaux
      page.drawRectangle({
        x: startX,
        y: curRowY,
        width: tableWidth,
        height: 20,
        borderColor: inkColor,
        borderWidth: 1,
        color: headerBgColor,
      });

      page.drawText(`TOTAUX CLASSE (${report.summary.totalStudents} élèves)`, {
        x: startX + 6,
        y: curRowY + 6,
        size: 8,
        font: fontBold,
        color: inkColor,
      });

      page.drawText(`Attendu : ${formatAmount(report.summary.totalExpected)} FCFA`, {
        x: startX + 220,
        y: curRowY + 6,
        size: 8,
        font: fontBold,
        color: inkColor,
      });

      page.drawText(`Encaissé : ${formatAmount(report.summary.totalPaid)} FCFA`, {
        x: startX + 410,
        y: curRowY + 6,
        size: 8,
        font: fontBold,
        color: greenColor,
      });

      page.drawText(`Reste Dû : ${formatAmount(report.summary.totalRemainingDue)} FCFA`, {
        x: startX + 570,
        y: curRowY + 6,
        size: 8,
        font: fontBold,
        color: redColor,
      });

      page.drawText(`Taux : ${report.summary.collectionRate}%`, {
        x: startX + 710,
        y: curRowY + 6,
        size: 8,
        font: fontBold,
        color: inkColor,
      });

      // Cartouche signatures
      const signY = curRowY - 55;
      page.drawText("L'Économe / Le Caissier", {
        x: startX + 50,
        y: signY + 30,
        size: 8.5,
        font: fontBold,
        color: inkColor,
      });
      page.drawText("(Visa & Signature)", {
        x: startX + 50,
        y: signY + 18,
        size: 7,
        font: fontItalic,
        color: slateColor,
      });

      page.drawText("La Direction / Le Principal", {
        x: width - 230,
        y: signY + 30,
        size: 8.5,
        font: fontBold,
        color: inkColor,
      });
      page.drawText("(Cachet & Signature)", {
        x: width - 230,
        y: signY + 18,
        size: 7,
        font: fontItalic,
        color: slateColor,
      });
    }

    // Bas de page
    page.drawText(
      `Document interne officiel — ${settings.name} — Confidentialité administrative et financière strictement réservée`,
      {
        x: startX,
        y: 15,
        size: 6.8,
        font: fontItalic,
        color: slateColor,
      }
    );
  }

  return await pdfDoc.save();
}
