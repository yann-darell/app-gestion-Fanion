import React, { useState, useEffect } from "react";
import {
  listClasses,
  ClassRecord,
  getClassFinancialReport,
  generateClassFinancialReportPdf,
  ClassFinancialReport,
  useSelectionPersistence,
  supabase,
} from "@fanion/shared";

interface ClassFinancialReportPageProps {
  userRole?: string;
}

export const ClassFinancialReportPage: React.FC<ClassFinancialReportPageProps> = () => {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [selectedClassId, setSelectedClassId] = useSelectionPersistence("financialClassId", "");
  const [schoolYears, setSchoolYears] = useState<{ id: string; label: string; is_active: boolean }[]>([]);
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useSelectionPersistence("financialSchoolYearId", "");

  const [report, setReport] = useState<ClassFinancialReport | null>(null);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Charger les années scolaires et classes
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoadingClasses(true);
      setError(null);

      // Années scolaires
      const { data: years, error: yearsErr } = await supabase
        .from("school_years")
        .select("id, label, is_active")
        .order("start_date", { ascending: false });

      if (yearsErr) throw yearsErr;

      setSchoolYears(years || []);
      let activeYearId = selectedSchoolYearId;
      if (!activeYearId || !years?.some((y) => y.id === activeYearId)) {
        const defaultYear = years?.find((y) => y.is_active) || years?.[0];
        if (defaultYear) {
          activeYearId = defaultYear.id;
          setSelectedSchoolYearId(defaultYear.id);
        }
      }

      // Classes
      const cls = await listClasses();
      setClasses(cls);

      if (cls.length > 0) {
        if (!selectedClassId || !cls.some((c) => c.id === selectedClassId)) {
          setSelectedClassId(cls[0].id);
        }
      }
    } catch (err: any) {
      console.error("Erreur chargement classes/années:", err);
      setError(err.message || "Erreur chargement des paramètres de classe.");
    } finally {
      setLoadingClasses(false);
    }
  };

  // 2. Charger le rapport financier quand classe ou année change
  useEffect(() => {
    if (selectedClassId && selectedSchoolYearId) {
      loadReport(selectedClassId, selectedSchoolYearId);
    } else {
      setReport(null);
    }
  }, [selectedClassId, selectedSchoolYearId]);

  const loadReport = async (classId: string, yearId: string) => {
    try {
      setLoadingReport(true);
      setError(null);
      const rep = await getClassFinancialReport(classId, yearId);
      setReport(rep);
    } catch (err: any) {
      console.error("Erreur chargement état financier:", err);
      setError(err.message || "Impossible de charger l'état financier de la classe.");
    } finally {
      setLoadingReport(false);
    }
  };

  const formatAmount = (amt: number) =>
    Math.round(amt || 0)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  // 3. Export PDF à la volée
  const handleExportPdf = async () => {
    if (!report) return;
    try {
      setGeneratingPdf(true);
      setError(null);

      const yearLabel =
        schoolYears.find((y) => y.id === selectedSchoolYearId)?.label || "Année scolaire";
      const pdfBytes = await generateClassFinancialReportPdf(report, yearLabel);

      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Fiche_Paiement_${report.className.replace(/\s+/g, "_")}_${yearLabel}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Erreur génération PDF:", err);
      setError(err.message || "Erreur lors de la génération du PDF.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const trancheLabels = (report?.feeSchedule?.installments_json || []).map((t) => t.label);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* En-tête de la page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-ink">
            Fiche de paiement de classe
          </h1>
          <p className="text-xs sm:text-sm text-slate mt-0.5">
            État financier détaillé par élève, suivi des tranches et solde de classe
          </p>
        </div>

        {report && (
          <button
            onClick={handleExportPdf}
            disabled={generatingPdf || loadingReport}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-ink hover:bg-ink/90 text-white text-xs sm:text-sm font-semibold rounded shadow-sm transition disabled:opacity-50"
          >
            {generatingPdf ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Génération PDF...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Exporter PDF (A4 Paysage)</span>
              </>
            )}
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-signal-red/30 text-signal-red text-xs sm:text-sm rounded font-medium">
          {error}
        </div>
      )}

      {/* Barre de sélection : Classe + Année scolaire */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white border border-line rounded p-4 shadow-sm">
        <div>
          <label className="block text-xs font-semibold text-slate uppercase mb-1">
            Classe
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            disabled={loadingClasses}
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
            Année scolaire
          </label>
          <select
            value={selectedSchoolYearId}
            onChange={(e) => setSelectedSchoolYearId(e.target.value)}
            disabled={loadingClasses}
            className="w-full px-3 py-2 border border-line rounded focus:outline-none focus:ring-1 focus:ring-ink bg-paper text-sm font-medium"
          >
            {schoolYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label} {y.is_active ? "★ (En cours)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Cartouches d'indicateurs de synthèse de la classe */}
      {report && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white border border-line rounded p-3 sm:p-4 shadow-sm">
            <span className="text-[11px] font-semibold text-slate uppercase">Effectif</span>
            <div className="text-xl sm:text-2xl font-bold font-mono text-ink mt-1">
              {report.summary.totalStudents} <span className="text-xs font-sans text-slate font-normal">élèves</span>
            </div>
            <div className="text-[11px] text-slate mt-0.5">
              Classe : {report.className}
            </div>
          </div>

          <div className="bg-white border border-line rounded p-3 sm:p-4 shadow-sm">
            <span className="text-[11px] font-semibold text-slate uppercase">Total Exigible</span>
            <div className="text-xl sm:text-2xl font-bold font-mono text-ink mt-1">
              {formatAmount(report.summary.totalExpected)}{" "}
              <span className="text-xs font-sans text-slate font-normal">FCFA</span>
            </div>
            <div className="text-[11px] text-slate mt-0.5">
              Inscr. : {formatAmount(report.summary.registrationExpected)} | Scol. : {formatAmount(report.summary.tuitionExpected)}
            </div>
          </div>

          <div className="bg-white border border-line rounded p-3 sm:p-4 shadow-sm">
            <span className="text-[11px] font-semibold text-slate uppercase">Total Encaissé</span>
            <div className="text-xl sm:text-2xl font-bold font-mono text-fanion-green mt-1">
              {formatAmount(report.summary.totalPaid)}{" "}
              <span className="text-xs font-sans text-slate font-normal">FCFA</span>
            </div>
            <div className="text-[11px] text-fanion-green font-medium mt-0.5">
              Taux de recouvrement : {report.summary.collectionRate}%
            </div>
          </div>

          <div className="bg-white border border-line rounded p-3 sm:p-4 shadow-sm">
            <span className="text-[11px] font-semibold text-slate uppercase">Reste à Recouvrer</span>
            <div className="text-xl sm:text-2xl font-bold font-mono text-signal-red mt-1">
              {formatAmount(report.summary.totalRemainingDue)}{" "}
              <span className="text-xs font-sans text-slate font-normal">FCFA</span>
            </div>
            <div className="text-[11px] text-slate mt-0.5">
              {report.summary.totalRemainingDue === 0 ? "100% collecté" : "Solde restant classe"}
            </div>
          </div>
        </div>
      )}

      {/* Avertissement si aucun tarif configuré pour la classe */}
      {report && !report.feeSchedule && (
        <div className="p-4 bg-amber-50 border border-fanion-gold/40 text-amber-900 text-xs sm:text-sm rounded">
          <strong>Information tarif :</strong> Aucun tarif configuré pour cette classe et cette année. Les montants exigibles apparaissent à 0 FCFA.
        </div>
      )}

      {/* Tableau des élèves */}
      {loadingReport ? (
        <div className="py-12 text-center text-slate text-sm">
          Chargement de l'état financier de la classe...
        </div>
      ) : !report || report.students.length === 0 ? (
        <div className="p-8 text-center bg-white border border-line rounded text-slate text-sm">
          Aucun élève trouvé dans cette classe.
        </div>
      ) : (
        <div className="bg-white border border-line rounded shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#150A5E] text-white uppercase text-[10px] sm:text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-3 w-8">#</th>
                  <th className="py-3 px-3">Élève</th>
                  <th className="py-3 px-3 text-right">Inscription</th>
                  <th className="py-3 px-3 text-right">Scolarité</th>
                  {trancheLabels.map((lbl) => (
                    <th key={lbl} className="py-3 px-3 text-right">
                      {lbl}
                    </th>
                  ))}
                  <th className="py-3 px-3 text-right">Total Versé</th>
                  <th className="py-3 px-3 text-right">Reste Dû</th>
                  <th className="py-3 px-3 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line font-sans">
                {report.students.map((st, idx) => (
                  <tr key={st.studentId} className="hover:bg-paper/40 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-slate text-xs">{idx + 1}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-ink">
                        {st.lastName} {st.firstName}
                      </div>
                      <div className="font-mono text-[10px] text-slate">
                        {st.matricule || "Pas de matricule"}
                      </div>
                    </td>

                    {/* Inscription */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="font-mono font-semibold">
                        {formatAmount(st.registrationFeePaid)} / {formatAmount(st.registrationFeeExpected)}
                      </div>
                      <span
                        className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded mt-0.5 ${
                          st.isRegistrationComplete
                            ? "bg-green-100 text-fanion-green"
                            : "bg-red-100 text-signal-red"
                        }`}
                      >
                        {st.isRegistrationComplete ? "Soldé" : "En attente"}
                      </span>
                    </td>

                    {/* Scolarité */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="font-mono font-semibold text-ink">
                        {formatAmount(st.tuitionExpected)}
                      </div>
                      {st.hasTuitionOverride && (
                        <span className="inline-block text-[9px] font-medium text-fanion-gold bg-amber-50 px-1 rounded">
                          Bourse/Réduction
                        </span>
                      )}
                    </td>

                    {/* Détail des tranches */}
                    {st.trancheBreakdown.map((tb) => (
                      <td key={tb.label} className="py-2.5 px-3 text-right">
                        <div className="font-mono text-xs font-semibold">
                          {formatAmount(tb.paid)}
                          <span className="text-[10px] text-slate font-normal"> / {formatAmount(tb.expected)}</span>
                        </div>
                        <span
                          className={`inline-block text-[9px] font-semibold px-1 rounded mt-0.5 ${
                            tb.status === "paid"
                              ? "text-fanion-green bg-green-50"
                              : tb.status === "partial"
                              ? "text-fanion-gold bg-amber-50"
                              : "text-signal-red bg-red-50"
                          }`}
                        >
                          {tb.status === "paid"
                            ? "Payé"
                            : tb.status === "partial"
                            ? "Partiel"
                            : "0"}
                        </span>
                      </td>
                    ))}

                    {/* Total versé */}
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-fanion-green">
                      {formatAmount(st.totalPaid)}
                    </td>

                    {/* Reste à payer */}
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-signal-red">
                      {formatAmount(st.remainingDue)}
                    </td>

                    {/* Statut global */}
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          st.remainingDue === 0
                            ? "bg-green-100 text-fanion-green"
                            : st.totalPaid > 0
                            ? "bg-amber-100 text-fanion-gold"
                            : "bg-red-100 text-signal-red"
                        }`}
                      >
                        {st.remainingDue === 0
                          ? "Soldé"
                          : st.totalPaid > 0
                          ? "Partiel"
                          : "Non entamé"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-paper/80 font-bold border-t-2 border-line">
                <tr>
                  <td colSpan={2} className="py-3 px-3 text-ink">
                    Totaux ({report.summary.totalStudents} élèves)
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-ink">
                    {formatAmount(report.summary.registrationPaid)} / {formatAmount(report.summary.registrationExpected)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-ink">
                    {formatAmount(report.summary.tuitionPaid)} / {formatAmount(report.summary.tuitionExpected)}
                  </td>
                  {trancheLabels.map((lbl) => (
                    <td key={lbl} className="py-3 px-3 text-right text-slate text-xs font-mono">
                      —
                    </td>
                  ))}
                  <td className="py-3 px-3 text-right font-mono text-fanion-green text-sm">
                    {formatAmount(report.summary.totalPaid)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-signal-red text-sm">
                    {formatAmount(report.summary.totalRemainingDue)}
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-xs text-ink">
                    {report.summary.collectionRate}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassFinancialReportPage;
