import { supabase } from "./supabaseClient";

export interface Installment {
  label: string;
  amount: number;
  due_date?: string;
}

export interface FeeSchedule {
  id?: string;
  class_id: string;
  school_year_id: string;
  registration_fee: number;
  total_amount: number;
  installments_json: Installment[];
  created_at?: string;
  updated_at?: string;
}

export interface StudentFeeOverride {
  id?: string;
  student_id: string;
  school_year_id: string;
  total_amount_override: number;
  reason?: string;
  created_at?: string;
}

export interface Payment {
  id: string;
  student_id: string;
  school_year_id: string;
  amount: number;
  payment_date: string;
  method: "cash" | "bank_transfer" | "mobile_money" | "check";
  receipt_number: number;
  student_receipt_seq?: number;
  tranche_ciblee: string | null;
  payment_category: "registration" | "tuition";
  created_at: string;
}

export interface TrancheAllocationDetail {
  label: string;
  targetAmount: number;
  previouslyPaid: number;
  allocatedNow: number;
  newTotalPaid: number;
  isCompleted: boolean;
}

export interface AllocationResult {
  trancheDetails: TrancheAllocationDetail[];
  totalTuitionTarget: number;
  totalPreviouslyPaid: number;
  newPaymentAmount: number;
  totalNewPaid: number;
  excessAdvance: number;
  trancheCibleeSummary: string;
}

/**
 * Fonction centralisée d'allocation d'un paiement par tranche.
 * Reçoit la liste des tranches de la classe, le cumul des paiements antérieurs sur la scolarité,
 * le montant du nouveau paiement, et un éventuel override individuel de scolarité.
 */
export function allocatePaymentToInstallments(
  installments: Installment[],
  previousPaymentsSum: number,
  newAmount: number,
  totalOverride?: number
): AllocationResult {
  // Calculate total standard tuition from installments
  const standardTotal = installments.reduce((acc, inst) => acc + Number(inst.amount), 0);
  const effectiveTotal = totalOverride !== undefined && totalOverride >= 0 ? totalOverride : standardTotal;

  // Calculate effective target amount for each installment (sequential capping if override)
  let accumTarget = 0;
  const effectiveInstallments = installments.map((inst) => {
    const rawAmt = Number(inst.amount);
    let target = rawAmt;
    if (totalOverride !== undefined && totalOverride >= 0) {
      if (accumTarget >= effectiveTotal) {
        target = 0;
      } else if (accumTarget + rawAmt > effectiveTotal) {
        target = effectiveTotal - accumTarget;
      }
      accumTarget += target;
    } else {
      accumTarget += rawAmt;
    }
    return {
      label: inst.label,
      targetAmount: target,
    };
  });

  // Distribute previous payments across installments
  let prevRem = Math.max(0, previousPaymentsSum);
  const prevAllocated = effectiveInstallments.map((inst) => {
    const paid = Math.min(inst.targetAmount, prevRem);
    prevRem -= paid;
    return paid;
  });

  // Distribute new payment across remaining balances
  let newRem = Math.max(0, newAmount);
  const trancheDetails: TrancheAllocationDetail[] = effectiveInstallments.map((inst, index) => {
    const prevPaid = prevAllocated[index];
    const needed = inst.targetAmount - prevPaid;
    const allocatedNow = Math.min(needed, newRem);
    newRem -= allocatedNow;
    const newTotalPaid = prevPaid + allocatedNow;

    return {
      label: inst.label,
      targetAmount: inst.targetAmount,
      previouslyPaid: prevPaid,
      allocatedNow,
      newTotalPaid,
      isCompleted: inst.targetAmount > 0 && newTotalPaid >= inst.targetAmount,
    };
  });

  // Any leftover is global advance / excess
  const excessAdvance = newRem;

  const formatAmount = (amt: number) => Math.round(amt).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  // Build human-readable summary string for tranche_ciblee
  const activeAllocations = trancheDetails.filter((td) => td.allocatedNow > 0);
  let summaryParts: string[] = [];

  if (activeAllocations.length > 0) {
    summaryParts = activeAllocations.map(
      (td) => `${td.label} (${formatAmount(td.allocatedNow)} FCFA)`
    );
  }

  if (excessAdvance > 0) {
    summaryParts.push(`Avance globale (${formatAmount(excessAdvance)} FCFA)`);
  }

  if (summaryParts.length === 0) {
    summaryParts.push("Paiement enregistré");
  }

  const trancheCibleeSummary = summaryParts.join(", ");

  return {
    trancheDetails,
    totalTuitionTarget: effectiveTotal,
    totalPreviouslyPaid: previousPaymentsSum,
    newPaymentAmount: newAmount,
    totalNewPaid: previousPaymentsSum + newAmount,
    excessAdvance,
    trancheCibleeSummary,
  };
}

/**
 * Récupère la grille tarifaire d'une classe pour une année scolaire.
 */
export async function getFeeSchedule(
  classId: string,
  schoolYearId: string
): Promise<FeeSchedule | null> {
  const { data, error } = await supabase
    .from("fee_schedules")
    .select("*")
    .eq("class_id", classId)
    .eq("school_year_id", schoolYearId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erreur lors de la récupération du tarif de classe: ${error.message}`);
  }

  return data;
}

/**
 * Crée ou met à jour la grille tarifaire d'une classe.
 */
export async function upsertFeeSchedule(
  feeSchedule: Omit<FeeSchedule, "id" | "created_at" | "updated_at">
): Promise<FeeSchedule> {
  const { data, error } = await supabase
    .from("fee_schedules")
    .upsert(
      {
        ...feeSchedule,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "class_id,school_year_id" }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Erreur lors de l'enregistrement du tarif de classe: ${error.message}`);
  }

  return data;
}

/**
 * Récupère la réduction / bourse individuelle d'un élève.
 */
export async function getStudentFeeOverride(
  studentId: string,
  schoolYearId: string
): Promise<StudentFeeOverride | null> {
  const { data, error } = await supabase
    .from("student_fee_overrides")
    .select("*")
    .eq("student_id", studentId)
    .eq("school_year_id", schoolYearId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erreur lors de la récupération de la réduction élève: ${error.message}`);
  }

  return data;
}

/**
 * Enregistre une réduction / bourse individuelle pour un élève.
 */
export async function upsertStudentFeeOverride(
  override: Omit<StudentFeeOverride, "id" | "created_at">
): Promise<StudentFeeOverride> {
  const { data, error } = await supabase
    .from("student_fee_overrides")
    .upsert(override, { onConflict: "student_id,school_year_id" })
    .select()
    .single();

  if (error) {
    throw new Error(`Erreur lors de l'enregistrement de la réduction élève: ${error.message}`);
  }

  return data;
}

/**
 * Récupère l'historique des paiements d'un élève pour une année scolaire.
 */
export async function getStudentPayments(
  studentId: string,
  schoolYearId: string
): Promise<Payment[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("student_id", studentId)
    .eq("school_year_id", schoolYearId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Erreur lors de la récupération des paiements de l'élève: ${error.message}`);
  }

  return data || [];
}

import { generateAndSaveReceipt, getReceiptForPayment } from "./receiptPdfService";

export interface PaymentWithReceipt extends Payment {
  receipt_pdf_path?: string;
}

/**
 * Récupère l'historique des paiements d'un élève pour une année scolaire avec le chemin PDF du reçu.
 */
export async function getStudentPaymentsWithReceipts(
  studentId: string,
  schoolYearId: string
): Promise<PaymentWithReceipt[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("*, receipts(pdf_path)")
    .eq("student_id", studentId)
    .eq("school_year_id", schoolYearId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Erreur lors de la récupération des paiements de l'élève: ${error.message}`);
  }

  return (data || []).map((item: any) => ({
    ...item,
    receipt_pdf_path: item.receipts?.[0]?.pdf_path || item.receipts?.pdf_path || undefined,
  }));
}

/**
 * Enregistre un nouveau paiement en calculant automatiquement la répartition par tranche,
 * en exécutant la RPC transactionnelle create_payment_with_receipt et en générant le reçu PDF.
 */
export async function createPayment(params: {
  studentId: string;
  schoolYearId: string;
  classId: string;
  amount: number;
  paymentDate?: string;
  method: "cash" | "bank_transfer" | "mobile_money" | "check";
  paymentCategory?: "registration" | "tuition";
}): Promise<{ payment: Payment; allocation: AllocationResult; receiptPdfPath?: string; secondaryReceiptPdfPath?: string }> {
  const category = params.paymentCategory || "tuition";

  // 1. Charger le tarif de la classe
  const feeSchedule = await getFeeSchedule(params.classId, params.schoolYearId);
  if (!feeSchedule) {
    throw new Error("Aucun tarif configuré pour cette classe et cette année scolaire.");
  }

  // 2. Charger les paiements antérieurs de l'élève
  const existingPayments = await getStudentPayments(params.studentId, params.schoolYearId);

  const previousRegistrationSum = existingPayments
    .filter((p) => (p.payment_category || "tuition") === "registration")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const previousTuitionSum = existingPayments
    .filter((p) => (p.payment_category || "tuition") === "tuition")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  // 3. Charger l'éventuel override de scolarité
  const feeOverride = await getStudentFeeOverride(params.studentId, params.schoolYearId);
  const totalOverride = feeOverride ? feeOverride.total_amount_override : undefined;

  const totalRegistrationFee = Number(feeSchedule.registration_fee || 0);
  const remainingRegistrationFee = Math.max(0, totalRegistrationFee - previousRegistrationSum);

  const formatAmount = (amt: number) =>
    Math.round(amt).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  // 4. Cas : Paiement sous la catégorie "registration" avec un montant dépassant le solde restant d'inscription (Option A : 2 reçus séparés)
  if (category === "registration") {
    if (remainingRegistrationFee > 0 && params.amount > remainingRegistrationFee) {
      const regPart = remainingRegistrationFee;
      const tuitionPart = params.amount - remainingRegistrationFee;

      // Étape 1 : Créer le paiement d'inscription pour solder l'inscription
      const { data: regData, error: regError } = await supabase.rpc(
        "create_payment_with_receipt",
        {
          p_student_id: params.studentId,
          p_school_year_id: params.schoolYearId,
          p_amount: regPart,
          p_payment_date: params.paymentDate || new Date().toISOString().split("T")[0],
          p_method: params.method,
          p_tranche_ciblee: "Frais d'inscription",
          p_payment_category: "registration",
        }
      );

      if (regError) {
        throw new Error(`Erreur lors du règlement de l'inscription: ${regError.message}`);
      }

      const regPayment = Array.isArray(regData) ? regData[0] : regData;
      const regReceipt = await generateAndSaveReceipt({ payment: regPayment });

      // Étape 2 : Créer le paiement de scolarité pour le surplus
      const allocation = allocatePaymentToInstallments(
        feeSchedule.installments_json,
        previousTuitionSum,
        tuitionPart,
        totalOverride
      );

      const { data: tuitionData, error: tuitionError } = await supabase.rpc(
        "create_payment_with_receipt",
        {
          p_student_id: params.studentId,
          p_school_year_id: params.schoolYearId,
          p_amount: tuitionPart,
          p_payment_date: params.paymentDate || new Date().toISOString().split("T")[0],
          p_method: params.method,
          p_tranche_ciblee: allocation.trancheCibleeSummary,
          p_payment_category: "tuition",
        }
      );

      if (tuitionError) {
        throw new Error(`Erreur lors du règlement de la scolarité (surplus): ${tuitionError.message}`);
      }

      const tuitionPayment = Array.isArray(tuitionData) ? tuitionData[0] : tuitionData;
      const tuitionReceipt = await generateAndSaveReceipt({ payment: tuitionPayment, allocation });

      // Synthèse combinée pour l'affichage de la confirmation
      const combinedPayment: Payment = {
        ...tuitionPayment,
        amount: params.amount,
        receipt_number: `${regPayment.receipt_number} & ${tuitionPayment.receipt_number}` as any,
        tranche_ciblee: `Inscription (${formatAmount(regPart)} FCFA) + Scolarité (${allocation.trancheCibleeSummary})`,
      };

      return {
        payment: combinedPayment,
        allocation,
        receiptPdfPath: regReceipt.pdfPath,
        secondaryReceiptPdfPath: tuitionReceipt.pdfPath,
      };
    } else if (remainingRegistrationFee === 0) {
      // Si l'inscription est déjà intégralement soldée, basculer tout le montant en scolarité
      const allocation = allocatePaymentToInstallments(
        feeSchedule.installments_json,
        previousTuitionSum,
        params.amount,
        totalOverride
      );

      const { data, error } = await supabase.rpc("create_payment_with_receipt", {
        p_student_id: params.studentId,
        p_school_year_id: params.schoolYearId,
        p_amount: params.amount,
        p_payment_date: params.paymentDate || new Date().toISOString().split("T")[0],
        p_method: params.method,
        p_tranche_ciblee: allocation.trancheCibleeSummary,
        p_payment_category: "tuition",
      });

      if (error) {
        throw new Error(`Erreur lors de l'enregistrement du paiement: ${error.message}`);
      }

      const createdPayment = Array.isArray(data) ? data[0] : data;
      const receiptRes = await generateAndSaveReceipt({ payment: createdPayment, allocation });

      return {
        payment: createdPayment,
        allocation,
        receiptPdfPath: receiptRes.pdfPath,
      };
    }
  }

  // 5. Cas standard (Montant <= solde restant d'inscription OU catégorie "tuition")
  const allocation = allocatePaymentToInstallments(
    feeSchedule.installments_json,
    previousTuitionSum,
    category === "registration" ? 0 : params.amount,
    totalOverride
  );

  const trancheSummary =
    category === "registration" ? "Frais d'inscription" : allocation.trancheCibleeSummary;

  const { data, error } = await supabase.rpc("create_payment_with_receipt", {
    p_student_id: params.studentId,
    p_school_year_id: params.schoolYearId,
    p_amount: params.amount,
    p_payment_date: params.paymentDate || new Date().toISOString().split("T")[0],
    p_method: params.method,
    p_tranche_ciblee: trancheSummary,
    p_payment_category: category,
  });

  if (error) {
    throw new Error(`Erreur lors de l'enregistrement du paiement: ${error.message}`);
  }

  const createdPayment = Array.isArray(data) ? data[0] : data;
  const receiptRes = await generateAndSaveReceipt({
    payment: createdPayment,
    allocation: category === "tuition" ? allocation : undefined,
  });

  return {
    payment: createdPayment,
    allocation,
    receiptPdfPath: receiptRes.pdfPath,
  };
}

/**
 * Supprime un paiement par son ID via la RPC transactionnelle backend,
 * et supprime son fichier Storage associé pour éviter les orphelins.
 */
export async function deletePayment(paymentId: string): Promise<void> {
  // 1. Récupérer d'abord le reçu associé (avant que la RPC ne supprime la ligne en DB)
  const receipt = await getReceiptForPayment(paymentId);
  const pdfPath = receipt?.pdf_path;

  // 2. Supprimer la ligne en base via la RPC
  const { error } = await supabase.rpc("delete_payment_with_status_check", {
    p_payment_id: paymentId,
  });

  if (error) {
    throw new Error(`Erreur lors de la suppression du paiement: ${error.message}`);
  }

  // 3. Supprimer le fichier Storage de façon explicite
  if (pdfPath) {
    const { data: remData, error: storageErr } = await supabase.storage
      .from("receipts")
      .remove([pdfPath]);

    if (storageErr) {
      console.warn("Avertissement: Échec de suppression du fichier PDF du reçu dans Storage:", storageErr);
    } else {
      console.log(`[deletePayment] Fichier Storage supprimé avec succès: ${pdfPath}`);
    }
  }
}

/**
 * Compte le nombre total de paiements déjà enregistrés pour une classe donnée et une année scolaire donnée.
 * Utilisé pour avertir l'utilisateur si un tarif est modifié alors que des paiements existent déjà.
 */
export async function getClassPaymentsCount(
  classId: string,
  schoolYearId: string
): Promise<number> {
  const { data: students, error: studErr } = await supabase
    .from("students")
    .select("id")
    .eq("class_id", classId);

  if (studErr || !students || students.length === 0) {
    return 0;
  }

  const studentIds = students.map((s) => s.id);
  const { count, error } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("school_year_id", schoolYearId)
    .in("student_id", studentIds);

  if (error) {
    return 0;
  }

  return count || 0;
}

