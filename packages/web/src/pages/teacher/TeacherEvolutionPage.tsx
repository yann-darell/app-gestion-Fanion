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

interface TeacherEvolutionPageProps {
  userRole?: string;
}

interface EvolutionDataPoint {
  sequenceLabel: string;
  averageScore: number;
}

interface SubjectReportRow {
  student: AssignedStudentRecord;
  sequenceScores: Record<string, number | null>; // sequence_id -> note
  average: number | null;
}

export const TeacherEvolutionPage: React.FC<TeacherEvolutionPageProps> = ({ userRole }) => {
  const [assignments, setAssignments] = useState<TeacherAssignmentRecord[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useSelectionPersistence("assignmentId", "");

  const [sequences, setSequences] = useState<SequenceRecord[]>([]);
  const [evolutionData, setEvolutionData] = useState<EvolutionDataPoint[]>([]);
  const [reportRows, setReportRows] = useState<SubjectReportRow[]>([]);

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
        setSelectedAssignmentId((prev) => (prev && assignmentsData.some(a => a.id === prev) ? prev : assignmentsData[0].id));
      }

      const seqsData = await listSequences();
      seqsData.sort((a, b) => a.order_index - b.order_index);
      setSequences(seqsData);
    } catch (err: any) {
      console.error("Erreur attributions web:", err);
      setError("Impossible de charger vos attributions.");
    } finally {
      setLoading(false);
    }
  };

  const currentAssignment = assignments.find((a) => a.id === selectedAssignmentId);

  useEffect(() => {
    if (currentAssignment && sequences.length > 0) {
      fetchEvolutionAndBordereau(currentAssignment.class_id, currentAssignment.subject_id);
    } else {
      setEvolutionData([]);
      setReportRows([]);
    }
  }, [selectedAssignmentId, sequences]);

  const fetchEvolutionAndBordereau = async (classId: string, subjectId: string) => {
    try {
      setLoadingChart(true);
      setError(null);

      // 1. Récupérer les élèves de la classe
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

      // 2. Récupérer les notes réelles directement de la table grades pour cette matière
      const studentIds = studentsData.map((s) => s.id);
      const allGrades = await listGrades({ subject_id: subjectId });
      const subjectGrades = allGrades.filter((g) => studentIds.includes(g.student_id));

      // 3. Calculer les points du graphique pour chaque séquence
      const chartPoints: EvolutionDataPoint[] = sequences.map((seq) => {
        const seqGrades = subjectGrades.filter((g) => g.sequence_id === seq.id);
        if (seqGrades.length === 0) {
          return {
            sequenceLabel: seq.label,
            averageScore: 0,
          };
        }
        const sum = seqGrades.reduce((acc, curr) => acc + curr.score, 0);
        const avg = Math.round((sum / seqGrades.length) * 100) / 100;
        return {
          sequenceLabel: seq.label,
          averageScore: avg,
        };
      });
      setEvolutionData(chartPoints);

      // 4. Construire les lignes du Bordereau de matière (1 ligne par élève, Séquences 1 à 6)
      const rows: SubjectReportRow[] = studentsData.map((st) => {
        const seqScores: Record<string, number | null> = {};
        const studentGrades = subjectGrades.filter((g) => g.student_id === st.id);

        let sum = 0;
        let count = 0;

        sequences.forEach((seq) => {
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
      console.error("Erreur calcul évolution & bordereau web:", err);
      setError("Erreur lors du calcul des moyennes pour le graphique et le bordereau.");
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

  // Séquences à afficher (jusqu'à 6)
  const displaySequences = sequences.slice(0, 6);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="border-b border-line pb-4">
        <h1 className="text-xl sm:text-2xl font-display font-bold text-ink">
          Évolution de mes élèves
        </h1>
        <p className="text-xs sm:text-sm text-slate mt-0.5">
          Tendance des moyennes et bordereau de notes par séquence pour votre matière assignée (Interface Web &amp; Mobile)
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-signal-red/30 text-signal-red text-xs sm:text-sm rounded font-medium">
          {error}
        </div>
      )}

      {/* Sélecteur Classe / Matière */}
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
                Moyenne de la classe dans votre matière (sur 20)
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
                    formatter={(val: any) => [`${val} / 20`, "Moyenne Matière"]}
                    contentStyle={{ backgroundColor: "#FAF9F5", borderColor: "#E4E0D6", borderRadius: "4px", fontSize: "12px" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }} />
                  <Line
                    type="monotone"
                    dataKey="averageScore"
                    name="Moyenne Matière"
                    stroke="#150A5E"
                    strokeWidth={2.5}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Section Bordereau de matière : Cartes empilées sur mobile, Tableau sur Desktop */}
          <div className="bg-white border border-line rounded shadow-sm overflow-hidden space-y-2">
            <div className="p-3 sm:p-4 border-b border-line bg-paper/50 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-ink uppercase tracking-wide">
                  Bordereau de matière : {currentAssignment?.subject_name}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate mt-0.5">
                  Récapitulatif des notes des {reportRows.length} élève(s) de {currentAssignment?.class_name} sur les 6 séquences
                </p>
              </div>
            </div>

            {reportRows.length === 0 ? (
              <div className="p-8 text-center text-slate text-sm">
                Aucun élève trouvé dans cette classe.
              </div>
            ) : (
              <>
                {/* 1. VERSION MOBILE (< md) : Liste de cartes empilées sans défilement horizontal */}
                <div className="block md:hidden divide-y divide-line">
                  {reportRows.map((row, idx) => {
                    // Calcul des séquences sous la moyenne (< 10)
                    const failingCount = displaySequences.filter((seq) => {
                      const score = row.sequenceScores[seq.id];
                      return score !== null && score !== undefined && score < 10;
                    }).length;
                    const hasMultipleFailures = failingCount >= 2;

                    return (
                      <div
                        key={row.student.id}
                        className={`p-3 transition-colors ${
                          hasMultipleFailures
                            ? "border-l-4 border-l-signal-red bg-rose-50/25"
                            : "hover:bg-paper/30"
                        }`}
                      >
                        {/* En-tête de la carte élève */}
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-xs font-bold text-slate w-5 flex-shrink-0">
                              #{idx + 1}
                            </span>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-ink truncate leading-tight">
                                {row.student.last_name} {row.student.first_name}
                              </h4>
                              <p className="text-[10px] text-slate font-mono mt-0.5">
                                {row.student.matricule}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {hasMultipleFailures && (
                              <span
                                title={`${failingCount} séquences en dessous de 10/20`}
                                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-signal-red border border-rose-200"
                              >
                                {failingCount} sous la moy.
                              </span>
                            )}
                            {row.average !== null ? (
                              <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                                row.average < 10 
                                  ? "bg-rose-100 text-signal-red" 
                                  : "bg-[#150A5E]/10 text-[#150A5E]"
                              }`}>
                                Moy: {row.average.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate/50 font-mono">
                                Non classé
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Grille 6 pastilles pour les 6 séquences */}
                        <div className="grid grid-cols-6 gap-1.5 pt-1">
                          {displaySequences.map((seq, sIdx) => {
                            const score = row.sequenceScores[seq.id];
                            const isFail = score !== null && score !== undefined && score < 10;
                            return (
                              <div
                                key={seq.id}
                                className={`flex flex-col items-center justify-center p-1 rounded border text-center ${
                                  score !== null && score !== undefined
                                    ? isFail
                                      ? "bg-rose-50 border-rose-200 text-signal-red font-bold"
                                      : "bg-paper border-line text-ink font-semibold"
                                    : "bg-paper/40 border-line/50 text-slate/40"
                                }`}
                              >
                                <span className="text-[9px] uppercase tracking-wider text-slate/70">
                                  S{sIdx + 1}
                                </span>
                                <span className="font-mono text-xs mt-0.5 leading-none">
                                  {score !== null && score !== undefined ? (
                                    score % 1 === 0 ? score.toString() : score.toFixed(1)
                                  ) : (
                                    "--"
                                  )}
                                </span>
                              </div>
                            );
                          })}
                          {/* Emplacements restants si moins de 6 séquences */}
                          {Array.from({ length: Math.max(0, 6 - displaySequences.length) }).map((_, i) => (
                            <div
                              key={`empty-mobile-seq-${i}`}
                              className="flex flex-col items-center justify-center p-1 rounded border border-line/30 bg-paper/20 text-slate/30 text-center"
                            >
                              <span className="text-[9px] uppercase tracking-wider">
                                S{displaySequences.length + i + 1}
                              </span>
                              <span className="font-mono text-xs mt-0.5 leading-none">--</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 2. VERSION DESKTOP (md: et plus) : Tableau tabulaire standard complet */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-paper border-b border-line text-slate font-bold uppercase tracking-wider">
                        <th className="py-2.5 px-3 w-10 text-center">N°</th>
                        <th className="py-2.5 px-3 w-28">Matricule</th>
                        <th className="py-2.5 px-3">Nom et Prénom</th>
                        {displaySequences.map((seq, idx) => (
                          <th key={seq.id} className="py-2.5 px-3 text-center w-20">
                            Seq {idx + 1}
                          </th>
                        ))}
                        {/* Compléter à 6 colonnes si moins de séquences */}
                        {Array.from({ length: Math.max(0, 6 - displaySequences.length) }).map((_, i) => (
                          <th key={`empty-seq-${i}`} className="py-2.5 px-3 text-center w-20 text-slate/40">
                            Seq {displaySequences.length + i + 1}
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
                          {displaySequences.map((seq) => {
                            const score = row.sequenceScores[seq.id];
                            return (
                              <td key={seq.id} className="py-2 px-3 text-center font-mono font-bold">
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
                          {Array.from({ length: Math.max(0, 6 - displaySequences.length) }).map((_, i) => (
                            <td key={`empty-cell-${i}`} className="py-2 px-3 text-center text-slate/30">
                              --
                            </td>
                          ))}
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
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TeacherEvolutionPage;
