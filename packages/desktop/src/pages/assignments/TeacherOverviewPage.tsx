import React, { useEffect, useState, useCallback } from "react";
import {
  listTeachers,
  listAssignments,
  AssignmentRecord,
} from "@fanion/shared";
import PageContainer from "../../components/ui/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import { Badge } from "../../components/ui/Badge";

interface TeacherOverviewPageProps {
  userRole?: string;
}

interface TeacherInfo {
  id: string;
  full_name: string;
}

interface TeacherWithAssignments extends TeacherInfo {
  assignments: AssignmentRecord[];
}

export const TeacherOverviewPage: React.FC<TeacherOverviewPageProps> = ({
  userRole,
}) => {
  const [teachersData, setTeachersData] = useState<TeacherWithAssignments[]>([]);
  const [expandedTeacherIds, setExpandedTeacherIds] = useState<Set<string>>(
    new Set()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthorized =
    userRole === "principal" || userRole === "directeur_etudes";

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [teachersList, assignmentsList] = await Promise.all([
        listTeachers(),
        listAssignments(),
      ]);

      const combined: TeacherWithAssignments[] = teachersList.map((t) => {
        const teacherAssigns = assignmentsList.filter(
          (a) => a.teacher_id === t.id
        );
        return {
          ...t,
          assignments: teacherAssigns,
        };
      });

      setTeachersData(combined);
    } catch (err: any) {
      console.error("Erreur de chargement de la vue d'ensemble:", err);
      setError("Impossible de charger la vue d'ensemble des enseignants.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const toggleExpand = (teacherId: string) => {
    setExpandedTeacherIds((prev) => {
      const next = new Set(prev);
      if (next.has(teacherId)) {
        next.delete(teacherId);
      } else {
        next.add(teacherId);
      }
      return next;
    });
  };

  if (!isAuthorized) {
    return (
      <PageContainer>
        <PageHeader title="Vue d'ensemble des Enseignants" />
        <div className="p-6 bg-signal-red/10 border border-signal-red/20 rounded text-signal-red font-medium text-sm">
          Accès restreint. Seuls le Principal et le Directeur des Études peuvent consulter la vue d'ensemble.
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Vue d'ensemble des Enseignants"
        description="Supervision globale des attributions de cours par enseignant."
      />

      {error && (
        <div className="mb-4 p-4 bg-signal-red/10 border border-signal-red/20 rounded text-sm text-signal-red font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm font-medium text-slate">
          Chargement de la vue d'ensemble...
        </div>
      ) : teachersData.length === 0 ? (
        <div className="py-12 border border-line rounded bg-white text-center">
          <p className="text-sm text-slate italic">
            Aucun compte enseignant n'a été trouvé.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {teachersData.map((teacher) => {
            const isExpanded = expandedTeacherIds.has(teacher.id);
            const count = teacher.assignments.length;

            return (
              <div
                key={teacher.id}
                className="border border-line rounded bg-white overflow-hidden shadow-sm transition"
              >
                {/* En-tête de la carte Enseignant */}
                <div
                  onClick={() => toggleExpand(teacher.id)}
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-paper/50 transition select-none"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-ink text-white font-bold flex items-center justify-center text-base">
                      {teacher.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-ink">
                        {teacher.full_name}
                      </h3>
                      <p className="text-xs text-slate">
                        Composante pédagogique / Enseignant
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <Badge variant={count > 0 ? "success" : "secondary"}>
                      {count} attribution{count > 1 ? "s" : ""}
                    </Badge>
                    <button
                      type="button"
                      className="text-xs font-semibold text-ink hover:underline"
                    >
                      {isExpanded ? "Masquer le détail ▲" : "Voir le détail ▼"}
                    </button>
                  </div>
                </div>

                {/* Détail des attributions */}
                {isExpanded && (
                  <div className="border-t border-line bg-paper/30 px-5 py-4">
                    {count === 0 ? (
                      <p className="text-xs text-slate italic">
                        Cet enseignant n'a aucune matière ni classe attribuée actuellement.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse bg-white border border-line rounded">
                          <thead>
                            <tr className="border-b border-line bg-paper text-xs font-semibold text-slate uppercase tracking-wider">
                              <th className="px-4 py-2">Classe</th>
                              <th className="px-4 py-2">Niveau</th>
                              <th className="px-4 py-2">Matière</th>
                            </tr>
                          </thead>
                          <tbody>
                            {teacher.assignments.map((assign) => (
                              <tr
                                key={assign.id}
                                className="border-b border-line/50 last:border-b-0"
                              >
                                <td className="px-4 py-2.5 text-sm font-semibold text-ink">
                                  {assign.classes?.name ?? "—"}
                                </td>
                                <td className="px-4 py-2.5 text-xs text-slate">
                                  {assign.classes?.level ?? "—"}
                                </td>
                                <td className="px-4 py-2.5 text-sm font-medium text-ink font-mono">
                                  {assign.subjects?.name ?? "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
};

export default TeacherOverviewPage;
