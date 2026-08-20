import React, { useEffect, useState, useCallback } from "react";
import {
  listClasses,
  listTerms,
  listSequences,
  ClassRecord,
  TermRecord,
  SequenceRecord,
} from "@fanion/shared";
import {
  generateClassReport,
  ClassReportData,
} from "@fanion/shared/services/classReportService";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface ClassReportPageProps {
  userRole?: string;
}

export const ClassReportPage: React.FC<ClassReportPageProps> = ({ userRole }) => {
  const [selectedDivision, setSelectedDivision] = useState<string>("college");
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");

  const [periodType, setPeriodType] = useState<"sequence" | "term">("sequence");
  const [terms, setTerms] = useState<TermRecord[]>([]);
  const [sequences, setSequences] = useState<SequenceRecord[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");

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

        setSelectedClassId("");
        setSelectedPeriodId("");
        setReportData(null);
      } catch (err: any) {
        console.error("Erreur d'initialisation du bordereau web:", err);
        setError("Impossible de charger les données de configuration.");
      } finally {
        setLoadingInit(false);
      }
    };
    fetchInit();
  }, [selectedDivision]);

  useEffect(() => {
    if (periodType === "sequence") {
      if (sequences.length > 0) {
        setSelectedPeriodId(sequences[0].id);
      } else {
        setSelectedPeriodId("");
      }
    } else {
      if (terms.length > 0) {
        setSelectedPeriodId(terms[0].id);
      } else {
        setSelectedPeriodId("");
      }
    }
  }, [periodType, sequences, terms]);

  const loadReport = useCallback(async () => {
    if (!selectedClassId || !selectedPeriodId) return;
    setLoadingReport(true);
    setError(null);
    try {
      const data = await generateClassReport(
        selectedClassId,
        periodType,
        selectedPeriodId
      );
      setReportData(data);
    } catch (err: any) {
      console.error("Erreur lors de la génération du bordereau web:", err);
      setError("Erreur lors du calcul du bordereau de classe.");
    } finally {
      setLoadingReport(false);
    }
  }, [selectedClassId, periodType, selectedPeriodId]);

  useEffect(() => {
    if (selectedClassId && selectedPeriodId) {
      loadReport();
    }
  }, [selectedClassId, selectedPeriodId, loadReport]);

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
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Bordereau de Classe</h1>
        <p className="text-xs text-slate mt-1">Vue récapitulative des notes, moyennes et classement de la classe.</p>
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
          </div>
        </div>

        {/* Choix Période */}
        <div className="min-w-[160px]">
          <label
            htmlFor="select-period-report-web"
            className="block text-xs font-semibold text-slate uppercase mb-1"
          >
            {periodType === "sequence" ? "Séquence" : "Trimestre"}
          </label>
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
              : terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
          </select>
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

          {/* Graphique Distribution */}
          <div className="bg-white border border-line rounded p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-ink font-display mb-2">Distribution des Moyennes</h3>
            <div className="h-44 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportData.distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E0D6" vertical={false} />
                  <XAxis dataKey="range" tick={{ fontSize: 10, fill: "#64748B" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#64748B" }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E4E0D6", borderRadius: "4px" }}
                    formatter={(value: any) => [`${value} élève(s)`, "Nombre"]}
                    labelFormatter={(label) => `Tranche: ${label}`}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {reportData.distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
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
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassReportPage;
