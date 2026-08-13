import { z } from "zod";

export const classSchema = z.object({
  name: z.string().min(1, "Le nom de la classe est requis"),
  level: z.string().min(1, "Le niveau est requis"),
  division_id: z.string().min(1, "La division est requise"),
  school_year_id: z.string().uuid("L'année scolaire est requise"),
  head_teacher_name: z.string().nullable().optional(),
});

export type ClassFormData = z.infer<typeof classSchema>;
