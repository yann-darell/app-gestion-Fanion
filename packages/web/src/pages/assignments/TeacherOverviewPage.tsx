import React, { useEffect, useState, useCallback } from "react";
import {
  listTeachers,
  listAssignments,
  deleteAssignment,
  removePrimaryTeacherAssignment,
  AssignmentRecord,
} from "@fanion/shared";

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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
      console.error("Erreur chargement vue d'ensemble web:", err);
      setError("Impossible de charger la vue d'ensemble.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const handleDeleteAssignment = async (assign: AssignmentRecord) => {
    const isPrimary = assign.subject_id === "primaire" || assign.subject_id === "primaire-titulaire";
    const label = isPrimary
      ? `l'attribution titulaire pour la classe ${assign.classes?.name || ""}`
      : `l'attribution de ${assign.subjects?.name || "la matière"} en classe ${assign.classes?.name || ""}`;

    if (!window.confirm(`Confirmez-vous la suppression de ${label} ?`)) {
      return;
    }

    try {
      setDeletingId(assign.id);
      setError(null);
      setSuccessMsg(null);

      if (isPrimary) {
        await removePrimaryTeacherAssignment(assign.class_id);
      } else {
        await deleteAssignment(assign.id);
      }

      setSuccessMsg(`Attribution supprimée avec succès.`);
      await fetchOverview();
    } catch (err: any) {
      console.error("Erreur suppression attribution:", err);
      setError(err?.message || "Impossible de supprimer l'attribution.");
    } finally {
      setDeletingId(null);
    }
  };

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
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <h1 className="font-display text-xl font-bold text-ink mb-4">
          Vue d'ensemble des Enseignants
        </h1>
        <div className="p-4 bg-signal-red/10 border border-signal-red/20 rounded text-signal-red text-sm font-medium">
          Accès restreint. Seuls le Principal et le Directeur des Études peuvent consulter la vue d'ensemble.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="pb-4 border-b border-line mb-6">
        <h1 className="font-display text-xl md:text-2xl font-bold text-ink">
          Vue d'ensemble des Enseignants
        </h1>
        <p className="text-xs md:text-sm text-slate mt-1">
          Visualisez et gérez les attributions de cours pour l'ensemble du corps enseignant.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-signal-red/10 border border-signal-red/20 rounded text-sm text-signal-red font-medium">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-800 font-medium flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold ml-2">✕</button>
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
                {/* Header Card / Accordion trigger */}
                <div
                  onClick={() => toggleExpand(teacher.id)}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-paper-dark/30 transition select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-ink text-white font-bold flex items-center justify-center text-sm">
                      {teacher.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm md:text-base font-semibold text-ink">
                        {teacher.full_name}
                      </h3>
                      <p className="text-[11px] text-slate">
                        Composante pédagogique
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-1 rounded text-xs font-semibold ${
                        count > 0
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate/10 text-slate"
                      }`}
                    >
                      {count} attribution{count > 1 ? "s" : ""}
                    </span>
                    <svg
                      className={`w-4 h-4 text-slate transition-transform duration-200 ${
                        isExpanded ? "transform rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-line bg-paper-dark/20 p-4">
                    {count === 0 ? (
                      <p className="text-xs text-slate italic">
                        Aucune matière attribuée à cet enseignant.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full text-left bg-white border border-line rounded">
                            <thead className="bg-paper-dark border-b border-line text-[11px] font-semibold text-slate uppercase">
                              <tr>
                                <th className="px-3 py-2">Classe</th>
                                <th className="px-3 py-2">Niveau</th>
                                <th className="px-3 py-2">Matière</th>
                                <th className="px-3 py-2 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                              {teacher.assignments.map((assign) => (
                                <tr key={assign.id}>
                                  <td className="px-3 py-2 text-xs font-semibold text-ink">
                                    {assign.classes?.name ?? "—"}
                                  </td>
                                  <td className="px-3 py-2 text-xs text-slate">
                                    {assign.classes?.level ?? "—"}
                                  </td>
                                  <td className="px-3 py-2 text-xs font-medium font-mono text-ink">
                                    {assign.subjects?.name ?? "—"}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteAssignment(assign);
                                      }}
                                      disabled={deletingId === assign.id}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition"
                                      title="Supprimer cette attribution"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                      <span>{deletingId === assign.id ? "Suppression..." : "Supprimer"}</span>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile list of assignments */}
                        <div className="md:hidden divide-y divide-line bg-white border border-line rounded overflow-hidden">
                          {teacher.assignments.map((assign) => (
                            <div key={assign.id} className="p-3 flex justify-between items-center text-xs gap-2">
                              <div>
                                <div className="font-bold text-ink">
                                  {assign.classes?.name ?? "—"}
                                  <span className="text-slate ml-1 font-mono font-normal">
                                    ({assign.classes?.level ?? ""})
                                  </span>
                                </div>
                                <span className="font-semibold text-ink font-mono bg-paper-dark px-1.5 py-0.5 rounded text-[11px] inline-block mt-0.5">
                                  {assign.subjects?.name ?? "—"}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteAssignment(assign);
                                }}
                                disabled={deletingId === assign.id}
                                className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition flex items-center gap-1 flex-shrink-0"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span>{deletingId === assign.id ? "..." : "Supprimer"}</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TeacherOverviewPage;
