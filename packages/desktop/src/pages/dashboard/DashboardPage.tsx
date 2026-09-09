import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getDashboardMetrics,
  DashboardMetrics,
} from "@fanion/shared";

interface DashboardPageProps {
  userRole?: string;
}

export const DashboardPage: React.FC<DashboardPageProps> = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDashboardMetrics();
      setMetrics(data);
    } catch (err: any) {
      console.error("Erreur chargement dashboard:", err);
      setError(err?.message || "Impossible de charger les indicateurs du tableau de bord.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR").format(Math.round(amount)) + " FCFA";
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* ── Entête & Période active ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span className="text-xs font-semibold text-slate uppercase tracking-wider">
              {metrics?.schoolSettings?.name || "Collège Le Fanion"}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-ink tracking-tight">
            Tableau de Bord
          </h1>
          <p className="text-sm text-slate">
            Synthèse d'activité et état opérationnel de l'établissement (Desktop)
          </p>
        </div>

        {/* Badges Période */}
        <div className="flex flex-wrap items-center gap-2">
          {metrics?.schoolYear && (
            <div className="px-3 py-1.5 rounded-lg bg-ink/5 border border-line text-xs font-medium text-ink flex items-center gap-1.5">
              <svg className="w-4 h-4 text-slate" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Année : <strong>{metrics.schoolYear.name}</strong></span>
            </div>
          )}

          {metrics?.activeSequence ? (
            <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                {metrics.activeSequence.termName} — <strong>{metrics.activeSequence.name}</strong>
              </span>
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-medium text-amber-800">
              Aucune séquence active
            </div>
          )}

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 border border-line rounded-lg hover:bg-white text-slate hover:text-ink transition shadow-sm disabled:opacity-50"
            title="Rafraîchir les données"
          >
            <svg
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
          <svg className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <div className="font-semibold">Erreur de chargement du tableau de bord</div>
            <div className="text-xs text-rose-700 mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {loading && !metrics ? (
        <div className="py-24 text-center">
          <div className="inline-block w-8 h-8 border-3 border-ink border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-sm font-medium text-slate">Calcul des indicateurs de l'établissement…</p>
        </div>
      ) : metrics ? (
        <>
          {/* ── GRILLE 1 : 4 CARTES KPI CLÉS ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1 : Effectifs */}
            <div className="bg-white p-5 rounded-xl border border-line shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate uppercase tracking-wider">Effectifs Élèves</span>
                <span className="p-2 rounded-lg bg-blue-50 text-blue-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </span>
              </div>
              <div className="text-3xl font-display font-bold text-ink">
                {metrics.enrollment.totalActive}
              </div>
              <div className="flex items-center justify-between text-xs text-slate mt-2 pt-2 border-t border-line/60">
                <span>Total inscrits : <strong>{metrics.enrollment.totalStudents}</strong></span>
                {metrics.enrollment.totalPending > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                    {metrics.enrollment.totalPending} en attente
                  </span>
                )}
              </div>
            </div>

            {/* KPI 2 : Finance Annuelle */}
            <div className="bg-white p-5 rounded-xl border border-line shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate uppercase tracking-wider">Recouvrement Annuel</span>
                <span className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </div>
              <div className="text-3xl font-display font-bold text-emerald-700">
                {metrics.finances.collectionRate}%
              </div>
              <div className="flex flex-col text-xs text-slate mt-2 pt-2 border-t border-line/60">
                <div className="flex justify-between">
                  <span>Encaissé :</span>
                  <strong className="text-ink">{formatCurrency(metrics.finances.totalPaid)}</strong>
                </div>
                <div className="flex justify-between text-[11px] text-slate/80">
                  <span>Attendu :</span>
                  <span>{formatCurrency(metrics.finances.totalExpected)}</span>
                </div>
              </div>
            </div>

            {/* KPI 3 : Activité Récente */}
            <div className="bg-white p-5 rounded-xl border border-line shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate uppercase tracking-wider">Activité Récente</span>
                <span className="p-2 rounded-lg bg-purple-50 text-purple-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </span>
              </div>
              <div className="text-2xl font-display font-bold text-ink">
                {formatCurrency(metrics.finances.todayPaymentsTotal)}
              </div>
              <div className="flex flex-col text-xs text-slate mt-2 pt-2 border-t border-line/60 space-y-1">
                <div className="flex justify-between">
                  <span>Paiements du jour :</span>
                  <strong className="text-ink">{metrics.finances.todayPaymentsCount}</strong>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>7 derniers jours :</span>
                  <span className="font-semibold text-ink">{formatCurrency(metrics.finances.weekPaymentsTotal)}</span>
                </div>
              </div>
            </div>

            {/* KPI 4 : Soumissions de Notes */}
            <div className="bg-white p-5 rounded-xl border border-line shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate uppercase tracking-wider">Soumissions Notes</span>
                <span className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </span>
              </div>
              <div className="text-3xl font-display font-bold text-indigo-900">
                {metrics.academics.gradeSubmissionRate}%
              </div>
              <div className="flex flex-col text-xs text-slate mt-2 pt-2 border-t border-line/60">
                <div className="flex justify-between">
                  <span>Effectuées :</span>
                  <strong className="text-emerald-700">
                    {metrics.academics.submittedGradesCount} / {metrics.academics.totalAssignments}
                  </strong>
                </div>
                <div className="flex justify-between text-[11px] text-amber-700">
                  <span>En attente :</span>
                  <span>{metrics.academics.pendingGradesCount} matières</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── RACCOURCIS RAPIDES ── */}
          <div className="space-y-3">
            <h2 className="text-base font-display font-bold text-ink flex items-center gap-2">
              <svg className="w-4 h-4 text-slate" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Actions Fréquentes
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Link
                to="/students"
                className="p-4 rounded-xl bg-white border border-line hover:border-ink/40 hover:bg-slate/5 transition group flex flex-col items-start"
              >
                <div className="p-2.5 rounded-lg bg-blue-50 text-blue-700 group-hover:scale-105 transition mb-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <span className="text-sm font-bold text-ink group-hover:text-blue-900">Ajouter un élève</span>
                <span className="text-xs text-slate mt-0.5">Inscription & scolarité</span>
              </Link>

              <Link
                to="/finance/payments"
                className="p-4 rounded-xl bg-white border border-line hover:border-ink/40 hover:bg-slate/5 transition group flex flex-col items-start"
              >
                <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700 group-hover:scale-105 transition mb-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <span className="text-sm font-bold text-ink group-hover:text-emerald-900">Enregistrer paiement</span>
                <span className="text-xs text-slate mt-0.5">Émission de reçu officiel</span>
              </Link>

              <Link
                to="/finance/class-report"
                className="p-4 rounded-xl bg-white border border-line hover:border-ink/40 hover:bg-slate/5 transition group flex flex-col items-start"
              >
                <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-700 group-hover:scale-105 transition mb-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="text-sm font-bold text-ink group-hover:text-indigo-900">Fiche de paiement de classe</span>
                <span className="text-xs text-slate mt-0.5">Bordereau financier & exports</span>
              </Link>

              <Link
                to="/reports/class"
                className="p-4 rounded-xl bg-white border border-line hover:border-ink/40 hover:bg-slate/5 transition group flex flex-col items-start"
              >
                <div className="p-2.5 rounded-lg bg-purple-50 text-purple-700 group-hover:scale-105 transition mb-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="text-sm font-bold text-ink group-hover:text-purple-900">Bordereau de classe</span>
                <span className="text-xs text-slate mt-0.5">Palmarès & moyennes</span>
              </Link>
            </div>
          </div>

          {/* ── TABLEAU DE BORD OPÉRATIONNEL PAR CLASSE ── */}
          <div className="bg-white rounded-xl border border-line shadow-sm overflow-hidden">
            <div className="p-5 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-display font-bold text-ink">
                  Synthèse Opérationnelle par Classe
                </h2>
                <p className="text-xs text-slate">
                  Effectifs, progression des soumissions et recouvrement financier
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-paper border border-line text-ink">
                {metrics.classesSummary.length} classes configurées
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line bg-paper/60 text-slate text-xs uppercase font-semibold">
                    <th className="py-3 px-4">Classe</th>
                    <th className="py-3 px-4 text-center">Effectif</th>
                    <th className="py-3 px-4 text-center">
                      Soumissions ({metrics.activeSequence ? metrics.activeSequence.name : "Notes"})
                    </th>
                    <th className="py-3 px-4 text-right">Recouvrement</th>
                    <th className="py-3 px-4 text-right">Encaissé</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {metrics.classesSummary.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate text-sm">
                        Aucune classe trouvée.
                      </td>
                    </tr>
                  ) : (
                    metrics.classesSummary.map((cls) => {
                      const submissionPercent =
                        cls.expectedSubmissions > 0
                          ? Math.round((cls.actualSubmissions / cls.expectedSubmissions) * 100)
                          : 0;

                      return (
                        <tr key={cls.id} className="hover:bg-slate/5 transition">
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-ink">{cls.name}</span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate/10 text-ink">
                              {cls.studentCount} élèves
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex flex-col items-center">
                              <span
                                className={`text-xs font-semibold ${
                                  cls.actualSubmissions >= cls.expectedSubmissions && cls.expectedSubmissions > 0
                                    ? "text-emerald-700"
                                    : "text-amber-700"
                                }`}
                              >
                                {cls.actualSubmissions} / {cls.expectedSubmissions} matières
                              </span>
                              <div className="w-24 bg-line h-1.5 rounded-full overflow-hidden mt-1">
                                <div
                                  className={`h-full ${
                                    submissionPercent >= 100 ? "bg-emerald-600" : "bg-amber-500"
                                  }`}
                                  style={{ width: `${Math.min(100, submissionPercent)}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-ink">{cls.collectionRate}%</span>
                              <div className="w-20 bg-line h-1.5 rounded-full overflow-hidden mt-1">
                                <div
                                  className="h-full bg-emerald-600"
                                  style={{ width: `${Math.min(100, cls.collectionRate)}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-ink">
                            {formatCurrency(cls.totalPaid)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Link
                                to={`/bulletins`}
                                className="px-2.5 py-1 rounded border border-line text-xs font-medium text-ink hover:bg-ink hover:text-white transition"
                                title="Bulletins de la classe"
                              >
                                Bulletins
                              </Link>
                              <Link
                                to={`/reports/class`}
                                className="px-2.5 py-1 rounded border border-line text-xs font-medium text-ink hover:bg-ink hover:text-white transition"
                                title="Bordereau de la classe"
                              >
                                Bordereau
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
export default DashboardPage;
