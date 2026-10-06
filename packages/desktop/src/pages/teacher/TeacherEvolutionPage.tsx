import React, { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  supabase,
  listTeacherAssignments,
  listMyAssignedStudents,
  listStudents,
  listSequences,
  listGrades,
  TeacherAssignmentRecord,
  SequenceRecord,
  AssignedStudentRecord,
  useSelectionPersistence,
} from "@fanion/shared";
import { listPrimaryApcStructure } from "@fanion/shared/api/grades";
import { listPrimaryMonths } from "@fanion/shared/api/primaryBulletinPdfService";

interface TeacherEvolutionPageProps {
  userRole?: string;
}

interface EvolutionDataPoint {
  sequenceLabel: string;
  averageScore: number;
}

interface PeriodColumn {
  id: string;
  label: string;
  shortLabel: string;
}

interface SubjectReportRow {
  student: AssignedStudentRecord;
  sequenceScores: Record<string, number | null>; // period_id -> note sur 20
  average: number | null;
}

export const TeacherEvolutionPage: React.FC<TeacherEvolutionPageProps> = ({ userRole }) => {
  const [assignments, setAssignments] = useState<TeacherAssignmentRecord[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useSelectionPersistence("assignmentId", "");

  const [sequences, setSequences] = useState<SequenceRecord[]>([]);
  const [primaryMonths, setPrimaryMonths] = useState<any[]>([]);
  const [isPrimaryClass, setIsPrimaryClass] = useState(false);
  const [classLevel, setClassLevel] = useState("");

  const [evolutionData, setEvolutionData] = useState<EvolutionDataPoint[]>([]);
  const [reportRows, setReportRows] = useState<SubjectReportRow[]>([]);
  const [activePeriods, setActivePeriods] = useState<PeriodColumn[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingChart, setLoadingChart] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;
      if (!user || !user.id) {
        setLoading(false);
        return;
      }

      const filters = userRole === "enseignant" ? { teacher_id: user.id } : {};
      const assignmentsData = await listTeacherAssignments(filters);
      setAssignments(assignmentsData);

      if (assignmentsData.length > 0) {
        setSelectedAssignmentId((prev) => (prev && assignmentsData.some((a) => a.id === prev) ? prev : assignmentsData[0].id));
      }

      // 1. Séquences collège
      const seqsData = await listSequences();
      seqsData.sort((a, b) => a.order_index - b.order_index);
      setSequences(seqsData);

      // 2. Mois primaire
      const { data: activeYear } = await supabase.from("school_years").select("id").eq("is_active", true).maybeSingle();
      let yearId = activeYear?.id;
      if (!yearId) {
        const { data: latestYear } = await supabase.from("school_years").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();
        yearId = latestYear?.id;
      }
      const months = await listPrimaryMonths(yearId);
      setPrimaryMonths(months);
    } catch (err: any) {
      console.error("Erreur attributions desktop:", err);
      setError("Impossible de charger vos attributions.");
    } finally {
      setLoading(false);
    }
  };

  const currentAssignment = assignments.find((a) => a.id === selectedAssignmentId);

  // Détecter si la classe sélectionnée est primaire / maternelle
  useEffect(() => {
    if (currentAssignment) {
      const checkPrimary = async () => {
        try {
          const { data: cls } = await supabase
            .from("classes")
            .select("division_id, level")
            .eq("id", currentAssignment.class_id)
            .single();

          if (cls && cls.division_id) {
            const { data: div } = await supabase.from("divisions").select("nom").eq("id", cls.division_id).single();
            const divName = (div?.nom || "").toLowerCase();
            const isPri = divName.includes("primaire") || divName.includes("primary") || divName.includes("maternelle");
            setIsPrimaryClass(isPri);
            setClassLevel(cls.level || "");
          } else {
            setIsPrimaryClass(false);
            setClassLevel(cls?.level || "");
          }
        } catch (e) {
          console.error("Erreur détection primaire desktop:", e);
          setIsPrimaryClass(false);
        }
      };
      checkPrimary();
    }
  }, [currentAssignment]);

  useEffect(() => {
    if (currentAssignment) {
      if (isPrimaryClass) {
        fetchEvolutionPrimary(currentAssignment.class_id, classLevel);
      } else if (sequences.length > 0) {
        fetchEvolutionSecondary(currentAssignment.class_id, currentAssignment.subject_id);
      }
    } else {
      setEvolutionData([]);
      setReportRows([]);
      setActivePeriods([]);
    }
  }, [selectedAssignmentId, sequences, primaryMonths, isPrimaryClass, classLevel]);

  // ==========================================
  // Traitement Secondaire / Collège
  // ==========================================
  const fetchEvolutionSecondary = async (classId: string, subjectId: string) => {
    try {
      setLoadingChart(true);
      setError(null);

      const periodCols: PeriodColumn[] = sequences.slice(0, 6).map((s, idx) => ({
        id: s.id,
        label: s.label,
        shortLabel: `S${idx + 1}`,
      }));
      setActivePeriods(periodCols);

      let studentsData: AssignedStudentRecord[];
      if (userRole === "enseignant") {
        studentsData = await listMyAssignedStudents(classId, subjectId);
      } else {
        const fullStudents = await listStudents({ classId, status: "active" });
        studentsData = fullStudents.map((s) => ({
          id: s.id,
          matricule: s.matricule || "",
          first_name: s.first_name,
          last_name: s.last_name,
          status: s.status || "active",
        }));
      }

      if (studentsData.length === 0) {
        setEvolutionData([]);
        setReportRows([]);
        return;
      }

      const studentIds = studentsData.map((s) => s.id);
      const allGrades = await listGrades({ subject_id: subjectId });
      const subjectGrades = allGrades.filter((g) => studentIds.includes(g.student_id));

      const chartPoints: EvolutionDataPoint[] = sequences.slice(0, 6).map((seq) => {
        const seqGrades = subjectGrades.filter((g) => g.sequence_id === seq.id);
        if (seqGrades.length === 0) {
          return { sequenceLabel: seq.label, averageScore: 0 };
        }
        const sum = seqGrades.reduce((acc, curr) => acc + curr.score, 0);
        const avg = Math.round((sum / seqGrades.length) * 100) / 100;
        return { sequenceLabel: seq.label, averageScore: avg };
      });
      setEvolutionData(chartPoints);

      const rows: SubjectReportRow[] = studentsData.map((st) => {
        const seqScores: Record<string, number | null> = {};
        const studentGrades = subjectGrades.filter((g) => g.student_id === st.id);

        let sum = 0;
        let count = 0;

        sequences.slice(0, 6).forEach((seq) => {
          const g = studentGrades.find((grade) => grade.sequence_id === seq.id);
          if (g && typeof g.score === "number") {
            seqScores[seq.id] = g.score;
            sum += g.score;
            count++;
          } else {
            seqScores[seq.id] = null;
          }
        });

        return {
          student: st,
          sequenceScores: seqScores,
          average: count > 0 ? Math.round((sum / count) * 100) / 100 : null,
        };
      });

      setReportRows(rows);
    } catch (err: any) {
      console.error("Erreur calcul évolution collège desktop:", err);
      setError("Erreur lors du calcul des moyennes collège.");
    } finally {
      setLoadingChart(false);
    }
  };

  // ==========================================
  // Traitement Primaire / Maternelle (Mois APC)
  // ==========================================
  const fetchEvolutionPrimary = async (classId: string, level: string) => {
    try {
      setLoadingChart(true);
      setError(null);

      const periodCols: PeriodColumn[] = primaryMonths.map((m, idx) => ({
        id: m.id,
        label: m.label,
        shortLabel: `M${idx + 1}`,
      }));
      setActivePeriods(periodCols);

      let studentsData: AssignedStudentRecord[];
      if (userRole === "enseignant") {
        studentsData = await listMyAssignedStudents(classId, currentAssignment?.subject_id || "");
      } else {
        const fullStudents = await listStudents({ classId, status: "active" });
        studentsData = fullStudents.map((s) => ({
          id: s.id,
          matricule: s.matricule || "",
          first_name: s.first_name,
          last_name: s.last_name,
          status: s.status || "active",
        }));
      }

      if (studentsData.length === 0) {
        setEvolutionData([]);
        setReportRows([]);
        return;
      }

      const monthIds = primaryMonths.map((m) => m.id);
      const { data: evals } = await supabase
        .from("primary_evaluations")
        .select("id, primary_month_id")
        .in("primary_month_id", monthIds);

      const evalIds = (evals || []).map((e) => e.id);

      const { subEvaluations, scales } = await listPrimaryApcStructure(level);
      const scaleMap = new Map<string, number>();
      scales.forEach((s) => scaleMap.set(s.sub_evaluation_id, Number(s.max_score) || 10));

      let totalMaxRef = 0;
      subEvaluations.forEach((sub) => {
        totalMaxRef += scaleMap.get(sub.id) ?? 10;
      });
      if (totalMaxRef === 0) totalMaxRef = 100;

      let rawGrades: any[] = [];
      if (evalIds.length > 0) {
        const { data: gData } = await supabase
          .from("primary_grades")
          .select("student_id, primary_evaluation_id, sub_evaluation_id, score")
          .in("primary_evaluation_id", evalIds)
          .in("student_id", studentsData.map((s) => s.id));
        rawGrades = gData || [];
      }

      const rows: SubjectReportRow[] = studentsData.map((st) => {
        const seqScores: Record<string, number | null> = {};
        let totalSum = 0;
        let monthCount = 0;

        primaryMonths.forEach((m) => {
          const evalItem = (evals || []).find((e) => e.primary_month_id === m.id);
          if (!evalItem) {
            seqScores[m.id] = null;
            return;
          }

          const stGrades = rawGrades.filter(
            (g) => g.student_id === st.id && g.primary_evaluation_id === evalItem.id
          );

          if (stGrades.length === 0) {
            seqScores[m.id] = null;
          } else {
            const sumScore = stGrades.reduce((acc, curr) => acc + Number(curr.score || 0), 0);
            const scoreSur20 = Math.round(((sumScore / totalMaxRef) * 20) * 100) / 100;
            seqScores[m.id] = scoreSur20;
            totalSum += scoreSur20;
            monthCount++;
          }
        });

        return {
          student: st,
          sequenceScores: seqScores,
          average: monthCount > 0 ? Math.round((totalSum / monthCount) * 100) / 100 : null,
        };
      });

      const chartPoints: EvolutionDataPoint[] = primaryMonths.map((m) => {
        const validMonthScores = rows
          .map((r) => r.sequenceScores[m.id])
          .filter((s) => s !== null && s !== undefined) as number[];

        if (validMonthScores.length === 0) {
          return { sequenceLabel: m.label, averageScore: 0 };
        }
        const sum = validMonthScores.reduce((acc, curr) => acc + curr, 0);
        const avg = Math.round((sum / validMonthScores.length) * 100) / 100;
        return { sequenceLabel: m.label, averageScore: avg };
      });

      setEvolutionData(chartPoints);
      setReportRows(rows);
    } catch (err: any) {
      console.error("Erreur calcul évolution primaire desktop:", err);
      setError("Erreur lors du calcul des moyennes primaire.");
    } finally {
      setLoadingChart(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-slate font-medium text-sm">
        Chargement des données d'évolution...
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="border-b border-line pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-ink">
            Évolution de mes élèves
          </h1>
          <p className="text-xs sm:text-sm text-slate mt-0.5">
            {isPrimaryClass
              ? "Tendance des moyennes mensuelles et bordereau APC pour votre classe primaire (Desktop)"
              : "Tendance des moyennes et bordereau de notes par séquence pour votre matière assignée (Desktop)"}
          </p>
        </div>

        {isPrimaryClass && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold self-start sm:self-auto">
            <span>Cycle Primaire (Évaluations mensuelles APC)</span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-signal-red/30 text-signal-red text-xs sm:text-sm rounded font-medium">
          {error}
        </div>
      )}

      {/* Sélecteur Classe & Matière */}
      <div className="bg-white border border-line rounded p-4 shadow-sm">
        <label className="block text-xs font-semibold text-slate uppercase mb-1">
          Sélectionner Classe &amp; Matière
        </label>
        {assignments.length === 0 ? (
          <div className="text-xs text-signal-red italic p-2 border border-dashed border-line rounded">
            Aucune attribution trouvée pour votre compte.
          </div>
        ) : (
          <select
            value={selectedAssignmentId}
            onChange={(e) => setSelectedAssignmentId(e.target.value)}
            className="w-full sm:w-1/2 px-3 py-2 border border-line rounded focus:outline-none focus:ring-1 focus:ring-ink bg-paper text-sm font-medium"
          >
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.class_name} — {a.subject_name}
              </option>
            ))}
          </select>
        )}
      </div>

      {loadingChart ? (
        <div className="py-12 text-center text-slate text-xs sm:text-sm">
          Calcul des moyennes et préparation du bordereau...
        </div>
      ) : (
        <>
          {/* Graphique en Ligne des Moyennes */}
          <div className="bg-white border border-line rounded p-3 sm:p-6 shadow-sm space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-ink uppercase tracking-wide">
                Moyenne de la classe (sur 20)
              </h3>
              {currentAssignment && (
                <span className="text-[11px] sm:text-xs font-semibold text-slate bg-paper px-2 py-0.5 sm:px-2.5 sm:py-1 rounded border border-line self-start sm:self-auto">
                  {currentAssignment.class_name} — {currentAssignment.subject_name}
                </span>
              )}
            </div>

            <div className="h-56 sm:h-72 w-full pt-2 sm:pt-4 -ml-2 sm:ml-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E0D6" />
                  <XAxis dataKey="sequenceLabel" stroke="#5B6B82" fontSize={11} tickLine={false} />
                  <YAxis domain={[0, 20]} stroke="#5B6B82" fontSize={11} tickCount={5} />
                  <Tooltip
                    formatter={(val: any) => [`${val} / 20`, isPrimaryClass ? "Moyenne Mensuelle" : "Moyenne Matière"]}
                    contentStyle={{ backgroundColor: "#FAF9F5", borderColor: "#E4E0D6", borderRadius: "4px", fontSize: "12px" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }} />
                  <Line
                    type="monotone"
                    dataKey="averageScore"
                    name={isPrimaryClass ? "Moyenne Mensuelle" : "Moyenne Matière"}
                    stroke="#150A5E"
                    strokeWidth={2.5}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Section Bordereau Desktop */}
          <div className="bg-white border border-line rounded shadow-sm overflow-hidden space-y-2">
            <div className="p-3 sm:p-4 border-b border-line bg-paper/50 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-ink uppercase tracking-wide">
                  {isPrimaryClass
                    ? `Bordereau mensuel : ${currentAssignment?.class_name}`
                    : `Bordereau de matière : ${currentAssignment?.subject_name}`}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate mt-0.5">
                  Récapitulatif des notes des {reportRows.length} élève(s) de {currentAssignment?.class_name} sur les {activePeriods.length} périodes
                </p>
              </div>
            </div>

            {reportRows.length === 0 ? (
              <div className="p-8 text-center text-slate text-sm">
                Aucun élève trouvé dans cette classe.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-paper border-b border-line text-slate font-bold uppercase tracking-wider">
                      <th className="py-2.5 px-3 w-10 text-center">N°</th>
                      <th className="py-2.5 px-3 w-28">Matricule</th>
                      <th className="py-2.5 px-3">Nom et Prénom</th>
                      {activePeriods.map((period) => (
                        <th key={period.id} className="py-2.5 px-3 text-center min-w-[70px]">
                          {period.label}
                        </th>
                      ))}
                      <th className="py-2.5 px-3 text-center w-24">Moyenne</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {reportRows.map((row, idx) => (
                      <tr key={row.student.id} className="hover:bg-paper/40 transition-colors">
                        <td className="py-2 px-3 text-center font-mono text-slate font-bold">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate">
                          {row.student.matricule}
                        </td>
                        <td className="py-2 px-3 font-semibold text-ink">
                          {row.student.last_name} {row.student.first_name}
                        </td>
                        {activePeriods.map((period) => {
                          const score = row.sequenceScores[period.id];
                          return (
                            <td key={period.id} className="py-2 px-3 text-center font-mono font-bold">
                              {score !== null && score !== undefined ? (
                                <span className={score < 10 ? "text-signal-red" : "text-ink"}>
                                  {score.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-slate/40 font-normal">--</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2 px-3 text-center font-mono font-bold">
                          {row.average !== null ? (
                            <span className={row.average < 10 ? "text-signal-red font-bold" : "text-[#150A5E]"}>
                              {row.average.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate/40">--</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TeacherEvolutionPage;
