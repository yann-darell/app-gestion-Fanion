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
  listSequences,
  TeacherAssignmentRecord,
  SequenceRecord,
} from "@fanion/shared";
import { generateClassReport } from "@fanion/shared/services/classReportService";
import PageContainer from "../../components/ui/PageContainer";
import PageHeader from "../../components/ui/PageHeader";

interface TeacherEvolutionPageProps {
  userRole?: string;
}

interface EvolutionDataPoint {
  sequenceLabel: string;
  averageScore: number;
}

export const TeacherEvolutionPage: React.FC<TeacherEvolutionPageProps> = ({ userRole }) => {
  const [assignments, setAssignments] = useState<TeacherAssignmentRecord[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("");
  const [evolutionData, setEvolutionData] = useState<EvolutionDataPoint[]>([]);
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

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user || !user.id) {
        setLoading(false);
        return;
      }

      const filters = userRole === "enseignant" ? { teacher_id: user.id } : {};
      const assignmentsData = await listTeacherAssignments(filters);
      setAssignments(assignmentsData);
      if (assignmentsData.length > 0) setSelectedAssignmentId(assignmentsData[0].id);
    } catch (err: any) {
      setError("Impossible de charger vos attributions.");
    } finally {
      setLoading(false);
    }
  };

  const currentAssignment = assignments.find((a) => a.id === selectedAssignmentId);

  useEffect(() => {
    if (currentAssignment) {
      fetchEvolutionData(currentAssignment.class_id, currentAssignment.subject_id);
    } else {
      setEvolutionData([]);
    }
  }, [selectedAssignmentId]);

  const fetchEvolutionData = async (classId: string, subjectId: string) => {
    try {
      setLoadingChart(true);
      setError(null);

      const sequencesData = await listSequences();

      // Pour chaque séquence, générer le rapport de classe et extraire la moyenne
      const chartPoints: EvolutionDataPoint[] = await Promise.all(
        sequencesData.map(async (seq: SequenceRecord) => {
          const report = await generateClassReport(classId, "sequence", seq.id);
          
          // Chercher la moyenne spécifique de cette matière ou la moyenne générale de la classe
          // Si le graphique s'intéresse à la matière spécifique enseignée :
          const subReport = report.subjects.find((s) => s.id === subjectId);
          let avgScore = 0;
          if (subReport) {
            const validGrades = report.rows
              .map((r) => r.gradesBySubject[subjectId]?.score)
              .filter((score): score is number => score !== null);
            if (validGrades.length > 0) {
              const sum = validGrades.reduce((acc, curr) => acc + curr, 0);
              avgScore = Math.round((sum / validGrades.length) * 100) / 100;
            }
          }

          return {
            sequenceLabel: seq.label,
            averageScore: avgScore,
          };
        })
      );

      setEvolutionData(chartPoints);
    } catch (err: any) {
      console.error("Erreur calcul évolution:", err);
      setError("Erreur lors du calcul des moyennes.");
    } finally {
      setLoadingChart(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="py-12 text-center text-slate font-medium text-sm">
          Chargement des données d'évolution…
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Évolution de mes élèves" />

      {error && (
        <div className="mb-4 p-3 bg-signal-red/10 border border-signal-red/20 text-signal-red text-sm rounded font-medium">
          {error}
        </div>
      )}

      {/* Sélecteur */}
      <div className="bg-white border border-line rounded p-4 mb-6 shadow-sm flex items-end gap-4">
        <div className="flex-1 max-w-sm">
          <label className="block text-xs font-semibold text-slate uppercase mb-1">
            Classe &amp; Matière
          </label>
          {assignments.length === 0 ? (
            <div className="text-xs text-signal-red italic p-2 border border-dashed border-line rounded">
              Aucune attribution trouvée.
            </div>
          ) : (
            <select
              value={selectedAssignmentId}
              onChange={(e) => setSelectedAssignmentId(e.target.value)}
              className="w-full px-3 py-2 border border-line rounded focus:outline-none focus:ring-1 focus:ring-ink bg-paper text-sm font-medium"
            >
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.class_name} — {a.subject_name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Graphique Recharts */}
      {loadingChart ? (
        <div className="py-12 text-center text-slate text-sm">
          Calcul des moyennes par séquence…
        </div>
      ) : (
        <div className="bg-white border border-line rounded p-6 shadow-sm">
          <h3 className="text-sm font-bold text-ink uppercase tracking-wide mb-6">
            Moyenne générale de la classe (sur 20) — séquence par séquence
          </h3>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolutionData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E0D6" />
                <XAxis dataKey="sequenceLabel" stroke="#5B6B82" fontSize={12} />
                <YAxis domain={[0, 20]} stroke="#5B6B82" fontSize={12} />
                <Tooltip
                  formatter={(val: any) => [`${val} / 20`, "Moyenne Classe"]}
                  contentStyle={{
                    backgroundColor: "#FAF9F5",
                    borderColor: "#E4E0D6",
                    borderRadius: "4px",
                    fontSize: "12px",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="averageScore"
                  name="Moyenne Classe"
                  stroke="#150A5E"
                  strokeWidth={2.5}
                  activeDot={{ r: 7 }}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default TeacherEvolutionPage;
