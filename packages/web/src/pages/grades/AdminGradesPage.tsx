import React, { useState, useEffect } from "react";
import {
  listClasses,
  listSubjects,
  listSequences,
  listStudents,
  listGrades,
  upsertGrade,
  getSubjectLetterGrade,
  ClassRecord,
  SubjectRecord,
  SequenceRecord,
  GradeRecord,
  useSelectionPersistence,
} from "@fanion/shared";

interface AdminGradesPageProps {
  userRole?: string;
}

export const AdminGradesPage: React.FC<AdminGradesPageProps> = () => {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [selectedClassId, setSelectedClassId] = useSelectionPersistence<string>("adminGradeClassId", "");

  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useSelectionPersistence<string>("adminGradeSubjectId", "");

  const [sequences, setSequences] = useState<SequenceRecord[]>([]);
  const [selectedSequenceId, setSelectedSequenceId] = useSelectionPersistence<string>("adminGradeSequenceId", "");

  const [students, setStudents] = useState<any[]>([]);
  const [gradesMap, setGradesMap] = useState<Record<string, number>>({});
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const [savedStatusMap, setSavedStatusMap] = useState<Record<string, boolean>>({});

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Charger Classes, Matières et Séquences
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoadingInitial(true);
      setError(null);

      // Classes
      const cls = await listClasses();
      setClasses(cls);

      let currentClassId = selectedClassId;
      if (!currentClassId || !cls.some((c) => c.id === currentClassId)) {
        if (cls.length > 0) {
          currentClassId = cls[0].id;
          setSelectedClassId(cls[0].id);
        }
      }

      // Séquences
      const seqs = await listSequences();
      setSequences(seqs);
      if (seqs.length > 0 && (!selectedSequenceId || !seqs.some((s) => s.id === selectedSequenceId))) {
        setSelectedSequenceId(seqs[0].id);
      }

      // Matières pour la classe courante
      if (currentClassId) {
        await fetchSubjectsForClass(currentClassId, cls);
      }
    } catch (err: any) {
      console.error("Erreur chargement données initiales notes admin:", err);
      setError(err.message || "Erreur chargement des classes et séquences.");
    } finally {
      setLoadingInitial(false);
    }
  };

  const fetchSubjectsForClass = async (classId: string, allClasses?: ClassRecord[]) => {
    try {
      const clsList = allClasses || classes;
      const targetClass = clsList.find((c) => c.id === classId);
      // Récupérer les matières de la division de la classe (Collège ou Primaire)
      const subs = await listSubjects(targetClass?.division_id);
      setSubjects(subs);

      if (subs.length > 0) {
        if (!selectedSubjectId || !subs.some((s) => s.id === selectedSubjectId)) {
          setSelectedSubjectId(subs[0].id);
        }
      } else {
        setSelectedSubjectId("");
      }
    } catch (err: any) {
      console.error("Erreur chargement matières:", err);
    }
  };

  // Recharger les matières si l'utilisateur change de classe
  const handleClassChange = async (newClassId: string) => {
    setSelectedClassId(newClassId);
    await fetchSubjectsForClass(newClassId);
  };

  // 2. Charger les élèves et les notes dès que classe, matière ou séquence change
  useEffect(() => {
    if (selectedClassId && selectedSubjectId && selectedSequenceId) {
      fetchStudentsAndGrades(selectedClassId, selectedSubjectId, selectedSequenceId);
    } else {
      setStudents([]);
      setGradesMap({});
    }
  }, [selectedClassId, selectedSubjectId, selectedSequenceId]);

  const fetchStudentsAndGrades = async (classId: string, subjectId: string, sequenceId: string) => {
    try {
      setLoadingGrades(true);
      setError(null);

      // Récupération de tous les élèves actifs de la classe (droit direction sans restriction)
      const fullStudents = await listStudents({ classId, status: "active" });
      setStudents(fullStudents);

      // Récupération des notes de cette classe/matière/séquence
      const gradesData: GradeRecord[] = await listGrades({
        class_id: classId,
        subject_id: subjectId,
        sequence_id: sequenceId,
      });

      const gMap: Record<string, number> = {};
      gradesData.forEach((g) => {
        gMap[g.student_id] = g.score;
      });
      setGradesMap(gMap);
      setSavedStatusMap({});
    } catch (err: any) {
      console.error("Erreur chargement élèves et notes direction:", err);
      setError(err.message || "Impossible de charger les notes de cette sélection.");
    } finally {
      setLoadingGrades(false);
    }
  };

  // 3. Modification de note & Sauvegarde automatique
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
    if (score === undefined || isNaN(score)) {
      // Si la note a été effacée et qu'une note existait, on peut la supprimer
      return;
    }

    if (score < 0 || score > 20) {
      setError("La note doit être obligatoirement comprise entre 0 et 20.");
      return;
    }

    if (!selectedSubjectId || !selectedSequenceId) return;

    try {
      setSavingMap((prev) => ({ ...prev, [studentId]: true }));
      setError(null);

      await upsertGrade({
        student_id: studentId,
        subject_id: selectedSubjectId,
        sequence_id: selectedSequenceId,
        score,
      });

      setSavedStatusMap((prev) => ({ ...prev, [studentId]: true }));
      setTimeout(() => {
        setSavedStatusMap((prev) => ({ ...prev, [studentId]: false }));
      }, 2000);
    } catch (err: any) {
      console.error("Erreur sauvegarde note direction:", err);
      setError(err.message || "Erreur lors de l'enregistrement de la note.");
    } finally {
      setSavingMap((prev) => ({ ...prev, [studentId]: false }));
    }
  };

  const currentSequence = sequences.find((s) => s.id === selectedSequenceId);
  const isLockedSequence = !!currentSequence?.is_locked;

  if (loadingInitial) {
    return (
      <div className="py-12 text-center text-slate font-medium text-sm">
        Chargement des classes, matières et séquences...
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-display font-bold text-ink">
              Saisie des notes — Direction
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-ink text-white">
              Accès Complet Admin
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate mt-0.5">
            Saisie et modification souveraine sur l'ensemble des classes et matières de l'établissement
          </p>
        </div>

        {isLockedSequence && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-50 border border-fanion-gold/40 text-amber-900 text-xs font-medium">
            <svg className="w-4 h-4 text-fanion-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Séquence verrouillée aux enseignants — Modification autorisée pour la Direction</span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-signal-red/30 text-signal-red text-xs sm:text-sm rounded font-medium">
          {error}
        </div>
      )}

      {/* Barre de sélection à 3 volets : Classe, Matière, Séquence */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white border border-line rounded p-4 shadow-sm">
        <div>
          <label className="block text-xs font-semibold text-slate uppercase mb-1">
            Classe
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => handleClassChange(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded focus:outline-none focus:ring-1 focus:ring-ink bg-paper text-sm font-medium"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.level})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate uppercase mb-1">
            Matière
          </label>
          {subjects.length === 0 ? (
            <div className="text-xs text-signal-red italic p-2 border border-dashed border-line rounded">
              Aucune matière pour cette division.
            </div>
          ) : (
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full px-3 py-2 border border-line rounded focus:outline-none focus:ring-1 focus:ring-ink bg-paper text-sm font-medium"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
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
                {s.label} {s.is_locked ? "🔒 (Verrouillée)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Liste des Élèves et saisie */}
      {loadingGrades ? (
        <div className="py-8 text-center text-slate text-xs sm:text-sm">
          Chargement des élèves et des notes...
        </div>
      ) : students.length === 0 ? (
        <div className="p-8 text-center bg-white border border-line rounded text-slate text-sm">
          Aucun élève actif trouvé dans cette classe.
        </div>
      ) : (
        <div className="bg-white border border-line rounded shadow-sm overflow-hidden">
          <div className="p-4 border-b border-line bg-paper/50 flex justify-between items-center">
            <span className="text-xs font-bold text-slate uppercase tracking-wider">
              {students.length} Élève(s) — Sauvegarde automatique
            </span>
            <span className="text-[11px] text-slate italic">
              Entrez la note (/20) puis passez au champ suivant
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
                        Matricule: {student.matricule || "—"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 justify-end self-end sm:self-center">
                    {/* Lettre barème */}
                    {letterGrade && (
                      <span className="text-xs font-bold px-2 py-1 rounded bg-slate/10 text-ink">
                        Lettre : {letterGrade}
                      </span>
                    )}

                    {/* Statut de sauvegarde */}
                    <span className="text-[11px] w-24 text-right font-medium">
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

export default AdminGradesPage;
