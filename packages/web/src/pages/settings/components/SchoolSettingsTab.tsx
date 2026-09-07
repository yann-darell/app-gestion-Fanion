import { SchoolIcon, SaveIcon } from "../../../components/ui/Icons";
import React, { useState } from "react";
import { SchoolSettings, updateSchoolSettings } from "@fanion/shared";

interface SchoolSettingsTabProps {
  settings: SchoolSettings;
  onRefresh: () => void;
}

export const SchoolSettingsTab: React.FC<SchoolSettingsTabProps> = ({ settings, onRefresh }) => {
  const [formData, setFormData] = useState<SchoolSettings>({
    name: settings.name || "",
    address: settings.address || "",
    phone: settings.phone || "",
    legal_notice: settings.legal_notice || "",
    logo_url: settings.logo_url || "",
    watermark_url: settings.watermark_url || "",
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setToast(null);

    try {
      await updateSchoolSettings(formData);
      setToast({ type: "success", message: "Paramètres de l'établissement enregistrés avec succès !" });
      onRefresh();
    } catch (err: any) {
      setToast({ type: "error", message: err.message || "Erreur lors de l'enregistrement." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
        <SchoolIcon className="w-5 h-5 text-indigo-700" /> Identité de l'Établissement
      </h2>

      {toast && (
        <div
          className={`mb-4 p-4 rounded-lg text-sm font-medium ${
            toast.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          {toast.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Nom officiel de l'établissement *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              placeholder="ex: Établissement Scolaire Le Fanion"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Téléphone de contact *
            </label>
            <input
              type="text"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              placeholder="ex: +237 600 00 00 00"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Adresse physique & Ville *
            </label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              placeholder="ex: BP 1234, Yaoundé, Cameroun"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Mention légale / Pied de page des bulletins *
            </label>
            <textarea
              rows={3}
              required
              value={formData.legal_notice}
              onChange={(e) => setFormData({ ...formData, legal_notice: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              placeholder="ex: Établissement d'Enseignement Général - Arrêté N°..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              URL du Logo de l'établissement
            </label>
            <input
              type="url"
              value={formData.logo_url || ""}
              onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              placeholder="https://..."
            />
            {formData.logo_url && (
              <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded-lg inline-block">
                <span className="text-xs text-slate-500 block mb-1">Aperçu du Logo :</span>
                <img src={formData.logo_url} alt="Logo preview" className="h-12 object-contain" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              URL du Filigrane (PDFs)
            </label>
            <input
              type="url"
              value={formData.watermark_url || ""}
              onChange={(e) => setFormData({ ...formData, watermark_url: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              placeholder="https://..."
            />
            {formData.watermark_url && (
              <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded-lg inline-block">
                <span className="text-xs text-slate-500 block mb-1">Aperçu du Filigrane :</span>
                <img src={formData.watermark_url} alt="Watermark preview" className="h-12 opacity-50 object-contain" />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-200">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? "Enregistrement..." : <><SaveIcon className="w-4 h-4" /> Enregistrer l'identité</>}
          </button>
        </div>
      </form>
    </div>
  );
};
