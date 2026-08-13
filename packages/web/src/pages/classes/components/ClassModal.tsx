import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  classSchema,
  ClassFormData,
  ClassRecord,
  SchoolYearRecord,
  DivisionRecord,
  getActiveSchoolYear,
  listDivisions,
  supabase,
} from "@fanion/shared";

/* ── Inline Zod resolver (no @hookform/resolvers needed) ── */
const zodResolver =
  (schema: typeof classSchema) => (values: any) => {
    const result = schema.safeParse({
      ...values,
      head_teacher_name: values.head_teacher_name || null,
    });

    if (result.success) return { values: result.data, errors: {} };

    const errors = result.error.issues.reduce((acc: any, issue: any) => {
      const path = issue.path[0];
      acc[path] = { type: issue.code, message: issue.message };
      return acc;
    }, {});
    return { values: {}, errors };
  };

/* ── Props ── */
interface ClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editingClass?: ClassRecord | null;
}

export const ClassModal: React.FC<ClassModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingClass = null,
}) => {
  const [schoolYears, setSchoolYears] = useState<SchoolYearRecord[]>([]);
  const [divisions, setDivisions] = useState<DivisionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      name: "",
      level: "",
      division_id: "",
      school_year_id: "",
      head_teacher_name: "",
    },
  });

  /* ── Load metadata on open ── */
  useEffect(() => {
    if (!isOpen) return;

    async function loadFormMetadata() {
      setLoading(true);
      setLoadError(null);
      try {
        const divs = await listDivisions();
        setDivisions(divs);

        const { data: syData, error: syErr } = await supabase
          .from("school_years")
          .select("*")
          .order("start_date", { ascending: false });
        if (syErr) throw syErr;
        setSchoolYears(syData || []);

        if (editingClass) {
          reset({
            name: editingClass.name,
            level: editingClass.level,
            division_id: editingClass.division_id,
            school_year_id: editingClass.school_year_id,
            head_teacher_name: editingClass.head_teacher_name || "",
          });
        } else {
          reset({
            name: "",
            level: "",
            division_id: divs.length > 0 ? divs[0].id : "",
            school_year_id: "",
            head_teacher_name: "",
          });

          const activeSy = await getActiveSchoolYear();
          if (activeSy) {
            setValue("school_year_id", activeSy.id);
          } else if (syData && syData.length > 0) {
            const active = syData.find((sy) => sy.is_active);
            setValue("school_year_id", active ? active.id : syData[0].id);
          }
        }
      } catch (err: any) {
        console.error("Erreur chargement métadonnées formulaire:", err);
        setLoadError("Impossible de charger les données du formulaire.");
      } finally {
        setLoading(false);
      }
    }

    loadFormMetadata();
  }, [isOpen, editingClass, reset, setValue]);

  /* ── Submit ── */
  const handleFormSubmit = async (data: ClassFormData) => {
    try {
      if (editingClass) {
        const { error } = await supabase
          .from("classes")
          .update({
            name: data.name,
            level: data.level,
            division_id: data.division_id,
            school_year_id: data.school_year_id,
            head_teacher_name: data.head_teacher_name || null,
          })
          .eq("id", editingClass.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("classes").insert({
          name: data.name,
          level: data.level,
          division_id: data.division_id,
          school_year_id: data.school_year_id,
          head_teacher_name: data.head_teacher_name || null,
        });
        if (error) throw error;
      }
      onSave();
      onClose();
    } catch (err: any) {
      console.error("Erreur sauvegarde classe:", err);
      alert(
        `Erreur : ${err.message || "Impossible d'enregistrer la classe."}`
      );
    }
  };

  if (!isOpen) return null;

  /* ── Field helper ── */
  const inputCls = (hasError: boolean) =>
    `w-full px-3 py-2 border rounded font-sans text-sm transition-colors duration-150 focus:outline-none focus:border-ink h-10 bg-white ${
      hasError ? "border-signal-red" : "border-line"
    }`;

  const labelCls =
    "font-sans text-xs font-semibold text-slate uppercase tracking-wider";

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/40"
        onClick={onClose}
      />

      {/* Panel – full-width bottom sheet on mobile, centered card on desktop */}
      <div
        className="relative bg-white w-full md:max-w-[480px] md:rounded shadow-lg border-t md:border border-line flex flex-col z-10 max-h-[90vh] rounded-t-xl md:rounded"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h3 className="text-lg font-semibold font-display text-ink">
            {editingClass ? "Modifier la classe" : "Créer une classe"}
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
            <form
              onSubmit={handleSubmit(handleFormSubmit)}
              className="flex flex-col gap-4"
            >
              {/* Nom */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Nom de la classe</label>
                <input
                  className={inputCls(!!errors.name)}
                  placeholder="Ex : 6ème A, CM2 B…"
                  {...register("name")}
                />
                {errors.name && (
                  <span className="text-xs text-signal-red font-medium">
                    {errors.name.message}
                  </span>
                )}
              </div>

              {/* Niveau */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Niveau</label>
                <input
                  className={inputCls(!!errors.level)}
                  placeholder="Ex : 6ème, CM2…"
                  {...register("level")}
                />
                {errors.level && (
                  <span className="text-xs text-signal-red font-medium">
                    {errors.level.message}
                  </span>
                )}
              </div>

              {/* Division */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Division</label>
                <select
                  className={inputCls(!!errors.division_id)}
                  {...register("division_id")}
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

              {/* Année scolaire */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Année scolaire</label>
                <select
                  className={inputCls(!!errors.school_year_id)}
                  {...register("school_year_id")}
                >
                  <option value="">Sélectionnez…</option>
                  {schoolYears.map((sy) => (
                    <option key={sy.id} value={sy.id}>
                      {sy.label} {sy.is_active ? "(Active)" : ""}
                    </option>
                  ))}
                </select>
                {errors.school_year_id && (
                  <span className="text-xs text-signal-red font-medium">
                    {errors.school_year_id.message}
                  </span>
                )}
              </div>

              {/* Prof. principal */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>
                  Professeur Principal{" "}
                  <span className="normal-case text-slate/60">(optionnel)</span>
                </label>
                <input
                  className={inputCls(false)}
                  placeholder="Nom de l'enseignant…"
                  {...register("head_teacher_name")}
                />
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

export default ClassModal;
