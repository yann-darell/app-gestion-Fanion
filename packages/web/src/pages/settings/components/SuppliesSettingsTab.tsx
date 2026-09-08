import React, { useEffect, useState } from "react";
import {
  listDivisions,
  listSchoolYears,
  getActiveSchoolYear,
  listSupplyRequirements,
  createSupplyRequirement,
  deleteSupplyRequirement,
  SupplyRequirement,
  DivisionRecord,
  SchoolYearRecord,
} from "@fanion/shared";
import {
  PackageIcon,
  TrashIcon,
  PlusIcon,
  SpinnerIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
} from "../../../components/ui/Icons";

export const SuppliesSettingsTab: React.FC = () => {
  const [divisions, setDivisions] = useState<DivisionRecord[]>([]);
  const [schoolYears, setSchoolYears] = useState<SchoolYearRecord[]>([]);
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>("");
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState<string>("");

  const [requirements, setRequirements] = useState<SupplyRequirement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Nouvel ajout
  const [newLabel, setNewLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 1. Charger divisions et années scolaires
  useEffect(() => {
    const init = async () => {
      try {
        const [divs, years, activeYear] = await Promise.all([
          listDivisions(),
          listSchoolYears(),
          getActiveSchoolYear(),
        ]);
        setDivisions(divs);
        setSchoolYears(years);

        if (divs.length > 0) {
          setSelectedDivisionId(divs[0].id);
        }
        if (activeYear) {
          setSelectedSchoolYearId(activeYear.id);
        } else if (years.length > 0) {
          setSelectedSchoolYearId(years[0].id);
        }
      } catch (err: any) {
        console.error("Erreur chargement divisions/années:", err);
        setError("Impossible de charger les divisions et années scolaires.");
      }
    };
    init();
  }, []);

  // 2. Charger les fournitures dès que division ou année change
  const fetchRequirements = async (divisionId: string, schoolYearId: string) => {
    if (!divisionId || !schoolYearId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listSupplyRequirements(divisionId, schoolYearId);
      setRequirements(data);
    } catch (err: any) {
      console.error("Erreur listSupplyRequirements:", err);
      setError(err.message || "Erreur lors du chargement des fournitures.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDivisionId && selectedSchoolYearId) {
      fetchRequirements(selectedDivisionId, selectedSchoolYearId);
    }
  }, [selectedDivisionId, selectedSchoolYearId]);

  // Ajouter une fourniture
  const handleAddRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    if (!selectedDivisionId || !selectedSchoolYearId) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await createSupplyRequirement(selectedDivisionId, selectedSchoolYearId, newLabel.trim());
      setNewLabel("");
      setSuccess("Fourniture requise ajoutée avec succès.");
      setTimeout(() => setSuccess(null), 3000);
      await fetchRequirements(selectedDivisionId, selectedSchoolYearId);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'ajout de la fourniture.");
    } finally {
      setSubmitting(false);
    }
  };

  // Supprimer une fourniture
  const handleDeleteRequirement = async (req: SupplyRequirement) => {
    const confirmed = window.confirm(
      `Voulez-vous vraiment supprimer "${req.label}" ? Cela supprimera également le suivi pour tous les élèves de cette division.`
    );
    if (!confirmed) return;

    setDeletingId(req.id);
    setError(null);
    try {
      await deleteSupplyRequirement(req.id);
      setSuccess(`"${req.label}" supprimée.`);
      setTimeout(() => setSuccess(null), 3000);
      await fetchRequirements(selectedDivisionId, selectedSchoolYearId);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la suppression.");
    } finally {
      setDeletingId(null);
    }
  };

  const selectedDivision = divisions.find((d) => d.id === selectedDivisionId);

  return (
    <div className="space-y-6">
      {/* Alertes info */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm font-medium">
          <AlertTriangleIcon className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium">
          <CheckCircleIcon className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Carte Filtres Division & Année */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <PackageIcon className="w-5 h-5 text-indigo-600" />
              Configuration de la Liste des Fournitures
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Définissez les articles exigés pour les élèves selon leur division et l'année scolaire.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Division */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">Division :</label>
              <select
                value={selectedDivisionId}
                onChange={(e) => setSelectedDivisionId(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nom}
                  </option>
                ))}
              </select>
            </div>

            {/* Année Scolaire */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">Année :</label>
              <select
                value={selectedSchoolYearId}
                onChange={(e) => setSelectedSchoolYearId(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {schoolYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label} {y.is_active ? "(En cours)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Formulaire d'ajout rapide */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">
          Ajouter un article demandé ({selectedDivision?.nom || "Division"}):
        </h3>
        <form onSubmit={handleAddRequirement} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Ex : Rame de papier A4, Paquet de stylos bleus, Boîte de craie..."
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            disabled={submitting}
            className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50"
          />
          <button
            type="submit"
            disabled={submitting || !newLabel.trim()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            {submitting ? (
              <SpinnerIcon className="w-4 h-4 animate-spin" />
            ) : (
              <PlusIcon className="w-4 h-4" />
            )}
            <span>Ajouter l'article</span>
          </button>
        </form>
      </div>

      {/* Liste des fournitures configurées */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Articles configurés ({requirements.length})
          </span>
          <span className="text-xs text-slate-500">
            Division : <strong className="text-slate-800">{selectedDivision?.nom || "—"}</strong>
          </span>
        </div>

        {loading ? (
          <div className="p-10 text-center">
            <div className="flex justify-center mb-2">
              <SpinnerIcon className="w-6 h-6 text-indigo-600 animate-spin" />
            </div>
            <p className="text-xs text-slate-500">Chargement des articles...</p>
          </div>
        ) : requirements.length === 0 ? (
          <div className="p-8 text-center">
            <PackageIcon className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">
              Aucune fourniture configurée pour cette sélection
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Utilisez le formulaire ci-dessus pour ajouter les fournitures demandées aux élèves du{" "}
              {selectedDivision?.nom}.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {requirements.map((req, index) => (
              <div
                key={req.id}
                className="flex items-center justify-between p-4 hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-100">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium text-slate-800">{req.label}</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteRequirement(req)}
                  disabled={deletingId === req.id}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  title="Supprimer cette fourniture"
                >
                  {deletingId === req.id ? (
                    <SpinnerIcon className="w-4 h-4 text-rose-600 animate-spin" />
                  ) : (
                    <TrashIcon className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
