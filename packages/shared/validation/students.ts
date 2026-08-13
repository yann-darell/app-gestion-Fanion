import { z } from "zod";

export const studentSchema = z.object({
  first_name: z.string().min(1, "Le prénom est obligatoire."),
  last_name: z.string().min(1, "Le nom est obligatoire."),
  birth_date: z.string().min(1, "La date de naissance est obligatoire."),
  birth_place: z.string().optional().nullable(),
  gender: z.enum(["M", "F"], {
    errorMap: () => ({ message: "Le genre doit être 'M' ou 'F'." }),
  }),
  nationality: z.string().optional().nullable(),
  is_repeating: z.boolean().default(false),
  class_id: z.string().min(1, "La classe est obligatoire."),
  guardian_name: z.string().min(1, "Le nom du tuteur est obligatoire."),
  guardian_phone: z.string().min(1, "Le téléphone du tuteur est obligatoire."),
  status: z.enum(["active", "inactive", "pending_registration"]).default("active"),
  matricule: z.string().optional().nullable(),
  photo_path: z.string().optional().nullable(),
});

export type StudentFormData = z.infer<typeof studentSchema>;
