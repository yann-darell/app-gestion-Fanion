import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { supabase } from "./supabaseClient";
import { Payment, allocatePaymentToInstallments } from "./financeService";
import { LOGO_FANION_BASE64 } from "../assets/logoBase64";

/**
 * Structure interne utilisée par le template PDF pour afficher le tableau des tranches.
 * Distincte de AllocationResult (service finance) qui n'a pas ce format.
 */
export interface ReceiptInstallmentRow {
  name: string;
  total_due: number;
  allocated_from_payment: number;
  paid_amount: number;
  remaining_due: number;
}

export interface ReceiptAllocation {
  installments: ReceiptInstallmentRow[];
  totals: {
    overallRemainingDue: number;
  };
}

export interface GenerateReceiptOptions {
  payment: Payment;
  allocation?: ReceiptAllocation;
}

/**
 * Utilitaire pour formater les montants en FCFA
 */
function formatAmount(amt: number): string {
  return Math.round(amt || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Génère le buffer du document PDF pour un reçu de paiement.
 */
export async function createReceiptPdfBuffer(
  payment: Payment,
  allocation?: ReceiptAllocation
): Promise<Uint8Array> {
  // 1. Récupération des informations de l'élève et de sa classe
  const { data: student } = await supabase
    .from("students")
    .select("*, classes(name, level)")
    .eq("id", payment.student_id)
    .single();

  // 1b. Récupérer le numéro séquentiel immuable propre à cet élève (stocké en DB)
  const studentSeqNum = payment.student_receipt_seq || 1;

  // 1c. Reconstruire l'allocation des tranches de scolarité si non fournie explicitement (ex: réouverture du reçu depuis l'historique)
  if (!allocation && payment.payment_category === "tuition" && student) {
    try {
      const { data: schedule } = await supabase
        .from("fee_schedules")
        .select("*")
        .eq("class_id", student.class_id)
        .eq("school_year_id", payment.school_year_id)
        .single();

      const { data: override } = await supabase
        .from("student_fee_overrides")
        .select("*")
        .eq("student_id", payment.student_id)
        .eq("school_year_id", payment.school_year_id)
        .maybeSingle();

      const { data: allPayments } = await supabase
        .from("payments")
        .select("*")
        .eq("student_id", payment.student_id)
        .eq("school_year_id", payment.school_year_id)
        .eq("payment_category", "tuition")
        .order("created_at", { ascending: true });

      if (schedule && allPayments) {
        // Cumul payé en scolarité AVANT ce paiement
        const priorTuitionPaid = allPayments
          .filter((p) => new Date(p.created_at) < new Date(payment.created_at))
          .reduce((sum, p) => sum + Number(p.amount), 0);

        // Appel utilisé uniquement pour valider la répartition (résultat non stocké ici,
        // on recalcule manuellement ci-dessous pour le format PDF)
        allocatePaymentToInstallments(
          schedule.installments_json,
          priorTuitionPaid,
          Number(payment.amount),
          override?.total_amount_override
        );

        // Formater au format attendu par le template PDF
        const instList = schedule.installments_json || [];
        let remPayment = Number(payment.amount);
        let prevAccumulated = priorTuitionPaid;

        const tableInstallments = instList.map((inst: any) => {
          const instDue = Number(inst.amount);
          const paidBeforeThis = Math.max(0, Math.min(instDue, prevAccumulated));
          prevAccumulated = Math.max(0, prevAccumulated - instDue);

          const remInstDue = instDue - paidBeforeThis;
          const allocNow = Math.max(0, Math.min(remInstDue, remPayment));
          remPayment = Math.max(0, remPayment - allocNow);

          const totalPaidForInst = paidBeforeThis + allocNow;
          const remDueForInst = instDue - totalPaidForInst;

          return {
            name: inst.label,
            total_due: instDue,
            allocated_from_payment: allocNow,
            paid_amount: totalPaidForInst,
            remaining_due: remDueForInst,
          };
        });

        const totalTuitionTarget = override
          ? Number(override.total_amount_override)
          : Number(schedule.total_amount);

        const totalPaidSoFar = allPayments
          .filter((p) => new Date(p.created_at) <= new Date(payment.created_at))
          .reduce((sum, p) => sum + Number(p.amount), 0);

        allocation = {
          installments: tableInstallments,
          totals: {
            overallRemainingDue: Math.max(0, totalTuitionTarget - totalPaidSoFar),
          },
        } satisfies ReceiptAllocation;
      }
    } catch (err) {
      console.warn("Impossible de ré-allouer automatiquement les tranches pour le PDF:", err);
    }
  }

  // 2. Création du PDF A5 Paysage ou A4 portrait (Format A4 ou A5 étendu)
  // Format A5 Paysage élargi en hauteur pour accueillir le tableau des tranches [595.28, 480]
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 465.00]);
  const { width, height } = page.getSize();

  // Chargement des polices standard
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // 3. Charger le logo officiel PNG via Base64 embarqué (compatible Web, Electron .exe et Node)
  let logoImage: any = null;
  try {
    const base64Data = LOGO_FANION_BASE64.replace(/^data:image\/png;base64,/, "");
    const logoBuffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    logoImage = await pdfDoc.embedPng(logoBuffer);
  } catch (e) {
    console.warn("Avertissement: Logo PNG non chargé sur le reçu:", e);
  }

  const inkColor = rgb(0.082, 0.039, 0.368); // #150A5E
  const slateColor = rgb(0.356, 0.419, 0.51); // #5B6B82
  const lineColor = rgb(0.894, 0.878, 0.839); // #E4E0D6
  const bgLight = rgb(0.96, 0.97, 0.99);

  // Cadre global du reçu
  page.drawRectangle({
    x: 20,
    y: 20,
    width: width - 40,
    height: height - 40,
    borderColor: inkColor,
    borderWidth: 1.5,
    color: rgb(1, 1, 1),
  });

  // Filigrane logo centré sur toute la page (Point 6)
  if (logoImage) {
    page.drawImage(logoImage, {
      x: width / 2 - 100,
      y: height / 2 - 100,
      width: 200,
      height: 200,
      opacity: 0.07, // Discret mais présent sur le reçu
    });
  }

  // ==========================================
  // EN-TÊTE ET LOGO
  // ==========================================
  const headerY = height - 45;

  if (logoImage) {
    page.drawImage(logoImage, {
      x: 35,
      y: headerY - 35,
      width: 45,
      height: 45,
    });
  }

  // Identité de l'école
  page.drawText("COLLÈGE PRIVÉ LAÏC LE FANION", {
    x: 90,
    y: headerY - 5,
    size: 11,
    font: fontBold,
    color: inkColor,
  });
  page.drawText("Discipline - Travail - Succès", {
    x: 90,
    y: headerY - 18,
    size: 8,
    font: fontItalic,
    color: slateColor,
  });
  page.drawText("BP 1234 Yaoundé - Tél : 696 81 07 22 / 690 54 95 99", {
    x: 90,
    y: headerY - 30,
    size: 7.5,
    font: fontRegular,
    color: slateColor,
  });

  // Numéro de reçu et Date (Coin supérieur droit)
  const rightHeaderX = width - 200;
  page.drawRectangle({
    x: rightHeaderX,
    y: headerY - 32,
    width: 170,
    height: 38,
    borderColor: inkColor,
    borderWidth: 1,
    color: rgb(0.96, 0.96, 0.98),
  });

  page.drawText(`REÇU N° ${studentSeqNum}`, {
    x: rightHeaderX + 10,
    y: headerY - 12,
    size: 11,
    font: fontBold,
    color: inkColor,
  });
  page.drawText(`Réf global : N° ${payment.receipt_number} | Date : ${payment.payment_date}`, {
    x: rightHeaderX + 10,
    y: headerY - 26,
    size: 7.5,
    font: fontRegular,
    color: inkColor,
  });

  // Ligne de séparation sous l'en-tête
  page.drawLine({
    start: { x: 35, y: headerY - 45 },
    end: { x: width - 35, y: headerY - 45 },
    color: lineColor,
    thickness: 1,
  });

  // ==========================================
  // INFORMATIONS DE L'ÉLÈVE
  // ==========================================
  let contentY = headerY - 70;

  const studentName = `${student.last_name.toUpperCase()} ${student.first_name}`;
  const className = student.classes
    ? `${student.classes.name} (${student.classes.level})`
    : "Non affecté";

  page.drawText("Reçu de M./Mme/Mlle :", {
    x: 35,
    y: contentY,
    size: 10,
    font: fontRegular,
    color: slateColor,
  });
  page.drawText(studentName, {
    x: 165,
    y: contentY,
    size: 11,
    font: fontBold,
    color: inkColor,
  });

  page.drawText("Matricule :", {
    x: 380,
    y: contentY,
    size: 10,
    font: fontRegular,
    color: slateColor,
  });
  page.drawText(student.matricule || "-", {
    x: 445,
    y: contentY,
    size: 10.5,
    font: fontBold,
    color: inkColor,
  });

  contentY -= 22;

  page.drawText("Classe :", {
    x: 35,
    y: contentY,
    size: 10,
    font: fontRegular,
    color: slateColor,
  });
  page.drawText(className, {
    x: 165,
    y: contentY,
    size: 10.5,
    font: fontBold,
    color: inkColor,
  });

  page.drawText("Mode de règlement :", {
    x: 380,
    y: contentY,
    size: 10,
    font: fontRegular,
    color: slateColor,
  });

  const methodLabels: Record<string, string> = {
    cash: "Espèces (Caisse)",
    bank_transfer: "Virement bancaire",
    mobile_money: "Mobile Money",
    check: "Chèque",
  };
  page.drawText(methodLabels[payment.method] || payment.method, {
    x: 480,
    y: contentY,
    size: 10,
    font: fontBold,
    color: inkColor,
  });

  contentY -= 26;

  // ==========================================
  // ENCADRÉ OBJET & MONTANT VERSÉ
  // ==========================================
  page.drawRectangle({
    x: 35,
    y: contentY - 28,
    width: width - 70,
    height: 32,
    borderColor: inkColor,
    borderWidth: 1.2,
    color: rgb(0.95, 0.97, 1),
  });

  const categoryLabel =
    payment.payment_category === "registration"
      ? "Frais d'inscription"
      : "Frais de scolarité";

  page.drawText(`Objet du versement : ${categoryLabel}`, {
    x: 45,
    y: contentY - 18,
    size: 10.5,
    font: fontBold,
    color: inkColor,
  });

  const amountStr = `${formatAmount(Number(payment.amount))} FCFA`;
  page.drawText(`Montant Versé : ${amountStr}`, {
    x: 330,
    y: contentY - 18,
    size: 11.5,
    font: fontBold,
    color: inkColor,
  });

  contentY -= 48;

  // ==========================================
  // TABLEAU DE RÉPARTITION ET DÉTAIL DES TRANCHES
  // ==========================================
  page.drawText("RÉPARTITION DU PAIEMENT ET ÉTAT DES SOLDE(S) :", {
    x: 35,
    y: contentY,
    size: 9.5,
    font: fontBold,
    color: inkColor,
  });

  contentY -= 18;

  if (allocation && (allocation as ReceiptAllocation).installments && (allocation as ReceiptAllocation).installments.length > 0) {
    const tableX = 35;
    const tableWidth = width - 70;
    const colWidths = [150, 115, 115, 120];

    page.drawRectangle({
      x: tableX,
      y: contentY - 22,
      width: tableWidth,
      height: 24,
      borderColor: inkColor,
      borderWidth: 1,
      color: inkColor,
    });

    page.drawText("Tranche", { x: tableX + 10, y: contentY - 16, size: 9.5, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText("Alloué ce jour", { x: tableX + colWidths[0] + 10, y: contentY - 16, size: 9.5, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText("Cumul Payé", { x: tableX + colWidths[0] + colWidths[1] + 10, y: contentY - 16, size: 9.5, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText("Reste Dû Tranche", { x: tableX + colWidths[0] + colWidths[1] + colWidths[2] + 10, y: contentY - 16, size: 9.5, font: fontBold, color: rgb(1, 1, 1) });

    contentY -= 24;

    (allocation as ReceiptAllocation).installments.forEach((inst: ReceiptInstallmentRow, idx: number) => {
      const isEven = idx % 2 === 0;
      page.drawRectangle({
        x: tableX,
        y: contentY - 22,
        width: tableWidth,
        height: 23,
        borderColor: lineColor,
        borderWidth: 0.5,
        color: isEven ? bgLight : rgb(1, 1, 1),
      });

      page.drawText(`${inst.name} (${formatAmount(inst.total_due)} FCFA)`, {
        x: tableX + 10,
        y: contentY - 16,
        size: 9,
        font: fontRegular,
        color: inkColor,
      });

      page.drawText(`${formatAmount(inst.allocated_from_payment)} FCFA`, {
        x: tableX + colWidths[0] + 10,
        y: contentY - 16,
        size: 9,
        font: inst.allocated_from_payment > 0 ? fontBold : fontRegular,
        color: inst.allocated_from_payment > 0 ? rgb(0.05, 0.4, 0.1) : slateColor,
      });

      page.drawText(`${formatAmount(inst.paid_amount)} FCFA`, {
        x: tableX + colWidths[0] + colWidths[1] + 10,
        y: contentY - 16,
        size: 9,
        font: fontRegular,
        color: inkColor,
      });

      const remainingColor = inst.remaining_due > 0 ? rgb(0.7, 0.1, 0.1) : rgb(0.1, 0.5, 0.1);
      const remainingText = inst.remaining_due > 0 ? `${formatAmount(inst.remaining_due)} FCFA` : "SOLDÉE";

      page.drawText(remainingText, {
        x: tableX + colWidths[0] + colWidths[1] + colWidths[2] + 10,
        y: contentY - 16,
        size: 9,
        font: fontBold,
        color: remainingColor,
      });

      contentY -= 23;
    });

    contentY -= 10;

    // Synthèse globale des restes dûs (Bandeau récapitulatif)
    page.drawRectangle({
      x: tableX,
      y: contentY - 24,
      width: tableWidth,
      height: 26,
      borderColor: inkColor,
      borderWidth: 1.2,
      color: rgb(0.93, 0.95, 0.98),
    });

    const overallDue = (allocation as ReceiptAllocation).totals.overallRemainingDue;
    const dueColor = overallDue > 0 ? rgb(0.75, 0.1, 0.1) : rgb(0.1, 0.5, 0.1);
    const dueStatusText = overallDue > 0 ? `${formatAmount(overallDue)} FCFA` : "SCOLARITÉ TOTALEMENT SOLDÉE";

    page.drawText(`RESTE À PAYER (TOTAL SCOLARITÉ) :`, {
      x: tableX + 12,
      y: contentY - 17,
      size: 9.5,
      font: fontBold,
      color: inkColor,
    });

    page.drawText(dueStatusText, {
      x: tableX + 270,
      y: contentY - 17,
      size: 10.5,
      font: fontBold,
      color: dueColor,
    });

    contentY -= 36;

  } else {
    const targetSummary = payment.tranche_ciblee || "Versement d'inscription enregistré";
    page.drawText(targetSummary, {
      x: 45,
      y: contentY,
      size: 9.5,
      font: fontRegular,
      color: inkColor,
    });
    contentY -= 24;
  }

  // ==========================================
  // BAS DE PAGE / SIGNATURE
  // ==========================================
  const footerY = Math.max(contentY - 25, 95);

  page.drawText("Cadre réservé à l'administration", {
    x: width - 220,
    y: footerY,
    size: 9,
    font: fontItalic,
    color: slateColor,
  });

  page.drawText("Le Principal", {
    x: width - 175,
    y: footerY - 16,
    size: 9.5,
    font: fontBold,
    color: inkColor,
  });

  // Zone de cachet / signature
  page.drawRectangle({
    x: width - 220,
    y: footerY - 62,
    width: 185,
    height: 40,
    borderColor: lineColor,
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });

  page.drawText("Signature & Cachet", {
    x: width - 170,
    y: footerY - 48,
    size: 8.5,
    font: fontItalic,
    color: rgb(0.6, 0.6, 0.6),
  });

  // Mentions légales bas de page gauche
  page.drawText("NB : Ce reçu doit être conservé comme preuve de paiement.", {
    x: 35,
    y: 45,
    size: 8,
    font: fontItalic,
    color: slateColor,
  });
  page.drawText("Les frais de scolarité sont non remboursables.", {
    x: 35,
    y: 32,
    size: 8,
    font: fontItalic,
    color: slateColor,
  });

  return await pdfDoc.save();
}

/**
 * Service atomique complet d'upload et enregistrement d'un reçu PDF.
 */
export async function generateAndSaveReceipt(
  options: GenerateReceiptOptions
): Promise<{ pdfPath: string; receiptDbId: string }> {
  const { payment, allocation } = options;

  // 1. Déterminer le chemin storage déterministe
  const storageRelativePath = `${payment.school_year_id}/${payment.id}.pdf`;

  // 2. Générer le buffer PDF
  const pdfBytes = await createReceiptPdfBuffer(payment, allocation);

  // 3. Upload Supabase Storage (upsert = true)
  const { error: uploadErr } = await supabase.storage
    .from("receipts")
    .upload(storageRelativePath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadErr) {
    console.error("Erreur d'upload du reçu sur Supabase Storage:", uploadErr);
    throw new Error(`Échec de l'enregistrement du PDF dans Storage: ${uploadErr.message}`);
  }

  // 4. Insertion atomic en base de données table `receipts`
  const { data: dbRecord, error: dbErr } = await supabase
    .from("receipts")
    .upsert(
      {
        payment_id: payment.id,
        pdf_path: storageRelativePath,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "payment_id" }
    )
    .select()
    .single();

  if (dbErr) {
    console.error("Erreur d'enregistrement DB du reçu, nettoyage Storage...", dbErr);
    // Rollback atomique
    await supabase.storage.from("receipts").remove([storageRelativePath]);
    throw new Error(`Échec de l'enregistrement du reçu en base: ${dbErr.message}`);
  }

  return {
    pdfPath: storageRelativePath,
    receiptDbId: dbRecord.id,
  };
}

/**
 * Récupère une URL signée temporaire (1 heure) pour visualiser/télécharger le reçu PDF.
 */
export async function getReceiptSignedUrl(pdfPath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("receipts")
    .createSignedUrl(pdfPath, 3600);

  if (error || !data?.signedUrl) {
    throw new Error(
      `Impossible de générer l'URL signée pour le reçu: ${error?.message || "Inconnue"}`
    );
  }

  return data.signedUrl;
}

/**
 * Récupère l'enregistrement du reçu associé à un paiement
 */
export async function getReceiptForPayment(
  paymentId: string
): Promise<{ id: string; pdf_path: string; generated_at: string } | null> {
  const { data, error } = await supabase
    .from("receipts")
    .select("id, pdf_path, generated_at")
    .eq("payment_id", paymentId)
    .maybeSingle();

  if (error) {
    console.error("Erreur lors de la recherche du reçu:", error);
    return null;
  }

  return data;
}
