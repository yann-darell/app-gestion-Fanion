import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Modal } from "../../../components/ui/Modal";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { 
  classSchema, 
  ClassFormData, 
  ClassRecord, 
  SchoolYearRecord, 
  DivisionRecord,
  getActiveSchoolYear,
  listDivisions,
  supabase
} from "@fanion/shared";

// Custom inline Zod resolver for react-hook-form
const zodResolver = (schema: typeof classSchema) => (values: any) => {
  const result = schema.safeParse({
    ...values,
    // head_teacher_name can be empty string in form but should be null in DB
    head_teacher_name: values.head_teacher_name || null,
  });
  
  if (result.success) {
    return { values: result.data, errors: {} };
  }
  
  const errors = result.error.issues.reduce((acc: any, issue: any) => {
    const path = issue.path[0];
    acc[path] = {
      type: issue.code,
      message: issue.message,
    };
    return acc;
  }, {});
  
  return { values: {}, errors };
};

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

  // Fetch school years and divisions on open
  useEffect(() => {
    if (!isOpen) return;

    async function loadFormMetadata() {
      setLoading(true);
      setLoadError(null);
      try {
        // Load divisions
        const divs = await listDivisions();
        setDivisions(divs);

        // Load all school years (so user can view or assign past/future if needed, but active is default)
        const { data: syData, error: syErr } = await supabase
          .from("school_years")
          .select("*")
          .order("start_date", { ascending: false });

        if (syErr) throw syErr;
        setSchoolYears(syData || []);

        if (editingClass) {
          // Prepopulate form if editing
          reset({
            name: editingClass.name,
            level: editingClass.level,
            division_id: editingClass.division_id,
            school_year_id: editingClass.school_year_id,
            head_teacher_name: editingClass.head_teacher_name || "",
          });
        } else {
          // Reset form
          reset({
            name: "",
            level: "",
            division_id: divs.length > 0 ? divs[0].id : "",
            school_year_id: "",
            head_teacher_name: "",
          });

          // Pre-select active school year
          const activeSy = await getActiveSchoolYear();
          if (activeSy) {
            setValue("school_year_id", activeSy.id);
          } else if (syData && syData.length > 0) {
            // Fallback to most recent
            const active = syData.find(sy => sy.is_active);
            setValue("school_year_id", active ? active.id : syData[0].id);
          }
        }
      } catch (err: any) {
        console.error("Erreur lors du chargement des métadonnées du formulaire:", err);
        setLoadError("Impossible de charger les années scolaires ou divisions.");
      } finally {
        setLoading(false);
      }
    }

    loadFormMetadata();
  }, [isOpen, editingClass, reset, setValue]);

  const handleFormSubmit = async (data: ClassFormData) => {
    try {
      if (editingClass) {
        // Update class
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
        // Create class
        const { error } = await supabase
          .from("classes")
          .insert({
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
      console.error("Erreur de sauvegarde de la classe:", err);
      alert(`Erreur : ${err.message || "Une erreur est survenue lors de l'enregistrement."}`);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingClass ? "Modifier la classe" : "Créer une classe"}
      size="sm"
    >
      {loadError && (
        <div className="mb-4 p-3 bg-signal-red/10 border border-signal-red/20 rounded text-xs text-signal-red font-medium">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="py-8 flex items-center justify-center text-slate text-sm font-medium">
          Chargement des données...
        </div>
      ) : (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-4">
          <Input
            label="Nom de la classe"
            placeholder="Ex : 6ème A, CM2 B..."
            error={errors.name?.message}
            {...register("name")}
          />

          <Input
            label="Niveau"
            placeholder="Ex : 6ème, CM2..."
            error={errors.level?.message}
            {...register("level")}
          />

          <div className="w-full flex flex-col gap-1.5">
            <label className="font-sans text-xs font-semibold text-slate uppercase tracking-wider">
              Division
            </label>
            <select
              className="w-full px-3 py-2 border border-line rounded font-sans transition-colors duration-150 focus:outline-none focus:border-ink h-10 bg-white"
              {...register("division_id")}
            >
              {divisions.map((div) => (
                <option key={div.id} value={div.id}>
                  {div.nom}
                </option>
              ))}
            </select>
            {errors.division_id && (
              <span className="font-sans text-xs text-signal-red font-medium">
                {errors.division_id.message}
              </span>
            )}
          </div>

          <div className="w-full flex flex-col gap-1.5">
            <label className="font-sans text-xs font-semibold text-slate uppercase tracking-wider">
              Année scolaire
            </label>
            <select
              className="w-full px-3 py-2 border border-line rounded font-sans transition-colors duration-150 focus:outline-none focus:border-ink h-10 bg-white"
              {...register("school_year_id")}
            >
              <option value="">Sélectionnez une année...</option>
              {schoolYears.map((sy) => (
                <option key={sy.id} value={sy.id}>
                  {sy.label} {sy.is_active ? "(Active)" : ""}
                </option>
              ))}
            </select>
            {errors.school_year_id && (
              <span className="font-sans text-xs text-signal-red font-medium">
                {errors.school_year_id.message}
              </span>
            )}
          </div>

          <Input
            label="Professeur Principal (Optionnel)"
            placeholder="Nom de l'enseignant..."
            error={errors.head_teacher_name?.message}
            {...register("head_teacher_name")}
          />

          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-line">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Enregistrer
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
