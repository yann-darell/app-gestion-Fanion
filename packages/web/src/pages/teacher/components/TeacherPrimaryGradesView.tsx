import React, { useState, useEffect } from "react";
import { CheckIcon, CheckCircleIcon, AlertTriangleIcon, LockIcon } from "../../../components/ui/Icons";
import {
  supabase,
  AssignedStudentRecord,
  listPrimaryApcStructure,
  getOrCreatePrimaryEvaluationForMonth,
  listPrimaryGrades,
  upsertPrimaryGrade,
  deletePrimaryGradeByCriteria,
  listPrimaryMonths,
  submitClassGrades,
  getGradeSubmission,
} from "@fanion/shared";

interface TeacherPrimaryGradesViewProps {
  currentAssignment: any;
  currentUserId?: string | null;
  isTeacher?: boolean;
}

export const TeacherPrimaryGradesView: React.FC<TeacherPrimaryGradesViewProps> = ({ currentAssignment, currentUserId, isTeacher }) => {
  const [primaryMonths, setPrimaryMonths] = useState<any[]>([]);
  const [selectedMonthId, setSelectedMonthId] = useState<string>("");
  
  const [primaryDomains, setPrimaryDomains] = useState<any[]>([]);
  const [primarySubEvals, setPrimarySubEvals] = useState<any[]>([]);
  const [primaryScales, setPrimaryScales] = useState<any[]>([]);
  
  const [students, setStudents] = useState<AssignedStudentRecord[]>([]);
  const [primaryGradeMap, setPrimaryGradeMap] = useState<Record<string, Record<string, number>>>({});
  const [primaryEvalId, setPrimaryEvalId] = useState<string>("");
  
  const [savingPrimaryCell, setSavingPrimaryCell] = useState<string | null>(null);
  const [savedPrimaryCell, setSavedPrimaryCell] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Soumission des notes primaires
  const [submitting, setSubmitting] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [submissionDate, setSubmissionDate] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (currentAssignment?.class_id) {
      initPrimaryData(currentAssignment.class_id);
    }
  }, [currentAssignment?.class_id]);

  const initPrimaryData = async (classId: string) => {
    try {
      setLoading(true);
      const { data: cls } = await supabase.from("classes").select("level").eq("id", classId).single();
      const clsLevel = cls?.level || "";

      const { data: activeYear } = await supabase.from("school_years").select("id").eq("is_active", true).maybeSingle();
      let yearId = activeYear?.id;
      if (!yearId) {
        const { data: latestYear } = await supabase.from("school_years").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();
        yearId = latestYear?.id;
      }

      const months = await listPrimaryMonths(yearId);
      setPrimaryMonths(months);

      if (months.length > 0) {
        setSelectedMonthId(months[0].id);
      }

      const { domains, subEvaluations, scales } = await listPrimaryApcStructure(clsLevel);
      setPrimaryDomains(domains);
      setPrimarySubEvals(subEvaluations);
      setPrimaryScales(scales);
    } catch (err: any) {
      setError("Erreur chargement structure primaire.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentAssignment && selectedMonthId) {
      fetchPrimaryGrades(currentAssignment.class_id, selectedMonthId);
    }
  }, [currentAssignment, selectedMonthId]);

  const fetchPrimaryGrades = async (classId: string, monthId: string) => {
    try {
      const evalId = await getOrCreatePrimaryEvaluationForMonth(monthId);
      setPrimaryEvalId(evalId);

      // Récupération des élèves : SELECT direct (fiable avec RLS students_primary_teacher_select)
      let studentsData: AssignedStudentRecord[] = [];
      try {
        const { data: directData, error: directErr } = await supabase
          .from("students")
          .select("id, matricule, first_name, last_name, status")
          .eq("class_id", classId)
          .eq("status", "active")
          .order("last_name")
          .order("first_name");
        if (!directErr && directData && directData.length > 0) {
          studentsData = directData as AssignedStudentRecord[];
        } else {
          // Fallback RPC SECURITY DEFINER
          const { data: rpcData } = await supabase.rpc("get_my_primary_assigned_students", { p_class_id: classId });
          if (rpcData && rpcData.length > 0) studentsData = rpcData as AssignedStudentRecord[];
        }
      } catch (e) {
        console.warn("Erreur chargement élèves primaires:", e);
      }
      setStudents(studentsData);

      // Statut de soumission pour ce mois
      try {
        const sub = await getGradeSubmission(classId, "primaire-titulaire", monthId);
        if (sub && sub.is_locked) {
          setIsLocked(true);
          setSubmissionDate(sub.submitted_at);
        } else {
          setIsLocked(false);
          setSubmissionDate(null);
        }
      } catch (e) {
        console.warn("Erreur statut soumission primaire:", e);
      }

      const gradesData = await listPrimaryGrades(evalId, studentsData.map(s => s.id));
      const pMap: Record<string, Record<string, number>> = {};
      gradesData.forEach((g) => {
        if (!pMap[g.student_id]) pMap[g.student_id] = {};
        pMap[g.student_id][g.sub_evaluation_id] = g.score;
      });
      setPrimaryGradeMap(pMap);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitPrimaryGrades = async () => {
    if (!currentAssignment?.class_id || !selectedMonthId || !currentUserId) return;
    const confirmMsg = "Êtes-vous sûr de vouloir valider les notes de la classe pour ce mois ?\n\nUne fois validées, elles seront verrouillées.";
    if (!window.confirm(confirmMsg)) return;
    try {
      setSubmitting(true);
      setError(null);
      const res = await submitClassGrades(
        currentAssignment.class_id,
        "primaire-titulaire",
        selectedMonthId,
        currentUserId
      );
      setIsLocked(true);
      setSubmissionDate(res.submitted_at);
      setSuccessMessage("Notes du mois validées et verrouillées avec succès.");
    } catch (err: any) {
      setError(err.message || "Erreur lors de la validation.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrimaryScoreChange = (studentId: string, subEvalId: string, valStr: string) => {
    const trimmed = valStr.trim();
    setPrimaryGradeMap((prev) => {
      const studentGrades = { ...prev[studentId] };
      if (trimmed === "") {
        delete studentGrades[subEvalId];
      } else {
        const val = parseFloat(trimmed);
        if (!isNaN(val)) {
          studentGrades[subEvalId] = val;
        }
      }
      return { ...prev, [studentId]: studentGrades };
    });
  };

  const handlePrimaryScoreBlur = async (studentId: string, subEvalId: string) => {
    if (!primaryEvalId) return;
    const score = primaryGradeMap[studentId]?.[subEvalId];
    const cellKey = `${studentId}_${subEvalId}`;

    if (score === undefined || isNaN(score)) {
      try {
        setSavingPrimaryCell(cellKey);
        await deletePrimaryGradeByCriteria(studentId, subEvalId, primaryEvalId);
        setSavedPrimaryCell(cellKey);
        setTimeout(() => { setSavedPrimaryCell((prev) => prev === cellKey ? null : prev); }, 1500);
      } catch (err: any) {
        console.error("Erreur suppression note primaire:", err);
      } finally {
        setSavingPrimaryCell(null);
      }
      return;
    }

    try {
      setSavingPrimaryCell(cellKey);
      await upsertPrimaryGrade(studentId, subEvalId, primaryEvalId, score);
      setSavedPrimaryCell(cellKey);
      setTimeout(() => { setSavedPrimaryCell((prev) => prev === cellKey ? null : prev); }, 1500);
    } catch (err: any) {
      setError(err.message || "Erreur de sauvegarde.");
    } finally {
      setSavingPrimaryCell(null);
    }
  };

  const getDomainTotal = (studentId: string, domain: any) => {
    const subs = primarySubEvals.filter((se) => se.domain_id === domain.id);
    let total = 0;
    let maxTotal = 0;
    subs.forEach((sub) => {
      const scale = primaryScales.find((s) => s.sub_evaluation_id === sub.id);
      maxTotal += scale?.max_score ?? 10;
      const score = primaryGradeMap[studentId]?.[sub.id];
      if (score !== undefined) {
        total += score;
      }
    });
    return { total, maxTotal };
  };

  if (loading) return <div className="py-8 text-center text-slate text-sm">Chargement du mois...</div>;

  return (
    <div className="space-y-6">
      {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded">{error}</div>}
      {successMessage && <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded font-medium">{successMessage}</div>}
      
      <div className="bg-white border border-line rounded p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="block text-xs font-semibold text-slate uppercase mb-1">Mois (Période)</label>
        <select
          value={selectedMonthId}
          onChange={(e) => setSelectedMonthId(e.target.value)}
          className="w-full sm:w-1/2 px-3 py-2 border border-line rounded focus:outline-none focus:ring-1 focus:ring-ink bg-paper text-sm font-medium"
        >
          {primaryMonths.map((m) => (
            <option key={m.id} value={m.id}>{m.label} {m.termLabel ? `(${m.termLabel})` : ""}</option>
          ))}
        </select>
        {isLocked && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-50 border border-emerald-200 text-fanion-green text-xs font-bold whitespace-nowrap">
            <LockIcon className="w-3.5 h-3.5" />
            Notes verrouillées
            {submissionDate && <span className="text-[11px] font-normal text-slate ml-1">({new Date(submissionDate).toLocaleDateString("fr-FR")})</span>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-800 font-medium">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>Classe Primaire — Grille APC complète (toutes matières · sauvegarde automatique par champ)</span>
      </div>

      {primaryDomains.length === 0 ? (
        <div className="p-8 text-center bg-white border border-line rounded text-slate text-sm">Aucun domaine APC configuré.</div>
      ) : (
        primaryDomains.map((domain) => {
          const domainSubs = primarySubEvals.filter((se) => se.domain_id === domain.id);
          if (domainSubs.length === 0) return null;
          return (
            <div key={domain.id} className="bg-white border border-line rounded shadow-sm overflow-hidden pb-12 md:pb-0">
              <div className="px-4 py-3 bg-ink text-white flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs font-bold opacity-70 mr-2">{domain.code}</span>
                  <span className="font-display font-bold text-sm">{domain.name}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-line bg-paper text-xs font-semibold text-slate uppercase tracking-wider">
                      <th className="px-4 py-2 w-8 text-center">N°</th>
                      <th className="px-4 py-2">Élève</th>
                      {domainSubs.map((sub) => {
                        const scale = primaryScales.find((s) => s.sub_evaluation_id === sub.id);
                        return (
                          <th key={sub.id} className="px-3 py-2 text-center min-w-[100px]">
                            <div className="text-[10px] leading-tight">{sub.label}</div>
                            <div className="text-[10px] font-normal opacity-60">/{scale?.max_score ?? "?"}</div>
                          </th>
                        );
                      })}
                      <th className="px-3 py-2 text-center min-w-[80px]">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60 text-sm">
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan={domainSubs.length + 3} className="px-4 py-8 text-center text-xs text-slate italic bg-paper/20">
                          Aucun élève actif trouvé dans cette classe.
                        </td>
                      </tr>
                    ) : (
                      students.map((student, idx) => {
                        const { total, maxTotal } = getDomainTotal(student.id, domain);
                      return (
                        <tr key={student.id} className="hover:bg-paper/30 transition">
                          <td className="px-4 py-2 text-center text-xs font-mono text-slate">{idx + 1}</td>
                          <td className="px-4 py-2">
                            <div className="font-semibold text-sm text-ink leading-tight">{student.last_name} {student.first_name}</div>
                          </td>
                          {domainSubs.map((sub) => {
                            const scale = primaryScales.find((s) => s.sub_evaluation_id === sub.id);
                            const maxScore = scale?.max_score ?? 10;
                            const score = primaryGradeMap[student.id]?.[sub.id];
                            const cellKey = `${student.id}_${sub.id}`;
                            const isSaving = savingPrimaryCell === cellKey;
                            const isSaved = savedPrimaryCell === cellKey;

                            return (
                              <td key={sub.id} className="px-3 py-2 text-center">
                                <div className="relative flex items-center justify-center gap-1">
                                  <input
                                    type="number" step="0.25" min="0" max={maxScore} inputMode="decimal"
                                    value={score !== undefined ? score : ""}
                                    onChange={(e) => handlePrimaryScoreChange(student.id, sub.id, e.target.value)}
                                    onBlur={() => handlePrimaryScoreBlur(student.id, sub.id)}
                                    placeholder={`/${maxScore}`}
                                    className={`w-16 sm:w-20 px-2 py-1.5 border rounded text-right font-mono font-bold text-xs bg-paper focus:outline-none focus:ring-1 transition ${
                                      isSaved ? "border-emerald-400 focus:ring-emerald-500" : "border-line focus:ring-ink"
                                    }`}
                                  />
                                  {isSaving && <span className="absolute -right-4 top-1/2 -translate-y-1/2 text-fanion-gold text-[10px]">...</span>}
                                  {isSaved && !isSaving && <span className="absolute -right-4 top-1/2 -translate-y-1/2"><CheckIcon className="w-3 h-3 text-emerald-600" /></span>}
                                </div>
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-block px-2 py-1 rounded font-mono font-bold text-xs ${
                              maxTotal > 0 && total / maxTotal >= 0.6 ? "bg-emerald-50 text-emerald-700" : maxTotal > 0 && total / maxTotal >= 0.4 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                            }`}>
                              {total.toFixed(1)}/{maxTotal}
                            </span>
                          </td>
                        </tr>
                      );
                    }))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}

      {/* Barre de validation globale pour le primaire */}
      {students.length > 0 && (!isLocked || !isTeacher) && (
        <div className="fixed bottom-16 left-0 right-0 z-20 md:static bg-white/95 md:bg-paper/30 backdrop-blur-md md:backdrop-blur-none border-t border-line p-3 sm:p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] md:shadow-none flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate w-full sm:w-auto text-center sm:text-left">
            {isLocked ? (
              <span className="text-fanion-green font-medium flex items-center justify-center sm:justify-start gap-1.5">
                <CheckCircleIcon className="w-4 h-4 text-fanion-green flex-shrink-0" />
                <span>Notes du mois validées et transmises.</span>
              </span>
            ) : (
              <span className="text-slate flex items-center gap-1.5">
                <AlertTriangleIcon className="w-4 h-4 flex-shrink-0" />
                Sauvegarde automatique par champ — cliquez Valider quand la saisie est complète.
              </span>
            )}
          </div>
          {!isLocked && (
            <button
              type="button"
              id="btn-validate-primary-grades"
              disabled={submitting}
              onClick={handleSubmitPrimaryGrades}
              className={`w-full sm:w-auto px-5 py-2.5 rounded text-xs sm:text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2 ${
                !submitting
                  ? "bg-fanion-green hover:bg-emerald-700 text-white cursor-pointer active:scale-98"
                  : "bg-slate/20 text-slate/60 cursor-not-allowed"
              }`}
            >
              {submitting ? "Validation en cours..." : "Valider et envoyer les notes du mois"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
