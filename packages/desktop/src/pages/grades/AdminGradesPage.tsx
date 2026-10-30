import React, { useState, useEffect, useCallback, useMemo } from "react";
import { CheckIcon, CheckCircleIcon, AlertTriangleIcon } from "../../components/ui/Icons";
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
  listPrimaryMonths,
  listPrimaryApcStructure,
  listPrimaryGrades,
  upsertPrimaryGrade,
  deleteGradeByCriteria,
  deletePrimaryGradeByCriteria,
  getOrCreatePrimaryEvaluationForMonth,
  supabase,
} from "@fanion/shared";

// ──────────────────────────────────────────────────────────────────────────────
// Types locaux
// ──────────────────────────────────────────────────────────────────────────────

interface PrimaryMonthRecord {
  id: string;
  label: string;
  order_index: number;
  term_id: string;
  termLabel?: string;
}

interface PrimaryDomain {
  id: string;
  code: string;
  name: string;
  order_index: number;
}

interface PrimarySubEvaluation {
  id: string;
  domain_id: string;
  label: string;
  order_index: number;
}

interface PrimaryScale {
  id: string;
  sub_evaluation_id: string;
  max_score: number;
}

// score map : student_id → sub_evaluation_id → score
type PrimaryGradeMap = Record<string, Record<string, number>>;

interface AdminGradesPageProps {
  userRole?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Composant principal
// ──────────────────────────────────────────────────────────────────────────────

export const AdminGradesPage: React.FC<AdminGradesPageProps> = () => {
  // ── Sélection de classe ────────────────────────────────────────────────────
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [selectedClassId, setSelectedClassId] = useSelectionPersistence<string>("adminGradeClassId", "");

  // ── Collège : Matière / Séquence ───────────────────────────────────────────
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useSelectionPersistence<string>("adminGradeSubjectId", "");
  const [sequences, setSequences] = useState<SequenceRecord[]>([]);
  const [selectedSequenceId, setSelectedSequenceId] = useSelectionPersistence<string>("adminGradeSequenceId", "");
  const [students, setStudents] = useState<any[]>([]);
  const [gradesMap, setGradesMap] = useState<Record<string, number>>({});
  const [initialGradesMap, setInitialGradesMap] = useState<Record<string, number>>({});
  const [savedStatusMap, setSavedStatusMap] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [unassignedList, setUnassignedList] = useState<any[]>([]);

  // ── Primaire APC : Mois + Structure ───────────────────────────────────────
  const [primaryMonths, setPrimaryMonths] = useState<PrimaryMonthRecord[]>([]);
  const [selectedMonthId, setSelectedMonthId] = useSelectionPersistence<string>("adminGradePrimaryMonthId", "");
  const [primaryDomains, setPrimaryDomains] = useState<PrimaryDomain[]>([]);
  const [primarySubEvals, setPrimarySubEvals] = useState<PrimarySubEvaluation[]>([]);
  const [primaryScales, setPrimaryScales] = useState<PrimaryScale[]>([]);
  const [primaryGradeMap, setPrimaryGradeMap] = useState<PrimaryGradeMap>({});
  const [primaryEvalId, setPrimaryEvalId] = useState<string>("");
  const [savingPrimaryCell, setSavingPrimaryCell] = useState<string | null>(null);
  const [savedPrimaryCell, setSavedPrimaryCell] = useState<string | null>(null);

  // ── État global ────────────────────────────────────────────────────────────
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Détecter si la classe est primaire (via division) ─────────────────────
  const [isPrimaryClass, setIsPrimaryClass] = useState(false);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Chargement initial : toutes les classes + séquences
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        setLoadingInitial(true);
        setError(null);

        const [cls, seqs] = await Promise.all([listClasses(), listSequences()]);
        setClasses(cls);
        setSequences(seqs);

        let currentClassId = selectedClassId;
        if (!currentClassId || !cls.some((c) => c.id === currentClassId)) {
          if (cls.length > 0) {
            currentClassId = cls[0].id;
            setSelectedClassId(cls[0].id);
          }
        }

        if (seqs.length > 0 && (!selectedSequenceId || !seqs.some((s) => s.id === selectedSequenceId))) {
          setSelectedSequenceId(seqs[0].id);
        }

        if (currentClassId) {
          await fetchSubjectsAndDetectDivision(currentClassId, cls);
        }
      } catch (err: any) {
        setError(err.message || "Erreur chargement des données initiales.");
      } finally {
        setLoadingInitial(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Détecter la division et charger les matières / mois
  // ──────────────────────────────────────────────────────────────────────────
  const fetchSubjectsAndDetectDivision = async (classId: string, allClasses?: ClassRecord[]) => {
    const clsList = allClasses || classes;
    const targetClass = clsList.find((c) => c.id === classId) as any;

    let divisionName = "";
    if (targetClass?.division_id) {
      const { data: div } = await supabase
        .from("divisions")
        .select("nom")
        .eq("id", targetClass.division_id)
        .maybeSingle();
      divisionName = ((div as any)?.nom || "").toLowerCase();
    }

    const isPrim = divisionName.includes("primaire") || divisionName.includes("primary");
    setIsPrimaryClass(isPrim);

    if (isPrim) {
      await fetchPrimaryData(classId, targetClass?.level || "");
    } else {
      const subs = await listSubjects(targetClass?.division_id);
      setSubjects(subs);
      if (subs.length > 0 && (!selectedSubjectId || !subs.some((s) => s.id === selectedSubjectId))) {
        setSelectedSubjectId(subs[0].id);
      } else if (subs.length === 0) {
        setSelectedSubjectId("");
      }
    }
  };

  const fetchPrimaryData = async (_classId: string, level: string) => {
    try {
      const { data: activeYear } = await supabase
        .from("school_years")
        .select("id")
        .eq("is_active", true)
        .maybeSingle();

      let yearId = activeYear?.id;
      if (!yearId) {
        const { data: latestYear } = await supabase
          .from("school_years")
          .select("id")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        yearId = latestYear?.id;
      }

      const months = await listPrimaryMonths(yearId);
      setPrimaryMonths(months);

      if (months.length > 0) {
        const currentMonth = months.find((m) => m.id === selectedMonthId) ? selectedMonthId : months[0].id;
        setSelectedMonthId(currentMonth);
      }

      const { domains, subEvaluations, scales } = await listPrimaryApcStructure(level);
      setPrimaryDomains(domains);
      setPrimarySubEvals(subEvaluations);
      setPrimaryScales(scales);
    } catch (err: any) {
      console.error("Erreur chargement données primaire:", err);
      setError("Impossible de charger la structure APC du primaire.");
    }
  };

  const handleClassChange = async (newClassId: string) => {
    setSelectedClassId(newClassId);
    setStudents([]);
    setGradesMap({});
    setInitialGradesMap({});
    setPrimaryGradeMap({});
    setPrimaryEvalId("");
    setError(null);
    setSuccessMessage(null);
    await fetchSubjectsAndDetectDivision(newClassId);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 3a. COLLÈGE : Charger élèves + notes quand classe/matière/séquence change
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPrimaryClass && selectedClassId && selectedSubjectId && selectedSequenceId) {
      fetchCollegeGrades(selectedClassId, selectedSubjectId, selectedSequenceId);
    }
  }, [isPrimaryClass, selectedClassId, selectedSubjectId, selectedSequenceId]);

  const fetchCollegeGrades = async (classId: string, subjectId: string, sequenceId: string) => {
    try {
      setLoadingGrades(true);
      setError(null);
      setSuccessMessage(null);

      const fullStudents = await listStudents({ classId, status: "active" });
      setStudents(fullStudents);

      const gradesData: GradeRecord[] = await listGrades({ class_id: classId, subject_id: subjectId, sequence_id: sequenceId });
      const gMap: Record<string, number> = {};
      gradesData.forEach((g) => { gMap[g.student_id] = g.score; });
      setGradesMap(gMap);
      setInitialGradesMap({ ...gMap });
      setSavedStatusMap({});
    } catch (err: any) {
      setError(err.message || "Impossible de charger les notes.");
    } finally {
      setLoadingGrades(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 3b. PRIMAIRE : Charger élèves + notes APC quand classe ou mois change
  // ──────────────────────────────────────────────────────────────────────────
  const loadPrimaryGradesForMonth = useCallback(async () => {
    if (!isPrimaryClass || !selectedClassId || !selectedMonthId) return;

    try {
      setLoadingGrades(true);
      setError(null);

      const fullStudents = await listStudents({ classId: selectedClassId, status: "active" });
      setStudents(fullStudents);

      if (fullStudents.length === 0) {
        setPrimaryGradeMap({});
        return;
      }

      const evalId = await getOrCreatePrimaryEvaluationForMonth(selectedMonthId);
      setPrimaryEvalId(evalId);

      const studentIds = fullStudents.map((s) => s.id);
      const grades = await listPrimaryGrades(evalId, studentIds);

      const gMap: PrimaryGradeMap = {};
      fullStudents.forEach((s) => { gMap[s.id] = {}; });
      grades.forEach((g) => {
        if (!gMap[g.student_id]) gMap[g.student_id] = {};
        gMap[g.student_id][g.sub_evaluation_id] = g.score;
      });
      setPrimaryGradeMap(gMap);
    } catch (err: any) {
      console.error("Erreur chargement notes primaire:", err);
      setError(err.message || "Impossible de charger les notes APC du primaire.");
    } finally {
      setLoadingGrades(false);
    }
  }, [isPrimaryClass, selectedClassId, selectedMonthId]);

  useEffect(() => {
    if (isPrimaryClass && selectedClassId && selectedMonthId) {
      loadPrimaryGradesForMonth();
    }
  }, [isPrimaryClass, selectedClassId, selectedMonthId, loadPrimaryGradesForMonth]);

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Calculs et Handlers Collège
  // ──────────────────────────────────────────────────────────────────────────
  const pendingChanges = useMemo(() => {
    const changes: { studentId: string; oldScore?: number; newScore?: number }[] = [];
    students.forEach((s) => {
      const oldScore = initialGradesMap[s.id];
      const newScore = gradesMap[s.id];
      if (oldScore !== newScore) {
        changes.push({ studentId: s.id, oldScore, newScore });
      }
    });
    return changes;
  }, [students, initialGradesMap, gradesMap]);

  const hasPendingChanges = pendingChanges.length > 0;

  const totalStudentsCount = students.length;
  const gradedStudents = useMemo(() => {
    return students.filter((s) => gradesMap[s.id] !== undefined && !isNaN(gradesMap[s.id]));
  }, [students, gradesMap]);
  const gradedStudentsCount = gradedStudents.length;

  const unassignedStudents = useMemo(() => {
    return students.filter((s) => gradesMap[s.id] === undefined || isNaN(gradesMap[s.id]));
  }, [students, gradesMap]);

  const handleScoreChange = (studentId: string, valueStr: string) => {
    setSuccessMessage(null);
    const trimmed = valueStr.trim();
    if (trimmed === "") {
      setGradesMap((prev) => {
        const copy = { ...prev };
        delete copy[studentId];
        return copy;
      });
      return;
    }
    const val = parseFloat(trimmed);
    if (!isNaN(val)) {
      setGradesMap((prev) => ({ ...prev, [studentId]: val }));
    }
  };

  const handleScoreBlur = (studentId: string) => {
    const score = gradesMap[studentId];
    if (score !== undefined && !isNaN(score)) {
      if (score < 0 || score > 20) {
        setError(`Note invalide (${score}). La note doit être comprise entre 0 et 20.`);
      } else {
        setError(null);
      }
    }
  };

  const handleStartSave = () => {
    setError(null);
    setSuccessMessage(null);

    // Vérifier la validité de toutes les notes saisies
    for (const s of students) {
      const score = gradesMap[s.id];
      if (score !== undefined && !isNaN(score) && (score < 0 || score > 20)) {
        setError(`La note de ${s.last_name} ${s.first_name} (${score}) doit être comprise entre 0 et 20.`);
        return;
      }
    }

    if (unassignedStudents.length > 0) {
      setUnassignedList(unassignedStudents);
    } else {
      setUnassignedList([]);
    }
    setShowConfirmModal(true);
  };

  const executeSaveGrades = async () => {
    if (!selectedClassId || !selectedSubjectId || !selectedSequenceId) return;

    try {
      setSubmitting(true);
      setError(null);
      setShowConfirmModal(false);

      const targetChanges = pendingChanges.length > 0
        ? pendingChanges
        : students.map((s) => ({ studentId: s.id, oldScore: initialGradesMap[s.id], newScore: gradesMap[s.id] }));

      for (const change of targetChanges) {
        const studentId = change.studentId;
        const newScore = gradesMap[studentId];

        if (newScore === undefined || isNaN(newScore)) {
          if (change.oldScore !== undefined) {
            await deleteGradeByCriteria(studentId, selectedSubjectId, selectedSequenceId);
          }
        } else {
          await upsertGrade({
            student_id: studentId,
            subject_id: selectedSubjectId,
            sequence_id: selectedSequenceId,
            score: newScore,
          });
        }
      }

      setInitialGradesMap({ ...gradesMap });

      const newSaved: Record<string, boolean> = {};
      targetChanges.forEach((c) => {
        newSaved[c.studentId] = true;
      });
      setSavedStatusMap(newSaved);
      setTimeout(() => {
        setSavedStatusMap({});
      }, 3500);

      setSuccessMessage("Notes enregistrées et confirmées avec succès !");
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (err: any) {
      console.error("Erreur enregistrement notes direction:", err);
      setError(err.message || "Erreur lors de l'enregistrement des notes.");
    } finally {
      setSubmitting(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Handlers Primaire APC
  // ──────────────────────────────────────────────────────────────────────────
  const handlePrimaryScoreChange = (studentId: string, subEvalId: string, valueStr: string) => {
    const trimmed = valueStr.trim();
    setPrimaryGradeMap((prev) => {
      const studentMap = { ...(prev[studentId] || {}) };
      if (trimmed === "") {
        delete studentMap[subEvalId];
      } else {
        const val = parseFloat(trimmed);
        if (!isNaN(val)) {
          studentMap[subEvalId] = val;
        }
      }
      return { ...prev, [studentId]: studentMap };
    });
  };

  const handlePrimaryScoreBlur = async (studentId: string, subEvalId: string) => {
    if (!primaryEvalId) return;
    const score = primaryGradeMap[studentId]?.[subEvalId];
    const cellKey = `${studentId}_${subEvalId}`;

    if (score === undefined || isNaN(score)) {
      try {
        setSavingPrimaryCell(cellKey);
        await deletePrimaryGradeByCriteria(studentId, subEvalId, primaryEvalId);
        setSavedPrimaryCell(cellKey);
        setTimeout(() => { setSavedPrimaryCell(null); }, 1500);
      } catch (err: any) {
        console.error("Erreur suppression note APC:", err);
      } finally {
        setSavingPrimaryCell(null);
      }
      return;
    }

    const scale = primaryScales.find((s) => s.sub_evaluation_id === subEvalId);
    const maxScore = scale?.max_score ?? 10;

    if (score < 0 || score > maxScore) {
      setError(`La note doit être entre 0 et ${maxScore}.`);
      return;
    }

    try {
      setSavingPrimaryCell(cellKey);
      setError(null);
      await upsertPrimaryGrade(studentId, subEvalId, primaryEvalId, score);
      setSavedPrimaryCell(cellKey);
      setTimeout(() => { setSavedPrimaryCell(null); }, 1500);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la sauvegarde de la note APC.");
    } finally {
      setSavingPrimaryCell(null);
    }
  };

  const getDomainTotal = (studentId: string, domain: PrimaryDomain) => {
    const subs = primarySubEvals.filter((se) => se.domain_id === domain.id);
    let total = 0;
    let maxTotal = 0;
    subs.forEach((sub) => {
      const scale = primaryScales.find((s) => s.sub_evaluation_id === sub.id);
      const max = scale?.max_score ?? 0;
      const score = primaryGradeMap[studentId]?.[sub.id] ?? 0;
      total += score;
      maxTotal += max;
    });
    return { total, maxTotal };
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Données contextuelles
  // ──────────────────────────────────────────────────────────────────────────
  const currentSequence = sequences.find((s) => s.id === selectedSequenceId);
  const isLockedSequence = !!currentSequence?.is_locked;
  const selectedMonth = primaryMonths.find((m) => m.id === selectedMonthId);

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Rendu
  // ──────────────────────────────────────────────────────────────────────────
  if (loadingInitial) {
    return (
      <div className="py-12 text-center text-slate font-medium text-sm">
        Chargement des classes, matières et séquences...
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-display font-bold text-ink">
              Saisie des notes — Direction
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-ink text-white">
              Accès Complet Admin
            </span>
            {isPrimaryClass && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-700 text-white">
                APC Primaire
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate mt-0.5">
            {isPrimaryClass
              ? "Saisie des évaluations APC par domaine et sous-évaluation pour les classes du primaire"
              : "Saisie et modification souveraine sur l'ensemble des classes et matières de l'établissement"}
          </p>
        </div>

        {!isPrimaryClass && isLockedSequence && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-50 border border-fanion-gold/40 text-amber-900 text-xs font-medium">
            <svg className="w-4 h-4 text-fanion-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Séquence verrouillée aux enseignants — Modification autorisée pour la Direction</span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-signal-red/30 text-signal-red text-xs sm:text-sm rounded font-medium flex items-center gap-2">
          <AlertTriangleIcon className="w-4 h-4 text-signal-red flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-fanion-green text-xs sm:text-sm rounded font-medium flex items-center gap-2 animate-in fade-in">
          <CheckCircleIcon className="w-4 h-4 text-fanion-green flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* ── Barre de Sélection ─────────────────────────────────────────────────── */}
      <div className={`grid grid-cols-1 gap-4 bg-white border border-line rounded p-4 shadow-sm ${isPrimaryClass ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        {/* Classe */}
        <div>
          <label className="block text-xs font-semibold text-slate uppercase mb-1">Classe</label>
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

        {isPrimaryClass ? (
          /* Primaire : sélecteur de Mois */
          <div>
            <label className="block text-xs font-semibold text-slate uppercase mb-1">Mois</label>
            {primaryMonths.length === 0 ? (
              <div className="px-3 py-2 border border-amber-300 rounded text-xs text-amber-800 bg-amber-50">
                Aucun mois configuré — exécutez la migration 024 dans Supabase
              </div>
            ) : (
              <select
                value={selectedMonthId}
                onChange={(e) => setSelectedMonthId(e.target.value)}
                className="w-full px-3 py-2 border border-emerald-400 rounded focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-paper text-sm font-medium"
              >
                {primaryMonths.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}{m.termLabel ? ` — ${m.termLabel}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : (
          /* Collège : Matière + Séquence */
          <>
            <div>
              <label className="block text-xs font-semibold text-slate uppercase mb-1">Matière</label>
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
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate uppercase mb-1">Séquence</label>
              <select
                value={selectedSequenceId}
                onChange={(e) => setSelectedSequenceId(e.target.value)}
                className="w-full px-3 py-2 border border-line rounded focus:outline-none focus:ring-1 focus:ring-ink bg-paper text-sm font-medium"
              >
                {sequences.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} {s.is_locked ? "(Verrouillée)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* ── Corps : Notes ──────────────────────────────────────────────────────── */}
      {loadingGrades ? (
        <div className="py-8 text-center text-slate text-xs sm:text-sm">
          Chargement des élèves et des notes...
        </div>
      ) : students.length === 0 ? (
        <div className="p-8 text-center bg-white border border-line rounded text-slate text-sm">
          Aucun élève actif trouvé dans cette classe.
        </div>
      ) : isPrimaryClass ? (
        /* ─── PRIMAIRE : Grille APC par Domaine ────────────────────────────── */
        <div className="space-y-6">
          {selectedMonth && (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-800 font-medium">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Période : <strong>{selectedMonth.label}</strong>{selectedMonth.termLabel ? ` — ${selectedMonth.termLabel}` : ""}</span>
              <span className="ml-auto text-xs text-emerald-600 font-normal">Sauvegarde automatique à chaque champ</span>
            </div>
          )}

          {primaryDomains.length === 0 ? (
            <div className="p-8 text-center bg-white border border-line rounded text-slate text-sm">
              Aucun domaine APC configuré. Veuillez contacter l'administration.
            </div>
          ) : (
            primaryDomains.map((domain) => {
              const domainSubs = primarySubEvals.filter((se) => se.domain_id === domain.id);
              if (domainSubs.length === 0) return null;

              return (
                <div key={domain.id} className="bg-white border border-line rounded shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-ink text-white flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold opacity-70 mr-2">{domain.code}</span>
                      <span className="font-display font-bold text-sm">{domain.name}</span>
                    </div>
                    <span className="text-[10px] font-mono opacity-60 uppercase tracking-wider">
                      {domainSubs.length} sous-évaluation(s)
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-line bg-paper text-xs font-semibold text-slate uppercase tracking-wider">
                          <th className="px-4 py-2 w-8 text-center">N°</th>
                          <th className="px-4 py-2">Élève</th>
                          {domainSubs.map((sub) => {
                            const scale = primaryScales.find((s) => s.sub_evaluation_id === sub.id);
                            return (
                              <th key={sub.id} className="px-3 py-2 text-center min-w-[100px]">
                                <div className="text-[10px] leading-tight">{sub.label}</div>
                                <div className="text-[10px] font-normal opacity-60">/{scale?.max_score ?? "?"}</div>
                              </th>
                            );
                          })}
                          <th className="px-3 py-2 text-center min-w-[80px]">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line/60 text-sm">
                        {students.map((student, idx) => {
                          const { total, maxTotal } = getDomainTotal(student.id, domain);
                          return (
                            <tr key={student.id} className="hover:bg-paper/30 transition">
                              <td className="px-4 py-2 text-center text-xs font-mono text-slate">{idx + 1}</td>
                              <td className="px-4 py-2">
                                <div className="font-semibold text-sm text-ink leading-tight">
                                  {student.last_name} {student.first_name}
                                </div>
                                <div className="text-[11px] font-mono text-slate">{student.matricule || "—"}</div>
                              </td>

                              {domainSubs.map((sub) => {
                                const scale = primaryScales.find((s) => s.sub_evaluation_id === sub.id);
                                const maxScore = scale?.max_score ?? 10;
                                const score = primaryGradeMap[student.id]?.[sub.id];
                                const cellKey = `${student.id}_${sub.id}`;
                                const isSaving = savingPrimaryCell === cellKey;
                                const isSaved = savedPrimaryCell === cellKey;

                                return (
                                  <td key={sub.id} className="px-3 py-2 text-center">
                                    <div className="relative flex items-center justify-center gap-1">
                                      <input
                                        type="number"
                                        step="0.25"
                                        min="0"
                                        max={maxScore}
                                        inputMode="decimal"
                                        value={score !== undefined ? score : ""}
                                        onChange={(e) => handlePrimaryScoreChange(student.id, sub.id, e.target.value)}
                                        onBlur={() => handlePrimaryScoreBlur(student.id, sub.id)}
                                        placeholder={`/${maxScore}`}
                                        className={`w-20 px-2 py-1.5 border rounded text-right font-mono font-bold text-xs bg-paper focus:outline-none focus:ring-1 transition ${
                                          isSaved ? "border-emerald-400 focus:ring-emerald-500" : "border-line focus:ring-ink"
                                        }`}
                                      />
                                      {isSaving && (
                                        <span className="absolute -right-4 top-1/2 -translate-y-1/2">
                                          <svg className="w-3 h-3 text-fanion-gold animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                          </svg>
                                        </span>
                                      )}
                                      {isSaved && !isSaving && (
                                        <span className="absolute -right-4 top-1/2 -translate-y-1/2">
                                          <CheckIcon className="w-3 h-3 text-emerald-600" />
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}

                              <td className="px-3 py-2 text-center">
                                <span className={`inline-block px-2 py-1 rounded font-mono font-bold text-xs ${
                                  maxTotal > 0 && total / maxTotal >= 0.6
                                    ? "bg-emerald-50 text-emerald-700"
                                    : maxTotal > 0 && total / maxTotal >= 0.4
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-red-50 text-red-700"
                                }`}>
                                  {total.toFixed(1)}/{maxTotal}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* ─── COLLÈGE : Liste élèves avec note par matière/séquence ────────── */
        <div className="bg-white border border-line rounded shadow-sm overflow-hidden">
          <div className="p-4 border-b border-line bg-paper/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-slate uppercase tracking-wider">
                {students.length} Élève(s) — Saisie &amp; Modification des notes
              </span>
              <p className="text-[11px] text-slate mt-0.5">
                Entrez ou modifiez les notes (/20), puis utilisez le bouton de confirmation ci-dessous pour valider.
              </p>
            </div>
            {hasPendingChanges && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-100 text-amber-800 text-xs font-bold self-start sm:self-auto">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                {pendingChanges.length} modification{pendingChanges.length > 1 ? "s" : ""} à confirmer
              </span>
            )}
          </div>

          <div className="divide-y divide-line">
            {students.map((student, idx) => {
              const score = gradesMap[student.id];
              const initialScore = initialGradesMap[student.id];
              const isDirty = score !== initialScore;
              const isSaved = savedStatusMap[student.id];
              const letterGrade = score !== undefined && !isNaN(score) ? getSubjectLetterGrade(score) : null;

              return (
                <div
                  key={student.id}
                  className={`p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    isDirty ? "bg-amber-50/40" : "hover:bg-paper/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-slate w-6">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-ink leading-tight">
                          {student.last_name} {student.first_name}
                        </h4>
                        {isDirty && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                            Modifié
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate font-mono mt-0.5">
                        Matricule: {student.matricule || "—"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 justify-end self-end sm:self-center">
                    {letterGrade && (
                      <span className="text-xs font-bold px-2 py-1 rounded bg-slate/10 text-ink">
                        Lettre : {letterGrade}
                      </span>
                    )}

                    <span className="text-[11px] w-24 text-right font-medium">
                      {isSaved && (
                        <span className="text-fanion-green font-bold inline-flex items-center gap-1">
                          <CheckIcon className="w-3.5 h-3.5" /> Enregistré
                        </span>
                      )}
                      {!isSaved && score === undefined && (
                        <span className="text-slate/60 text-[10px] italic">Non classé</span>
                      )}
                    </span>

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
                        className={`w-24 px-3 py-2 border rounded text-right font-mono font-bold text-sm bg-paper focus:outline-none focus:ring-1 ${
                          isDirty
                            ? "border-amber-400 focus:ring-amber-500 bg-amber-50/30"
                            : "border-line focus:ring-ink"
                        }`}
                      />
                      <span className="ml-1 text-xs text-slate font-mono font-semibold">/20</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Barre d'action et bouton de confirmation en bas */}
          <div className="sticky bottom-0 z-20 bg-white/95 backdrop-blur-md border-t border-line p-3 sm:p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate w-full sm:w-auto text-center sm:text-left space-y-0.5">
              {unassignedStudents.length > 0 ? (
                <div className="text-amber-800 font-medium flex items-center justify-center sm:justify-start gap-1.5">
                  <AlertTriangleIcon className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>
                    Notes renseignées : <strong>{gradedStudentsCount}/{totalStudentsCount}</strong> ({unassignedStudents.length} sans note &rarr; non classé{unassignedStudents.length > 1 ? "s" : ""})
                  </span>
                </div>
              ) : (
                <div className="text-fanion-green font-medium flex items-center justify-center sm:justify-start gap-1.5">
                  <CheckCircleIcon className="w-4 h-4 text-fanion-green flex-shrink-0" />
                  <span>Tous les élèves ont une note ({gradedStudentsCount}/{totalStudentsCount})</span>
                </div>
              )}
              {hasPendingChanges ? (
                <div className="text-[11px] text-amber-900 font-semibold">
                  ⚠️ {pendingChanges.length} modification{pendingChanges.length > 1 ? "s" : ""} en attente de confirmation
                </div>
              ) : (
                <div className="text-[11px] text-slate">
                  Toutes les notes actuelles sont synchronisées avec la base de données.
                </div>
              )}
            </div>

            <button
              type="button"
              id="btn-confirm-admin-grades"
              disabled={submitting || totalStudentsCount === 0}
              onClick={handleStartSave}
              className={`w-full sm:w-auto px-5 py-2.5 rounded text-xs sm:text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2 ${
                totalStudentsCount > 0
                  ? "bg-fanion-green hover:bg-emerald-700 text-white cursor-pointer active:scale-98"
                  : "bg-slate/20 text-slate/60 cursor-not-allowed"
              }`}
            >
              {submitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  <span>Enregistrement en cours...</span>
                </>
              ) : (
                <>
                  <CheckCircleIcon className="w-4 h-4 text-white" />
                  <span>
                    {hasPendingChanges ? "Confirmer les modifications" : "Valider / Enregistrer les notes"}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Modale de confirmation avant enregistrement ────────────────────── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-5 sm:p-6 space-y-4 border border-line animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                unassignedList.length > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
              }`}>
                {unassignedList.length > 0 ? (
                  <AlertTriangleIcon className="w-5 h-5 text-amber-700" />
                ) : (
                  <CheckCircleIcon className="w-5 h-5 text-emerald-700" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-ink">
                  {unassignedList.length > 0
                    ? "Confirmation des élèves sans note"
                    : "Confirmer l'enregistrement des notes"}
                </h3>
                <p className="text-xs text-slate">
                  {classes.find((c) => c.id === selectedClassId)?.name} &bull;{" "}
                  {subjects.find((s) => s.id === selectedSubjectId)?.name} &bull;{" "}
                  {sequences.find((s) => s.id === selectedSequenceId)?.label}
                </p>
              </div>
            </div>

            {unassignedList.length > 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900 space-y-2">
                <p className="font-semibold">
                  Attention : Les élèves suivants n'ont pas de note et seront considérés comme <u>NON CLASSÉS</u> pour cette matière :
                </p>
                <div className="max-h-36 overflow-y-auto divide-y divide-amber-200/60 bg-white/80 rounded border border-amber-200">
                  {unassignedList.map((st, i) => (
                    <div key={st.id} className="px-3 py-1.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-ink">
                        #{i + 1} {st.last_name} {st.first_name}
                      </span>
                      <span className="font-mono text-[10px] text-slate">{st.matricule || "—"}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-amber-800">
                  Ces élèves ne seront pas pris en compte dans le calcul du rang de cette matière ni dans le nombre d'élèves ayant composé.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900">
                <p>
                  Tous les <strong>{totalStudentsCount}</strong> élèves de la classe ont une note renseignée.
                </p>
                {hasPendingChanges && (
                  <p className="mt-1 text-[11px] text-slate">
                    {pendingChanges.length} modification{pendingChanges.length > 1 ? "s" : ""} prête{pendingChanges.length > 1 ? "s" : ""} à être enregistrée{pendingChanges.length > 1 ? "s" : ""}.
                  </p>
                )}
              </div>
            )}

            <p className="text-xs text-slate leading-relaxed">
              Confirmez-vous l'enregistrement et l'application immédiate de ces notes pour cette classe et matière ?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={submitting}
                className="px-4 py-2 border border-line rounded text-xs font-semibold text-slate hover:bg-paper transition"
              >
                Annuler
              </button>
              <button
                type="button"
                id="btn-modal-confirm-save"
                onClick={executeSaveGrades}
                disabled={submitting}
                className="px-4 py-2 bg-fanion-green hover:bg-emerald-700 text-white rounded text-xs font-bold transition shadow-sm flex items-center gap-1.5"
              >
                {submitting ? "Enregistrement..." : (unassignedList.length > 0 ? "Oui, valider avec ces non-classés" : "Oui, enregistrer les notes")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminGradesPage;
