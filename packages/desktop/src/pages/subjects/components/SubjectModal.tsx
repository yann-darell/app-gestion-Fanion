import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Modal } from "../../../components/ui/Modal";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import {
  SubjectRecord,
  listDivisions,
  DivisionRecord,
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

  // Fetch divisions on open
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
        console.error("Erreur lors du chargement des divisions:", err);
        setLoadError("Impossible de charger les divisions.");
      } finally {
        setLoading(false);
      }
    }

    loadFormMetadata();
  }, [isOpen, editingSubject, reset, defaultDivision]);

  const handleFormSubmit = async (data: SubjectFormData) => {
    try {
      if (editingSubject) {
        // Update subject
        const { error } = await supabase
          .from("subjects")
          .update({
            name: data.name.trim(),
            division_id: data.division_id,
          })
          .eq("id", editingSubject.id);

        if (error) throw error;
      } else {
        // Create subject
        const { error } = await supabase
          .from("subjects")
          .insert({
            name: data.name.trim(),
            division_id: data.division_id,
          });

        if (error) throw error;
      }
      onSave();
      onClose();
    } catch (err: any) {
      console.error("Erreur de sauvegarde de la matière:", err);
      alert(`Erreur : ${err.message || "Une erreur est survenue lors de l'enregistrement."}`);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingSubject ? "Modifier la matière" : "Créer une matière"}
      size="sm"
    >
      {loadError && (
        <div className="mb-4 p-3 bg-signal-red/10 border border-signal-red/20 rounded text-xs text-signal-red font-medium">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="py-8 flex items-center justify-center text-slate text-sm font-medium">
          Chargement des divisions...
        </div>
      ) : (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-4">
          <Input
            label="Nom de la matière"
            placeholder="Ex : Anglais, Mathématiques..."
            error={errors.name?.message}
            required
            {...register("name", { required: "Le nom est obligatoire" })}
          />

          <div className="w-full flex flex-col gap-1.5">
            <label className="font-sans text-xs font-semibold text-slate uppercase tracking-wider">
              Division
            </label>
            <select
              className="w-full px-3 py-2 border border-line rounded font-sans transition-colors duration-150 focus:outline-none focus:border-ink h-10 bg-white"
              {...register("division_id", { required: "La division est obligatoire" })}
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
