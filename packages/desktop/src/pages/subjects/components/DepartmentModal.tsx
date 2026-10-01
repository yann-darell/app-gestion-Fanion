import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  DepartmentRecord,
  DepartmentInput,
  createDepartment,
  updateDepartment,
  listUsers,
  UserProfile,
} from "@fanion/shared";

interface DepartmentFormData {
  name: string;
  head_teacher_id: string;
}

interface DepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editingDepartment?: DepartmentRecord | null;
}

export const DepartmentModal: React.FC<DepartmentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingDepartment = null,
}) => {
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DepartmentFormData>({
    defaultValues: {
      name: "",
      head_teacher_id: "",
    },
  });

  useEffect(() => {
    if (!isOpen) return;

    async function loadData() {
      setLoading(true);
      setLoadError(null);
      try {
        const users = await listUsers("enseignant");
        setTeachers(users);

        if (editingDepartment) {
          reset({
            name: editingDepartment.name,
            head_teacher_id: editingDepartment.head_teacher_id || "",
          });
        } else {
          reset({
            name: "",
            head_teacher_id: "",
          });
        }
      } catch (err: any) {
        console.error("Erreur chargement enseignants:", err);
        setLoadError("Impossible de charger la liste des enseignants.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [isOpen, editingDepartment, reset]);

  const handleFormSubmit = async (data: DepartmentFormData) => {
    try {
      const payload: DepartmentInput = {
        name: data.name.trim(),
        head_teacher_id: data.head_teacher_id || null,
      };

      if (editingDepartment) {
        await updateDepartment(editingDepartment.id, payload);
      } else {
        await createDepartment(payload);
      }
      onSave();
      onClose();
    } catch (err: any) {
      console.error("Erreur sauvegarde département:", err);
      alert(`Erreur : ${err.message || "Impossible d'enregistrer le département."}`);
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

      {/* Modal Card */}
      <div
        className="relative bg-white w-full md:max-w-[480px] md:rounded shadow-lg border-t md:border border-line flex flex-col z-10 max-h-[90vh] rounded-t-xl"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
            <h3 className="text-lg font-semibold font-display text-ink">
              {editingDepartment ? "Modifier le département" : "Nouveau département (Collège)"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate hover:text-ink transition p-1 rounded hover:bg-paper"
            aria-label="Fermer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
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
              Chargement des enseignants…
            </div>
          ) : (
            <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-4">
              {/* Nom du département */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Nom du département</label>
                <input
                  className={inputCls(!!errors.name)}
                  placeholder="Ex : Langue Française, Sciences Sportives…"
                  {...register("name", { required: "Le nom est obligatoire" })}
                />
                {errors.name && (
                  <span className="text-xs text-signal-red font-medium">
                    {errors.name.message}
                  </span>
                )}
              </div>

              {/* Chef de département */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Chef de département (Enseignant assigné)</label>
                <select
                  className={inputCls(false)}
                  {...register("head_teacher_id")}
                >
                  <option value="">-- Aucun chef assigné --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} ({t.email || "Sans email"})
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate">
                  Sélectionné parmi les enseignants actifs. Le chef coordonne les matières du département.
                </span>
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
                  {isSubmitting ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
