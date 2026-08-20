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
import PageContainer from "../../components/ui/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import { Badge } from "../../components/ui/Badge";
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

  // Charger les classes de la division et la liste des trimestres/séquences
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
        console.error("Erreur d'initialisation du bordereau:", err);
        setError("Impossible de charger les données de configuration.");
      } finally {
        setLoadingInit(false);
      }
    };
    fetchInit();
  }, [selectedDivision]);

  // Réinitialiser / présélectionner le premier choix de période selon le mode
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

  // Générer le bordereau quand la classe et la période sont sélectionnées
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
      console.error("Erreur lors de la génération du bordereau:", err);
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
      <PageContainer>
        <PageHeader title="Bordereau de Classe" />
        <div className="p-6 bg-signal-red/10 border border-signal-red/20 rounded text-signal-red font-medium text-sm">
          Accès restreint. Seuls le Principal et le Directeur des Études peuvent consulter les bordereaux de classe.
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Bordereau de Classe" />

      {/* Barre de Filtres */}
      <div className="bg-white p-4 border border-line rounded mb-6 shadow-sm flex flex-wrap items-end gap-4">
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
                className={`px-3 py-1.5 rounded text-xs font-medium transition ${
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
        <div className="flex-1 min-w-[200px]">
          <label
            htmlFor="select-class-report"
            className="block text-xs font-semibold text-slate uppercase mb-1"
          >
            Classe
          </label>
          <select
            id="select-class-report"
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

        {/* Mode de période */}
        <div>
          <label className="block text-xs font-semibold text-slate uppercase mb-1">
            Type de Période
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

        {/* Sélection Période */}
        <div className="min-w-[180px]">
          <label
            htmlFor="select-period-report"
            className="block text-xs font-semibold text-slate uppercase mb-1"
          >
            {periodType === "sequence" ? "Séquence" : "Trimestre"}
          </label>
          <select
            id="select-period-report"
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
        <div className="mb-6 p-4 bg-signal-red/10 border border-signal-red/20 rounded text-sm text-signal-red font-medium">
          {error}
        </div>
      )}

      {!selectedClassId || !selectedPeriodId ? (
        <div className="py-16 border border-dashed border-line rounded bg-white text-center">
          <p className="text-sm text-slate font-medium">
            Veuillez sélectionner une classe et une période pour afficher le bordereau.
          </p>
        </div>
      ) : loadingReport ? (
        <div className="py-16 text-center text-sm font-medium text-slate">
          Calcul et génération du bordereau de classe...
        </div>
      ) : !reportData || reportData.rows.length === 0 ? (
        <div className="py-12 border border-line rounded bg-white text-center">
          <p className="text-sm text-slate font-medium">
            Aucun élève trouvé dans cette classe.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Cartes Métriques clés + Graphique Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Colonne Statistiques */}
            <div className="space-y-4">
              <div className="bg-white border border-line rounded p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-ink font-display mb-4">Résumé de la Classe</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-paper border border-line rounded">
                    <span className="text-[11px] font-semibold text-slate uppercase block mb-1">
                      Effectif Noté
                    </span>
                    <span className="text-xl font-bold font-mono text-ink">
                      {reportData.stats.rankedStudentsCount} / {reportData.stats.totalStudents}
                    </span>
                  </div>

                  <div className="p-3 bg-paper border border-line rounded">
                    <span className="text-[11px] font-semibold text-slate uppercase block mb-1">
                      Moyenne Classe
                    </span>
                    <span className="text-xl font-bold font-mono text-ink">
                      {reportData.stats.classAverageDisplay} / 20
                    </span>
                  </div>

                  <div className="p-3 bg-paper border border-line rounded">
                    <span className="text-[11px] font-semibold text-slate uppercase block mb-1">
                      Plus Forte Moyenne
                    </span>
                    <span className="text-xl font-bold font-mono text-emerald-600">
                      {reportData.stats.maxAverageDisplay}
                    </span>
                  </div>

                  <div className="p-3 bg-paper border border-line rounded">
                    <span className="text-[11px] font-semibold text-slate uppercase block mb-1">
                      Plus Faible Moyenne
                    </span>
                    <span className="text-xl font-bold font-mono text-signal-red">
                      {reportData.stats.minAverageDisplay}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-line flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate uppercase">
                    Taux de Réussite (≥ 10/20)
                  </span>
                  <span className="text-lg font-bold font-mono text-ink">
                    {reportData.stats.successRate !== null
                      ? `${reportData.stats.successRate.toFixed(1)}%`
                      : "NC"}
                  </span>
                </div>
              </div>
            </div>

            {/* Colonne Graphique Recharts */}
            <div className="lg:col-span-2">
              <div className="bg-white border border-line rounded p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-ink font-display mb-2">Distribution des Moyennes de la Classe</h3>
                <div className="h-48 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E4E0D6" vertical={false} />
                      <XAxis dataKey="range" tick={{ fontSize: 11, fill: "#64748B" }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} />
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
            </div>
          </div>

          {/* Tableau Récapitulatif : Élèves x Matières */}
          <div className="border border-line rounded bg-white overflow-x-auto shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line bg-paper text-xs font-semibold text-slate uppercase tracking-wider">
                  <th className="px-3 py-3 w-12 text-center">N°</th>
                  <th className="px-4 py-3 min-w-[200px]">Élève</th>
                  {reportData.subjects.map((sub) => (
                    <th key={sub.id} className="px-3 py-3 text-center min-w-[90px]">
                      <div className="font-bold text-ink truncate max-w-[120px]" title={sub.name}>
                        {sub.name}
                      </div>
                      <div className="text-[10px] text-slate font-normal font-mono">
                        Coef {sub.coefficient}
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center w-28 bg-paper font-bold text-ink">
                    Moyenne
                  </th>
                  <th className="px-4 py-3 text-center w-24 bg-paper font-bold text-ink">
                    Rang
                  </th>
                </tr>
              </thead>
              <tbody>
                {reportData.rows.map((row, index) => (
                  <tr
                    key={row.student.id}
                    className="border-b border-line/60 last:border-b-0 hover:bg-paper/40 transition text-sm"
                  >
                    <td className="px-3 py-2 text-center text-xs font-mono text-slate">
                      {index + 1}
                    </td>
                    <td className="px-4 py-2 font-medium text-ink">
                      {row.student.last_name} {row.student.first_name}
                    </td>

                    {/* Cellules Matières */}
                    {reportData.subjects.map((sub) => {
                      const item = row.gradesBySubject[sub.id];
                      return (
                        <td
                          key={sub.id}
                          className={`px-3 py-2 text-center font-mono text-xs ${
                            item?.isNC ? "text-slate/60 font-normal italic" : "font-semibold text-ink"
                          }`}
                        >
                          {item?.displayValue ?? "NC"}
                        </td>
                      );
                    })}

                    {/* Moyenne Générale */}
                    <td className="px-4 py-2 text-center bg-paper/50 font-mono font-bold text-sm">
                      {row.average !== null ? (
                        <span className={row.average >= 10 ? "text-emerald-700" : "text-signal-red"}>
                          {row.averageDisplay}
                        </span>
                      ) : (
                        <span className="text-slate/60 italic font-normal">NC</span>
                      )}
                    </td>

                    {/* Rang */}
                    <td className="px-4 py-2 text-center bg-paper/50">
                      {row.isRanked ? (
                        <Badge variant={row.rank === 1 ? "green" : "gray"}>
                          {row.rankDisplay}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate italic font-medium">NC</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default ClassReportPage;
