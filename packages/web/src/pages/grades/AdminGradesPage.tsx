import React, { useState, useEffect, useCallback } from "react";
import { CheckIcon } from "../../components/ui/Icons";
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
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const [savedStatusMap, setSavedStatusMap] = useState<Record<string, boolean>>({});

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

    // Détecter si c'est une classe primaire via la division
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
      // Primaire : charger les mois + structure APC
      await fetchPrimaryData(classId, targetClass?.level || "");
    } else {
      // Collège : charger les matières
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
      // Mois primaires
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

      // Structure APC (domaines, sous-évaluations, barèmes)
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
    setPrimaryGradeMap({});
    setPrimaryEvalId("");
    setError(null);
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

      const fullStudents = await listStudents({ classId, status: "active" });
      setStudents(fullStudents);

      const gradesData: GradeRecord[] = await listGrades({ class_id: classId, subject_id: subjectId, sequence_id: sequenceId });
      const gMap: Record<string, number> = {};
      gradesData.forEach((g) => { gMap[g.student_id] = g.score; });
      setGradesMap(gMap);
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

      // Élèves de la classe
      const fullStudents = await listStudents({ classId: selectedClassId, status: "active" });
      setStudents(fullStudents);

      if (fullStudents.length === 0) {
        setPrimaryGradeMap({});
        return;
      }

      // Récupérer ou créer l'évaluation primaire pour ce mois
      const evalId = await getOrCreatePrimaryEvaluationForMonth(selectedMonthId);
      setPrimaryEvalId(evalId);

      // Notes de tous les élèves pour cette évaluation
      const studentIds = fullStudents.map((s) => s.id);
      const grades = await listPrimaryGrades(evalId, studentIds);

      // Construire la map : student_id → sub_evaluation_id → score
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
  // 4. Handlers Collège
  // ──────────────────────────────────────────────────────────────────────────
  const handleScoreChange = (studentId: string, valueStr: string) => {
    const val = parseFloat(valueStr);
    if (isNaN(val)) {
      const newMap = { ...gradesMap };
      delete newMap[studentId];
      setGradesMap(newMap);
      return;
    }
    setGradesMap((prev) => ({ ...prev, [studentId]: val }));
  };

  const handleScoreBlur = async (studentId: string) => {
    const score = gradesMap[studentId];
    if (score === undefined || isNaN(score)) return;
    if (score < 0 || score > 20) {
      setError("La note doit être comprise entre 0 et 20.");
      return;
    }
    if (!selectedSubjectId || !selectedSequenceId) return;

    try {
      setSavingMap((prev) => ({ ...prev, [studentId]: true }));
      setError(null);
      await upsertGrade({ student_id: studentId, subject_id: selectedSubjectId, sequence_id: selectedSequenceId, score });
      setSavedStatusMap((prev) => ({ ...prev, [studentId]: true }));
      setTimeout(() => { setSavedStatusMap((prev) => ({ ...prev, [studentId]: false })); }, 2000);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'enregistrement de la note.");
    } finally {
      setSavingMap((prev) => ({ ...prev, [studentId]: false }));
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Handlers Primaire APC
  // ──────────────────────────────────────────────────────────────────────────
  const handlePrimaryScoreChange = (studentId: string, subEvalId: string, valueStr: string) => {
    const val = parseFloat(valueStr);
    setPrimaryGradeMap((prev) => {
      const studentMap = { ...(prev[studentId] || {}) };
      if (isNaN(val)) {
        delete studentMap[subEvalId];
      } else {
        studentMap[subEvalId] = val;
      }
      return { ...prev, [studentId]: studentMap };
    });
  };

  const handlePrimaryScoreBlur = async (studentId: string, subEvalId: string) => {
    if (!primaryEvalId) return;
    const score = primaryGradeMap[studentId]?.[subEvalId];
    if (score === undefined || isNaN(score)) return;

    const scale = primaryScales.find((s) => s.sub_evaluation_id === subEvalId);
    const maxScore = scale?.max_score ?? 10;

    if (score < 0 || score > maxScore) {
      setError(`La note doit être entre 0 et ${maxScore}.`);
      return;
    }

    const cellKey = `${studentId}_${subEvalId}`;
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

  // Score total d'un élève pour un domaine
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
        <div className="p-3 bg-red-50 border border-signal-red/30 text-signal-red text-xs sm:text-sm rounded font-medium">
          {error}
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
          {/* Légende du mois sélectionné */}
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
                  {/* En-tête du domaine */}
                  <div className="px-4 py-3 bg-ink text-white flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold opacity-70 mr-2">{domain.code}</span>
                      <span className="font-display font-bold text-sm">{domain.name}</span>
                    </div>
                    <span className="text-[10px] font-mono opacity-60 uppercase tracking-wider">
                      {domainSubs.length} sous-évaluation(s)
                    </span>
                  </div>

                  {/* Table : Élèves × Sous-évaluations */}
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

                              {/* Total du domaine */}
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
                    {letterGrade && (
                      <span className="text-xs font-bold px-2 py-1 rounded bg-slate/10 text-ink">
                        Lettre : {letterGrade}
                      </span>
                    )}

                    <span className="text-[11px] w-24 text-right font-medium">
                      {isSaving && <span className="text-fanion-gold animate-pulse">Enregistrement...</span>}
                      {isSaved && <span className="text-fanion-green font-bold inline-flex items-center gap-1"><CheckIcon className="w-3.5 h-3.5" /> Enregistré</span>}
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
