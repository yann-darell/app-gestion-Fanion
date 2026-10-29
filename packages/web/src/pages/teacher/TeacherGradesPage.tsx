import { LockIcon, CheckIcon, CheckCircleIcon, AlertTriangleIcon } from "../../components/ui/Icons";
import React, { useState, useEffect } from "react";
import {
  supabase,
  listTeacherAssignments,
  listMyAssignedStudents,
  listStudents,
  listGrades,
  upsertGrade,
  deleteGradeByCriteria,
  listSequences,
  getSubjectLetterGrade,
  TeacherAssignmentRecord,
  AssignedStudentRecord,
  SequenceRecord,
  GradeRecord,
  useSelectionPersistence,
  getSequenceCompetency,
  upsertSequenceCompetency,
  getGradeSubmission,
  submitClassGrades,
} from "@fanion/shared";
import { TeacherPrimaryGradesView } from "./components/TeacherPrimaryGradesView";

interface TeacherGradesPageProps {
  userRole?: string;
}

export const TeacherGradesPage: React.FC<TeacherGradesPageProps> = ({ userRole }) => {
  const [assignments, setAssignments] = useState<TeacherAssignmentRecord[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useSelectionPersistence("assignmentId", "");

  const [sequences, setSequences] = useState<SequenceRecord[]>([]);
  const [selectedSequenceId, setSelectedSequenceId] = useSelectionPersistence("sequenceId", "");
  const [isPrimaryClass, setIsPrimaryClass] = useState(false);

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

  // Modale de confirmation pour les élèves sans note
  const [showUnassignedConfirmModal, setShowUnassignedConfirmModal] = useState(false);
  const [unassignedStudentsList, setUnassignedStudentsList] = useState<AssignedStudentRecord[]>([]);

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

      let initialAssignmentId = selectedAssignmentId;
      if (!initialAssignmentId || !assignmentsData.some((a) => a.id === initialAssignmentId)) {
        if (assignmentsData.length > 0) {
          initialAssignmentId = assignmentsData[0].id;
          setSelectedAssignmentId(initialAssignmentId);
        }
      }

      const seqsData = await listSequences();
      setSequences(seqsData);

      let initialSeqId = selectedSequenceId;
      if (!initialSeqId || !seqsData.some((s) => s.id === initialSeqId)) {
        if (seqsData.length > 0) {
          initialSeqId = seqsData[0].id;
          setSelectedSequenceId(initialSeqId);
        }
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
    if (currentAssignment) {
      if (
        currentAssignment.subject_id === "primaire-titulaire" ||
        currentAssignment.subject_id === "primaire"
      ) {
        setIsPrimaryClass(true);
        return;
      }

      const checkPrimary = async () => {
        try {
          const { data: cls } = await supabase
            .from("classes")
            .select("division_id")
            .eq("id", currentAssignment.class_id)
            .maybeSingle();

          if (cls && cls.division_id) {
            const divId = cls.division_id.toLowerCase();
            if (divId === "primaire" || divId.includes("prim") || divId.includes("mater")) {
              setIsPrimaryClass(true);
              return;
            }
            const { data: div } = await supabase.from("divisions").select("nom").eq("id", cls.division_id).maybeSingle();
            const divName = (div?.nom || "").toLowerCase();
            setIsPrimaryClass(divName.includes("primaire") || divName.includes("primary") || divName.includes("maternelle"));
          } else {
            setIsPrimaryClass(false);
          }
        } catch (e) {
          console.error(e);
          setIsPrimaryClass(false);
        }
      };
      checkPrimary();
    } else {
      setIsPrimaryClass(false);
    }
  }, [currentAssignment]);

  useEffect(() => {
    if (currentAssignment && selectedSequenceId && !isPrimaryClass) {
      fetchStudentsAndGrades(currentAssignment.class_id, currentAssignment.subject_id, selectedSequenceId);
      fetchCompetencyAndSubmission(currentAssignment.class_id, currentAssignment.subject_id, selectedSequenceId);
    } else if (!isPrimaryClass) {
      setStudents([]);
      setGradesMap({});
      setCompetencyDescription("");
      setIsLockedBySubmission(false);
    }
  }, [currentAssignment, selectedAssignmentId, selectedSequenceId, isPrimaryClass]);

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
    const trimmed = valueStr.trim();
    if (trimmed === "") {
      const newMap = { ...gradesMap };
      delete newMap[studentId];
      setGradesMap(newMap);
      return;
    }

    const val = parseFloat(trimmed);
    if (!isNaN(val)) {
      setGradesMap((prev) => ({
        ...prev,
        [studentId]: val,
      }));
    }
  };

  const handleScoreBlur = async (studentId: string) => {
    if (isTeacher && isLockedBySubmission) return;
    if (!currentAssignment || !selectedSequenceId) return;

    const score = gradesMap[studentId];

    // Si le champ est vidé, supprimer la note de la base
    if (score === undefined || isNaN(score)) {
      try {
        setSavingMap((prev) => ({ ...prev, [studentId]: true }));
        await deleteGradeByCriteria(studentId, currentAssignment.subject_id, selectedSequenceId);
        setSavedStatusMap((prev) => ({ ...prev, [studentId]: true }));
        setTimeout(() => {
          setSavedStatusMap((prev) => ({ ...prev, [studentId]: false }));
        }, 1500);
      } catch (err: any) {
        console.error("Erreur suppression note:", err);
      } finally {
        setSavingMap((prev) => ({ ...prev, [studentId]: false }));
      }
      return;
    }

    if (score < 0 || score > 20) {
      setError("La note doit être comprise entre 0 et 20.");
      return;
    }

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
  const gradedStudents = students.filter(
    (s) => gradesMap[s.id] !== undefined && !isNaN(gradesMap[s.id])
  );
  const gradedStudentsCount = gradedStudents.length;
  const unassignedStudents = students.filter(
    (s) => gradesMap[s.id] === undefined || isNaN(gradesMap[s.id])
  );
  const isClassComplete = totalStudentsCount > 0 && gradedStudentsCount === totalStudentsCount;

  // L'écriture est verrouillée si l'enseignant a validé (Direction peut toujours modifier)
  const isReadOnlyForUser = isTeacher && isLockedBySubmission;

  const handleStartSubmitClass = () => {
    if (!currentAssignment || !selectedSequenceId || !currentUserId) return;
    if (students.length === 0) return;

    if (unassignedStudents.length > 0) {
      setUnassignedStudentsList(unassignedStudents);
      setShowUnassignedConfirmModal(true);
    } else {
      if (
        window.confirm(
          "Êtes-vous sûr de vouloir valider et envoyer les notes de la classe ?\n\nUne fois validées, vos notes seront verrouillées et vous ne pourrez plus les modifier."
        )
      ) {
        executeSubmitClass();
      }
    }
  };

  const executeSubmitClass = async () => {
    if (!currentAssignment || !selectedSequenceId || !currentUserId) return;

    try {
      setSubmitting(true);
      setError(null);
      setShowUnassignedConfirmModal(false);

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
            {isPrimaryClass ? "Ma Classe" : "Classe & Matière assignée"}
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
                  {isPrimaryClass
                    ? a.class_name
                    : `${a.class_name} — ${a.subject_name}`}
                </option>
              ))}
            </select>
          )}
        </div>

        {!isPrimaryClass && (
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
        )}
      </div>

      {isPrimaryClass && currentAssignment && (
        <TeacherPrimaryGradesView
          currentAssignment={currentAssignment}
          currentUserId={currentUserId}
          isTeacher={isTeacher}
        />
      )}

      {/* Bloc Compétence Évaluée intégrée (1 seul champ par matière/classe/séquence) */}
      {currentAssignment && !isPrimaryClass && (
        <div className="bg-white border border-line rounded p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="competency-textarea" className="block text-xs font-bold text-ink uppercase tracking-wide">
              Compétence évaluée pour cette séquence
            </label>
            <span className="text-[11px] font-medium">
              {savingCompetency && <span className="text-fanion-gold animate-pulse">Enregistrement...</span>}
              {savedCompetency && <span className="text-fanion-green font-bold inline-flex items-center gap-1"><CheckIcon className="w-3.5 h-3.5" /> Enregistrée</span>}
            </span>
          </div>
          <p className="text-xs text-slate">
            Description de l'activité d'évaluation ou savoir essentiel (apparaîtra sur les bulletins).
          </p>
          <div className="relative">
            <textarea
              id="competency-textarea"
              rows={2}
              maxLength={300}
              disabled={isReadOnlyForUser}
              value={competencyDescription}
              onChange={(e) => setCompetencyDescription(e.target.value)}
              onBlur={handleCompetencyBlur}
              placeholder="Ex : Résoudre des équations du premier degré dans des situations concrètes"
              className={`w-full px-3 py-2 border border-line rounded text-sm bg-paper focus:outline-none focus:ring-1 focus:ring-ink resize-none leading-snug ${
                isReadOnlyForUser ? "bg-slate/5 cursor-not-allowed text-slate" : ""
              }`}
            />
            <div className="text-[10px] text-slate/60 text-right mt-0.5">
              {competencyDescription.length}/300 caractères
            </div>
          </div>
        </div>
      )}

      {/* Grille de saisie des élèves */}
      {isPrimaryClass ? null : loadingGrades ? (
        <div className="py-8 text-center text-slate text-xs sm:text-sm">
          Chargement de la liste des élèves et des notes...
        </div>
      ) : students.length === 0 ? (
        <div className="p-8 text-center bg-white border border-line rounded text-slate text-sm">
          Aucun élève actif trouvé dans cette classe.
        </div>
      ) : (
        <div className="bg-white border border-line rounded shadow-sm overflow-hidden pb-16 md:pb-0">
          <div className="p-3 sm:p-4 border-b border-line bg-paper/50 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
            <div>
              <span className="text-xs font-bold text-slate uppercase tracking-wider">
                {students.length} Élève(s) dans la classe
              </span>
              <span className="ml-2 text-xs font-semibold text-ink">
                ({gradedStudentsCount}/{totalStudentsCount} saisie{gradedStudentsCount > 1 ? "s" : ""})
              </span>
            </div>
            <span className="text-[11px] text-slate italic">
              {isReadOnlyForUser
                ? "Saisie verrouillée après validation"
                : "Sauvegarde auto à la sortie du champ"}
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
                  className="p-3 sm:p-4 flex items-center justify-between gap-2 hover:bg-paper/30 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="font-mono text-xs font-bold text-slate w-5 sm:w-6 flex-shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-semibold text-ink leading-tight truncate">
                        {student.last_name} {student.first_name}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] sm:text-[11px] text-slate font-mono">
                          {student.matricule}
                        </span>
                        {letterGrade && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate/10 text-ink">
                            {letterGrade}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] sm:text-[11px] w-14 sm:w-20 text-right font-medium">
                      {isSaving && <span className="text-fanion-gold animate-pulse">Sauv...</span>}
                      {isSaved && <span className="text-fanion-green font-bold inline-flex items-center gap-0.5"><CheckIcon className="w-3 h-3" /> OK</span>}
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
                        className={`w-18 sm:w-24 px-2 py-1.5 sm:px-3 sm:py-2 border border-line rounded text-right font-mono font-bold text-xs sm:text-sm bg-paper focus:outline-none focus:ring-1 focus:ring-ink ${
                          isReadOnlyForUser ? "bg-slate/5 cursor-not-allowed text-slate" : ""
                        }`}
                      />
                      <span className="ml-1 text-[11px] sm:text-xs text-slate font-mono font-semibold">/20</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Barre d'action de validation globale de la classe — FIXE SUR MOBILE en bas au-dessus du BottomNav */}
          {/* Barre d'action de validation globale de la classe — FIXE SUR MOBILE en bas au-dessus du BottomNav */}
          <div className="fixed bottom-16 left-0 right-0 z-20 md:static bg-white/95 md:bg-paper/30 backdrop-blur-md md:backdrop-blur-none border-t border-line p-3 sm:p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] md:shadow-none flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate w-full sm:w-auto text-center sm:text-left">
              {isLockedBySubmission ? (
                <span className="text-fanion-green font-medium flex items-center justify-center sm:justify-start gap-1.5">
                  <CheckCircleIcon className="w-4 h-4 text-fanion-green flex-shrink-0" />
                  <span>Notes validées et transmises.</span>
                </span>
              ) : unassignedStudents.length > 0 ? (
                <span className="text-amber-700 font-medium flex items-center justify-center sm:justify-start gap-1.5">
                  <AlertTriangleIcon className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>
                    Notes saisies : <strong>{gradedStudentsCount}/{totalStudentsCount}</strong> ({unassignedStudents.length} sans note &rarr; non classé{unassignedStudents.length > 1 ? "s" : ""})
                  </span>
                </span>
              ) : (
                <span className="text-fanion-green font-medium flex items-center justify-center sm:justify-start gap-1.5">
                  <CheckCircleIcon className="w-4 h-4 text-fanion-green flex-shrink-0" />
                  <span>Tous les élèves ont une note ({gradedStudentsCount}/{totalStudentsCount}) — Prête à valider !</span>
                </span>
              )}
            </div>

            {(!isLockedBySubmission || !isTeacher) && (
              <button
                type="button"
                id="btn-validate-class-grades"
                disabled={submitting || isReadOnlyForUser || totalStudentsCount === 0}
                onClick={handleStartSubmitClass}
                className={`w-full sm:w-auto px-5 py-2.5 rounded text-xs sm:text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2 ${
                  !isReadOnlyForUser && totalStudentsCount > 0
                    ? "bg-fanion-green hover:bg-emerald-700 text-white cursor-pointer active:scale-98"
                    : "bg-slate/20 text-slate/60 cursor-not-allowed"
                }`}
              >
                {submitting ? "Validation en cours..." : "Valider et envoyer les notes de la classe"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modale d'avertissement et confirmation pour les élèves sans note */}
      {showUnassignedConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-5 sm:p-6 space-y-4 border border-line animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                <AlertTriangleIcon className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h3 className="text-base font-bold text-ink">Confirmation des élèves sans note</h3>
                <p className="text-xs text-slate">Certains élèves n'ont aucune note renseignée.</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900 space-y-1">
              <p className="font-semibold">
                Attention : Les élèves suivants n'ont pas de note et seront considérés comme <u>NON CLASSÉS</u> pour cette matière :
              </p>
              <div className="max-h-36 overflow-y-auto mt-2 divide-y divide-amber-200/60 bg-white/80 rounded border border-amber-200">
                {unassignedStudentsList.map((st, i) => (
                  <div key={st.id} className="px-3 py-1.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-ink">
                      #{i + 1} {st.last_name} {st.first_name}
                    </span>
                    <span className="font-mono text-[10px] text-slate">{st.matricule || "—"}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate leading-relaxed">
              Confirmez-vous que vous souhaitez valider et envoyer les notes de cette classe ? Une fois validée, la saisie sera verrouillée.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowUnassignedConfirmModal(false)}
                disabled={submitting}
                className="px-4 py-2 border border-line rounded text-xs font-semibold text-slate hover:bg-paper transition"
              >
                Annuler et compléter
              </button>
              <button
                type="button"
                onClick={executeSubmitClass}
                disabled={submitting}
                className="px-4 py-2 bg-fanion-green hover:bg-emerald-700 text-white rounded text-xs font-bold transition shadow-sm"
              >
                {submitting ? "Validation..." : "Oui, valider avec ces non-classés"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherGradesPage;
