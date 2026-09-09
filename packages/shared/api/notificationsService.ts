import { supabase } from "./supabaseClient";
import { getAcademicCalendar } from "../services/settingsService";
import { getClassFinancialReport } from "./financialReportService";

export interface LateTeacherNotification {
  id: string; // unique identifier
  teacherId: string;
  teacherName: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  sequenceId: string;
  sequenceName: string;
  deadlineDate: string; // end_date + grace_period_days
  daysLate: number;
  message: string;
}

export interface UnpaidStudentNotification {
  id: string; // unique identifier
  studentId: string;
  studentName: string;
  matricule: string;
  classId: string;
  className: string;
  trancheLabel: string;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  remainingDue: number;
  daysOverdue: number;
  message: string;
}

export interface AdminNotificationsResult {
  lateTeachers: LateTeacherNotification[];
  unpaidStudents: UnpaidStudentNotification[];
  totalCount: number;
}

/**
 * Service d'agrégation des notifications administratives (calculées en lecture à la volée).
 * Réservé exclusivement au Principal et au Directeur des Études.
 */
export async function getAdminNotifications(schoolYearId?: string): Promise<AdminNotificationsResult> {
  // 1. Vérification de rôle (sécurité application + RLS)
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    throw new Error("Utilisateur non authentifié.");
  }

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profErr || !profile || !["principal", "directeur_etudes"].includes(profile.role)) {
    throw new Error("Accès refusé : le centre de notifications est réservé à la direction.");
  }

  // 2. Année scolaire active si non fournie
  let targetYearId = schoolYearId;
  if (!targetYearId) {
    const { data: activeYear } = await supabase
      .from("school_years")
      .select("id")
      .eq("is_active", true)
      .maybeSingle();
    targetYearId = activeYear?.id;

    if (!targetYearId) {
      const { data: fallbackYears } = await supabase
        .from("school_years")
        .select("id")
        .order("start_date", { ascending: false })
        .limit(1);
      if (fallbackYears && fallbackYears.length > 0) {
        targetYearId = fallbackYears[0].id;
      }
    }
  }

  if (!targetYearId) {
    return { lateTeachers: [], unpaidStudents: [], totalCount: 0 };
  }

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD

  // -------------------------------------------------------------------------
  // A. Détection des Enseignants en Retard
  // -------------------------------------------------------------------------
  // Récupérer le calendrier académique pour identifier les séquences dont l'échéance + délai de grâce est dépassée
  const academicCalendar = await getAcademicCalendar();
  const lateTeachers: LateTeacherNotification[] = [];

  // Identifier la séquence active (ou les séquences échues non encore verrouillées)
  // Règle cahier des charges : "pour la séquence active, si aujourd'hui > (sequences.end_date + grace_period_days)
  // ET qu'un enseignant assigné n'a pas de ligne dans grade_submissions pour sa classe/matière/cette séquence"
  
  // Trouvons la séquence active (la première ouverte ou la dernière chronologique)
  let activeSeq: { id: string; name: string; end_date: string | null; grace_period_days: number } | null = null;
  for (const term of academicCalendar) {
    for (const seq of term.sequences) {
      if (!seq.is_locked && !activeSeq) {
        activeSeq = {
          id: seq.id,
          name: seq.name,
          end_date: seq.end_date,
          grace_period_days: seq.grace_period_days || 0,
        };
      }
    }
  }

  // Si aucune ouverte, fallback sur la première séquence du calendrier
  if (!activeSeq && academicCalendar.length > 0 && academicCalendar[0].sequences.length > 0) {
    const fSeq = academicCalendar[0].sequences[0];
    activeSeq = {
      id: fSeq.id,
      name: fSeq.name,
      end_date: fSeq.end_date,
      grace_period_days: fSeq.grace_period_days || 0,
    };
  }

  if (activeSeq && activeSeq.end_date) {
    const endDate = new Date(activeSeq.end_date);
    const deadline = new Date(endDate);
    deadline.setDate(deadline.getDate() + (activeSeq.grace_period_days || 0));
    const deadlineStr = deadline.toISOString().split("T")[0];

    // Vérifier si aujourd'hui > deadline
    if (todayStr > deadlineStr) {
      const diffTime = Math.abs(today.getTime() - deadline.getTime());
      const daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Charger les assignations d'enseignants avec les profils, matières et classes
      const { data: assignments, error: assignErr } = await supabase
        .from("teacher_assignments")
        .select(`
          id,
          teacher_id,
          subject_id,
          class_id,
          profiles:teacher_id (id, full_name),
          subjects:subject_id (id, name),
          classes:class_id (id, name, school_year_id)
        `);

      if (!assignErr && assignments) {
        // Filtrer les assignations pour l'année scolaire ciblée
        const validAssignments = assignments.filter(
          (a: any) => a.classes && a.classes.school_year_id === targetYearId
        );

        // Charger toutes les soumissions de notes pour cette séquence
        const { data: submissions } = await supabase
          .from("grade_submissions")
          .select("class_id, subject_id, sequence_id")
          .eq("sequence_id", activeSeq.id);

        const submittedKeys = new Set(
          (submissions || []).map((s: any) => `${s.class_id}_${s.subject_id}`)
        );

        for (const a of validAssignments) {
          const key = `${a.class_id}_${a.subject_id}`;
          if (!submittedKeys.has(key)) {
            const teacherName = (a.profiles as any)?.full_name || "Enseignant non identifié";
            const subjectName = (a.subjects as any)?.name || "Matière";
            const className = (a.classes as any)?.name || "Classe";

            lateTeachers.push({
              id: `late-teacher-${a.id}-${activeSeq.id}`,
              teacherId: a.teacher_id,
              teacherName,
              classId: a.class_id,
              className,
              subjectId: a.subject_id,
              subjectName,
              sequenceId: activeSeq.id,
              sequenceName: activeSeq.name,
              deadlineDate: deadlineStr,
              daysLate,
              message: `${teacherName} n'a pas encore soumis ses notes de ${subjectName} pour ${className}, ${activeSeq.name}`,
            });
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // B. Détection des Élèves non solvables avec délai dépassé
  // -------------------------------------------------------------------------
  // Récupérer toutes les classes de l'année
  const { data: classesList } = await supabase
    .from("classes")
    .select("id, name")
    .eq("school_year_id", targetYearId);

  const unpaidStudents: UnpaidStudentNotification[] = [];

  if (classesList && classesList.length > 0) {
    // Calculer les états financiers de chaque classe
    for (const cls of classesList) {
      try {
        const report = await getClassFinancialReport(cls.id, targetYearId);
        if (!report.feeSchedule || !report.feeSchedule.installments_json) continue;

        const installments = report.feeSchedule.installments_json;

        for (const student of report.students) {
          // Pour chaque tranche, vérifier si due_date < todayStr ET tranche non soldée
          student.trancheBreakdown.forEach((tb, idx) => {
            const originalInst = installments[idx];
            if (
              originalInst &&
              originalInst.due_date &&
              originalInst.due_date < todayStr &&
              tb.remaining > 0
            ) {
              const dueDateObj = new Date(originalInst.due_date);
              const diffTime = Math.abs(today.getTime() - dueDateObj.getTime());
              const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              const studentFullName = `${student.lastName} ${student.firstName}`.trim();

              unpaidStudents.push({
                id: `unpaid-student-${student.studentId}-${idx}`,
                studentId: student.studentId,
                studentName: studentFullName,
                matricule: student.matricule,
                classId: cls.id,
                className: cls.name,
                trancheLabel: tb.label,
                dueDate: originalInst.due_date,
                amountDue: tb.expected,
                amountPaid: tb.paid,
                remainingDue: tb.remaining,
                daysOverdue,
                message: `Retard de paiement : ${studentFullName} (${cls.name}), ${tb.label}, échéance dépassée le ${originalInst.due_date}`,
              });
            }
          });
        }
      } catch (err) {
        console.warn(`Erreur calcul état financier pour classe ${cls.id}:`, err);
      }
    }
  }

  // Trier les enseignants par nombre de jours de retard descendant
  lateTeachers.sort((a, b) => b.daysLate - a.daysLate);
  // Trier les impayés par nombre de jours de retard descendant
  unpaidStudents.sort((a, b) => b.daysOverdue - a.daysOverdue);

  return {
    lateTeachers,
    unpaidStudents,
    totalCount: lateTeachers.length + unpaidStudents.length,
  };
}
