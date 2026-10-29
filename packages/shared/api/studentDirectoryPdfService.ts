import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import { supabase } from "./supabaseClient";
import { getSchoolSettings, SchoolSettings } from "../services/settingsService";
import { LOGO_FANION_BASE64 } from "../assets/logoBase64";
import { LOGO_PRIMAIRE_BASE64 } from "../assets/logoPrimaireBase64";

/**
 * Données d'un élève enrichi pour le répertoire PDF
 */
export interface StudentDirectoryEntry {
  id: string;
  matricule: string | null;
  last_name: string;
  first_name: string;
  birth_date: string | null;
  birth_place: string | null;
  gender: "M" | "F";
  nationality: string | null;
  is_repeating: boolean;
  class_id: string;
  guardian_name: string;
  guardian_phone: string;
  status: string;
  photo_path: string | null;
  enrolled_at: string | null;
  created_at: string | null;
}

export interface GenerateStudentDirectoryOptions {
  classId: string;
  className: string;
  schoolYearLabel?: string;
}

/**
 * Formate une date ISO en format français court
 */
function formatDateFr(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Tronque un texte à une longueur maximale
 */
function truncate(text: string | null | undefined, max: number): string {
  if (!text) return "—";
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

/**
 * Dessine le filigrane diagonal sur une page
 */
function drawWatermark(page: any, fontBold: any, width: number, height: number): void {
  page.drawText("CONFIDENTIEL", {
    x: width / 2 - 120,
    y: height / 2 - 18,
    size: 56,
    font: fontBold,
    color: rgb(0.88, 0.88, 0.9),
    rotate: degrees(45),
    opacity: 0.15,
  });
}

/**
 * Dessine l'en-tête officiel de l'établissement sur une page
 */
function drawPageHeader(
  page: any,
  params: {
    logoImage: any;
    settings: SchoolSettings;
    isPrimary: boolean;
    className: string;
    schoolYearLabel: string;
    fontBold: any;
    fontRegular: any;
    pageIdx: number;
    totalPages: number;
    width: number;
    height: number;
    inkColor: any;
    slateColor: any;
    lineColor: any;
    headerBgColor: any;
  }
): number {
  const {
    logoImage, settings, isPrimary, className, schoolYearLabel,
    fontBold, fontRegular, width, height,
    inkColor, slateColor, headerBgColor,
  } = params;

  const topY = height - 22;

  // ── Logo établissement ──
  if (logoImage) {
    page.drawImage(logoImage, {
      x: 36,
      y: topY - 50,
      width: 48,
      height: 48,
    });
  }

  // ── Nom de l'établissement ──
  const schoolName = isPrimary
    ? (settings.primary_name || "Complexe Scolaire Bilingue La Grâce").toUpperCase()
    : (settings.name || "Collège Privé Laïc Le Fanion").toUpperCase();

  const legalNotice = isPrimary
    ? (settings.primary_legal_notice || "Enseignement Primaire et Maternel")
    : (settings.legal_notice || "Établissement d'Enseignement Secondaire Général et Bilingue");

  page.drawText(schoolName, {
    x: 94,
    y: topY - 12,
    size: 11,
    font: fontBold,
    color: inkColor,
  });

  page.drawText(legalNotice, {
    x: 94,
    y: topY - 25,
    size: 7.5,
    font: fontRegular,
    color: slateColor,
  });

  const contactParts: string[] = [];
  if (settings.address) contactParts.push(settings.address);
  if (settings.phone) contactParts.push(`Tél : ${settings.phone}`);
  if (contactParts.length > 0) {
    page.drawText(contactParts.join(" • "), {
      x: 94,
      y: topY - 37,
      size: 6.5,
      font: fontRegular,
      color: slateColor,
    });
  }

  // ── Encadré titre du document (côté droit) ──
  const titleBoxW = 240;
  const titleBoxX = width - titleBoxW - 36;
  page.drawRectangle({
    x: titleBoxX,
    y: topY - 52,
    width: titleBoxW,
    height: 48,
    borderColor: inkColor,
    borderWidth: 1,
    color: headerBgColor,
  });

  page.drawText("RÉPERTOIRE DES ÉLÈVES", {
    x: titleBoxX + 10,
    y: topY - 18,
    size: 10,
    font: fontBold,
    color: inkColor,
  });

  page.drawText(`CLASSE : ${className.toUpperCase()}`, {
    x: titleBoxX + 10,
    y: topY - 31,
    size: 8,
    font: fontBold,
    color: slateColor,
  });

  if (schoolYearLabel) {
    page.drawText(`Année scolaire : ${schoolYearLabel}`, {
      x: titleBoxX + 10,
      y: topY - 43,
      size: 7,
      font: fontRegular,
      color: slateColor,
    });
  }

  // ── Ligne de séparation sous l'en-tête ──
  const headerBottomY = topY - 58;
  page.drawLine({
    start: { x: 36, y: headerBottomY },
    end: { x: width - 36, y: headerBottomY },
    thickness: 1.2,
    color: inkColor,
  });

  return headerBottomY;
}

/**
 * Dessine le pied de page sur une page
 */
function drawPageFooter(
  page: any,
  params: {
    fontRegular: any;
    slateColor: any;
    lineColor: any;
    width: number;
    pageIdx: number;
    totalPages: number;
    isPrimary: boolean;
    settings: SchoolSettings;
  }
): void {
  const { fontRegular, slateColor, lineColor, width, pageIdx, totalPages, isPrimary, settings } = params;
  const footerY = 22;

  page.drawLine({
    start: { x: 36, y: footerY + 10 },
    end: { x: width - 36, y: footerY + 10 },
    thickness: 0.5,
    color: lineColor,
  });

  const dateStr = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const schoolShortName = isPrimary
    ? (settings.primary_name || "Complexe Scolaire Bilingue La Grâce")
    : (settings.name || "Collège Privé Laïc Le Fanion");

  page.drawText(`Document généré le ${dateStr} — ${schoolShortName}`, {
    x: 36,
    y: footerY,
    size: 6.5,
    font: fontRegular,
    color: slateColor,
  });

  page.drawText(`Page ${pageIdx + 1} / ${totalPages}`, {
    x: width - 80,
    y: footerY,
    size: 6.5,
    font: fontRegular,
    color: slateColor,
  });
}

/**
 * Génère un PDF répertoire des élèves d'une classe donnée.
 * Format A4 Portrait — une ligne par élève avec toutes ses informations d'inscription.
 * En-tête et logo adaptés à la division (Collège = Fanion, Primaire = logo primaire).
 */
export async function generateStudentDirectoryPdf(
  options: GenerateStudentDirectoryOptions
): Promise<Uint8Array> {
  const { classId, className, schoolYearLabel = "" } = options;

  // ── 1. Récupérer les infos de la classe (division) ──
  const { data: classData, error: classErr } = await supabase
    .from("classes")
    .select("*, divisions(id, nom)")
    .eq("id", classId)
    .single();

  if (classErr || !classData) {
    throw new Error("Impossible de récupérer la classe pour le répertoire.");
  }

  const divisionNom: string = (classData.divisions as any)?.nom || "";
  const isPrimary = divisionNom.toLowerCase().includes("primaire");

  // ── 2. Récupérer les élèves de la classe ──
  const { data: students, error: studErr } = await supabase
    .from("students")
    .select("*")
    .eq("class_id", classId)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (studErr) {
    throw new Error(`Impossible de récupérer les élèves : ${studErr.message}`);
  }

  const studentList: StudentDirectoryEntry[] = (students || []) as StudentDirectoryEntry[];

  // ── 3. Récupérer les paramètres de l'établissement ──
  const settings: SchoolSettings = await getSchoolSettings();

  // ── 4. Initialiser le document PDF ──
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // ── Palette de couleurs de la charte graphique ──
  const inkColor = rgb(0.082, 0.039, 0.368);     // #150A5E violet foncé
  const slateColor = rgb(0.356, 0.419, 0.51);    // #5B6B82 gris bleuté
  const lineColor = rgb(0.85, 0.85, 0.85);        // gris clair
  const headerBgColor = rgb(0.94, 0.94, 0.97);   // fond bleu très pâle
  const zebraBgColor = rgb(0.975, 0.975, 0.99);  // alternance lignes
  const whiteColor = rgb(1, 1, 1);
  const emeraldColor = rgb(0.06, 0.5, 0.25);
  const amberColor = rgb(0.6, 0.4, 0.0);
  const roseColor = rgb(0.7, 0.15, 0.15);

  // ── 5. Charger le logo selon la division ──
  let logoImage: any = null;
  try {
    if (isPrimary) {
      const b64 = LOGO_PRIMAIRE_BASE64.replace(/^data:image\/jpeg;base64,/, "");
      const buf = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      logoImage = await pdfDoc.embedJpg(buf);
    } else {
      const b64 = LOGO_FANION_BASE64.replace(/^data:image\/png;base64,/, "");
      const buf = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      logoImage = await pdfDoc.embedPng(buf);
    }
  } catch (e) {
    console.warn("Logo non chargé pour le répertoire:", e);
  }

  // ── 6. Configuration du layout A4 Portrait : 595.28 pt x 841.89 pt ──
  const pageW = 595.28;
  const pageH = 841.89;
  const startX = 36;
  const usableW = pageW - 72; // 36 gauche + 36 droite

  // Définition des colonnes avec leurs largeurs (total doit = usableW = 523.28)
  type ColDef = { key: string; label: string; width: number };
  const colDefs: ColDef[] = [
    { key: "num",       label: "N°",           width: 20  },
    { key: "matricule", label: "Matricule",     width: 72  },
    { key: "nom",       label: "Nom et Prénom", width: 110 },
    { key: "naissance", label: "Né(e) le",      width: 44  },
    { key: "lieu",      label: "Lieu naiss.",   width: 52  },
    { key: "genre",     label: "G.",             width: 14  },
    { key: "nat",       label: "Nationalité",   width: 58  },
    { key: "redob",     label: "Rdbl.",          width: 24  },
    { key: "tuteur",    label: "Tuteur",         width: 78  },
    { key: "tel",       label: "Téléphone",     width: 56  },
    { key: "statut",    label: "Statut",         width: 0   }, // calculé
  ];

  // Calculer la largeur de la dernière colonne
  const fixedWidth = colDefs.slice(0, -1).reduce((s, c) => s + c.width, 0);
  colDefs[colDefs.length - 1].width = usableW - fixedWidth;

  const rowsPerPage = 30;
  const totalStudents = studentList.length;
  const totalPages = Math.max(1, Math.ceil(totalStudents / rowsPerPage));

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const page = pdfDoc.addPage([pageW, pageH]);
    const { width, height } = page.getSize();

    // ── Filigrane ──
    drawWatermark(page, fontBold, width, height);

    // ── En-tête ──
    const headerBottomY = drawPageHeader(page, {
      logoImage, settings, isPrimary, className, schoolYearLabel,
      fontBold, fontRegular, pageIdx, totalPages, width, height,
      inkColor, slateColor, lineColor, headerBgColor,
    });

    // ── Sous-titre effectif + date ──
    const subtitleY = headerBottomY - 10;
    const dateGen = new Date().toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    page.drawText(
      `Effectif total : ${totalStudents} élève${totalStudents > 1 ? "s" : ""}   •   Édité le ${dateGen}`,
      { x: startX, y: subtitleY, size: 7, font: fontItalic, color: slateColor }
    );

    // ── En-tête du tableau ──
    const thY = subtitleY - 18;
    const thHeight = 17;

    page.drawRectangle({
      x: startX,
      y: thY - thHeight,
      width: usableW,
      height: thHeight,
      color: inkColor,
    });

    let curX = startX;
    for (const col of colDefs) {
      page.drawText(col.label, {
        x: curX + 2,
        y: thY - thHeight + 5,
        size: 6,
        font: fontBold,
        color: whiteColor,
      });
      curX += col.width;
    }

    // ── Lignes d'élèves ──
    const startStudentIdx = pageIdx * rowsPerPage;
    const endStudentIdx = Math.min(totalStudents, startStudentIdx + rowsPerPage);
    const pageRows = studentList.slice(startStudentIdx, endStudentIdx);

    const rowHeight = 15;
    let curRowY = thY - thHeight;

    pageRows.forEach((student, i) => {
      curRowY -= rowHeight;
      const globalIdx = startStudentIdx + i + 1;
      const isZebra = i % 2 === 1;

      // Fond alterné
      if (isZebra) {
        page.drawRectangle({
          x: startX, y: curRowY,
          width: usableW, height: rowHeight,
          color: zebraBgColor,
        });
      }

      // Ligne séparatrice
      page.drawLine({
        start: { x: startX, y: curRowY },
        end: { x: startX + usableW, y: curRowY },
        thickness: 0.4,
        color: lineColor,
      });

      let cX = startX;
      const cellY = curRowY + 4;

      // N°
      page.drawText(`${globalIdx}`, {
        x: cX + 2, y: cellY, size: 6, font: fontRegular, color: slateColor,
      });
      cX += colDefs[0].width;

      // Matricule
      page.drawText(truncate(student.matricule, 12), {
        x: cX + 2, y: cellY, size: 6, font: fontRegular,
        color: rgb(0.3, 0.3, 0.6),
      });
      cX += colDefs[1].width;

      // NOM Prénom
      const fullName = `${student.last_name.toUpperCase()} ${student.first_name}`;
      page.drawText(truncate(fullName, 24), {
        x: cX + 2, y: cellY, size: 6.5, font: fontBold, color: inkColor,
      });
      cX += colDefs[2].width;

      // Date de naissance
      page.drawText(formatDateFr(student.birth_date), {
        x: cX + 2, y: cellY, size: 6, font: fontRegular, color: rgb(0.2, 0.2, 0.2),
      });
      cX += colDefs[3].width;

      // Lieu de naissance
      page.drawText(truncate(student.birth_place, 10), {
        x: cX + 2, y: cellY, size: 6, font: fontRegular, color: rgb(0.2, 0.2, 0.2),
      });
      cX += colDefs[4].width;

      // Genre
      page.drawText(student.gender || "—", {
        x: cX + 2, y: cellY, size: 6.5, font: fontBold,
        color: student.gender === "M" ? rgb(0.1, 0.3, 0.7) : rgb(0.7, 0.1, 0.4),
      });
      cX += colDefs[5].width;

      // Nationalité
      page.drawText(truncate(student.nationality, 11), {
        x: cX + 2, y: cellY, size: 6, font: fontRegular, color: rgb(0.2, 0.2, 0.2),
      });
      cX += colDefs[6].width;

      // Redoublant
      page.drawText(student.is_repeating ? "Oui" : "Non", {
        x: cX + 2, y: cellY, size: 6, font: fontRegular,
        color: student.is_repeating ? amberColor : rgb(0.3, 0.3, 0.3),
      });
      cX += colDefs[7].width;

      // Tuteur
      page.drawText(truncate(student.guardian_name, 16), {
        x: cX + 2, y: cellY, size: 6, font: fontRegular, color: rgb(0.2, 0.2, 0.2),
      });
      cX += colDefs[8].width;

      // Téléphone
      page.drawText(truncate(student.guardian_phone, 13), {
        x: cX + 2, y: cellY, size: 6, font: fontRegular, color: rgb(0.2, 0.2, 0.2),
      });
      cX += colDefs[9].width;

      // Statut
      const statusLabel =
        student.status === "active"
          ? "Actif"
          : student.status === "pending_registration"
          ? "En attente"
          : "Inactif";
      const statusColor =
        student.status === "active"
          ? emeraldColor
          : student.status === "pending_registration"
          ? amberColor
          : roseColor;

      page.drawText(statusLabel, {
        x: cX + 2, y: cellY, size: 6, font: fontBold, color: statusColor,
      });
    });

    // ── Ligne de fermeture du tableau ──
    page.drawLine({
      start: { x: startX, y: curRowY },
      end: { x: startX + usableW, y: curRowY },
      thickness: 0.6,
      color: slateColor,
    });

    // ── Dernière page : récapitulatif + zone signature ──
    const isLastPage = pageIdx === totalPages - 1;
    if (isLastPage) {
      const bottomAreaY = curRowY - 18;

      // Stats récapitulatifs
      const totalActif = studentList.filter((s) => s.status === "active").length;
      const totalEnAttente = studentList.filter((s) => s.status === "pending_registration").length;
      const totalInactif = studentList.filter((s) => s.status === "inactive").length;
      const totalM = studentList.filter((s) => s.gender === "M").length;
      const totalF = studentList.filter((s) => s.gender === "F").length;
      const totalRedob = studentList.filter((s) => s.is_repeating).length;

      // Encadré récapitulatif (gauche)
      page.drawRectangle({
        x: startX, y: bottomAreaY - 64,
        width: 285, height: 62,
        borderColor: inkColor, borderWidth: 0.8,
        color: headerBgColor,
      });

      page.drawText("RÉCAPITULATIF DE LA CLASSE", {
        x: startX + 8, y: bottomAreaY - 14,
        size: 7.5, font: fontBold, color: inkColor,
      });
      page.drawText(
        `• Effectif total : ${totalStudents} élève${totalStudents > 1 ? "s" : ""}   (Garçons : ${totalM}  |  Filles : ${totalF})`,
        { x: startX + 8, y: bottomAreaY - 28, size: 6.5, font: fontRegular, color: inkColor }
      );
      page.drawText(
        `• Actifs : ${totalActif}   |   En attente : ${totalEnAttente}   |   Inactifs : ${totalInactif}`,
        { x: startX + 8, y: bottomAreaY - 40, size: 6.5, font: fontRegular, color: inkColor }
      );
      page.drawText(
        `• Redoublants : ${totalRedob}   |   Nouveaux : ${totalStudents - totalRedob}`,
        { x: startX + 8, y: bottomAreaY - 52, size: 6.5, font: fontRegular, color: inkColor }
      );

      // Zone signature (droite)
      const sigBoxW = 205;
      const sigBoxX = startX + usableW - sigBoxW;

      page.drawRectangle({
        x: sigBoxX, y: bottomAreaY - 64,
        width: sigBoxW, height: 62,
        borderColor: inkColor, borderWidth: 0.8,
        color: rgb(0.98, 0.98, 1),
      });

      page.drawText("Signature & Cachet de l'Administration", {
        x: sigBoxX + 8, y: bottomAreaY - 14,
        size: 7, font: fontBold, color: inkColor,
      });

      page.drawLine({
        start: { x: sigBoxX + 8, y: bottomAreaY - 46 },
        end: { x: sigBoxX + sigBoxW - 8, y: bottomAreaY - 46 },
        thickness: 0.5,
        color: rgb(0.6, 0.6, 0.7),
      });

      const directorLabel = isPrimary
        ? (settings.primary_director_name || "La Directrice")
        : (settings.director_name || "Le Principal");

      page.drawText(directorLabel, {
        x: sigBoxX + 8, y: bottomAreaY - 58,
        size: 6, font: fontRegular, color: rgb(0.45, 0.45, 0.55),
      });
    }

    // ── Pied de page ──
    drawPageFooter(page, {
      fontRegular, slateColor, lineColor,
      width, pageIdx, totalPages, isPrimary, settings,
    });
  }

  return await pdfDoc.save();
}
