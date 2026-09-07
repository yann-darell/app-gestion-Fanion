import React, { useEffect, useState, useCallback } from "react";
import {
  listClasses,
  listTerms,
  listSequences,
  listStudents,
  ClassRecord,
  TermRecord,
  SequenceRecord,
  StudentRecord,
  checkStudentBulletinCompleteness,
  generateAndSaveStudentBulletin,
  getBulletinSignedUrl,
  fetchClassBulletinsStatus,
  StudentBulletinStatus,
  BulletinCompletenessDiagnostic,
  useSelectionPersistence,
  generateClassCombinedBulletinsPdfBuffer,
} from "@fanion/shared";

interface BulletinsPdfPageProps {
  userRole?: string;
}

export const BulletinsPdfPage: React.FC<BulletinsPdfPageProps> = ({ userRole }) => {
  const [selectedDivision, setSelectedDivision] = useSelectionPersistence("division", "college");
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [selectedClassId, setSelectedClassId] = useSelectionPersistence("classId", "");

  const [periodType, setPeriodType] = useSelectionPersistence<"sequence" | "term">("periodType", "sequence");
  const [terms, setTerms] = useState<TermRecord[]>([]);
  const [sequences, setSequences] = useState<SequenceRecord[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useSelectionPersistence("periodId", "");

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [bulletinStatuses, setBulletinStatuses] = useState<Record<string, StudentBulletinStatus>>({});

  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingStatuses, setLoadingStatuses] = useState(false);

  // État de génération individuelle
  const [generatingStudentId, setGeneratingStudentId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modale d'avertissement complétude
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [pendingStudent, setPendingStudent] = useState<StudentRecord | null>(null);
  const [diagnostic, setDiagnostic] = useState<BulletinCompletenessDiagnostic | null>(null);

  const [error, setError] = useState<string | null>(null);

  const isAuthorized = userRole === "principal" || userRole === "directeur_etudes";

  // 1. Initialisation des classes, trimestres et séquences
  useEffect(() => {
    const initData = async () => {
      setLoadingInit(true);
      setError(null);
      try {
        const [clsData, tData, seqData] = await Promise.all([
          listClasses(selectedDivision),
          listTerms(),
          listSequences(),
        ]);
        setClasses(clsData);
        setTerms(tData);
        setSequences(seqData);

        if (clsData.length > 0) {
          setSelectedClassId((prev) => (prev && clsData.some((c) => c.id === prev) ? prev : clsData[0].id));
        }
      } catch (err: any) {
        console.error("Erreur d'initialisation des bulletins:", err);
        setError("Impossible de charger la liste des classes ou des périodes.");
      } finally {
        setLoadingInit(false);
      }
    };
    initData();
  }, [selectedDivision]);

  // 2. Présélection intelligente de la période par défaut
  useEffect(() => {
    if (periodType === "sequence") {
      if (sequences.length > 0) {
        setSelectedPeriodId((prev) => (prev && sequences.some((s) => s.id === prev) ? prev : sequences[0].id));
      }
    } else {
      if (terms.length > 0) {
        setSelectedPeriodId((prev) => (prev && terms.some((t) => t.id === prev) ? prev : terms[0].id));
      }
    }
  }, [periodType, sequences, terms]);

  // 3. Chargement des élèves de la classe
  const loadStudents = useCallback(async () => {
    if (!selectedClassId) {
      setStudents([]);
      setBulletinStatuses({});
      return;
    }
    setLoadingStudents(true);
    setError(null);
    try {
      const stData = await listStudents({ classId: selectedClassId, status: "active" });
      setStudents(stData);
    } catch (err: any) {
      console.error("Erreur chargement élèves:", err);
      setError("Impossible de charger les élèves de la classe.");
    } finally {
      setLoadingStudents(false);
    }
  }, [selectedClassId]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // 4. Chargement déterministe des statuts des bulletins (Généré/Non généré) dès que Classe, Période ou Élèves changent
  const loadStatuses = useCallback(async () => {
    if (!selectedClassId || !selectedPeriodId || students.length === 0) {
      setBulletinStatuses({});
      return;
    }
    setLoadingStatuses(true);
    try {
      const statuses = await fetchClassBulletinsStatus(selectedClassId, periodType, selectedPeriodId);
      setBulletinStatuses(statuses);
    } catch (err: any) {
      console.error("Erreur chargement statuts bulletins:", err);
    } finally {
      setLoadingStatuses(false);
    }
  }, [selectedClassId, periodType, selectedPeriodId, students.length]);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  // Handler 1 : Demande de Génération Individuelle (avec pré-vérification de complétude)
  const handleRequestGeneration = async (student: StudentRecord) => {
    if (!selectedPeriodId) return;
    setError(null);
    setGeneratingStudentId(student.id);

    try {
      const diag = await checkStudentBulletinCompleteness(student.id, selectedPeriodId, periodType);
      setDiagnostic(diag);

      if (!diag.isComplete) {
        setPendingStudent(student);
        setShowWarningModal(true);
        setGeneratingStudentId(null);
      } else {
        await executeGeneration(student.id);
      }
    } catch (err: any) {
      console.error("Erreur contrôle complétude bulletin:", err);
      setError(err.message || "Erreur lors de la vérification des notes de l'élève.");
      setGeneratingStudentId(null);
    }
  };

  // Handler 2 : Exécution effective de la génération
  const executeGeneration = async (studentId: string) => {
    try {
      setGeneratingStudentId(studentId);
      setShowWarningModal(false);
      setPendingStudent(null);

      await generateAndSaveStudentBulletin({
        studentId,
        periodId: selectedPeriodId,
        periodType,
      });

      // Rafraîchir les statuts
      await loadStatuses();
    } catch (err: any) {
      console.error("Erreur génération bulletin PDF:", err);
      setError(err.message || "Échec de la génération du bulletin.");
    } finally {
      setGeneratingStudentId(null);
    }
  };

  // Modal de prévisualisation du PDF dans l'application
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);

  // Action Voir le PDF (Modale Intégrée)
  const handleViewPdf = async (studentId: string, pdfPath?: string) => {
    if (!pdfPath) return;
    setActionLoading(`view_${studentId}`);
    setError(null);
    try {
      const signedUrl = await getBulletinSignedUrl(pdfPath);
      setPreviewPdfUrl(signedUrl);
    } catch (err: any) {
      console.error("Erreur ouverture bulletin:", err);
      setError("Impossible d'ouvrir le bulletin PDF.");
    } finally {
      setActionLoading(null);
    }
  };

  // Action Télécharger le PDF (Téléchargement direct via Blob sans ouvrir d'onglet)
  const handleDownloadPdf = async (studentId: string, pdfPath?: string, studentName?: string) => {
    if (!pdfPath) return;
    setActionLoading(`download_${studentId}`);
    setError(null);
    try {
      const signedUrl = await getBulletinSignedUrl(pdfPath);
      const res = await fetch(signedUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `Bulletin_${studentName || studentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error("Erreur téléchargement bulletin:", err);
      setError("Impossible de télécharger le bulletin PDF.");
    } finally {
      setActionLoading(null);
    }
  };

  // Action Téléchargement Groupé de tous les bulletins de la classe en un seul PDF
  const [downloadingBatch, setDownloadingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  const handleBatchDownloadClassBulletins = async () => {
    if (!selectedClassId || !selectedPeriodId) return;
    setDownloadingBatch(true);
    setBatchProgress(null);
    setError(null);
    try {
      const clsName = classes.find((c) => c.id === selectedClassId)?.name || "Classe";
      const pLabel =
        periodType === "sequence"
          ? sequences.find((s) => s.id === selectedPeriodId)?.label || "Séquence"
          : terms.find((t) => t.id === selectedPeriodId)?.label || "Trimestre";

      const pdfBytes = await generateClassCombinedBulletinsPdfBuffer(
        selectedClassId,
        periodType,
        selectedPeriodId,
        (current, total) => setBatchProgress({ current, total })
      );

      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `Bulletins_Complets_${clsName.replace(/\s+/g, "_")}_${pLabel.replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error("Erreur téléchargement groupé des bulletins:", err);
      setError(err?.message || "Échec du téléchargement groupé des bulletins.");
    } finally {
      setDownloadingBatch(false);
      setBatchProgress(null);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="p-6">
        <h1 className="font-display text-2xl font-bold text-ink mb-4">Bulletins de classe</h1>
        <div className="p-4 bg-rose-50 border border-rose-200 rounded text-rose-700 font-medium text-sm">
          Accès restreint. Seuls le Principal et le Directeur des Études peuvent gérer les bulletins de classe.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Bulletins de classe</h1>
          <p className="text-xs text-slate mt-1">
            Gestion et suivi individuel de la génération des bulletins officiels par classe et période.
          </p>
        </div>

        {students.length > 0 && (
          <button
            type="button"
            onClick={handleBatchDownloadClassBulletins}
            disabled={downloadingBatch}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded text-xs font-semibold hover:bg-emerald-800 transition shadow-sm disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>
              {downloadingBatch
                ? batchProgress
                  ? `Génération groupée (${batchProgress.current}/${batchProgress.total})…`
                  : "Préparation du PDF groupé…"
                : "Télécharger tous les bulletins (PDF)"}
            </span>
          </button>
        )}
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
        <div className="flex-1 min-w-[180px]">
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

        {/* Type de Période */}
        <div>
          <label className="block text-xs font-semibold text-slate uppercase mb-1">Type de Période</label>
          <div className="flex gap-1 p-1 bg-paper border border-line rounded">
            <button
              type="button"
              onClick={() => setPeriodType("sequence")}
              className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                periodType === "sequence" ? "bg-ink text-white font-semibold" : "text-slate hover:bg-line/40"
              }`}
            >
              Séquence
            </button>
            <button
              type="button"
              onClick={() => setPeriodType("term")}
              className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                periodType === "term" ? "bg-ink text-white font-semibold" : "text-slate hover:bg-line/40"
              }`}
            >
              Trimestre
            </button>
          </div>
        </div>

        {/* Période Précise */}
        <div className="min-w-[180px]">
          <label className="block text-xs font-semibold text-slate uppercase mb-1">
            {periodType === "sequence" ? "Séquence" : "Trimestre"}
          </label>
          <select
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-ink font-semibold"
            disabled={loadingInit}
          >
            {periodType === "sequence"
              ? sequences.map((seq) => (
                  <option key={seq.id} value={seq.id}>
                    {seq.label}
                  </option>
                ))
              : terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
          </select>
        </div>
      </div>

      {/* Tableau des Élèves de la Classe */}
      <div className="bg-white border border-line rounded shadow-sm overflow-hidden">
        {loadingStudents || loadingStatuses ? (
          <div className="py-16 text-center text-sm text-slate font-medium">Chargement de la liste et des statuts…</div>
        ) : students.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate font-medium">Aucun élève trouvé dans cette classe.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line bg-paper text-xs font-semibold text-slate uppercase tracking-wider">
                  <th className="px-4 py-3 w-12 text-center">N°</th>
                  <th className="px-4 py-3">Élève</th>
                  <th className="px-4 py-3 w-36">Matricule</th>
                  <th className="px-4 py-3 w-44 text-center">Statut du Bulletin</th>
                  <th className="px-4 py-3 text-right pr-4 min-w-[260px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60 text-sm">
                {students.map((st, index) => {
                  const status = bulletinStatuses[st.id] || { isGenerated: false };
                  const isBusy = generatingStudentId === st.id;

                  return (
                    <tr key={st.id} className="hover:bg-paper/30 transition">
                      <td className="px-4 py-3 text-center text-xs font-mono text-slate">{index + 1}</td>
                      <td className="px-4 py-3 font-semibold text-ink">
                        {st.last_name} {st.first_name}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate">{st.matricule}</td>

                      {/* Statut Généré / Pas Généré */}
                      <td className="px-4 py-3 text-center">
                        {status.isGenerated ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            Généré
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate/10 text-slate whitespace-nowrap">
                            Non généré
                          </span>
                        )}
                      </td>

                      {/* Actions par élève */}
                      <td className="px-4 py-3 text-right pr-4">
                        <div className="inline-flex flex-wrap justify-end gap-1.5">
                          {/* Action 1: Générer / Régénérer */}
                          <button
                            type="button"
                            onClick={() => handleRequestGeneration(st)}
                            disabled={isBusy}
                            className={`px-2.5 py-1.5 rounded text-xs font-semibold transition inline-flex items-center gap-1 whitespace-nowrap ${
                              status.isGenerated
                                ? "border border-line text-slate hover:bg-paper"
                                : "bg-ink text-white hover:bg-opacity-90"
                            } disabled:opacity-50`}
                          >
                            {isBusy ? "Génération…" : status.isGenerated ? "Régénérer" : "Générer"}
                          </button>

                          {/* Action 2: Voir (PDF) */}
                          <button
                            type="button"
                            onClick={() => handleViewPdf(st.id, status.pdfPath)}
                            disabled={!status.isGenerated || actionLoading === `view_${st.id}`}
                            className="px-2.5 py-1.5 border border-line rounded text-xs font-semibold text-ink hover:bg-paper transition disabled:opacity-30 disabled:hover:bg-transparent whitespace-nowrap"
                          >
                            {actionLoading === `view_${st.id}` ? "…" : "Voir"}
                          </button>

                          {/* Action 3: Télécharger */}
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(st.id, status.pdfPath, `${st.last_name}_${st.first_name}`)}
                            disabled={!status.isGenerated || actionLoading === `download_${st.id}`}
                            className="px-2.5 py-1.5 bg-emerald-700 text-white rounded text-xs font-semibold hover:bg-emerald-800 transition disabled:opacity-30 disabled:hover:bg-emerald-700 whitespace-nowrap"
                          >
                            {actionLoading === `download_${st.id}` ? "…" : "Télécharger"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODALE D'AVERTISSEMENT (Notes Manquantes) */}
      {showWarningModal && pendingStudent && diagnostic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded border border-line max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-amber-600">
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h3 className="font-display font-bold text-lg text-ink">Notes manquantes : {pendingStudent.last_name}</h3>
            </div>

            <p className="text-xs text-slate leading-relaxed">
              Certaines notes sont absentes pour cette période. Les matières non renseignées afficheront la mention{" "}
              <strong className="text-ink">"NC"</strong> sans bloquer la génération.
            </p>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 space-y-1">
              <span className="font-bold block">{diagnostic.missingSubjects.length} matière(s) non complétée(s) :</span>
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
                  setPendingStudent(null);
                }}
                className="px-4 py-2 border border-line rounded text-xs font-semibold text-slate hover:bg-paper"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={() => executeGeneration(pendingStudent.id)}
                className="px-4 py-2 bg-ink text-white rounded text-xs font-semibold hover:bg-opacity-90"
              >
                Générer quand même avec NC
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE DE PRÉVISUALISATION DU PDF INTEGRÉE */}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-white rounded-lg border border-line max-w-4xl w-full h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-paper border-b border-line">
              <h3 className="font-display font-bold text-base text-ink">Prévisualisation du Bulletin PDF</h3>
              <button
                type="button"
                onClick={() => setPreviewPdfUrl(null)}
                className="p-1.5 rounded-full text-slate hover:text-ink hover:bg-line/40 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 bg-slate-100">
              <iframe src={previewPdfUrl} className="w-full h-full border-none" title="Bulletin PDF" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulletinsPdfPage;
