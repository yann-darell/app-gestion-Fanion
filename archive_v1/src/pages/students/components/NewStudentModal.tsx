import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Modal from "../../../components/ui/Modal";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";
import { Student, Class, CreateStudentInput } from "../../../../electron/types/students";

interface NewStudentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CreateStudentInput) => Promise<boolean>;
    student?: Student | null;
    classes: Class[];
    pickPhoto: () => Promise<{ ok: boolean; data: { path: string; base64: string } | null; error?: string }>;
}

const studentSchema = z.object({
    matricule: z.string().optional(),
    first_name: z.string().min(1, "Le prénom est obligatoire"),
    last_name: z.string().min(1, "Le nom de famille est obligatoire"),
    birth_date: z.string().min(1, "La date de naissance est obligatoire"),
    birth_place: z.string().optional(),
    nationality: z.string().optional(),
    is_repeating: z.coerce.number().optional().default(0),
    gender: z.enum(["M", "F"], { errorMap: () => ({ message: "Le genre est obligatoire" }) }),
    class_id: z.coerce.number().min(1, "La classe est obligatoire"),
    guardian_name: z.string().min(1, "Le nom du tuteur est obligatoire"),
    guardian_phone: z.string().min(1, "Le téléphone du tuteur est obligatoire"),
});

type FormValues = z.infer<typeof studentSchema>;

export const NewStudentModal: React.FC<NewStudentModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    student,
    classes,
    pickPhoto,
}) => {
    const [submitting, setSubmitting] = useState(false);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [selectedPhotoPath, setSelectedPhotoPath] = useState<string | null | undefined>(undefined);
    const [formError, setFormError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
        setError,
    } = useForm<FormValues>();

    // Initialiser les valeurs du formulaire si on édite un élève
    useEffect(() => {
        if (isOpen) {
            setFormError(null);
            if (student) {
                reset({
                    matricule: student.matricule,
                    first_name: student.first_name,
                    last_name: student.last_name,
                    birth_date: student.birth_date,
                    birth_place: student.birth_place || "",
                    nationality: student.nationality || "",
                    is_repeating: student.is_repeating || 0,
                    gender: student.gender,
                    class_id: student.class_id,
                    guardian_name: student.guardian_name,
                    guardian_phone: student.guardian_phone,
                });
                setSelectedPhotoPath(undefined);
                setPhotoPreview(
                    student.photo_filename
                        ? `fanion-photo://${student.photo_filename}`
                        : null
                );
            } else {
                reset({
                    matricule: "",
                    first_name: "",
                    last_name: "",
                    birth_date: "",
                    birth_place: "",
                    nationality: "",
                    is_repeating: 0,
                    gender: "M",
                    class_id: classes[0]?.id || 0,
                    guardian_name: "",
                    guardian_phone: "",
                });
                setSelectedPhotoPath(null);
                setPhotoPreview(null);
            }
        }
    }, [isOpen, student, reset, classes]);

    const handlePhotoSelection = async () => {
        setFormError(null);
        const res = await pickPhoto();
        if (res.ok && res.data) {
            setSelectedPhotoPath(res.data.path);
            setPhotoPreview(res.data.base64);
        } else if (!res.ok && res.error) {
            setFormError(res.error);
        }
    };

    const handleRemovePhoto = () => {
        setSelectedPhotoPath(null); // signale une suppression explicite de photo
        setPhotoPreview(null);
    };

    const handleFormSubmit = async (values: FormValues) => {
        setFormError(null);
        
        // Validation avec Zod
        const validation = studentSchema.safeParse(values);
        if (!validation.success) {
            validation.error.errors.forEach((err) => {
                const path = err.path[0] as keyof FormValues;
                setError(path, { message: err.message });
            });
            return;
        }

        setSubmitting(true);
        try {
            const dataToSend: CreateStudentInput = {
                ...values,
                photo_path: selectedPhotoPath,
            };

            const success = await onSubmit(dataToSend);
            if (success) {
                onClose();
            }
        } catch (err: any) {
            setFormError(err.message || "Une erreur est survenue lors de l'enregistrement.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={student ? "Modifier la fiche élève" : "Inscrire un nouvel élève"}
            size="sm"
        >
            <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-4">
                {formError && (
                    <div className="p-3 bg-signal-red/10 border border-signal-red/20 text-signal-red rounded text-xs font-medium font-sans">
                        {formError}
                    </div>
                )}

                {/* Photo de profil section */}
                <div className="flex flex-col items-center gap-3 py-2 border-b border-line pb-4">
                    <span className="font-sans text-xs font-semibold text-slate uppercase tracking-wider self-start">
                        Photo de profil
                    </span>
                    <div className="flex items-center gap-4 w-full">
                        <div className="relative">
                            {photoPreview ? (
                                <img
                                    src={photoPreview}
                                    alt="Prévisualisation"
                                    className="w-16 h-16 rounded-full object-cover border border-line"
                                />
                            ) : (
                                <div className="w-16 h-16 rounded-full bg-paper-dark text-slate flex items-center justify-center text-lg font-bold border border-line">
                                    ?
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col gap-2">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={handlePhotoSelection}
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
                            className={`w-full px-3 py-2 border rounded font-sans transition-colors duration-150 focus:outline-none focus:border-2 focus:border-ink h-10 bg-white text-sm ${
                                errors.gender ? "border-signal-red focus:border-signal-red" : "border-line"
                            }`}
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

                {/* Classe & Statut Redoublant */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5 w-full">
                        <label className="font-sans text-xs font-semibold text-slate uppercase tracking-wider">
                            Classe affectée *
                        </label>
                        <select
                            className={`w-full px-3 py-2 border rounded font-sans transition-colors duration-150 focus:outline-none focus:border-2 focus:border-ink h-10 bg-white text-sm ${
                                errors.class_id ? "border-signal-red focus:border-signal-red" : "border-line"
                            }`}
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
                            className={`w-full px-3 py-2 border rounded font-sans transition-colors duration-150 focus:outline-none focus:border-2 focus:border-ink h-10 bg-white text-sm ${
                                errors.is_repeating ? "border-signal-red focus:border-signal-red" : "border-line"
                            }`}
                            {...register("is_repeating")}
                        >
                            <option value="0">Non-redoublant</option>
                            <option value="1">Redoublant</option>
                        </select>
                        {errors.is_repeating && (
                            <span className="font-sans text-xs text-signal-red font-medium">
                                {errors.is_repeating.message}
                            </span>
                        )}
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
                        fontMono
                        error={errors.guardian_phone?.message}
                        {...register("guardian_phone")}
                    />
                </div>

                {/* Matricule optionnel */}
                <Input
                    label="Matricule (Optionnel)"
                    placeholder="Généré automatiquement si laissé vide"
                    fontMono
                    error={errors.matricule?.message}
                    {...register("matricule")}
                />

                {/* Footer boutons */}
                <div className="flex items-center justify-end gap-3 mt-4 border-t border-line pt-4">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                        disabled={submitting}
                    >
                        Annuler
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        isLoading={submitting}
                    >
                        {student ? "Enregistrer" : "Inscrire l'élève"}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default NewStudentModal;
