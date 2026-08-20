import React, { useEffect, useState, useCallback } from "react";
import {
  listClasses,
  listCoefficients,
  listAssignments,
  listTeachers,
  createAssignment,
  deleteAssignment,
  ClassRecord,
  CoefficientRecord,
  AssignmentRecord,
} from "@fanion/shared";

interface TeacherAssignmentsPageProps {
  userRole?: string;
}

interface TeacherOption {
  id: string;
  full_name: string;
}

export const TeacherAssignmentsPage: React.FC<TeacherAssignmentsPageProps> = ({
  userRole,
}) => {
  const [selectedDivision, setSelectedDivision] = useState<string>("college");
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");

  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [coefficients, setCoefficients] = useState<CoefficientRecord[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);

  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [savingSubjectId, setSavingSubjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAuthorized =
    userRole === "principal" || userRole === "directeur_etudes";

  useEffect(() => {
    const fetchInit = async () => {
      setLoadingInit(true);
      setError(null);
      try {
        const [classData, teacherData] = await Promise.all([
          listClasses(selectedDivision),
          listTeachers(),
        ]);
        setClasses(classData);
        setTeachers(teacherData);
        setSelectedClassId("");
        setCoefficients([]);
        setAssignments([]);
      } catch (err: any) {
        console.error("Erreur initialisation web attributions:", err);
        setError("Impossible de charger les classes et enseignants.");
      } finally {
        setLoadingInit(false);
      }
    };
    fetchInit();
  }, [selectedDivision]);

  const fetchClassAssignments = useCallback(async (classId: string) => {
    if (!classId) return;
    setLoadingData(true);
    setError(null);
    try {
      const [coefData, assignData] = await Promise.all([
        listCoefficients(classId),
        listAssignments({ classId }),
      ]);
      setCoefficients(coefData);
      setAssignments(assignData);
    } catch (err: any) {
      console.error("Erreur chargement attributions web:", err);
      setError("Erreur lors du chargement des matières et attributions.");
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      fetchClassAssignments(selectedClassId);
    }
  }, [selectedClassId, fetchClassAssignments]);

  const handleTeacherChange = async (subjectId: string, newTeacherId: string) => {
    if (!selectedClassId) return;
    setSavingSubjectId(subjectId);
    setError(null);

    try {
      const existing = assignments.find((a) => a.subject_id === subjectId);

      if (newTeacherId === "") {
        if (existing) {
          await deleteAssignment(existing.id);
          setAssignments((prev) => prev.filter((a) => a.id !== existing.id));
        }
      } else {
        if (existing) {
          if (existing.teacher_id === newTeacherId) {
            setSavingSubjectId(null);
            return;
          }
          await deleteAssignment(existing.id);
        }

        const created = await createAssignment({
          class_id: selectedClassId,
          subject_id: subjectId,
          teacher_id: newTeacherId,
        });

        setAssignments((prev) => {
          const filtered = prev.filter((a) => a.subject_id !== subjectId);
          return [...filtered, created];
        });
      }
    } catch (err: any) {
      console.error("Erreur modification attribution web:", err);
      setError(
        err?.message || "Impossible de mettre à jour l'attribution."
      );
    } finally {
      setSavingSubjectId(null);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <h1 className="font-display text-xl font-bold text-ink mb-4">
          Attribution des Enseignants
        </h1>
        <div className="p-4 bg-signal-red/10 border border-signal-red/20 rounded text-signal-red text-sm font-medium">
          Accès restreint. Seuls le Principal et le Directeur des Études peuvent gérer les attributions d'enseignants.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="pb-4 border-b border-line mb-6">
        <h1 className="font-display text-xl md:text-2xl font-bold text-ink">
          Attribution des Enseignants
        </h1>
        <p className="text-xs md:text-sm text-slate mt-1">
          Affectez les enseignants aux matières pour la classe sélectionnée.
        </p>
      </div>

      {/* Selectors */}
      <div className="flex flex-col md:flex-row md:items-end gap-4 mb-6 bg-paper-dark p-4 rounded border border-line">
        {/* Division */}
        <div className="flex-shrink-0">
          <label className="block text-xs font-semibold text-slate uppercase mb-1">
            Division
          </label>
          <div className="flex gap-1 p-1 bg-white border border-line rounded">
            {["college", "primaire"].map((div) => (
              <button
                key={div}
                onClick={() => {
                  setSelectedDivision(div);
                  setSelectedClassId("");
                }}
                className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                  selectedDivision === div
                    ? "bg-ink text-white font-semibold"
                    : "text-slate hover:bg-paper-dark"
                }`}
              >
                {div === "college" ? "Collège" : "Primaire"}
              </button>
            ))}
          </div>
        </div>

        {/* Classe */}
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate uppercase mb-1">
            Classe
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded text-sm bg-white focus:outline-none focus:border-ink h-10"
            disabled={loadingInit}
          >
            <option value="">— Sélectionner une classe —</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name} ({cls.level})
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-signal-red/10 border border-signal-red/20 rounded text-sm text-signal-red font-medium">
          {error}
        </div>
      )}

      {/* Content */}
      {!selectedClassId ? (
        <div className="py-12 border border-dashed border-line rounded bg-white text-center">
          <p className="text-sm text-slate font-medium">
            Sélectionnez une classe pour gérer ses attributions
          </p>
        </div>
      ) : loadingData ? (
        <div className="py-12 text-center text-sm font-medium text-slate">
          Chargement des attributions...
        </div>
      ) : coefficients.length === 0 ? (
        <div className="py-12 px-6 border border-line rounded bg-white text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-fanion-gold/10 text-fanion-gold flex items-center justify-center mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-ink mb-1">
            Aucune matière avec coefficient configuré pour cette classe
          </h3>
          <p className="text-xs text-slate max-w-md mb-4 leading-relaxed">
            Pour pouvoir attribuer un enseignant à une matière, cette dernière doit d'abord posséder un coefficient configuré pour la classe.
          </p>
          <a
            href="/subjects/coefficients"
            className="px-4 py-2 bg-ink text-white text-xs font-semibold rounded hover:bg-opacity-90 transition inline-flex items-center gap-1.5"
          >
            Configurez d'abord les coefficients
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
        </div>
      ) : (
        <div className="border border-line rounded bg-white overflow-hidden shadow-sm">
          {/* Desktop Table (hidden on mobile) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-paper-dark border-b border-line text-xs font-semibold text-slate uppercase">
                <tr>
                  <th className="px-4 py-3">Matière</th>
                  <th className="px-4 py-3 w-32">Groupe</th>
                  <th className="px-4 py-3 w-24 text-center">Coef.</th>
                  <th className="px-4 py-3">Enseignant attribué</th>
                  <th className="px-4 py-3 w-32 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {coefficients.map((coef) => {
                  const subject = coef.subjects;
                  const group = coef.subject_groups;
                  if (!subject) return null;

                  const currentAssignment = assignments.find(
                    (a) => a.subject_id === subject.id
                  );
                  const currentTeacherId = currentAssignment?.teacher_id || "";
                  const isSaving = savingSubjectId === subject.id;

                  return (
                    <tr key={coef.id} className="hover:bg-paper-dark/30 transition">
                      <td className="px-4 py-3 text-sm font-semibold text-ink">
                        {subject.name}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono font-bold text-slate">
                        Groupe {group?.label ?? "I"}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono font-bold text-center">
                        {coef.coefficient}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={currentTeacherId}
                          onChange={(e) =>
                            handleTeacherChange(subject.id, e.target.value)
                          }
                          disabled={isSaving}
                          className="w-full max-w-xs px-3 py-1.5 border border-line rounded text-sm bg-white focus:outline-none focus:border-ink"
                        >
                          <option value="">— Non assigné —</option>
                          {teachers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.full_name}
                            </option>
                          ))}
                        </select>
                        {isSaving && (
                          <span className="ml-2 text-xs text-slate italic">
                            Enreg...
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {currentTeacherId ? (
                          <span className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                            Assigné
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded text-xs font-semibold bg-slate/10 text-slate">
                            Non assigné
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards (hidden on desktop) */}
          <div className="md:hidden divide-y divide-line">
            {coefficients.map((coef) => {
              const subject = coef.subjects;
              const group = coef.subject_groups;
              if (!subject) return null;

              const currentAssignment = assignments.find(
                (a) => a.subject_id === subject.id
              );
              const currentTeacherId = currentAssignment?.teacher_id || "";
              const isSaving = savingSubjectId === subject.id;

              return (
                <div key={coef.id} className="p-4 flex flex-col gap-3 bg-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-sm font-bold text-ink">{subject.name}</h3>
                      <p className="text-xs text-slate font-mono">
                        Groupe {group?.label ?? "I"} · Coef {coef.coefficient}
                      </p>
                    </div>
                    {currentTeacherId ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                        Assigné
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate/10 text-slate">
                        Non assigné
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate uppercase font-semibold mb-1">
                      Enseignant
                    </label>
                    <select
                      value={currentTeacherId}
                      onChange={(e) =>
                        handleTeacherChange(subject.id, e.target.value)
                      }
                      disabled={isSaving}
                      className="w-full text-xs border border-line rounded px-3 py-2 bg-white focus:outline-none focus:border-ink h-10 font-medium"
                    >
                      <option value="">— Non assigné —</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name}
                        </option>
                      ))}
                    </select>
                    {isSaving && (
                      <p className="text-[11px] text-slate italic mt-1">
                        Enregistrement en cours...
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherAssignmentsPage;
