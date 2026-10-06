import React, { useState, useEffect } from "react";
import { CheckIcon } from "../../../components/ui/Icons";
import { supabase, listStudents, listMyAssignedStudents, AssignedStudentRecord } from "@fanion/shared";
import {
  listPrimaryApcStructure,
  getOrCreatePrimaryEvaluationForMonth,
  listPrimaryGrades,
  upsertPrimaryGrade,
} from "@fanion/shared/api/grades";
import { listPrimaryMonths } from "@fanion/shared/api/primaryBulletinPdfService";

interface TeacherPrimaryGradesViewProps {
  currentAssignment: any;
  userRole?: string;
}

export const TeacherPrimaryGradesView: React.FC<TeacherPrimaryGradesViewProps> = ({ currentAssignment, userRole }) => {
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

      let studentsData: AssignedStudentRecord[];
      if (userRole === "enseignant") {
        studentsData = await listMyAssignedStudents(classId, currentAssignment.subject_id);
      } else {
        const fullStudents = await listStudents({ classId, status: "active" });
        studentsData = fullStudents.map(s => ({ id: s.id, matricule: s.matricule || "", first_name: s.first_name, last_name: s.last_name, status: s.status || "active" }));
      }
      setStudents(studentsData);

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

  const handlePrimaryScoreChange = (studentId: string, subEvalId: string, valStr: string) => {
    const val = parseFloat(valStr);
    setPrimaryGradeMap((prev) => {
      const studentGrades = { ...prev[studentId] };
      if (isNaN(val)) delete studentGrades[subEvalId];
      else studentGrades[subEvalId] = val;
      return { ...prev, [studentId]: studentGrades };
    });
  };

  const handlePrimaryScoreBlur = async (studentId: string, subEvalId: string) => {
    const score = primaryGradeMap[studentId]?.[subEvalId];
    if (score === undefined || isNaN(score)) return;
    try {
      const cellKey = `${studentId}_${subEvalId}`;
      setSavingPrimaryCell(cellKey);
      await upsertPrimaryGrade(studentId, subEvalId, primaryEvalId, score);
      setSavedPrimaryCell(cellKey);
      setTimeout(() => { setSavedPrimaryCell((prev) => prev === cellKey ? null : prev); }, 2000);
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
      
      <div className="bg-white border border-line rounded p-4 shadow-sm">
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
      </div>

      <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-800 font-medium">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>Classe Primaire — Remplissage automatique (Sauvegarde à chaque champ)</span>
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
                    {students.map((student, idx) => {
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
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
