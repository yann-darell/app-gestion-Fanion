import React, { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import {
  studentSchema,
  StudentFormData,
  StudentRecord,
  ClassRecord,
  createStudent,
  updateStudent,
  getStudentPhotoUrl,
} from "@fanion/shared";
import { Modal } from "../../../components/ui/Modal";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";

/* ── Inline Zod Resolver ── */
const zodResolver = (schema: typeof studentSchema) => (values: any) => {
  const result = schema.safeParse({
    ...values,
    is_repeating: values.is_repeating === "1" || values.is_repeating === true,
  });

  if (result.success) return { values: result.data, errors: {} };

  const errors = result.error.issues.reduce((acc: any, issue: any) => {
    const path = issue.path[0];
    acc[path] = { type: issue.code, message: issue.message };
    return acc;
  }, {});
  return { values: {}, errors };
};

interface NewStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editingStudent?: StudentRecord | null;
  classes: ClassRecord[];
}

export const NewStudentModal: React.FC<NewStudentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingStudent = null,
  classes,
}) => {
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
  });

  useEffect(() => {
    if (!isOpen) return;

    setFormError(null);
    setSelectedFile(null);

    if (editingStudent) {
      reset({
        first_name: editingStudent.first_name,
        last_name: editingStudent.last_name,
        birth_date: editingStudent.birth_date,
        birth_place: editingStudent.birth_place || "",
        nationality: editingStudent.nationality || "",
        gender: editingStudent.gender,
        is_repeating: editingStudent.is_repeating,
        class_id: editingStudent.class_id,
        guardian_name: editingStudent.guardian_name,
        guardian_phone: editingStudent.guardian_phone,
        status: editingStudent.status,
        matricule: editingStudent.matricule,
      });

      if (editingStudent.photo_path) {
        getStudentPhotoUrl(editingStudent.photo_path).then(setPhotoPreview);
      } else {
        setPhotoPreview(null);
      }
    } else {
      reset({
        first_name: "",
        last_name: "",
        birth_date: "",
        birth_place: "",
        nationality: "",
        gender: "M",
        is_repeating: false,
        class_id: classes[0]?.id || "",
        guardian_name: "",
        guardian_phone: "",
        status: "active",
        matricule: "",
      });
      setPhotoPreview(null);
    }
  }, [isOpen, editingStudent, reset, classes]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setSelectedFile(null);
    setPhotoPreview(null);
  };

  const handleFormSubmit = async (data: StudentFormData) => {
    setFormError(null);
    try {
      if (editingStudent) {
        await updateStudent(editingStudent.id, data, selectedFile || undefined);
      } else {
        await createStudent(data, selectedFile || undefined);
      }
      onSave();
      onClose();
    } catch (err: any) {
      console.error("Erreur enregistrement élève:", err);
      setFormError(err.message || "Impossible d'enregistrer la fiche élève.");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingStudent ? "Modifier la fiche élève" : "Inscrire un nouvel élève"}
      size="md"
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-4">
        {formError && (
          <div className="p-3 bg-signal-red/10 border border-signal-red/20 text-signal-red rounded text-xs font-medium font-sans">
            {formError}
          </div>
        )}

        {/* Photo section */}
        <div className="flex flex-col items-center gap-3 py-2 border-b border-line pb-4">
          <span className="font-sans text-xs font-semibold text-slate uppercase tracking-wider self-start">
            Photo de profil
          </span>
          <div className="flex items-center gap-4 w-full">
            <div className="relative">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Aperçu"
                  className="w-16 h-16 rounded-full object-cover border border-line"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-paper-dark text-slate flex items-center justify-center text-lg font-bold border border-line">
                  ?
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 py-1 px-3 text-xs"
              >
                Choisir une photo
              </Button>
              {photoPreview && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="text-[11px] text-signal-red hover:underline text-left font-medium"
                >
                  Supprimer la photo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Nom & Prénom */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Nom de famille *"
            placeholder="Ex: NOUBI"
            error={errors.last_name?.message}
            {...register("last_name")}
          />
          <Input
            label="Prénom *"
            placeholder="Ex: Yann"
            error={errors.first_name?.message}
            {...register("first_name")}
          />
        </div>

        {/* Date & Lieu de naissance */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Date de naissance *"
            type="date"
            error={errors.birth_date?.message}
            {...register("birth_date")}
          />
          <Input
            label="Lieu de naissance"
            placeholder="Ex: Douala"
            error={errors.birth_place?.message}
            {...register("birth_place")}
          />
        </div>

        {/* Genre & Nationalité */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5 w-full">
            <label className="font-sans text-xs font-semibold text-slate uppercase tracking-wider">
              Genre *
            </label>
            <select
              className="w-full px-3 py-2 border border-line rounded font-sans transition-colors duration-150 focus:outline-none focus:border-ink h-10 bg-white text-sm"
              {...register("gender")}
            >
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
            {errors.gender && (
              <span className="font-sans text-xs text-signal-red font-medium">
                {errors.gender.message}
              </span>
            )}
          </div>
          <Input
            label="Nationalité"
            placeholder="Ex: Camerounaise"
            error={errors.nationality?.message}
            {...register("nationality")}
          />
        </div>

        {/* Classe & Redoublant */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5 w-full">
            <label className="font-sans text-xs font-semibold text-slate uppercase tracking-wider">
              Classe affectée *
            </label>
            <select
              className="w-full px-3 py-2 border border-line rounded font-sans transition-colors duration-150 focus:outline-none focus:border-ink h-10 bg-white text-sm"
              {...register("class_id")}
            >
              <option value="">Sélectionner une classe</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} ({cls.level})
                </option>
              ))}
            </select>
            {errors.class_id && (
              <span className="font-sans text-xs text-signal-red font-medium">
                {errors.class_id.message}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5 w-full">
            <label className="font-sans text-xs font-semibold text-slate uppercase tracking-wider">
              Statut Redoublant *
            </label>
            <select
              className="w-full px-3 py-2 border border-line rounded font-sans transition-colors duration-150 focus:outline-none focus:border-ink h-10 bg-white text-sm"
              {...register("is_repeating")}
            >
              <option value="false">Non-redoublant</option>
              <option value="true">Redoublant</option>
            </select>
          </div>
        </div>

        {/* Tuteur & Téléphone */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Parent / Tuteur *"
            placeholder="Nom complet"
            error={errors.guardian_name?.message}
            {...register("guardian_name")}
          />
          <Input
            label="Téléphone tuteur *"
            placeholder="Ex: 699001122"
            error={errors.guardian_phone?.message}
            {...register("guardian_phone")}
          />
        </div>

        {/* Matricule optionnel */}
        <Input
          label="Matricule (Optionnel)"
          placeholder="Généré automatiquement si laissé vide"
          error={errors.matricule?.message}
          {...register("matricule")}
        />

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 mt-4 border-t border-line pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            {editingStudent ? "Enregistrer" : "Inscrire l'élève"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default NewStudentModal;
