import { supabase } from "./supabaseClient";

export interface StudentInput {
  matricule?: string | null;
  first_name: string;
  last_name: string;
  birth_date: string;
  birth_place?: string | null;
  gender: "M" | "F";
  nationality?: string | null;
  is_repeating?: boolean;
  class_id: string;
  guardian_name: string;
  guardian_phone: string;
  status?: "active" | "inactive" | "pending_registration";
  photo_path?: string | null;
}

export interface StudentRecord extends StudentInput {
  id: string;
  enrolled_at: string;
  created_at: string;
}

/**
  * Génère un matricule unique au format ANNEE-CLASSE-SEQUENCE
  * Ex: "2026-6EMEA-0001"
  */
export async function generateMatricule(classId: string): Promise<string> {
  const { data: clsData, error: clsErr } = await supabase
    .from("classes")
    .select("name, school_year_id")
    .eq("id", classId)
    .single();

  if (clsErr || !clsData) {
    throw new Error("Classe introuvable pour la génération du matricule.");
  }

  let yearPart = new Date().getFullYear().toString();
  if (clsData.school_year_id) {
    const { data: syData } = await supabase
      .from("school_years")
      .select("label")
      .eq("id", clsData.school_year_id)
      .single();

    if (syData?.label) {
      yearPart = syData.label.split("-")[0].trim();
    }
  }

  const classPart = clsData.name
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "");

  const { count } = await supabase
    .from("students")
    .select("*", { count: "exact", head: true })
    .eq("class_id", classId);

  let sequence = (count || 0) + 1;
  let generatedMatricule = "";
  let exists = true;

  while (exists) {
    const seqPart = sequence.toString().padStart(4, "0");
    generatedMatricule = `${yearPart}-${classPart}-${seqPart}`;

    const { data: existing } = await supabase
      .from("students")
      .select("id")
      .eq("matricule", generatedMatricule)
      .maybeSingle();

    if (!existing) {
      exists = false;
    } else {
      sequence++;
    }
  }

  return generatedMatricule;
}

/**
  * Upload d'une photo vers le bucket Supabase Storage `student-photos`
  */
export async function uploadStudentPhoto(
  file: File | Blob,
  matricule: string
): Promise<string> {
  const extension = file.type?.split("/")[1] || "jpg";
  const fileName = `${matricule}_${Date.now()}.${extension}`;

  const { data, error } = await supabase.storage
    .from("student-photos")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (error) {
    console.error("Erreur d'upload photo:", error);
    throw new Error(`Échec de l'upload de la photo: ${error.message}`);
  }

  return data.path;
}

/**
  * Suppression d'une photo du bucket Supabase Storage
  */
export async function deleteStudentPhoto(photoPath: string): Promise<void> {
  if (!photoPath) return;
  const { error } = await supabase.storage
    .from("student-photos")
    .remove([photoPath]);

  if (error) {
    console.warn("Avertissement: Impossible de supprimer la photo:", error.message);
  }
}

/**
  * Obtenir l'URL de téléchargement/affichage d'une photo
  */
export async function getStudentPhotoUrl(photoPath: string | null): Promise<string | null> {
  if (!photoPath) return null;

  const { data, error } = await supabase.storage
    .from("student-photos")
    .createSignedUrl(photoPath, 3600);

  if (error || !data?.signedUrl) {
    console.warn("Erreur d'obtention de l'URL signée:", error);
    return null;
  }

  return data.signedUrl;
}

/**
  * Liste des élèves avec filtres optionnels
  */
export async function listStudents(filters?: {
  classId?: string;
  search?: string;
  status?: string;
}): Promise<StudentRecord[]> {
  let query = supabase.from("students").select("*");

  if (filters?.classId && filters.classId !== "all") {
    query = query.eq("class_id", filters.classId);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.search && filters.search.trim()) {
    const q = `%${filters.search.trim()}%`;
    query = query.or(
      `first_name.ilike.${q},last_name.ilike.${q},matricule.ilike.${q}`
    );
  }

  const { data, error } = await query
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (error) {
    console.error("Erreur listStudents:", error);
    throw error;
  }

  return data as StudentRecord[];
}

/**
  * Récupérer un élève par son ID
  */
export async function getStudent(id: string): Promise<StudentRecord> {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Erreur getStudent:", error);
    throw error;
  }

  return data as StudentRecord;
}

/**
  * Création d'un élève avec gestion atomique de la photo
  */
export async function createStudent(
  input: StudentInput,
  photoFile?: File | Blob
): Promise<StudentRecord> {
  let finalMatricule = input.matricule?.trim();
  if (!finalMatricule) {
    finalMatricule = await generateMatricule(input.class_id);
  } else {
    const { data: existing } = await supabase
      .from("students")
      .select("id")
      .eq("matricule", finalMatricule)
      .maybeSingle();

    if (existing) {
      throw new Error(`Le matricule '${finalMatricule}' est déjà attribué.`);
    }
  }

  let uploadedPhotoPath: string | null = null;
  if (photoFile) {
    uploadedPhotoPath = await uploadStudentPhoto(photoFile, finalMatricule);
  }

  try {
    const { data, error } = await supabase
      .from("students")
      .insert({
        matricule: finalMatricule,
        first_name: input.first_name.trim(),
        last_name: input.last_name.trim(),
        birth_date: input.birth_date,
        birth_place: input.birth_place?.trim() || null,
        gender: input.gender,
        nationality: input.nationality?.trim() || null,
        is_repeating: input.is_repeating ?? false,
        class_id: input.class_id,
        guardian_name: input.guardian_name.trim(),
        guardian_phone: input.guardian_phone.trim(),
        status: input.status || "active",
        photo_path: uploadedPhotoPath,
      })
      .select()
      .single();

    if (error) throw error;
    return data as StudentRecord;
  } catch (dbError) {
    if (uploadedPhotoPath) {
      console.warn("Échec DB : Suppression de la photo uploadée en rollback...");
      await deleteStudentPhoto(uploadedPhotoPath);
    }
    throw dbError;
  }
}

/**
  * Mise à jour d'un élève
  */
export async function updateStudent(
  id: string,
  input: Partial<StudentInput>,
  photoFile?: File | Blob
): Promise<StudentRecord> {
  const existing = await getStudent(id);

  let newPhotoPath: string | null = null;
  if (photoFile) {
    const matriculeForUpload = (input.matricule || existing.matricule) as string;
    newPhotoPath = await uploadStudentPhoto(photoFile, matriculeForUpload);
  }

  const updateData: Record<string, any> = {};
  if (input.first_name !== undefined) updateData.first_name = input.first_name.trim();
  if (input.last_name !== undefined) updateData.last_name = input.last_name.trim();
  if (input.birth_date !== undefined) updateData.birth_date = input.birth_date;
  if (input.birth_place !== undefined) updateData.birth_place = input.birth_place?.trim() || null;
  if (input.gender !== undefined) updateData.gender = input.gender;
  if (input.nationality !== undefined) updateData.nationality = input.nationality?.trim() || null;
  if (input.is_repeating !== undefined) updateData.is_repeating = input.is_repeating;
  if (input.class_id !== undefined) updateData.class_id = input.class_id;
  if (input.guardian_name !== undefined) updateData.guardian_name = input.guardian_name.trim();
  if (input.guardian_phone !== undefined) updateData.guardian_phone = input.guardian_phone.trim();
  if (input.status !== undefined) updateData.status = input.status;
  if (input.matricule !== undefined && input.matricule !== null) updateData.matricule = input.matricule.trim();

  if (newPhotoPath) {
    updateData.photo_path = newPhotoPath;
  }

  try {
    const { data, error } = await supabase
      .from("students")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    if (newPhotoPath && existing.photo_path && existing.photo_path !== newPhotoPath) {
      await deleteStudentPhoto(existing.photo_path);
    }

    return data as StudentRecord;
  } catch (dbError) {
    if (newPhotoPath) {
      await deleteStudentPhoto(newPhotoPath);
    }
    throw dbError;
  }
}

/**
  * Désactivation d'un élève (soft-delete via statut 'inactive')
  */
export async function deactivateStudent(id: string): Promise<StudentRecord> {
  const { data, error } = await supabase
    .from("students")
    .update({ status: "inactive" })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Erreur deactivateStudent:", error);
    throw error;
  }

  return data as StudentRecord;
}
