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

/* ── Inline Zod Resolver ── */
const zodResolver = (schema: typeof studentSchema) => (values: any) => {
  const result = schema.safeParse({
    ...values,
    is_repeating: values.is_repeating === "true" || values.is_repeating === true,
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

  if (!isOpen) return null;

  const inputCls = (hasError: boolean) =>
    `w-full px-3 py-2 border rounded font-sans text-sm transition duration-150 focus:outline-none focus:border-ink h-10 bg-white ${
      hasError ? "border-signal-red" : "border-line"
    }`;

  const labelCls =
    "font-sans text-xs font-semibold text-slate uppercase tracking-wider";

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="fixed inset-0 bg-ink/40" onClick={onClose} />

      <div
        className="relative bg-white w-full md:max-w-xl md:rounded shadow-lg border-t md:border border-line flex flex-col z-10 max-h-[92vh] rounded-t-xl md:rounded"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line flex-shrink-0">
          <h3 className="text-lg font-semibold font-display text-ink">
            {editingStudent ? "Modifier la fiche élève" : "Inscrire un nouvel élève"}
          </h3>
          <button
            onClick={onClose}
            className="text-slate hover:text-ink transition p-1 rounded hover:bg-paper"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 overflow-y-auto flex-1">
          {formError && (
            <div className="mb-4 p-3 bg-signal-red/10 border border-signal-red/20 rounded text-xs text-signal-red font-medium">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-4">
            {/* Photo */}
            <div className="flex flex-col items-center gap-3 py-2 border-b border-line pb-4">
              <span className={labelCls + " self-start"}>Photo de profil</span>
              <div className="flex items-center gap-4 w-full">
                <div className="relative flex-shrink-0">
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
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 border border-line text-ink rounded text-xs font-medium hover:bg-paper transition"
                  >
                    Choisir une photo
                  </button>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Nom de famille *</label>
                <input className={inputCls(!!errors.last_name)} placeholder="Ex: NOUBI" {...register("last_name")} />
                {errors.last_name && <span className="text-xs text-signal-red">{errors.last_name.message}</span>}
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Prénom *</label>
                <input className={inputCls(!!errors.first_name)} placeholder="Ex: Yann" {...register("first_name")} />
                {errors.first_name && <span className="text-xs text-signal-red">{errors.first_name.message}</span>}
              </div>
            </div>

            {/* Date & Lieu de naissance */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Date de naissance *</label>
                <input type="date" className={inputCls(!!errors.birth_date)} {...register("birth_date")} />
                {errors.birth_date && <span className="text-xs text-signal-red">{errors.birth_date.message}</span>}
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Lieu de naissance</label>
                <input className={inputCls(false)} placeholder="Ex: Douala" {...register("birth_place")} />
              </div>
            </div>

            {/* Genre & Nationalité */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Genre *</label>
                <select className={inputCls(!!errors.gender)} {...register("gender")}>
                  <option value="M">Masculin</option>
                  <option value="F">Féminin</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Nationalité</label>
                <input className={inputCls(false)} placeholder="Ex: Camerounaise" {...register("nationality")} />
              </div>
            </div>

            {/* Classe & Redoublant */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Classe affectée *</label>
                <select className={inputCls(!!errors.class_id)} {...register("class_id")}>
                  <option value="">Sélectionner une classe</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} ({cls.level})
                    </option>
                  ))}
                </select>
                {errors.class_id && <span className="text-xs text-signal-red">{errors.class_id.message}</span>}
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Statut Redoublant *</label>
                <select className={inputCls(false)} {...register("is_repeating")}>
                  <option value="false">Non-redoublant</option>
                  <option value="true">Redoublant</option>
                </select>
              </div>
            </div>

            {/* Tuteur & Téléphone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Parent / Tuteur *</label>
                <input className={inputCls(!!errors.guardian_name)} placeholder="Nom complet" {...register("guardian_name")} />
                {errors.guardian_name && <span className="text-xs text-signal-red">{errors.guardian_name.message}</span>}
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Téléphone tuteur *</label>
                <input className={inputCls(!!errors.guardian_phone)} placeholder="Ex: 699001122" {...register("guardian_phone")} />
                {errors.guardian_phone && <span className="text-xs text-signal-red">{errors.guardian_phone.message}</span>}
              </div>
            </div>

            {/* Matricule optionnel */}
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Matricule (Optionnel)</label>
              <input className={inputCls(false)} placeholder="Généré automatiquement si laissé vide" {...register("matricule")} />
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
                {isSubmitting ? "En cours..." : editingStudent ? "Enregistrer" : "Inscrire l'élève"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default NewStudentModal;
