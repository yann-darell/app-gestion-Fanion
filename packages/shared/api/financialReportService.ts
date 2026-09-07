import { supabase } from "./supabaseClient";
import { getFeeSchedule, FeeSchedule, Installment } from "./financeService";

export interface StudentFinancialStatus {
  studentId: string;
  matricule: string;
  lastName: string;
  firstName: string;
  gender: string;
  status: string; // active | pending_registration | inactive
  registrationFeeExpected: number;
  registrationFeePaid: number;
  isRegistrationComplete: boolean;
  tuitionExpected: number;
  hasTuitionOverride: boolean;
  tuitionOverrideReason?: string;
  tuitionPaid: number;
  totalExpected: number;
  totalPaid: number;
  remainingDue: number;
  trancheBreakdown: {
    label: string;
    expected: number;
    paid: number;
    remaining: number;
    status: "paid" | "partial" | "unpaid";
  }[];
}

export interface ClassFinancialReport {
  classId: string;
  className: string;
  divisionId: string;
  schoolYearId: string;
  feeSchedule: FeeSchedule | null;
  students: StudentFinancialStatus[];
  summary: {
    totalStudents: number;
    totalExpected: number;
    totalPaid: number;
    totalRemainingDue: number;
    registrationExpected: number;
    registrationPaid: number;
    tuitionExpected: number;
    tuitionPaid: number;
    collectionRate: number; // percentage 0-100
  };
}

/**
 * Calcule l'état financier complet d'une classe pour une année scolaire donnée.
 */
export async function getClassFinancialReport(
  classId: string,
  schoolYearId: string
): Promise<ClassFinancialReport> {
  // 1. Récupérer les détails de la classe
  const { data: classData, error: classErr } = await supabase
    .from("classes")
    .select("id, name, division_id")
    .eq("id", classId)
    .single();

  if (classErr || !classData) {
    throw new Error(`Classe introuvable: ${classErr?.message || "Erreur inconnue"}`);
  }

  // 2. Récupérer la grille tarifaire de la classe
  const feeSchedule = await getFeeSchedule(classId, schoolYearId);

  // 3. Récupérer les élèves de la classe
  const { data: studentsData, error: studErr } = await supabase
    .from("students")
    .select("id, matricule, last_name, first_name, gender, status")
    .eq("class_id", classId)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (studErr) {
    throw new Error(`Erreur récupération élèves: ${studErr.message}`);
  }

  const rawStudents = studentsData || [];
  const studentIds = rawStudents.map((s) => s.id);

  // 4. Récupérer tous les paiements de ces élèves pour cette année
  let allPayments: any[] = [];
  if (studentIds.length > 0) {
    const { data: payData, error: payErr } = await supabase
      .from("payments")
      .select("id, student_id, amount, payment_category, payment_date")
      .eq("school_year_id", schoolYearId)
      .in("student_id", studentIds);

    if (payErr) {
      throw new Error(`Erreur récupération paiements: ${payErr.message}`);
    }
    allPayments = payData || [];
  }

  // 5. Récupérer les éventuels overrides de scolarité
  let allOverrides: any[] = [];
  if (studentIds.length > 0) {
    const { data: overData, error: overErr } = await supabase
      .from("student_fee_overrides")
      .select("student_id, total_amount_override, reason")
      .eq("school_year_id", schoolYearId)
      .in("student_id", studentIds);

    if (overErr) {
      throw new Error(`Erreur récupération bourses/réductions: ${overErr.message}`);
    }
    allOverrides = overData || [];
  }

  const overridesMap = new Map<string, { total: number; reason?: string }>();
  allOverrides.forEach((o) => {
    overridesMap.set(o.student_id, {
      total: Number(o.total_amount_override),
      reason: o.reason,
    });
  });

  // Groupement des paiements par élève
  const paymentsByStudent = new Map<string, { registration: number; tuition: number; total: number }>();
  allPayments.forEach((p) => {
    const sId = p.student_id;
    const cat = p.payment_category || "tuition";
    const amt = Number(p.amount || 0);

    if (!paymentsByStudent.has(sId)) {
      paymentsByStudent.set(sId, { registration: 0, tuition: 0, total: 0 });
    }
    const cur = paymentsByStudent.get(sId)!;
    if (cat === "registration") {
      cur.registration += amt;
    } else {
      cur.tuition += amt;
    }
    cur.total += amt;
  });

  const stdRegFee = feeSchedule ? Number(feeSchedule.registration_fee || 0) : 0;
  const stdTuitionFee = feeSchedule ? Number(feeSchedule.total_amount || 0) : 0;
  const installments: Installment[] = feeSchedule?.installments_json || [];

  // 6. Calcul individuel par élève
  const computedStudents: StudentFinancialStatus[] = rawStudents.map((st) => {
    const override = overridesMap.get(st.id);
    const regExpected = stdRegFee;
    const tuitionExpected = override !== undefined ? override.total : stdTuitionFee;

    const pays = paymentsByStudent.get(st.id) || { registration: 0, tuition: 0, total: 0 };
    const regPaid = pays.registration;
    const tuitionPaid = pays.tuition;

    const isRegComplete = regExpected === 0 || regPaid >= regExpected;
    const totalExpected = regExpected + tuitionExpected;
    const totalPaid = regPaid + tuitionPaid;
    const remainingDue = Math.max(0, totalExpected - totalPaid);

    // Calcul séquentiel des tranches
    let accumCap = 0;
    const effectiveInstallments = installments.map((inst) => {
      const rawAmt = Number(inst.amount);
      let target = rawAmt;
      if (override !== undefined) {
        if (accumCap >= tuitionExpected) {
          target = 0;
        } else if (accumCap + rawAmt > tuitionExpected) {
          target = tuitionExpected - accumCap;
        }
        accumCap += target;
      } else {
        accumCap += rawAmt;
      }
      return { label: inst.label, expected: target };
    });

    let remTuitionPaid = tuitionPaid;
    const trancheBreakdown = effectiveInstallments.map((inst) => {
      const exp = inst.expected;
      const allocated = Math.min(exp, remTuitionPaid);
      remTuitionPaid = Math.max(0, remTuitionPaid - allocated);
      const remaining = Math.max(0, exp - allocated);
      let status: "paid" | "partial" | "unpaid" = "unpaid";
      if (exp === 0 || allocated >= exp) {
        status = "paid";
      } else if (allocated > 0) {
        status = "partial";
      }
      return {
        label: inst.label,
        expected: exp,
        paid: allocated,
        remaining,
        status,
      };
    });

    return {
      studentId: st.id,
      matricule: st.matricule || "",
      lastName: st.last_name,
      firstName: st.first_name,
      gender: st.gender,
      status: st.status || "active",
      registrationFeeExpected: regExpected,
      registrationFeePaid: regPaid,
      isRegistrationComplete: isRegComplete,
      tuitionExpected,
      hasTuitionOverride: override !== undefined,
      tuitionOverrideReason: override?.reason,
      tuitionPaid,
      totalExpected,
      totalPaid,
      remainingDue,
      trancheBreakdown,
    };
  });

  // 7. Totaux et synthèse de la classe
  const summary = computedStudents.reduce(
    (acc, s) => {
      acc.totalExpected += s.totalExpected;
      acc.totalPaid += s.totalPaid;
      acc.totalRemainingDue += s.remainingDue;
      acc.registrationExpected += s.registrationFeeExpected;
      acc.registrationPaid += s.registrationFeePaid;
      acc.tuitionExpected += s.tuitionExpected;
      acc.tuitionPaid += s.tuitionPaid;
      return acc;
    },
    {
      totalStudents: computedStudents.length,
      totalExpected: 0,
      totalPaid: 0,
      totalRemainingDue: 0,
      registrationExpected: 0,
      registrationPaid: 0,
      tuitionExpected: 0,
      tuitionPaid: 0,
      collectionRate: 0,
    }
  );

  summary.collectionRate =
    summary.totalExpected > 0
      ? Math.round((summary.totalPaid / summary.totalExpected) * 1000) / 10
      : 0;

  return {
    classId,
    className: classData.name,
    divisionId: classData.division_id,
    schoolYearId,
    feeSchedule,
    students: computedStudents,
    summary,
  };
}
