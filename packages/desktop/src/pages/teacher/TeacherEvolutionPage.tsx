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
  GradeRecord,
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
      // Trier par order_index
      seqsData.sort((a, b) => a.order_index - b.order_index);
      setSequences(seqsData);
    } catch (err: any) {
      console.error("Erreur attributions desktop:", err);
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
      console.error("Erreur calcul évolution & bordereau desktop:", err);
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

  // Filtrer les séquences 1 à 6 (ou l'ensemble disponible ordonné)
  const displaySequences = sequences.slice(0, 6);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="border-b border-line pb-4">
        <h1 className="text-xl sm:text-2xl font-display font-bold text-ink">
          Évolution de mes élèves
        </h1>
        <p className="text-xs sm:text-sm text-slate mt-0.5">
          Tendance des moyennes et bordereau de notes par séquence pour votre matière assignée
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
          <div className="bg-white border border-line rounded p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-ink uppercase tracking-wide">
                Moyenne de la classe dans votre matière (sur 20)
              </h3>
              {currentAssignment && (
                <span className="text-xs font-semibold text-slate bg-paper px-2.5 py-1 rounded border border-line">
                  {currentAssignment.class_name} — {currentAssignment.subject_name}
                </span>
              )}
            </div>

            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolutionData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E0D6" />
                  <XAxis dataKey="sequenceLabel" stroke="#5B6B82" fontSize={12} />
                  <YAxis domain={[0, 20]} stroke="#5B6B82" fontSize={12} />
                  <Tooltip
                    formatter={(val: any) => [`${val} / 20`, "Moyenne Matière"]}
                    contentStyle={{ backgroundColor: "#FAF9F5", borderColor: "#E4E0D6", borderRadius: "4px" }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="averageScore"
                    name="Moyenne Matière"
                    stroke="#150A5E"
                    strokeWidth={3}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tableau "Bordereau de matière" (8 colonnes : N°, Matricule, Nom, Séquence 1 à 6) */}
          <div className="bg-white border border-line rounded shadow-sm overflow-hidden space-y-2">
            <div className="p-4 border-b border-line bg-paper/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-ink uppercase tracking-wide">
                  Bordereau de matière : {currentAssignment?.subject_name}
                </h3>
                <p className="text-xs text-slate mt-0.5">
                  Récapitulatif des notes des {reportRows.length} élève(s) de {currentAssignment?.class_name} sur les 6 séquences
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
                      {displaySequences.map((seq, idx) => (
                        <th key={seq.id} className="py-2.5 px-3 text-center w-20">
                          Seq {idx + 1}
                        </th>
                      ))}
                      {/* Compléter à 6 colonnes de séquences si moins de séquences configurées */}
                      {Array.from({ length: Math.max(0, 6 - displaySequences.length) }).map((_, i) => (
                        <th key={`empty-seq-${i}`} className="py-2.5 px-3 text-center w-20 text-slate/40">
                          Seq {displaySequences.length + i + 1}
                        </th>
                      ))}
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
