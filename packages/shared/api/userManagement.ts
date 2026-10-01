// packages/shared/api/userManagement.ts
import { supabase } from "./supabaseClient";

export interface UserProfile {
    id: string;
    full_name: string;
    email?: string | null;
    role: "principal" | "directeur_etudes" | "enseignant" | string;
    division_scope?: string | null;
    is_active?: boolean;
    is_fictitious?: boolean;
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

export interface CreateFictitiousAccountResponse {
    message: string;
    user: {
        id: string;
        email: string;
        full_name: string;
        role: string;
        is_fictitious: true;
    };
    generated_password: string;
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
 * Crée un compte enseignant avec un email fictif auto-généré et un mot de passe fort.
 * Utilisé pour les enseignants n'ayant pas d'adresse email personnelle.
 * Le mot de passe généré est retourné UNE SEULE FOIS dans la réponse.
 */
export async function createFictitiousTeacher(
    email: string,
    fullName: string
): Promise<CreateFictitiousAccountResponse> {
    const { data, error } = await supabase.functions.invoke("invite-teacher", {
        body: {
            email: email.trim(),
            full_name: fullName.trim(),
            is_fictitious: true,
        },
    });

    if (error) {
        throw new Error(error.message || "Erreur de communication avec le serveur.");
    }

    if (data?.error) {
        throw new Error(data.error);
    }

    return data as CreateFictitiousAccountResponse;
}

/**
 * Liste les profils utilisateurs (enseignants, direction, etc.).
 */
export async function listUsers(roleFilter?: string): Promise<UserProfile[]> {
    let query = supabase
        .from("profiles")
        .select("id, full_name, email, role, division_scope, is_active, is_fictitious, created_at")
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
 * Supprime un profil utilisateur et son compte d'authentification.
 */
export async function deleteUser(id: string): Promise<void> {
    const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: id },
    });

    if (error) {
        // Tenter d'extraire le message d'erreur du corps de la réponse
        let errorMessage = "Erreur de communication avec le serveur lors de la suppression.";
        try {
            // Si l'erreur contient un contexte (FunctionsHttpError), le message est dans error.context
            if ((error as any).context) {
                const body = await (error as any).context.json();
                if (body?.error) errorMessage = body.error;
            } else if (data?.error) {
                errorMessage = data.error;
            } else if (error.message) {
                errorMessage = error.message;
            }
        } catch {
            // Fallback au message d'erreur brut
            if (error.message) errorMessage = error.message;
        }
        throw new Error(errorMessage);
    }

    if (data?.error) {
        throw new Error(data.error);
    }
}

/**
 * Réinitialise le mot de passe d'un compte fictif enseignant.
 * Retourne le nouveau mot de passe UNE SEULE FOIS.
 * Interdit sur les comptes non-fictifs (erreur 403 côté serveur).
 */
export async function resetFictitiousPassword(
    userId: string
): Promise<{ generated_password: string }> {
    const { data, error } = await supabase.functions.invoke("reset-fictitious-password", {
        body: { user_id: userId },
    });

    if (error) {
        let errorMessage = "Erreur de communication avec le serveur.";
        try {
            if ((error as any).context) {
                const body = await (error as any).context.json();
                if (body?.error) errorMessage = body.error;
            } else if (error.message) {
                errorMessage = error.message;
            }
        } catch {
            if (error.message) errorMessage = error.message;
        }
        throw new Error(errorMessage);
    }

    if (data?.error) {
        throw new Error(data.error);
    }

    return data as { generated_password: string };
}

