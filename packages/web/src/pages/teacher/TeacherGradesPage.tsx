import { LockIcon, CheckIcon, CheckCircleIcon, AlertTriangleIcon } from "../../components/ui/Icons";
import React, { useState, useEffect } from "react";
import {
  supabase,
  listTeacherAssignments,
  listMyAssignedStudents,
  listStudents,
  listGrades,
  upsertGrade,
  listSequences,
  getSubjectLetterGrade,
  TeacherAssignmentRecord,
  AssignedStudentRecord,
  SequenceRecord,
  GradeRecord,
  useSelectionPersistence,
} from "@fanion/shared";
import {
  getSequenceCompetency,
  upsertSequenceCompetency,
  getGradeSubmission,
  submitClassGrades,
} from "@fanion/shared/api/grades";

interface TeacherGradesPageProps {
  userRole?: string;
}

export const TeacherGradesPage: React.FC<TeacherGradesPageProps> = ({ userRole }) => {
  const [assignments, setAssignments] = useState<TeacherAssignmentRecord[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useSelectionPersistence("assignmentId", "");

  const [sequences, setSequences] = useState<SequenceRecord[]>([]);
  const [selectedSequenceId, setSelectedSequenceId] = useSelectionPersistence("sequenceId", "");

  const [students, setStudents] = useState<AssignedStudentRecord[]>([]);
  const [gradesMap, setGradesMap] = useState<Record<string, number>>({});
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const [savedStatusMap, setSavedStatusMap] = useState<Record<string, boolean>>({});

  // Compétence évaluée par séquence
  const [competencyDescription, setCompetencyDescription] = useState<string>("");
  const [savingCompetency, setSavingCompetency] = useState(false);
  const [savedCompetency, setSavedCompetency] = useState(false);

  // Verrouillage / Soumission des notes
  const [isLockedBySubmission, setIsLockedBySubmission] = useState(false);
  const [submissionDate, setSubmissionDate] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isTeacher = userRole === "enseignant";

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
      setCurrentUserId(user.id);

      const assignmentFilters = userRole === "enseignant" ? { teacher_id: user.id } : {};
      const assignmentsData = await listTeacherAssignments(assignmentFilters);
      setAssignments(assignmentsData);

      if (assignmentsData.length > 0) {
        setSelectedAssignmentId((prev) => (prev && assignmentsData.some(a => a.id === prev) ? prev : assignmentsData[0].id));
      }

      const seqsData = await listSequences();
      setSequences(seqsData);

      if (seqsData.length > 0) {
        setSelectedSequenceId((prev) => (prev && seqsData.some(s => s.id === prev) ? prev : seqsData[0].id));
      }
    } catch (err: any) {
      console.error("Erreur chargement attributions web:", err);
      setError(err.message || "Erreur lors du chargement des attributions.");
    } finally {
      setLoading(false);
    }
  };

  const currentAssignment = assignments.find((a) => a.id === selectedAssignmentId);

  useEffect(() => {
    if (currentAssignment && selectedSequenceId) {
      fetchStudentsAndGrades(currentAssignment.class_id, currentAssignment.subject_id, selectedSequenceId);
      fetchCompetencyAndSubmission(currentAssignment.class_id, currentAssignment.subject_id, selectedSequenceId);
    } else {
      setStudents([]);
      setGradesMap({});
      setCompetencyDescription("");
      setIsLockedBySubmission(false);
    }
  }, [selectedAssignmentId, selectedSequenceId]);

  const fetchCompetencyAndSubmission = async (classId: string, subjectId: string, sequenceId: string) => {
    try {
      // 1. Compétence
      const comp = await getSequenceCompetency(classId, subjectId, sequenceId);
      setCompetencyDescription(comp ? comp.description : "");

      // 2. Statut de soumission
      const sub = await getGradeSubmission(classId, subjectId, sequenceId);
      if (sub && sub.is_locked) {
        setIsLockedBySubmission(true);
        setSubmissionDate(sub.submitted_at);
      } else {
        setIsLockedBySubmission(false);
        setSubmissionDate(null);
      }
    } catch (err) {
      console.error("Erreur chargement métadonnées séquence web:", err);
    }
  };

  const fetchStudentsAndGrades = async (classId: string, subjectId: string, sequenceId: string) => {
    try {
      setLoadingGrades(true);
      setError(null);
      setSuccessMessage(null);

      let studentsData: AssignedStudentRecord[];
      if (userRole === "enseignant") {
        studentsData = await listMyAssignedStudents(classId, subjectId);
      } else {
        const fullStudents = await listStudents({ classId, status: "active" });
        studentsData = fullStudents.map(s => ({
          id: s.id, matricule: s.matricule || "", first_name: s.first_name,
          last_name: s.last_name, status: s.status || "active",
        }));
      }
      setStudents(studentsData);

      let gradesData: GradeRecord[] = [];
      if (studentsData.length > 0) {
        const studentIds = studentsData.map(s => s.id);
        const allGrades = await listGrades({ subject_id: subjectId, sequence_id: sequenceId });
        gradesData = allGrades.filter(g => studentIds.includes(g.student_id));
      }

      const gMap: Record<string, number> = {};
      gradesData.forEach((g: GradeRecord) => {
        gMap[g.student_id] = g.score;
      });
      setGradesMap(gMap);
      setSavedStatusMap({});
    } catch (err: any) {
      console.error("Erreur chargement des notes web:", err);
      setError("Impossible de charger les élèves ou les notes.");
    } finally {
      setLoadingGrades(false);
    }
  };

  // Sauvegarde automatique de la compétence évaluée
  const handleCompetencyBlur = async () => {
    if (!currentAssignment || !selectedSequenceId) return;
    if (isTeacher && isLockedBySubmission) return;

    try {
      setSavingCompetency(true);
      await upsertSequenceCompetency(
        currentAssignment.class_id,
        currentAssignment.subject_id,
        selectedSequenceId,
        competencyDescription,
        currentUserId || undefined
      );
      setSavedCompetency(true);
      setTimeout(() => setSavedCompetency(false), 2000);
    } catch (err: any) {
      console.error("Erreur sauvegarde compétence web:", err);
      setError(err.message || "Erreur lors de la sauvegarde de la compétence.");
    } finally {
      setSavingCompetency(false);
    }
  };

  const handleScoreChange = (studentId: string, valueStr: string) => {
    const val = parseFloat(valueStr);
    if (isNaN(val)) {
      const newMap = { ...gradesMap };
      delete newMap[studentId];
      setGradesMap(newMap);
      return;
    }

    setGradesMap((prev) => ({
      ...prev,
      [studentId]: val,
    }));
  };

  const handleScoreBlur = async (studentId: string) => {
    if (isTeacher && isLockedBySubmission) return;

    const score = gradesMap[studentId];
    if (score === undefined || isNaN(score)) return;

    if (score < 0 || score > 20) {
      setError("La note doit être comprise entre 0 et 20.");
      return;
    }

    if (!currentAssignment || !selectedSequenceId) return;

    try {
      setSavingMap((prev) => ({ ...prev, [studentId]: true }));
      setError(null);

      await upsertGrade({
        student_id: studentId,
        subject_id: currentAssignment.subject_id,
        sequence_id: selectedSequenceId,
        score,
      });

      setSavedStatusMap((prev) => ({ ...prev, [studentId]: true }));
      setTimeout(() => {
        setSavedStatusMap((prev) => ({ ...prev, [studentId]: false }));
      }, 2000);
    } catch (err: any) {
      console.error("Erreur sauvegarde note web:", err);
      setError(err.message || "Erreur lors de la sauvegarde de la note.");
    } finally {
      setSavingMap((prev) => ({ ...prev, [studentId]: false }));
    }
  };

  // Calcul du workflow de validation
  const totalStudentsCount = students.length;
  const gradedStudentsCount = students.filter(
    (s) => gradesMap[s.id] !== undefined && !isNaN(gradesMap[s.id])
  ).length;
  const isClassComplete = totalStudentsCount > 0 && gradedStudentsCount === totalStudentsCount;

  // L'écriture est verrouillée si l'enseignant a validé (Direction peut toujours modifier)
  const isReadOnlyForUser = isTeacher && isLockedBySubmission;

  const handleSubmitClass = async () => {
    if (!currentAssignment || !selectedSequenceId || !currentUserId) return;
    if (!isClassComplete) {
      setError("Toutes les notes de la classe doivent être saisies avant de valider.");
      return;
    }

    const confirmMsg = "Êtes-vous sûr de vouloir valider et envoyer les notes de la classe ?\n\nUne fois validées, vos notes seront verrouillées et vous ne pourrez plus les modifier.";
    if (!window.confirm(confirmMsg)) return;

    try {
      setSubmitting(true);
      setError(null);

      // Si la compétence a été saisie, s'assurer qu'elle est enregistrée
      if (competencyDescription.trim()) {
        await upsertSequenceCompetency(
          currentAssignment.class_id,
          currentAssignment.subject_id,
          selectedSequenceId,
          competencyDescription,
          currentUserId
        );
      }

      const res = await submitClassGrades(
        currentAssignment.class_id,
        currentAssignment.subject_id,
        selectedSequenceId,
        currentUserId
      );

      setIsLockedBySubmission(true);
      setSubmissionDate(res.submitted_at);
      setSuccessMessage("Notes de la classe validées et envoyées avec succès. Écriture désormais verrouillée.");
    } catch (err: any) {
      console.error("Erreur validation des notes web:", err);
      setError(err.message || "Erreur lors de la validation des notes.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-slate font-medium text-sm">
        Chargement de vos attributions et périmètre...
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-ink">Saisie des notes</h1>
          <p className="text-xs sm:text-sm text-slate mt-0.5">
            Saisie au fil de l'eau pour vos classes et matières assignées (Interface Web &amp; Mobile)
          </p>
        </div>

        {/* Indicateur de statut de verrouillage */}
        {isLockedBySubmission && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-50 border border-emerald-200 text-fanion-green text-xs font-bold self-start sm:self-auto">
            <span className="inline-flex items-center gap-1.5"><LockIcon className="w-3.5 h-3.5" /> Notes validées &amp; verrouillées</span>
            {submissionDate && (
              <span className="text-[11px] font-normal text-slate">
                ({new Date(submissionDate).toLocaleDateString("fr-FR")})
              </span>
            )}
            {!isTeacher && (
              <span className="text-[10px] bg-ink/10 text-ink px-1.5 py-0.5 rounded font-mono ml-1">
                Mode Direction (Écriture active)
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-signal-red/30 text-signal-red text-xs sm:text-sm rounded font-medium">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-fanion-green text-xs sm:text-sm rounded font-medium">
          {successMessage}
        </div>
      )}

      {/* Sélecteurs Classe / Matière et Séquence */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white border border-line rounded p-4 shadow-sm">
        <div>
          <label className="block text-xs font-semibold text-slate uppercase mb-1">
            Classe &amp; Matière assignée
          </label>
          {assignments.length === 0 ? (
            <div className="text-xs text-signal-red italic p-2 border border-dashed border-line rounded">
              Aucune attribution trouvée pour votre compte.
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

        <div>
          <label className="block text-xs font-semibold text-slate uppercase mb-1">
            Séquence
          </label>
          <select
            value={selectedSequenceId}
            onChange={(e) => setSelectedSequenceId(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded focus:outline-none focus:ring-1 focus:ring-ink bg-paper text-sm font-medium"
          >
            {sequences.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bloc Compétence Évaluée intégrée (1 seul champ par matière/classe/séquence) */}
      {currentAssignment && (
        <div className="bg-white border border-line rounded p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-ink uppercase tracking-wide">
              Compétence évaluée pour cette séquence
            </label>
            <span className="text-[11px] font-medium">
              {savingCompetency && <span className="text-fanion-gold animate-pulse">Enregistrement...</span>}
              {savedCompetency && <span className="text-fanion-green font-bold inline-flex items-center gap-1"><CheckIcon className="w-3.5 h-3.5" /> Enregistrée</span>}
            </span>
          </div>
          <p className="text-xs text-slate">
            Description de l'activité d'évaluation ou savoir essentiel (apparaîtra sur les bulletins de tous les élèves de la classe).
          </p>
          <div className="relative">
            <input
              type="text"
              maxLength={300}
              disabled={isReadOnlyForUser}
              value={competencyDescription}
              onChange={(e) => setCompetencyDescription(e.target.value)}
              onBlur={handleCompetencyBlur}
              placeholder="Ex: Résoudre des équations du premier degré dans des situations de vie courante"
              className={`w-full px-3 py-2 border border-line rounded text-sm bg-paper focus:outline-none focus:ring-1 focus:ring-ink ${
                isReadOnlyForUser ? "bg-slate/5 cursor-not-allowed text-slate" : ""
              }`}
            />
          </div>
        </div>
      )}

      {/* Grille de saisie des élèves */}
      {loadingGrades ? (
        <div className="py-8 text-center text-slate text-xs sm:text-sm">
          Chargement de la liste des élèves et des notes...
        </div>
      ) : students.length === 0 ? (
        <div className="p-8 text-center bg-white border border-line rounded text-slate text-sm">
          Aucun élève actif trouvé dans cette classe.
        </div>
      ) : (
        <div className="bg-white border border-line rounded shadow-sm overflow-hidden">
          <div className="p-4 border-b border-line bg-paper/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-slate uppercase tracking-wider">
                {students.length} Élève(s) dans la classe
              </span>
              <span className="ml-3 text-xs font-semibold text-ink">
                ({gradedStudentsCount}/{totalStudentsCount} note(s) renseignée(s))
              </span>
            </div>
            <span className="text-[11px] text-slate italic">
              {isReadOnlyForUser
                ? "Saisie verrouillée après validation"
                : "Sauvegarde automatique à la sortie du champ"}
            </span>
          </div>

          <div className="divide-y divide-line">
            {students.map((student, idx) => {
              const score = gradesMap[student.id];
              const isSaving = savingMap[student.id];
              const isSaved = savedStatusMap[student.id];
              const letterGrade = score !== undefined && !isNaN(score) ? getSubjectLetterGrade(score) : null;

              return (
                <div
                  key={student.id}
                  className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-paper/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-slate w-6">
                      #{idx + 1}
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold text-ink leading-tight">
                        {student.last_name} {student.first_name}
                      </h4>
                      <p className="text-[11px] text-slate font-mono mt-0.5">
                        Matricule: {student.matricule}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 justify-end self-end sm:self-center">
                    {letterGrade && (
                      <span className="text-xs font-bold px-2 py-1 rounded bg-slate/10 text-ink">
                        Lettre: {letterGrade}
                      </span>
                    )}

                    <span className="text-[11px] w-20 text-right font-medium">
                      {isSaving && <span className="text-fanion-gold animate-pulse">Enregistrement...</span>}
                      {isSaved && <span className="text-fanion-green font-bold inline-flex items-center gap-1"><CheckIcon className="w-3.5 h-3.5" /> Enregistré</span>}
                    </span>

                    <div className="relative flex items-center">
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        max="20"
                        disabled={isReadOnlyForUser}
                        inputMode="decimal"
                        value={score !== undefined ? score : ""}
                        onChange={(e) => handleScoreChange(student.id, e.target.value)}
                        onBlur={() => handleScoreBlur(student.id)}
                        placeholder="/ 20"
                        className={`w-24 px-3 py-2 border border-line rounded text-right font-mono font-bold text-sm bg-paper focus:outline-none focus:ring-1 focus:ring-ink ${
                          isReadOnlyForUser ? "bg-slate/5 cursor-not-allowed text-slate" : ""
                        }`}
                      />
                      <span className="ml-1 text-xs text-slate font-mono font-semibold">/20</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Barre d'action de validation globale de la classe */}
          <div className="p-4 border-t border-line bg-paper/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate">
              {!isClassComplete ? (
                <span className="text-signal-red font-medium">
                  <span className="inline-flex items-center gap-1.5"><AlertTriangleIcon className="w-4 h-4 text-signal-red flex-shrink-0" /> Toutes les notes doivent être remplies ({gradedStudentsCount}/{totalStudentsCount}) pour pouvoir valider la classe.</span>
                </span>
              ) : isLockedBySubmission ? (
                <span className="text-fanion-green font-medium">
                  <span className="inline-flex items-center gap-1.5"><CheckCircleIcon className="w-4 h-4 text-fanion-green flex-shrink-0" /> Toutes les notes ont été validées et transmises à la Direction.</span>
                </span>
              ) : (
                <span className="text-slate font-medium">
                  <span className="inline-flex items-center gap-1.5"><CheckCircleIcon className="w-4 h-4 text-slate flex-shrink-0" /> Toutes les notes sont saisies. Vous pouvez maintenant valider et envoyer les notes.</span>
                </span>
              )}
            </div>

            {(!isLockedBySubmission || !isTeacher) && (
              <button
                type="button"
                id="btn-validate-class-grades"
                disabled={!isClassComplete || submitting || isReadOnlyForUser}
                onClick={handleSubmitClass}
                className={`px-5 py-2.5 rounded text-sm font-bold shadow-sm transition-all flex items-center gap-2 ${
                  isClassComplete && !isReadOnlyForUser
                    ? "bg-fanion-green hover:bg-emerald-700 text-white cursor-pointer"
                    : "bg-slate/20 text-slate/60 cursor-not-allowed"
                }`}
              >
                {submitting ? "Validation en cours..." : "Valider et envoyer les notes de la classe"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherGradesPage;
