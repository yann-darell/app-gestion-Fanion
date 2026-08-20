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
} from "@fanion/shared";

interface TeacherGradesPageProps {
  userRole?: string;
}

export const TeacherGradesPage: React.FC<TeacherGradesPageProps> = ({ userRole }) => {
  const [assignments, setAssignments] = useState<TeacherAssignmentRecord[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("");

  const [sequences, setSequences] = useState<SequenceRecord[]>([]);
  const [selectedSequenceId, setSelectedSequenceId] = useState<string>("");

  const [students, setStudents] = useState<AssignedStudentRecord[]>([]);
  const [gradesMap, setGradesMap] = useState<Record<string, number>>({});
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const [savedStatusMap, setSavedStatusMap] = useState<Record<string, boolean>>({});

  const [loading, setLoading] = useState(true);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger les attributions de l'enseignant et les trimestres/séquences
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
        return; // Garde explicite : ne lance pas la requête si l'ID n'est pas encore prêt
      }

      // Si l'utilisateur est enseignant, filtrer ses attributions ; sinon charger tout si direction
      const assignmentFilters = userRole === "enseignant" ? { teacher_id: user.id } : {};
      const assignmentsData = await listTeacherAssignments(assignmentFilters);
      setAssignments(assignmentsData);

      if (assignmentsData.length > 0) {
        setSelectedAssignmentId(assignmentsData[0].id);
      }

      // Charger séquences
      const seqsData = await listSequences();
      setSequences(seqsData);

      if (seqsData.length > 0) {
        setSelectedSequenceId(seqsData[0].id);
      }
    } catch (err: any) {
      console.error("Erreur chargement attributions:", err);
      setError(err.message || "Erreur lors du chargement des attributions.");
    } finally {
      setLoading(false);
    }
  };

  // Sélection de l'attribution courante
  const currentAssignment = assignments.find((a) => a.id === selectedAssignmentId);

  // Charger la liste des élèves et leurs notes lorsque l'attribution ou la séquence change
  useEffect(() => {
    if (currentAssignment && selectedSequenceId) {
      fetchStudentsAndGrades(currentAssignment.class_id, currentAssignment.subject_id, selectedSequenceId);
    } else {
      setStudents([]);
      setGradesMap({});
    }
  }, [selectedAssignmentId, selectedSequenceId]);

  const fetchStudentsAndGrades = async (classId: string, subjectId: string, sequenceId: string) => {
    try {
      setLoadingGrades(true);
      setError(null);

      // Charger les élèves via RPC SECURITY DEFINER (contourne la RLS de students)
      // Pour la direction, on utilise listStudents direct ; pour l'enseignant, le RPC
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

      // Charger les notes déjà saisies
      const gradesData = await listGrades({ class_id: classId, subject_id: subjectId, sequence_id: sequenceId });

      const gMap: Record<string, number> = {};
      gradesData.forEach((g: GradeRecord) => {
        gMap[g.student_id] = g.score;
      });
      setGradesMap(gMap);
      setSavedStatusMap({});
    } catch (err: any) {
      console.error("Erreur chargement des notes:", err);
      setError("Impossible de charger les élèves ou les notes.");
    } finally {
      setLoadingGrades(false);
    }
  };

  // Gestion du changement de note et sauvegarde automatique (UPSERT)
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
      console.error("Erreur sauvegarde note:", err);
      setError(err.message || "Erreur lors de la sauvegarde de la note.");
    } finally {
      setSavingMap((prev) => ({ ...prev, [studentId]: false }));
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
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-ink">Saisie des notes</h1>
          <p className="text-xs sm:text-sm text-slate mt-0.5">
            Saisie au fil de l'eau pour vos classes et matières assignées
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-signal-red/30 text-signal-red text-xs sm:text-sm rounded font-medium">
          {error}
        </div>
      )}

      {/* Barre de sélection (Attribution + Séquence) */}
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

      {/* Grille des Élèves et Saisie Mobile-First */}
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
          <div className="p-4 border-b border-line bg-paper/50 flex justify-between items-center">
            <span className="text-xs font-bold text-slate uppercase tracking-wider">
              {students.length} Élève(s) dans la classe
            </span>
            <span className="text-[11px] text-slate italic">
              Sauvegarde automatique à la sortie du champ
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
                    {/* Lettre de la matière */}
                    {letterGrade && (
                      <span className="text-xs font-bold px-2 py-1 rounded bg-slate/10 text-ink">
                        Lettre: {letterGrade}
                      </span>
                    )}

                    {/* Statut de sauvegarde */}
                    <span className="text-[11px] w-20 text-right font-medium">
                      {isSaving && <span className="text-fanion-gold animate-pulse">Enregistrement...</span>}
                      {isSaved && <span className="text-fanion-green font-bold">✓ Enregistré</span>}
                    </span>

                    {/* Champ de saisie numérique */}
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        max="20"
                        inputMode="decimal"
                        value={score !== undefined ? score : ""}
                        onChange={(e) => handleScoreChange(student.id, e.target.value)}
                        onBlur={() => handleScoreBlur(student.id)}
                        placeholder="/ 20"
                        className="w-24 px-3 py-2 border border-line rounded text-right font-mono font-bold text-sm bg-paper focus:outline-none focus:ring-1 focus:ring-ink"
                      />
                      <span className="ml-1 text-xs text-slate font-mono font-semibold">/20</span>
                    </div>
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

export default TeacherGradesPage;
