// packages/shared/api/userManagement.ts
import { supabase } from "./supabaseClient";

export interface UserProfile {
    id: string;
    full_name: string;
    email?: string | null;
    role: "principal" | "directeur_etudes" | "enseignant" | string;
    division_scope?: string | null;
    created_at: string;
}

export interface InviteTeacherResponse {
    message: string;
    user: {
        id: string;
        email: string;
        full_name: string;
        role: string;
    };
}

/**
 * Invoque la Edge Function Supabase 'invite-teacher'
 * pour créer un utilisateur et lui envoyer une invitation par email.
 * Réservé aux rôles 'principal' et 'directeur_etudes'.
 */
export async function inviteTeacher(
    email: string,
    fullName: string
): Promise<InviteTeacherResponse> {
    const { data, error } = await supabase.functions.invoke("invite-teacher", {
        body: {
            email: email.trim(),
            full_name: fullName.trim(),
        },
    });

    if (error) {
        throw new Error(error.message || "Erreur de communication avec le serveur.");
    }

    if (data?.error) {
        throw new Error(data.error);
    }

    return data as InviteTeacherResponse;
}

/**
 * Liste les profils utilisateurs (enseignants, direction, etc.).
 */
export async function listUsers(roleFilter?: string): Promise<UserProfile[]> {
    let query = supabase
        .from("profiles")
        .select("id, full_name, email, role, division_scope, created_at")
        .order("created_at", { ascending: false });

    if (roleFilter) {
        query = query.eq("role", roleFilter);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data as UserProfile[]) ?? [];
}
