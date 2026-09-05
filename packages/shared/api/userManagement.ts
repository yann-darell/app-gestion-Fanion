// packages/shared/api/userManagement.ts
import { supabase } from "./supabaseClient";

export interface UserProfile {
    id: string;
    full_name: string;
    email?: string | null;
    role: "principal" | "directeur_etudes" | "enseignant" | string;
    division_scope?: string | null;
    is_active?: boolean;
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
        .select("id, full_name, email, role, division_scope, is_active, created_at")
        .order("created_at", { ascending: false });

    if (roleFilter && roleFilter !== "all") {
        query = query.eq("role", roleFilter);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data as UserProfile[]) ?? [];
}

/**
 * Met à jour un profil utilisateur existant.
 */
export async function updateUser(
    id: string,
    updates: {
        full_name?: string;
        email?: string;
        role?: string;
        division_scope?: string | null;
    }
): Promise<UserProfile> {
    // Vérification préalable pour empêcher la modification de comptes de direction
    const { data: targetProfile, error: fetchErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", id)
        .single();
        
    if (fetchErr) {
        throw new Error("Impossible de vérifier les permissions du compte ciblé.");
    }
    
    if (targetProfile?.role === "principal" || targetProfile?.role === "directeur_etudes") {
        throw new Error("Action interdite : les comptes de l'équipe de direction ne peuvent pas être modifiés.");
    }

    const { data, error } = await supabase
        .from("profiles")
        .update({
            ...(updates.full_name !== undefined && { full_name: updates.full_name.trim() }),
            ...(updates.email !== undefined && { email: updates.email.trim() }),
            ...(updates.role !== undefined && { role: updates.role }),
            ...(updates.division_scope !== undefined && { division_scope: updates.division_scope }),
        })
        .eq("id", id)
        .select()
        .single();

    if (error) {
        throw new Error(error.message || "Impossible de mettre à jour l'utilisateur.");
    }

    return data as UserProfile;
}

/**
 * Supprime un profil utilisateur.
 */
export async function deleteUser(id: string): Promise<void> {
    // Vérification préalable pour empêcher la suppression de comptes de direction
    const { data: targetProfile, error: fetchErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", id)
        .single();
        
    if (fetchErr) {
        throw new Error("Impossible de vérifier les permissions du compte ciblé.");
    }
    
    if (targetProfile?.role === "principal" || targetProfile?.role === "directeur_etudes") {
        throw new Error("Action interdite : les comptes de l'équipe de direction ne peuvent pas être supprimés.");
    }

    const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", id);

    if (error) {
        throw new Error(error.message || "Échec de la suppression du compte utilisateur.");
    }
}

