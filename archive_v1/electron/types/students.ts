export interface Student {
    id: number;
    matricule: string;
    first_name: string;
    last_name: string;
    birth_date: string;
    gender: "M" | "F";
    class_id: number;
    guardian_name: string;
    guardian_phone: string;
    photo_filename: string | null;
    status: "active" | "inactive";
    class_name?: string; // Nom de la classe si jointure effectuée
    birth_place?: string | null;
    nationality?: string | null;
    is_repeating?: number; // 0 ou 1
}

export interface CreateStudentInput {
    matricule?: string;
    first_name: string;
    last_name: string;
    birth_date: string;
    gender: "M" | "F";
    class_id: number;
    guardian_name: string;
    guardian_phone: string;
    photo_path?: string | null; // Chemin temporaire sélectionné via pickPhoto
    birth_place?: string | null;
    nationality?: string | null;
    is_repeating?: number; // 0 ou 1
}

export interface UpdateStudentInput {
    matricule?: string;
    first_name?: string;
    last_name?: string;
    birth_date?: string;
    gender?: "M" | "F";
    class_id?: number;
    guardian_name?: string;
    guardian_phone?: string;
    photo_path?: string | null;
    birth_place?: string | null;
    nationality?: string | null;
    is_repeating?: number; // 0 ou 1
}

export interface Class {
    id: number;
    name: string;
    level: string;
    school_year_id: number;
    apc_enabled: number; // 0 ou 1
    school_year_label?: string; // Libellé de l'année scolaire si jointure
}

export interface CreateClassInput {
    name: string;
    level: string;
    school_year_id: number;
    apc_enabled: number;
}

export type IpcResponse<T> =
    | { ok: true; data: T }
    | { ok: false; error: string };
