import React, { useEffect, useState } from "react";
import {
  listClasses,
  listTerms,
  listStudents,
  ClassRecord,
  TermRecord,
  StudentRecord,
  checkStudentBulletinCompleteness,
  generateAndSaveStudentBulletin,
  getBulletinSignedUrl,
  BulletinCompletenessDiagnostic,
  useSelectionPersistence,
} from "@fanion/shared";

interface BulletinsPdfPageProps {
  userRole?: string;
}

export const BulletinsPdfPage: React.FC<BulletinsPdfPageProps> = ({ userRole }) => {
  const [selectedDivision, setSelectedDivision] = useSelectionPersistence("division", "college");
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [selectedClassId, setSelectedClassId] = useSelectionPersistence("classId", "");

  const [terms, setTerms] = useState<TermRecord[]>([]);
  const [selectedTermId, setSelectedTermId] = useSelectionPersistence("termId", "");

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");

  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Diagnostic de complétude (avertissement)
  const [diagnostic, setDiagnostic] = useState<BulletinCompletenessDiagnostic | null>(null);
  const [showWarningModal, setShowWarningModal] = useState(false);

  // Progression de la génération en masse par classe
  const [progressStatus, setProgressStatus] = useState<string | null>(null);

  const isAuthorized = userRole === "principal" || userRole === "directeur_etudes";

  useEffect(() => {
    const initData = async () => {
      setLoadingInit(true);
      setError(null);
      try {
        const [clsData, tData] = await Promise.all([
          listClasses(selectedDivision),
          listTerms(),
        ]);
        setClasses(clsData);
        setTerms(tData);

        if (clsData.length > 0) {
          setSelectedClassId((prev) => (prev && clsData.some(c => c.id === prev) ? prev : clsData[0].id));
        }
        if (tData.length > 0) {
          setSelectedTermId((prev) => (prev && tData.some(t => t.id === prev) ? prev : tData[0].id));
        }
      } catch (err: any) {
        console.error("Erreur init bulletins PDF:", err);
        setError("Erreur lors du chargement des classes ou trimestres.");
      } finally {
        setLoadingInit(false);
      }
    };
    initData();
  }, [selectedDivision]);

  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      return;
    }
    const fetchClassStudents = async () => {
      setLoadingStudents(true);
      try {
        const stData = await listStudents({ classId: selectedClassId, status: "active" });
        setStudents(stData);
        if (stData.length > 0) setSelectedStudentId(stData[0].id);
      } catch (err: any) {
        console.error("Erreur chargement élèves:", err);
        setError("Impossible de charger les élèves de la classe.");
      } finally {
        setLoadingStudents(false);
      }
    };
    fetchClassStudents();
  }, [selectedClassId]);

  // Déclencher la vérification de complétude avant la génération individuelle
  const handleRequestSingleGeneration = async () => {
    if (!selectedStudentId || !selectedTermId) return;
    setError(null);
    setGenerating(true);
    setPdfUrl(null);

    try {
      const diag = await checkStudentBulletinCompleteness(selectedStudentId, selectedTermId);
      setDiagnostic(diag);

      if (!diag.isComplete) {
        setShowWarningModal(true);
        setGenerating(false);
      } else {
        await executeSingleGeneration();
      }
    } catch (err: any) {
      console.error("Erreur diagnostic bulletin:", err);
      setError(err.message || "Erreur lors du contrôle du bulletin.");
      setGenerating(false);
    }
  };

  const executeSingleGeneration = async () => {
    try {
      setGenerating(true);
      setShowWarningModal(false);
      const res = await generateAndSaveStudentBulletin({
        studentId: selectedStudentId,
        periodId: selectedTermId,
        periodType: "term",
      });

      const url = await getBulletinSignedUrl(res.pdfPath);
      setPdfUrl(url);
    } catch (err: any) {
      console.error("Erreur génération bulletin PDF:", err);
      setError(err.message || "Échec de la génération du bulletin PDF.");
    } finally {
      setGenerating(false);
    }
  };

  // Génération en masse par classe
  const handleRequestClassGeneration = async () => {
    if (!selectedClassId || !selectedTermId || students.length === 0) return;
    setError(null);
    setGenerating(true);
    setProgressStatus(`Génération des ${students.length} bulletins de la classe en cours...`);

    try {
      let completedCount = 0;
      for (const student of students) {
        completedCount++;
        setProgressStatus(`Génération du bulletin ${completedCount}/${students.length}: ${student.last_name} ${student.first_name}...`);
        await generateAndSaveStudentBulletin({
          studentId: student.id,
          periodId: selectedTermId,
          periodType: "term",
        });
      }
      setProgressStatus(`✓ ${students.length} bulletin(s) de la classe générés et enregistrés avec succès !`);
    } catch (err: any) {
      console.error("Erreur génération masse:", err);
      setError("Une erreur est survenue lors de la génération par classe.");
    } finally {
      setGenerating(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="p-6">
        <h1 className="font-display text-2xl font-bold text-ink mb-4">Génération des Bulletins PDF</h1>
        <div className="p-4 bg-rose-50 border border-rose-200 rounded text-rose-700 font-medium text-sm">
          Accès restreint. Seuls le Principal et le Directeur des Études peuvent générer les bulletins PDF.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Génération des Bulletins PDF</h1>
        <p className="text-xs text-slate mt-1">
          Génération officielle avec en-tête bilingue, calculs trimestriels et stockage sécurisé.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded text-sm text-rose-700 font-medium">
          {error}
        </div>
      )}

      {/* Barre de Filtres Globaux */}
      <div className="bg-white p-4 border border-line rounded shadow-sm flex flex-col md:flex-row md:items-end gap-4">
        {/* Division */}
        <div>
          <label className="block text-xs font-semibold text-slate uppercase mb-1">Division</label>
          <div className="flex gap-1 p-1 bg-paper border border-line rounded">
            {["college", "primaire"].map((div) => (
              <button
                key={div}
                onClick={() => setSelectedDivision(div)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                  selectedDivision === div ? "bg-ink text-white font-semibold" : "text-slate hover:bg-line/40"
                }`}
              >
                {div === "college" ? "Collège" : "Primaire"}
              </button>
            ))}
          </div>
        </div>

        {/* Classe */}
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate uppercase mb-1">Classe</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-ink"
            disabled={loadingInit}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.level})
              </option>
            ))}
          </select>
        </div>

        {/* Trimestre */}
        <div className="w-48">
          <label className="block text-xs font-semibold text-slate uppercase mb-1">Trimestre</label>
          <select
            value={selectedTermId}
            onChange={(e) => setSelectedTermId(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-ink font-semibold"
            disabled={loadingInit}
          >
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grille : Génération Individuelle vs Génération Classe */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Carte 1: Génération Individuelle */}
        <div className="bg-white border border-line rounded p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-display font-bold text-lg text-ink mb-1">1. Bulletin Individuel</h3>
            <p className="text-xs text-slate mb-4">Sélectionnez un élève spécifique pour générer son bulletin.</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate uppercase mb-1">Sélectionner l'Élève</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full px-3 py-2 border border-line rounded text-sm bg-paper focus:outline-none focus:ring-1 focus:ring-ink"
                  disabled={loadingStudents || students.length === 0}
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.last_name} {s.first_name} ({s.matricule})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-line flex flex-col gap-3">
            <button
              type="button"
              onClick={handleRequestSingleGeneration}
              disabled={generating || !selectedStudentId}
              className="w-full py-2.5 bg-ink hover:bg-opacity-90 text-white rounded text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {generating ? "Génération en cours..." : "Générer & Proposer Téléchargement"}
            </button>

            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-sm font-semibold transition text-center flex items-center justify-center gap-2 shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Ouvrir / Télécharger Bulletin PDF
              </a>
            )}
          </div>
        </div>

        {/* Carte 2: Génération par Classe (Masse) */}
        <div className="bg-white border border-line rounded p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-display font-bold text-lg text-ink mb-1">2. Génération par Classe</h3>
            <p className="text-xs text-slate mb-4">
              Génère et sauvegarde atomiquement tous les bulletins de la classe sélectionnée.
            </p>

            <div className="p-3 bg-paper border border-line rounded space-y-1">
              <span className="text-xs font-semibold text-slate uppercase block">Classe cible</span>
              <span className="text-sm font-bold text-ink">
                {classes.find((c) => c.id === selectedClassId)?.name || "Aucune classe"} — {students.length} Élève(s)
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-line space-y-3">
            {progressStatus && (
              <div className="p-2.5 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded font-medium">
                {progressStatus}
              </div>
            )}

            <button
              type="button"
              onClick={handleRequestClassGeneration}
              disabled={generating || students.length === 0}
              className="w-full py-2.5 bg-fanion-green hover:bg-opacity-90 text-white rounded text-sm font-semibold transition disabled:opacity-50"
            >
              {generating ? "Traitement en masse..." : `Générer les ${students.length} Bulletins de la Classe`}
            </button>
          </div>
        </div>
      </div>

      {/* MODALE D'AVERTISSEMENT (Notes Manquantes) */}
      {showWarningModal && diagnostic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded border border-line max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-amber-600">
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="font-display font-bold text-lg text-ink">Avertissement : Notes manquantes</h3>
            </div>

            <p className="text-xs text-slate leading-relaxed">
              Certaines notes sont absentes pour cet élève. Les matières non renseignées afficheront la mention <strong className="text-ink">"NC"</strong> sans bloquer la génération.
            </p>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 space-y-1">
              <span className="font-bold block">
                {diagnostic.missingSubjects.length} matière(s) non complétée(s) :
              </span>
              <ul className="list-disc list-inside font-mono text-[11px]">
                {diagnostic.missingSubjects.map((sub, idx) => (
                  <li key={idx}>{sub}</li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowWarningModal(false);
                }}
                className="px-4 py-2 border border-line rounded text-xs font-semibold text-slate hover:bg-paper"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={executeSingleGeneration}
                className="px-4 py-2 bg-ink text-white rounded text-xs font-semibold hover:bg-opacity-90"
              >
                Générer quand même avec NC
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulletinsPdfPage;
