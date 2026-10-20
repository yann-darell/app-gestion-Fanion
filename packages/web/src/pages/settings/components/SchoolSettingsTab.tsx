import { SchoolIcon, SaveIcon, CheckCircleIcon } from "../../../components/ui/Icons";
import React, { useState } from "react";
import { 
  SchoolSettings, 
  updateSchoolSettings, 
  LOGO_FANION_BASE64, 
  LOGO_PRIMAIRE_BASE64 
} from "@fanion/shared";

interface SchoolSettingsTabProps {
  settings: SchoolSettings;
  onRefresh: () => void;
}

export const SchoolSettingsTab: React.FC<SchoolSettingsTabProps> = ({ settings, onRefresh }) => {
  const [formData, setFormData] = useState<SchoolSettings>({
    name: settings.name || "Collège Bilingue Le Fanion",
    director_name: settings.director_name || "Le Principal",
    legal_notice: settings.legal_notice || "Établissement d'Enseignement Général et Bilingue",
    primary_name: settings.primary_name || "École Primaire Le Fanion",
    primary_director_name: settings.primary_director_name || "La Directrice",
    primary_legal_notice: settings.primary_legal_notice || "Enseignement Primaire et Maternel - Système APC",
    address: settings.address || "Yaoundé, Cameroun",
    city: settings.city || "Yaoundé",
    phone: settings.phone || "+237 600 00 00 00",
    logo_url: settings.logo_url || "",
    watermark_url: settings.watermark_url || "",
  });

  const [showAdvancedUrls, setShowAdvancedUrls] = useState(false);
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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <SchoolIcon className="w-5 h-5 text-indigo-700" /> Identité de l'Établissement (Collège &amp; Primaire)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Configurez les informations officielles qui s'affichent sur les bulletins de notes, reçus de paiement et attestations.
          </p>
        </div>
      </div>

      {toast && (
        <div
          className={`p-4 rounded-lg text-sm font-medium ${
            toast.type === "success" 
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          {toast.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* SECTION 1 : ENSEIGNEMENT SECONDAIRE / COLLÈGE */}
        <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
              Section Secondaire / Collège
            </h3>
            <span className="text-xs text-slate-500 font-normal">
              (Utilisé sur les bulletins du collège)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Nom officiel du Collège *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white font-medium"
                placeholder="ex: Collège Polyvalent Bilingue Le Fanion"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Responsable / Titre de la Direction *
              </label>
              <input
                type="text"
                required
                value={formData.director_name}
                onChange={(e) => setFormData({ ...formData, director_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white"
                placeholder="ex: Le Principal"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Mention légale / Pied de page (Collège) *
              </label>
              <input
                type="text"
                required
                value={formData.legal_notice}
                onChange={(e) => setFormData({ ...formData, legal_notice: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white"
                placeholder="ex: Établissement d'Enseignement Général et Bilingue - Arrêté N°..."
              />
            </div>
          </div>
        </div>

        {/* SECTION 2 : SECTION PRIMAIRE & MATERNELLE */}
        <div className="bg-emerald-50/40 border border-emerald-200/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-emerald-200 pb-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
              Section Primaire &amp; Maternelle (Système APC)
            </h3>
            <span className="text-xs text-emerald-800 font-semibold bg-emerald-100 px-2 py-0.5 rounded-full">
              Utilisé sur les bulletins primaires
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Nom officiel de l'École Primaire *
              </label>
              <input
                type="text"
                required
                value={formData.primary_name || ""}
                onChange={(e) => setFormData({ ...formData, primary_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm bg-white font-medium"
                placeholder="ex: École Primaire Bilingue Le Fanion"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Ce nom remplacera le nom du collège en en-tête des bulletins de notes APC du primaire.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Nom ou Titre du Directeur / Directrice du Primaire *
              </label>
              <input
                type="text"
                required
                value={formData.primary_director_name || ""}
                onChange={(e) => setFormData({ ...formData, primary_director_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm bg-white"
                placeholder="ex: La Directrice"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Utilisé pour le bloc signature au bas du bulletin primaire.
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Mention légale / Arrêté du Primaire
              </label>
              <input
                type="text"
                value={formData.primary_legal_notice || ""}
                onChange={(e) => setFormData({ ...formData, primary_legal_notice: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm bg-white"
                placeholder="ex: Enseignement Primaire et Maternel - Système APC"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3 : COORDONNÉES COMMUNES */}
        <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
              Coordonnées de l'Établissement
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Ville (bulletins &amp; reçus) *
              </label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white"
                placeholder="ex: Yaoundé"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Téléphone de contact *
              </label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white"
                placeholder="ex: +237 600 00 00 00"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase">
                Adresse physique *
              </label>
              <input
                type="text"
                required
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white"
                placeholder="ex: BP 1234, Yaoundé, Cameroun"
              />
            </div>
          </div>
        </div>

        {/* SECTION 4 : LOGOS & VISUELS INTÉGRÉS DANS L'APPLICATION */}
        <div className="bg-paper-dark border border-line rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-ink uppercase tracking-wide">
                Logos et Filigranes Officiels Intégrés
              </h3>
            </div>
            <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
              Automatique &amp; Haute Résolution
            </span>
          </div>

          <p className="text-xs text-slate leading-relaxed">
            Les logos officiels de l'établissement sont déjà intégrés directement dans le code source de l'application en haute définition. Ils sont automatiquement appliqués sur tous vos bulletins (Collège et Primaire), reçus de paiement et attestations scolaires, sans nécessiter d'hébergement externe ni d'URL d'image.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Logo Collège */}
            <div className="p-3 bg-white rounded-lg border border-line flex items-center gap-3 shadow-xs">
              <div className="w-14 h-14 bg-slate-50 border border-slate-200 rounded flex items-center justify-center p-1 flex-shrink-0">
                <img src={LOGO_FANION_BASE64} alt="Logo Collège" className="max-h-full max-w-full object-contain" />
              </div>
              <div>
                <p className="text-xs font-bold text-ink">Logo Officiel Collège</p>
                <p className="text-[11px] text-slate">Intégré pour les bulletins et reçus du secondaire.</p>
              </div>
            </div>

            {/* Logo Primaire */}
            <div className="p-3 bg-white rounded-lg border border-line flex items-center gap-3 shadow-xs">
              <div className="w-14 h-14 bg-slate-50 border border-slate-200 rounded flex items-center justify-center p-1 flex-shrink-0">
                <img src={LOGO_PRIMAIRE_BASE64} alt="Logo Primaire" className="max-h-full max-w-full object-contain" />
              </div>
              <div>
                <p className="text-xs font-bold text-ink">Logo Officiel Primaire</p>
                <p className="text-[11px] text-slate">Intégré pour les bulletins APC et dossiers primaires.</p>
              </div>
            </div>
          </div>

          {/* Option avancée dépliable si un jour l'admin veut forcer une autre URL */}
          <div className="pt-2 border-t border-line/60">
            <button
              type="button"
              onClick={() => setShowAdvancedUrls(!showAdvancedUrls)}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition"
            >
              <span>{showAdvancedUrls ? "▼ Masquer les options avancées d'URL" : "▶ Remplacer par des URLs d'images externes (Optionnel / Avancé)"}</span>
            </button>

            {showAdvancedUrls && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 p-3 bg-white rounded-lg border border-line animate-fadeIn">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    URL personnalisée du logo (facultatif)
                  </label>
                  <input
                    type="url"
                    value={formData.logo_url || ""}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs"
                    placeholder="https://..."
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Laissez vide pour conserver le logo intégré officiel.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    URL personnalisée du filigrane (facultatif)
                  </label>
                  <input
                    type="url"
                    value={formData.watermark_url || ""}
                    onChange={(e) => setFormData({ ...formData, watermark_url: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs"
                    placeholder="https://..."
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Laissez vide pour conserver le filigrane intégré officiel.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-200">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-2 transition"
          >
            {saving ? "Enregistrement..." : <><SaveIcon className="w-4 h-4" /> Enregistrer les paramètres</>}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SchoolSettingsTab;
