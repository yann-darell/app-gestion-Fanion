import { supabase } from "../api/supabaseClient";
import { getActiveSchoolYear } from "../api/classes";
import { getSchoolSettings, getAcademicCalendar } from "./settingsService";

export interface DivisionStudentCount {
  divisionId: string;
  divisionName: string;
  activeStudents: number;
  pendingStudents: number;
  totalStudents: number;
}

export interface ClassDashboardSummary {
  id: string;
  name: string;
  divisionId: string;
  studentCount: number;
  expectedSubmissions: number;
  actualSubmissions: number;
  collectionRate: number;
  totalPaid: number;
  totalExpected: number;
}

export interface DashboardMetrics {
  schoolYear: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  } | null;
  activeSequence: {
    id: string;
    name: string;
    termName: string;
    isLocked: boolean;
  } | null;
  schoolSettings: {
    name: string;
    address: string;
    phone: string;
  };
  enrollment: {
    totalActive: number;
    totalPending: number;
    totalStudents: number;
    byDivision: DivisionStudentCount[];
  };
  finances: {
    totalExpected: number;
    totalPaid: number;
    totalRemainingDue: number;
    collectionRate: number;
    todayPaymentsCount: number;
    todayPaymentsTotal: number;
    weekPaymentsCount: number;
    weekPaymentsTotal: number;
  };
  academics: {
    totalClasses: number;
    totalAssignments: number;
    submittedGradesCount: number;
    pendingGradesCount: number;
    gradeSubmissionRate: number;
  };
  classesSummary: ClassDashboardSummary[];
}

/**
 * Agrège les indicateurs clés en lecture seule pour le tableau de bord direction.
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  // 1. Année scolaire active & Paramètres établissement
  const [activeYear, schoolSettings, academicCalendar] = await Promise.all([
    getActiveSchoolYear(),
    getSchoolSettings(),
    getAcademicCalendar().catch(() => []),
  ]);

  if (!activeYear) {
    throw new Error("Aucune année scolaire active n'est configurée dans le système.");
  }

  // 2. Déterminer la séquence active (la première non verrouillée ou la plus récente)
  let activeSeq: { id: string; name: string; termName: string; isLocked: boolean } | null = null;
  for (const term of academicCalendar) {
    for (const seq of term.sequences) {
      if (!seq.is_locked && !activeSeq) {
        activeSeq = {
          id: seq.id,
          name: seq.name,
          termName: term.name,
          isLocked: seq.is_locked,
        };
      }
    }
  }
  // Fallback si toutes verrouillées ou aucune : prendre la première
  if (!activeSeq && academicCalendar.length > 0 && academicCalendar[0].sequences.length > 0) {
    const firstTerm = academicCalendar[0];
    const firstSeq = firstTerm.sequences[0];
    activeSeq = {
      id: firstSeq.id,
      name: firstSeq.name,
      termName: firstTerm.name,
      isLocked: firstSeq.is_locked,
    };
  }

  // 3. Récupérer les classes, divisions, élèves, attributions, soumissions et paiements en parallèle
  const [
    classesRes,
    divisionsRes,
    studentsRes,
    assignmentsRes,
    submissionsRes,
    paymentsRes,
    feeSchedulesRes,
    feeOverridesRes,
  ] = await Promise.all([
    supabase.from("classes").select("id, name, division_id, level").order("name"),
    supabase.from("divisions").select("id, name"),
    supabase.from("students").select("id, class_id, status"),
    supabase.from("teacher_assignments").select("id, class_id, subject_id"),
    activeSeq
      ? supabase
          .from("grade_submissions")
          .select("id, class_id, subject_id, sequence_id, is_locked")
          .eq("sequence_id", activeSeq.id)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("payments")
      .select("id, student_id, amount, payment_date")
      .eq("school_year_id", activeYear.id),
    supabase
      .from("fee_schedules")
      .select("class_id, registration_fee, total_amount")
      .eq("school_year_id", activeYear.id),
    supabase
      .from("student_fee_overrides")
      .select("student_id, total_amount_override")
      .eq("school_year_id", activeYear.id),
  ]);

  if (classesRes.error) throw new Error(`Erreur classes: ${classesRes.error.message}`);
  if (studentsRes.error) throw new Error(`Erreur élèves: ${studentsRes.error.message}`);
  if (assignmentsRes.error) throw new Error(`Erreur attributions: ${assignmentsRes.error.message}`);
  if (paymentsRes.error) throw new Error(`Erreur paiements: ${paymentsRes.error.message}`);

  const classes = classesRes.data || [];
  const divisions = divisionsRes.data || [];
  const students = studentsRes.data || [];
  const assignments = assignmentsRes.data || [];
  const submissions = submissionsRes.data || [];
  const payments = paymentsRes.data || [];
  const feeSchedules = feeSchedulesRes.data || [];
  const feeOverrides = feeOverridesRes.data || [];

  // ─── A. Effectifs ────────────────────────────────────────────────────────────
  const divisionMap = new Map<string, string>();
  divisions.forEach((d) => divisionMap.set(d.id, d.name));

  const classDivisionMap = new Map<string, string>();
  classes.forEach((c) => classDivisionMap.set(c.id, c.division_id));

  let totalActive = 0;
  let totalPending = 0;
  const divStatsMap = new Map<string, { active: number; pending: number; total: number }>();

  students.forEach((s) => {
    const isActive = s.status === "active";
    const isPending = s.status === "pending_registration";
    if (isActive) totalActive++;
    if (isPending) totalPending++;

    const divId = s.class_id ? (classDivisionMap.get(s.class_id) || "autre") : "autre";
    if (!divStatsMap.has(divId)) {
      divStatsMap.set(divId, { active: 0, pending: 0, total: 0 });
    }
    const cur = divStatsMap.get(divId)!;
    if (isActive) cur.active++;
    if (isPending) cur.pending++;
    cur.total++;
  });

  const byDivision: DivisionStudentCount[] = Array.from(divStatsMap.entries()).map(
    ([divisionId, stats]) => ({
      divisionId,
      divisionName: divisionMap.get(divisionId) || (divisionId === "autre" ? "Sans classe" : divisionId),
      activeStudents: stats.active,
      pendingStudents: stats.pending,
      totalStudents: stats.total,
    })
  );

  // ─── B. Finances ─────────────────────────────────────────────────────────────
  // Override map
  const overrideMap = new Map<string, number>();
  feeOverrides.forEach((o) => {
    overrideMap.set(o.student_id, Number(o.total_amount_override || 0));
  });

  // Fee schedule map
  const feeMap = new Map<string, { reg: number; tuition: number }>();
  feeSchedules.forEach((f) => {
    feeMap.set(f.class_id, {
      reg: Number(f.registration_fee || 0),
      tuition: Number(f.total_amount || 0),
    });
  });

  // Somme des paiements par élève & paiements par classe
  const studentPaidMap = new Map<string, number>();
  const classPaidMap = new Map<string, number>();
  const studentClassMap = new Map<string, string>();
  students.forEach((s) => {
    if (s.class_id) studentClassMap.set(s.id, s.class_id);
  });

  // Calcul paiements du jour & de la semaine
  const todayStr = new Date().toISOString().split("T")[0];
  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

  let todayPaymentsCount = 0;
  let todayPaymentsTotal = 0;
  let weekPaymentsCount = 0;
  let weekPaymentsTotal = 0;
  let totalPaidOverall = 0;

  payments.forEach((p) => {
    const amt = Number(p.amount || 0);
    totalPaidOverall += amt;

    const sId = p.student_id;
    studentPaidMap.set(sId, (studentPaidMap.get(sId) || 0) + amt);

    const cId = studentClassMap.get(sId);
    if (cId) {
      classPaidMap.set(cId, (classPaidMap.get(cId) || 0) + amt);
    }

    const pDate = p.payment_date ? p.payment_date.split("T")[0] : "";
    if (pDate === todayStr) {
      todayPaymentsCount++;
      todayPaymentsTotal += amt;
    }
    if (pDate >= sevenDaysAgoStr) {
      weekPaymentsCount++;
      weekPaymentsTotal += amt;
    }
  });

  // Calcul du total attendu par élève et par classe
  const classExpectedMap = new Map<string, number>();
  let totalExpectedOverall = 0;

  students.forEach((s) => {
    if (!s.class_id) return;
    const fee = feeMap.get(s.class_id);
    const regExpected = fee ? fee.reg : 0;
    const tuitionExpected = overrideMap.has(s.id)
      ? overrideMap.get(s.id)!
      : fee
      ? fee.tuition
      : 0;
    const studentTotalExpected = regExpected + tuitionExpected;

    totalExpectedOverall += studentTotalExpected;
    classExpectedMap.set(
      s.class_id,
      (classExpectedMap.get(s.class_id) || 0) + studentTotalExpected
    );
  });

  const totalRemainingDue = Math.max(0, totalExpectedOverall - totalPaidOverall);
  const collectionRate =
    totalExpectedOverall > 0
      ? Math.round((totalPaidOverall / totalExpectedOverall) * 1000) / 10
      : 0;

  // ─── C. Académique & Soumissions de notes ─────────────────────────────────────
  const totalClasses = classes.length;
  const totalAssignments = assignments.length;
  
  // Clé unique class_id + '_' + subject_id
  const submittedSet = new Set<string>();
  submissions.forEach((sub) => {
    submittedSet.add(`${sub.class_id}_${sub.subject_id}`);
  });

  // Calcul par classe des attributions et soumissions
  const classAssignmentsCount = new Map<string, number>();
  const classSubmissionsCount = new Map<string, number>();

  assignments.forEach((a) => {
    classAssignmentsCount.set(a.class_id, (classAssignmentsCount.get(a.class_id) || 0) + 1);
    if (submittedSet.has(`${a.class_id}_${a.subject_id}`)) {
      classSubmissionsCount.set(a.class_id, (classSubmissionsCount.get(a.class_id) || 0) + 1);
    }
  });

  // Total soumissions validées (qui correspondent à des attributions)
  let submittedGradesCount = 0;
  assignments.forEach((a) => {
    if (submittedSet.has(`${a.class_id}_${a.subject_id}`)) {
      submittedGradesCount++;
    }
  });
  const pendingGradesCount = Math.max(0, totalAssignments - submittedGradesCount);
  const gradeSubmissionRate =
    totalAssignments > 0
      ? Math.round((submittedGradesCount / totalAssignments) * 1000) / 10
      : 0;

  // ─── D. Synthèse par Classe ──────────────────────────────────────────────────
  const classStudentsCount = new Map<string, number>();
  students.forEach((s) => {
    if (s.class_id) {
      classStudentsCount.set(s.class_id, (classStudentsCount.get(s.class_id) || 0) + 1);
    }
  });

  const classesSummary: ClassDashboardSummary[] = classes.map((c) => {
    const cExpected = classExpectedMap.get(c.id) || 0;
    const cPaid = classPaidMap.get(c.id) || 0;
    const cRate = cExpected > 0 ? Math.round((cPaid / cExpected) * 1000) / 10 : 0;

    return {
      id: c.id,
      name: c.name,
      divisionId: c.division_id,
      studentCount: classStudentsCount.get(c.id) || 0,
      expectedSubmissions: classAssignmentsCount.get(c.id) || 0,
      actualSubmissions: classSubmissionsCount.get(c.id) || 0,
      collectionRate: cRate,
      totalPaid: cPaid,
      totalExpected: cExpected,
    };
  });

  return {
    schoolYear: {
      id: activeYear.id,
      name: activeYear.label || (activeYear as any).name || "Année active",
      startDate: activeYear.start_date,
      endDate: activeYear.end_date,
    },
    activeSequence: activeSeq,
    schoolSettings: {
      name: schoolSettings.name,
      address: schoolSettings.address,
      phone: schoolSettings.phone,
    },
    enrollment: {
      totalActive,
      totalPending,
      totalStudents: students.length,
      byDivision,
    },
    finances: {
      totalExpected: totalExpectedOverall,
      totalPaid: totalPaidOverall,
      totalRemainingDue,
      collectionRate,
      todayPaymentsCount,
      todayPaymentsTotal,
      weekPaymentsCount,
      weekPaymentsTotal,
    },
    academics: {
      totalClasses,
      totalAssignments,
      submittedGradesCount,
      pendingGradesCount,
      gradeSubmissionRate,
    },
    classesSummary,
  };
}
