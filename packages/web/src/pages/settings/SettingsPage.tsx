import React, { useEffect, useState } from "react";
import {
  getSchoolSettings,
  getAcademicCalendar,
  SchoolSettings,
  TermSetting,
} from "@fanion/shared";
import { SchoolSettingsTab } from "./components/SchoolSettingsTab";
import { AcademicCalendarTab } from "./components/AcademicCalendarTab";

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"school" | "calendar">("school");
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [terms, setTerms] = useState<TermSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sData, cData] = await Promise.all([
        getSchoolSettings(),
        getAcademicCalendar(),
      ]);
      setSettings(sData);
      setTerms(cData);
    } catch (err: any) {
      setError(err.message || "Erreur lors du chargement des paramètres.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* En-tête de la page */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Paramètres Généraux</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configuration globale de l'établissement et calendrier des évaluations &amp; verrouillage des séquences.
        </p>
      </div>

      {/* Barre d'onglets */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab("school")}
          className={`pb-3 px-4 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "school"
              ? "border-indigo-600 text-indigo-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span>🏫</span> Identité Établissement
        </button>

        <button
          onClick={() => setActiveTab("calendar")}
          className={`pb-3 px-4 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "calendar"
              ? "border-indigo-600 text-indigo-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span>📅</span> Calendrier &amp; Séquences
        </button>
      </div>

      {/* Contenu principal selon statut */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <div className="inline-block animate-spin text-2xl mb-2">⏳</div>
          <p className="text-sm text-slate-500">Chargement des configurations...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-sm font-medium">
          {error}
        </div>
      ) : (
        <>
          {activeTab === "school" && settings && (
            <SchoolSettingsTab settings={settings} onRefresh={loadData} />
          )}

          {activeTab === "calendar" && (
            <AcademicCalendarTab terms={terms} onRefresh={loadData} />
          )}
        </>
      )}
    </div>
  );
};

