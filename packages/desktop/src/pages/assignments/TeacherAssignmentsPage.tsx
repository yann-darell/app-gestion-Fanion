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
import PageContainer from "../../components/ui/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import { Badge } from "../../components/ui/Badge";

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

  // Charger les classes de la division et la liste des enseignants au chargement
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
        console.error("Erreur d'initialisation attributions:", err);
        setError("Impossible de charger les classes ou la liste des enseignants.");
      } finally {
        setLoadingInit(false);
      }
    };
    fetchInit();
  }, [selectedDivision]);

  // Charger les coefficients et attributions quand une classe est sélectionnée
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
      console.error("Erreur de chargement des attributions:", err);
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

  // Gérer la modification d'attribution pour une matière
  const handleTeacherChange = async (subjectId: string, newTeacherId: string) => {
    if (!selectedClassId) return;
    setSavingSubjectId(subjectId);
    setError(null);

    try {
      // Trouver l'attribution existante pour cette matière (le cas échéant)
      const existing = assignments.find((a) => a.subject_id === subjectId);

      if (newTeacherId === "") {
        // Supprimer l'attribution si elle existe
        if (existing) {
          await deleteAssignment(existing.id);
          setAssignments((prev) => prev.filter((a) => a.id !== existing.id));
        }
      } else {
        // Si une attribution existait déjà pour un autre enseignant, on la supprime d'abord
        if (existing) {
          if (existing.teacher_id === newTeacherId) {
            setSavingSubjectId(null);
            return; // Aucun changement
          }
          await deleteAssignment(existing.id);
        }

        // Créer la nouvelle attribution
        const created = await createAssignment({
          class_id: selectedClassId,
          subject_id: subjectId,
          teacher_id: newTeacherId,
        });

        // Mettre à jour les attributions locales
        setAssignments((prev) => {
          const filtered = prev.filter((a) => a.subject_id !== subjectId);
          return [...filtered, created];
        });
      }
    } catch (err: any) {
      console.error("Erreur de modification d'attribution:", err);
      setError(
        err?.message || "Impossible de mettre à jour l'attribution de l'enseignant."
      );
    } finally {
      setSavingSubjectId(null);
    }
  };

  if (!isAuthorized) {
    return (
      <PageContainer>
        <PageHeader title="Attribution des Enseignants" />
        <div className="p-6 bg-signal-red/10 border border-signal-red/20 rounded text-signal-red font-medium text-sm">
          Accès restreint. Seuls le Principal et le Directeur des Études peuvent gérer les attributions d'enseignants.
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Attribution des Enseignants par Classe"
        description="Assignez les enseignants aux matières configurées pour chaque classe."
      />

      {/* Barre de filtre Division + Classe */}
      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div>
          <label className="block text-xs font-semibold text-slate uppercase mb-1">
            Division
          </label>
          <div className="flex gap-1 p-1 bg-paper border border-line rounded">
            {["college", "primaire"].map((div) => (
              <button
                key={div}
                id={`assign-division-${div}`}
                onClick={() => {
                  setSelectedDivision(div);
                  setSelectedClassId("");
                }}
                className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                  selectedDivision === div
                    ? "bg-ink text-white font-semibold"
                    : "text-slate hover:bg-line/40"
                }`}
              >
                {div === "college" ? "Collège" : "Primaire"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-[220px]">
          <label
            htmlFor="select-class-assignment"
            className="block text-xs font-semibold text-slate uppercase mb-1"
          >
            Classe
          </label>
          <select
            id="select-class-assignment"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-ink"
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
        <div className="mb-4 p-4 bg-signal-red/10 border border-signal-red/20 rounded text-sm text-signal-red font-medium">
          {error}
        </div>
      )}

      {!selectedClassId ? (
        <div className="py-12 border border-dashed border-line rounded bg-white text-center">
          <p className="text-sm text-slate font-medium">
            Veuillez sélectionner une classe pour afficher ses matières et attribuer les enseignants.
          </p>
        </div>
      ) : loadingData ? (
        <div className="py-12 text-center text-sm font-medium text-slate">
          Chargement des matières et attributions...
        </div>
      ) : coefficients.length === 0 ? (
        <div className="py-12 border border-line rounded bg-white text-center">
          <p className="text-sm text-slate italic">
            Aucune matière n'est configurée pour cette classe. Veuillez d'abord paramétrer les coefficients dans la section "Coefficients".
          </p>
        </div>
      ) : (
        <div className="border border-line rounded bg-white overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line bg-paper text-xs font-semibold text-slate uppercase tracking-wider">
                <th className="px-4 py-3">Matière</th>
                <th className="px-4 py-3 w-32">Groupe</th>
                <th className="px-4 py-3 w-24 text-center">Coef.</th>
                <th className="px-4 py-3">Enseignant attribué</th>
                <th className="px-4 py-3 w-32 text-center">Statut</th>
              </tr>
            </thead>
            <tbody>
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
                  <tr
                    key={coef.id}
                    className="border-b border-line/60 last:border-b-0 hover:bg-paper/40 transition"
                  >
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
                        id={`select-teacher-${subject.id}`}
                        value={currentTeacherId}
                        onChange={(e) =>
                          handleTeacherChange(subject.id, e.target.value)
                        }
                        disabled={isSaving}
                        className="w-full max-w-xs px-3 py-1.5 border border-line rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-ink font-medium"
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
                          Enregistrement...
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {currentTeacherId ? (
                        <Badge variant="success">Assigné</Badge>
                      ) : (
                        <Badge variant="secondary">Non assigné</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
};

export default TeacherAssignmentsPage;
