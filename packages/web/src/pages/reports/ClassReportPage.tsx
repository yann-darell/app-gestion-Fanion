import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  listClasses,
  listTerms,
  listSequences,
  ClassRecord,
  TermRecord,
  SequenceRecord,
  useSelectionPersistence,
  generateClassReportPdf,
  generateClassAveragesReportPdf,
  listPrimaryMonths,
  generateClassReport,
  ClassReportData,
} from "@fanion/shared";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";

interface ClassReportPageProps {
  userRole?: string;
}

export const ClassReportPage: React.FC<ClassReportPageProps> = ({ userRole }) => {
  const [selectedDivision, setSelectedDivision] = useSelectionPersistence<"college" | "primaire">("division", "college");
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [selectedClassId, setSelectedClassId] = useSelectionPersistence("classId", "");

  // Collège
  const [periodType, setPeriodType] = useSelectionPersistence<"sequence" | "term">("periodType", "sequence");
  const [terms, setTerms] = useState<TermRecord[]>([]);
  const [sequences, setSequences] = useState<SequenceRecord[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useSelectionPersistence<string>("periodId", "");

  // Primaire (mois & trimestres)
  const [primaryPeriodType, setPrimaryPeriodType] = useSelectionPersistence<"month" | "term">("primaryClassReportPeriodType", "month");
  const [primaryMonths, setPrimaryMonths] = useState<{ id: string; label: string; termLabel?: string }[]>([]);
  const [selectedPrimaryPeriodId, setSelectedPrimaryPeriodId] = useSelectionPersistence("primaryClassReportPeriodId", "");

  const isPrimary = selectedDivision === "primaire";

  const [reportData, setReportData] = useState<ClassReportData | null>(null);
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthorized =
    userRole === "principal" || userRole === "directeur_etudes";

  useEffect(() => {
    const fetchInit = async () => {
      setLoadingInit(true);
      setError(null);
      try {
        const [classData, termData, seqData] = await Promise.all([
          listClasses(selectedDivision),
          listTerms(),
          listSequences(),
        ]);
        setClasses(classData);
        setTerms(termData);
        setSequences(seqData);

        if (selectedDivision === "primaire") {
          try {
            const months = await listPrimaryMonths();
            setPrimaryMonths(months);
            if (months.length > 0) {
              setSelectedPrimaryPeriodId((prev) =>
                prev && months.some((m) => m.id === prev) ? prev : months[0].id
              );
            }
          } catch (e) {
            console.warn("Mois primaires non chargés dans bordereau:", e);
          }
        }
      } catch (err: any) {
        console.error("Erreur d'initialisation du bordereau web:", err);
        setError("Impossible de charger les données de configuration.");
      } finally {
        setLoadingInit(false);
      }
    };
    fetchInit();
  }, [selectedDivision]);

  // Synchronisation période collège
  useEffect(() => {
    if (periodType === "sequence") {
      if (sequences.length > 0) {
        setSelectedPeriodId((prev) => (prev && sequences.some(s => s.id === prev) ? prev : sequences[0].id));
      }
    } else {
      if (terms.length > 0) {
        setSelectedPeriodId((prev) => (prev && (prev === "annual" || terms.some(t => t.id === prev)) ? prev : terms[0].id));
      }
    }
  }, [periodType, sequences, terms]);

  // Synchronisation période primaire
  useEffect(() => {
    if (primaryPeriodType === "month") {
      if (primaryMonths.length > 0) {
        setSelectedPrimaryPeriodId((prev) =>
          prev && primaryMonths.some((m) => m.id === prev) ? prev : primaryMonths[0].id
        );
      }
    } else {
      if (terms.length > 0) {
        setSelectedPrimaryPeriodId((prev) =>
          prev && terms.some((t) => t.id === prev) ? prev : terms[0].id
        );
      }
    }
  }, [primaryPeriodType, primaryMonths, terms]);

  const isAnnualSelected = !isPrimary && periodType === "term" && selectedPeriodId === "annual";
  const currentClass = classes.find((c) => c.id === selectedClassId);
  const activePeriodId = isPrimary
    ? selectedPrimaryPeriodId
    : isAnnualSelected
    ? (currentClass?.school_year_id || terms[0]?.school_year_id || "annual")
    : selectedPeriodId;
  const activePeriodType = isPrimary
    ? primaryPeriodType
    : isAnnualSelected
    ? "annual"
    : periodType;

  const loadReport = useCallback(async () => {
    if (!selectedClassId || !activePeriodId) return;
    setLoadingReport(true);
    setError(null);
    try {
      const data = await generateClassReport(
        selectedClassId,
        activePeriodType as any,
        activePeriodId
      );
      setReportData(data);
    } catch (err: any) {
      console.error("Erreur lors de la génération du bordereau web:", err);
      setError("Erreur lors du calcul du bordereau de classe.");
    } finally {
      setLoadingReport(false);
    }
  }, [selectedClassId, activePeriodType, activePeriodId]);

  useEffect(() => {
    if (selectedClassId && activePeriodId) {
      loadReport();
    }
  }, [selectedClassId, activePeriodId, loadReport]);

  const [exportingPdf, setExportingPdf] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const handleExportPdf = async () => {
    if (!reportData) return;
    setExportingPdf(true);
    setError(null);
    try {
      const clsName = classes.find((c) => c.id === selectedClassId)?.name || "Classe";
      let pLabel = "";
      if (isPrimary) {
        if (primaryPeriodType === "month") {
          const m = primaryMonths.find((m) => m.id === selectedPrimaryPeriodId);
          pLabel = m ? `Mois de ${m.label}` : "Mois";
        } else {
          const t = terms.find((t) => t.id === selectedPrimaryPeriodId);
          pLabel = t ? t.label : "Trimestre";
        }
      } else {
        pLabel =
          periodType === "sequence"
            ? sequences.find((s) => s.id === selectedPeriodId)?.label || "Séquence"
            : isAnnualSelected
            ? "Annuel (Bilan Annuel)"
            : terms.find((t) => t.id === selectedPeriodId)?.label || "Trimestre";
      }

      // Tentative de capture du graphique SVG Recharts en PNG via Canvas
      let chartImageBase64: string | null = null;
      try {
        const svgEl = chartContainerRef.current?.querySelector("svg");
        if (svgEl) {
          const svgData = new XMLSerializer().serializeToString(svgEl);
          const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
          const url = URL.createObjectURL(svgBlob);
          const img = new Image();

          await new Promise<void>((resolve) => {
            img.onload = () => {
              const canvas = document.createElement("canvas");
              canvas.width = svgEl.clientWidth || 300;
              canvas.height = svgEl.clientHeight || 200;
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                chartImageBase64 = canvas.toDataURL("image/png");
              }
              URL.revokeObjectURL(url);
              resolve();
            };
            img.onerror = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            img.src = url;
          });
        }
      } catch (cErr) {
        console.warn("Capture image Recharts non disponible, utilisation du tracé natif:", cErr);
      }

      const pdfBytes = await generateClassReportPdf({
        reportData,
        className: clsName,
        periodLabel: pLabel,
        chartImageBase64,
        isPrimary,
      });

      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `Bordereau_${clsName.replace(/\s+/g, "_")}_${pLabel.replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error("Erreur téléchargement bordereau PDF:", err);
      setError(err?.message || "Erreur lors de la génération du bordereau PDF.");
    } finally {
      setExportingPdf(false);
    }
  };

  const [exportingAveragesPdf, setExportingAveragesPdf] = useState(false);

  const handleExportAveragesPdf = async () => {
    if (!reportData) return;
    setExportingAveragesPdf(true);
    setError(null);
    try {
      const clsName = classes.find((c) => c.id === selectedClassId)?.name || "Classe";
      let pLabel = "";
      if (isPrimary) {
        if (primaryPeriodType === "month") {
          const m = primaryMonths.find((m) => m.id === selectedPrimaryPeriodId);
          pLabel = m ? `Mois de ${m.label}` : "Mois";
        } else {
          const t = terms.find((t) => t.id === selectedPrimaryPeriodId);
          pLabel = t ? t.label : "Trimestre";
        }
      } else {
        pLabel =
          periodType === "sequence"
            ? sequences.find((s) => s.id === selectedPeriodId)?.label || "Séquence"
            : terms.find((t) => t.id === selectedPeriodId)?.label || "Trimestre";
      }

      const pdfBytes = await generateClassAveragesReportPdf({
        reportData,
        className: clsName,
        periodLabel: pLabel,
        isPrimary,
      });

      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `Bordereau_Moyennes_${clsName.replace(/\s+/g, "_")}_${pLabel.replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error("Erreur téléchargement bordereau des moyennes PDF:", err);
      setError(err?.message || "Erreur lors de la génération du bordereau des moyennes PDF.");
    } finally {
      setExportingAveragesPdf(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="p-6">
        <h1 className="font-display text-2xl font-bold text-ink mb-4">Bordereau de Classe</h1>
        <div className="p-4 bg-rose-50 border border-rose-200 rounded text-rose-700 font-medium text-sm">
          Accès restreint. Seuls le Principal et le Directeur des Études peuvent consulter les bordereaux de classe.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Bordereau de Classe</h1>
          <p className="text-xs text-slate mt-1">Vue récapitulative des notes, moyennes et classement de la classe.</p>
        </div>

        {reportData && reportData.rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              id="btn-export-averages-pdf"
              onClick={handleExportAveragesPdf}
              disabled={exportingAveragesPdf || exportingPdf}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold transition shadow-sm disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>{exportingAveragesPdf ? "Génération du PDF…" : "Bordereau des moyennes (PDF)"}</span>
            </button>

            <button
              type="button"
              id="btn-export-full-pdf"
              onClick={handleExportPdf}
              disabled={exportingPdf || exportingAveragesPdf}
              className="inline-flex items-center gap-2 px-4 py-2 bg-ink text-white rounded text-xs font-semibold hover:bg-opacity-90 transition shadow-sm disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>{exportingPdf ? "Génération du PDF…" : "Bordereau complet (PDF)"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Barre de Filtres */}
      <div className="bg-white p-4 border border-line rounded mb-6 shadow-sm flex flex-col sm:flex-row sm:items-end gap-4">
        {/* Division */}
        <div>
          <label className="block text-xs font-semibold text-slate uppercase mb-1">
            Division
          </label>
          <div className="flex gap-1 p-1 bg-paper border border-line rounded">
            {["college", "primaire"].map((div) => (
              <button
                key={div}
                onClick={() => {
                  setSelectedDivision(div);
                  setSelectedClassId("");
                  setReportData(null);
                }}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded text-xs font-medium transition ${
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

        {/* Classe */}
        <div className="flex-1 min-w-[180px]">
          <label
            htmlFor="select-class-report-web"
            className="block text-xs font-semibold text-slate uppercase mb-1"
          >
            Classe
          </label>
          <select
            id="select-class-report-web"
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

        {/* Type de Période */}
        <div>
          <label className="block text-xs font-semibold text-slate uppercase mb-1">
            Période
          </label>
          <div className="flex gap-1 p-1 bg-paper border border-line rounded">
            {isPrimary ? (
              <>
                <button
                  type="button"
                  onClick={() => setPrimaryPeriodType("month")}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                    primaryPeriodType === "month"
                      ? "bg-emerald-700 text-white font-semibold"
                      : "text-slate hover:bg-line/40"
                  }`}
                >
                  Mois
                </button>
                <button
                  type="button"
                  onClick={() => setPrimaryPeriodType("term")}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                    primaryPeriodType === "term"
                      ? "bg-emerald-700 text-white font-semibold"
                      : "text-slate hover:bg-line/40"
                  }`}
                >
                  Trimestre
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setPeriodType("sequence")}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                    periodType === "sequence"
                      ? "bg-ink text-white font-semibold"
                      : "text-slate hover:bg-line/40"
                  }`}
                >
                  Séquence
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodType("term")}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                    periodType === "term"
                      ? "bg-ink text-white font-semibold"
                      : "text-slate hover:bg-line/40"
                  }`}
                >
                  Trimestre
                </button>
              </>
            )}
          </div>
        </div>

        {/* Choix Période */}
        <div className="min-w-[160px]">
          <label
            htmlFor="select-period-report-web"
            className="block text-xs font-semibold text-slate uppercase mb-1"
          >
            {isPrimary
              ? primaryPeriodType === "month"
                ? "Mois"
                : "Trimestre"
              : periodType === "sequence"
              ? "Séquence"
              : "Trimestre"}
          </label>
          {isPrimary ? (
            primaryPeriodType === "month" ? (
              <select
                id="select-period-report-web"
                value={selectedPrimaryPeriodId}
                onChange={(e) => setSelectedPrimaryPeriodId(e.target.value)}
                className="w-full px-3 py-2 border border-emerald-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 font-semibold"
                disabled={loadingInit}
              >
                {primaryMonths.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} {m.termLabel ? `(${m.termLabel})` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <select
                id="select-period-report-web"
                value={selectedPrimaryPeriodId}
                onChange={(e) => setSelectedPrimaryPeriodId(e.target.value)}
                className="w-full px-3 py-2 border border-emerald-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 font-semibold"
                disabled={loadingInit}
              >
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            )
          ) : (
            <select
              id="select-period-report-web"
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="w-full px-3 py-2 border border-line rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-ink font-medium"
              disabled={loadingInit}
            >
              {periodType === "sequence"
                ? sequences.map((seq) => (
                    <option key={seq.id} value={seq.id}>
                      {seq.label}
                    </option>
                  ))
                : (
                    <>
                      {terms.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                      <option value="annual">Annuel (Bilan Annuel)</option>
                    </>
                  )}
            </select>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded text-sm text-rose-700 font-medium">
          {error}
        </div>
      )}

      {!selectedClassId || !selectedPeriodId ? (
        <div className="py-12 border border-dashed border-line rounded bg-white text-center">
          <p className="text-sm text-slate font-medium">
            Veuillez sélectionner une classe et une période pour afficher le bordereau.
          </p>
        </div>
      ) : loadingReport ? (
        <div className="py-12 text-center text-sm font-medium text-slate">
          Calcul et génération du bordereau...
        </div>
      ) : !reportData || reportData.rows.length === 0 ? (
        <div className="py-12 border border-line rounded bg-white text-center">
          <p className="text-sm text-slate font-medium">
            Aucun élève trouvé dans cette classe.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Métriques */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-white border border-line rounded shadow-sm">
              <span className="text-[11px] font-semibold text-slate uppercase block mb-1">
                Effectif Noté
              </span>
              <span className="text-lg font-bold font-mono text-ink">
                {reportData.stats.rankedStudentsCount} / {reportData.stats.totalStudents}
              </span>
            </div>

            <div className="p-3 bg-white border border-line rounded shadow-sm">
              <span className="text-[11px] font-semibold text-slate uppercase block mb-1">
                Moyenne Classe
              </span>
              <span className="text-lg font-bold font-mono text-ink">
                {reportData.stats.classAverageDisplay}
              </span>
            </div>

            <div className="p-3 bg-white border border-line rounded shadow-sm">
              <span className="text-[11px] font-semibold text-slate uppercase block mb-1">
                Max / Min
              </span>
              <span className="text-lg font-bold font-mono text-ink">
                <span className="text-emerald-600">{reportData.stats.maxAverageDisplay}</span>
                <span className="text-slate mx-1">/</span>
                <span className="text-rose-600">{reportData.stats.minAverageDisplay}</span>
              </span>
            </div>

            <div className="p-3 bg-white border border-line rounded shadow-sm">
              <span className="text-[11px] font-semibold text-slate uppercase block mb-1">
                Taux Réussite
              </span>
              <span className="text-lg font-bold font-mono text-ink">
                {reportData.stats.successRate !== null
                  ? `${reportData.stats.successRate.toFixed(1)}%`
                  : "NC"}
              </span>
            </div>
          </div>

          {/* Graphique Distribution — Barres (distribution par tranche) */}
          <div ref={chartContainerRef} className="bg-white border border-line rounded p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-ink font-display mb-3">Distribution des Moyennes par Tranche</h3>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={reportData.distribution}
                  margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
                  barCategoryGap="30%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E0D6" vertical={false} />
                  <XAxis
                    dataKey="range"
                    tick={{ fontSize: 9, fill: "#5B6B82" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: "#5B6B82" }}
                    axisLine={false}
                    tickLine={false}
                    width={24}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E4E0D6", borderRadius: "4px", fontSize: "11px" }}
                    formatter={(value: any, name: any, props: any) => [
                      `${value} élève(s)`,
                      props.payload?.label || name,
                    ]}
                    labelFormatter={(label) => `Tranche : ${label}`}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {reportData.distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                    <LabelList
                      dataKey="count"
                      position="top"
                      style={{ fontSize: "10px", fontWeight: 700, fill: "#150A5E" }}
                      formatter={(v: any) => (Number(v) > 0 ? v : "")}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Matrice des Notes */}
          <div className="border border-line rounded bg-white overflow-x-auto shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line bg-paper text-xs font-semibold text-slate uppercase tracking-wider">
                  <th className="px-3 py-3 w-10 text-center">N°</th>
                  <th className="px-3 py-3 min-w-[160px]">Élève</th>
                  {reportData.subjects.map((sub) => (
                    <th key={sub.id} className="px-2 py-3 text-center min-w-[80px]">
                      <div className="font-bold text-ink truncate max-w-[100px]" title={sub.name}>
                        {sub.name}
                      </div>
                      <div className="text-[9px] text-slate font-normal font-mono">
                        Coef {sub.coefficient}
                      </div>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center w-24 bg-paper font-bold text-ink">
                    Moy.
                  </th>
                  <th className="px-3 py-3 text-center w-20 bg-paper font-bold text-ink">
                    Rang
                  </th>
                </tr>
              </thead>
              <tbody>
                {reportData.rows.map((row, index) => (
                  <tr
                    key={row.student.id}
                    className="border-b border-line/60 last:border-b-0 hover:bg-paper/40 transition text-xs"
                  >
                    <td className="px-3 py-2 text-center font-mono text-slate">
                      {index + 1}
                    </td>
                    <td className="px-3 py-2 font-medium text-ink">
                      {row.student.last_name} {row.student.first_name}
                    </td>

                    {reportData.subjects.map((sub) => {
                      const item = row.gradesBySubject[sub.id];
                      return (
                        <td
                          key={sub.id}
                          className={`px-2 py-2 text-center font-mono ${
                            item?.isNC ? "text-slate/50 italic" : "font-semibold text-ink"
                          }`}
                        >
                          {item?.displayValue ?? "NC"}
                        </td>
                      );
                    })}

                    <td className="px-3 py-2 text-center bg-paper/50 font-mono font-bold">
                      {row.average !== null ? (
                        <span className={row.average >= 10 ? "text-emerald-700" : "text-rose-600"}>
                          {row.averageDisplay}
                        </span>
                      ) : (
                        <span className="text-slate/50 italic font-normal">NC</span>
                      )}
                    </td>

                    <td className="px-3 py-2 text-center bg-paper/50 font-mono font-semibold">
                      {row.isRanked ? (
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          row.rank === 1 ? "bg-emerald-100 text-emerald-800" : "bg-slate/10 text-slate"
                        }`}>
                          {row.rankDisplay}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate italic">NC</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Ligne Moyenne de la Classe par matière */}
              <tfoot>
                <tr className="border-t-2 border-ink/20 bg-ink/5 text-xs font-bold">
                  <td className="px-3 py-2 text-center text-slate" colSpan={2}>
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-3 h-3 text-ink/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span className="text-[10px] font-semibold text-ink uppercase tracking-wide">Moy. Classe</span>
                    </span>
                  </td>
                  {reportData.subjects.map((sub) => {
                    const sa = reportData.subjectAverages?.[sub.id];
                    const avg = sa?.average ?? null;
                    return (
                      <td key={sub.id} className="px-2 py-2 text-center font-mono">
                        {avg !== null ? (
                          <span className={`font-bold text-[11px] px-1.5 py-0.5 rounded ${avg >= 10 ? "text-emerald-700 bg-emerald-50" : "text-rose-600 bg-rose-50"}`}>
                            {sa!.display}
                          </span>
                        ) : (
                          <span className="text-slate/40 italic font-normal text-[10px]">NC</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center bg-paper/80 font-mono">
                    <span className={`font-bold text-[11px] px-1.5 py-0.5 rounded ${
                      reportData.stats.classAverage !== null && reportData.stats.classAverage >= 10
                        ? "text-emerald-700 bg-emerald-50"
                        : reportData.stats.classAverage !== null
                        ? "text-rose-600 bg-rose-50"
                        : ""
                    }`}>
                      {reportData.stats.classAverageDisplay}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center bg-paper/80 text-slate text-[10px]">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassReportPage;
