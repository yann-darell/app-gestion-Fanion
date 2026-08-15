import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  SubjectRecord,
  DivisionRecord,
  listDivisions,
  supabase,
} from "@fanion/shared";

interface SubjectFormData {
  name: string;
  division_id: string;
}

interface SubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editingSubject?: SubjectRecord | null;
  defaultDivision?: string;
}

export const SubjectModal: React.FC<SubjectModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingSubject = null,
  defaultDivision = "college",
}) => {
  const [divisions, setDivisions] = useState<DivisionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SubjectFormData>({
    defaultValues: {
      name: "",
      division_id: defaultDivision,
    },
  });

  /* Load divisions and editing subject data */
  useEffect(() => {
    if (!isOpen) return;

    async function loadFormMetadata() {
      setLoading(true);
      setLoadError(null);
      try {
        const divs = await listDivisions();
        setDivisions(divs);

        if (editingSubject) {
          reset({
            name: editingSubject.name,
            division_id: editingSubject.division_id,
          });
        } else {
          reset({
            name: "",
            division_id: defaultDivision,
          });
        }
      } catch (err: any) {
        console.error("Erreur chargement divisions:", err);
        setLoadError("Impossible de charger les divisions.");
      } finally {
        setLoading(false);
      }
    }

    loadFormMetadata();
  }, [isOpen, editingSubject, reset, defaultDivision]);

  /* Form submission */
  const handleFormSubmit = async (data: SubjectFormData) => {
    try {
      if (editingSubject) {
        const { error } = await supabase
          .from("subjects")
          .update({
            name: data.name.trim(),
            division_id: data.division_id,
          })
          .eq("id", editingSubject.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("subjects").insert({
          name: data.name.trim(),
          division_id: data.division_id,
        });
        if (error) throw error;
      }
      onSave();
      onClose();
    } catch (err: any) {
      console.error("Erreur sauvegarde matière:", err);
      alert(`Erreur : ${err.message || "Impossible d'enregistrer la matière."}`);
    }
  };

  if (!isOpen) return null;

  const inputCls = (hasError: boolean) =>
    `w-full px-3 py-2 border rounded font-sans text-sm transition-colors duration-150 focus:outline-none focus:border-ink h-10 bg-white ${
      hasError ? "border-signal-red" : "border-line"
    }`;

  const labelCls =
    "font-sans text-xs font-semibold text-slate uppercase tracking-wider";

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-ink/40" onClick={onClose} />

      {/* Panel */}
      <div
        className="relative bg-white w-full md:max-w-[480px] md:rounded shadow-lg border-t md:border border-line flex flex-col z-10 max-h-[90vh] rounded-t-xl md:rounded"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h3 className="text-lg font-semibold font-display text-ink">
            {editingSubject ? "Modifier la matière" : "Créer une matière"}
          </h3>
          <button
            onClick={onClose}
            className="text-slate hover:text-ink transition p-1 rounded hover:bg-paper"
            aria-label="Fermer"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 overflow-y-auto flex-1">
          {loadError && (
            <div className="mb-4 p-3 bg-signal-red/10 border border-signal-red/20 rounded text-xs text-signal-red font-medium">
              {loadError}
            </div>
          )}

          {loading ? (
            <div className="py-8 flex items-center justify-center text-slate text-sm font-medium">
              Chargement…
            </div>
          ) : (
            <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-4">
              {/* Nom */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Nom de la matière</label>
                <input
                  className={inputCls(!!errors.name)}
                  placeholder="Ex : Anglais, Mathématiques…"
                  {...register("name", { required: "Le nom est obligatoire" })}
                />
                {errors.name && (
                  <span className="text-xs text-signal-red font-medium">
                    {errors.name.message}
                  </span>
                )}
              </div>

              {/* Division */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Division</label>
                <select
                  className={inputCls(!!errors.division_id)}
                  {...register("division_id", { required: "La division est obligatoire" })}
                >
                  {divisions.map((div) => (
                    <option key={div.id} value={div.id}>
                      {div.nom}
                    </option>
                  ))}
                </select>
                {errors.division_id && (
                  <span className="text-xs text-signal-red font-medium">
                    {errors.division_id.message}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-line text-slate rounded text-sm font-medium hover:bg-paper transition disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-ink text-white rounded text-sm font-semibold hover:bg-opacity-90 transition disabled:opacity-50"
                >
                  {isSubmitting ? "En cours…" : "Enregistrer"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
