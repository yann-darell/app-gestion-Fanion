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
  tranche_ciblee: string | null;
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

/**
 * Enregistre un nouveau paiement en calculant automatiquement la répartition par tranche
 * et en exécutant la RPC transactionnelle create_payment_with_receipt.
 */
export async function createPayment(params: {
  studentId: string;
  schoolYearId: string;
  classId: string;
  amount: number;
  paymentDate?: string;
  method: "cash" | "bank_transfer" | "mobile_money" | "check";
}): Promise<{ payment: Payment; allocation: AllocationResult }> {
  // 1. Charger le tarif de la classe
  const feeSchedule = await getFeeSchedule(params.classId, params.schoolYearId);
  if (!feeSchedule) {
    throw new Error("Aucun tarif configuré pour cette classe et cette année scolaire.");
  }

  // 2. Charger les éventuels paiements antérieurs
  const existingPayments = await getStudentPayments(params.studentId, params.schoolYearId);
  const previousSum = existingPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  // 3. Charger l'éventuel override de scolarité
  const feeOverride = await getStudentFeeOverride(params.studentId, params.schoolYearId);
  const totalOverride = feeOverride ? feeOverride.total_amount_override : undefined;

  // 4. Calculer l'allocation centralisée
  const allocation = allocatePaymentToInstallments(
    feeSchedule.installments_json,
    previousSum,
    params.amount,
    totalOverride
  );

  // 5. Exécuter la RPC transactionnelle backend create_payment_with_receipt
  const { data, error } = await supabase.rpc("create_payment_with_receipt", {
    p_student_id: params.studentId,
    p_school_year_id: params.schoolYearId,
    p_amount: params.amount,
    p_payment_date: params.paymentDate || new Date().toISOString().split("T")[0],
    p_method: params.method,
    p_tranche_ciblee: allocation.trancheCibleeSummary,
  });

  if (error) {
    throw new Error(`Erreur lors de l'enregistrement du paiement: ${error.message}`);
  }

  const createdPayment = Array.isArray(data) ? data[0] : data;

  return {
    payment: createdPayment,
    allocation,
  };
}

/**
 * Supprime un paiement par son ID.
 * NOTE : La suppression d'un paiement ne décrémente JAMAIS receipt_counters.
 */
export async function deletePayment(paymentId: string): Promise<void> {
  const { error } = await supabase.from("payments").delete().eq("id", paymentId);

  if (error) {
    throw new Error(`Erreur lors de la suppression du paiement: ${error.message}`);
  }
}
