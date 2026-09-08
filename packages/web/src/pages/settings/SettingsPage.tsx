import { SchoolIcon, CalendarIcon, PackageIcon, SpinnerIcon } from "../../components/ui/Icons";
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  getSchoolSettings,
  getAcademicCalendar,
  SchoolSettings,
  TermSetting,
} from "@fanion/shared";
import { SchoolSettingsTab } from "./components/SchoolSettingsTab";
import { AcademicCalendarTab } from "./components/AcademicCalendarTab";
import { SuppliesSettingsTab } from "./components/SuppliesSettingsTab";

export const SettingsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as "school" | "calendar" | "supplies") || "school";
  const [activeTab, setActiveTab] = useState<"school" | "calendar" | "supplies">(
    initialTab === "supplies" || initialTab === "calendar" ? initialTab : "school"
  );
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [terms, setTerms] = useState<TermSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleTabChange = (tab: "school" | "calendar" | "supplies") => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

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
          Configuration globale de l'établissement, calendrier &amp; verrouillage des séquences, et liste des fournitures scolaires exigées.
        </p>
      </div>

      {/* Barre d'onglets */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto">
        <button
          onClick={() => handleTabChange("school")}
          className={`pb-3 px-4 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === "school"
              ? "border-indigo-600 text-indigo-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <SchoolIcon className="w-4 h-4 text-indigo-600" /> Identité Établissement
        </button>

        <button
          onClick={() => handleTabChange("calendar")}
          className={`pb-3 px-4 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === "calendar"
              ? "border-indigo-600 text-indigo-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <CalendarIcon className="w-4 h-4 text-indigo-600" /> Calendrier &amp; Séquences
        </button>

        <button
          onClick={() => handleTabChange("supplies")}
          className={`pb-3 px-4 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === "supplies"
              ? "border-indigo-600 text-indigo-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <PackageIcon className="w-4 h-4 text-indigo-600" /> Fournitures Scolaires
        </button>
      </div>

      {/* Contenu principal selon statut */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <div className="flex justify-center mb-2"><SpinnerIcon className="w-8 h-8 text-indigo-600 animate-spin" /></div>
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

          {activeTab === "supplies" && (
            <SuppliesSettingsTab />
          )}
        </>
      )}
    </div>
  );
};

