// supabase/functions/reset-fictitious-password/index.ts
// Réinitialise le mot de passe d'un compte fictif enseignant.
// Réservé aux rôles 'principal' et 'directeur_etudes'.
// Interdit sur les comptes non-fictifs (is_fictitious = false).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Génère un mot de passe de 16 caractères.
 * Exclut les caractères ambigus (0, O, I, l, 1) pour faciliter la saisie manuelle.
 */
function generateSecurePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => chars[b % chars.length])
    .join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Vérifier la présence du header Authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Non autorisé : en-tête Authorization manquant." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error("Configuration serveur manquante.");
      return new Response(
        JSON.stringify({ error: "Configuration serveur indisponible." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Vérifier l'identité de l'appelant via JWT
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: userError } = await callerClient.auth.getUser();
    if (userError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Non autorisé : jeton invalide ou expiré." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Vérifier le rôle de l'appelant dans profiles
    const { data: callerProfile, error: profileError } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", callerUser.id)
      .single();

    if (profileError || !callerProfile) {
      return new Response(
        JSON.stringify({ error: "Impossible de vérifier les autorisations." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allowedRoles = ["principal", "directeur_etudes"];
    if (!allowedRoles.includes(callerProfile.role)) {
      return new Response(
        JSON.stringify({ error: "Accès refusé. Privilèges administratifs requis." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Lire le user_id cible depuis le body
    const body = await req.json();
    const { user_id } = body;

    if (!user_id || typeof user_id !== "string") {
      return new Response(
        JSON.stringify({ error: "user_id requis et doit être une chaîne de caractères." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 5. Vérifier que le compte cible est bien fictif (SECURITE.md §7)
    const { data: targetProfile, error: targetErr } = await adminClient
      .from("profiles")
      .select("is_fictitious, full_name")
      .eq("id", user_id)
      .single();

    if (targetErr || !targetProfile) {
      return new Response(
        JSON.stringify({ error: "Compte introuvable." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!targetProfile.is_fictitious) {
      return new Response(
        JSON.stringify({
          error: "Action refusée : ce compte n'est pas un compte fictif. Utilisez la réinitialisation par email.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Générer et appliquer le nouveau mot de passe
    const newPassword = generateSecurePassword();

    const { error: updateError } = await adminClient.auth.admin.updateUserById(user_id, {
      password: newPassword,
    });

    if (updateError) {
      console.error("Erreur updateUserById:", updateError);
      return new Response(
        JSON.stringify({ error: "Échec de la réinitialisation du mot de passe." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Le mot de passe n'est JAMAIS stocké en base — retourné une seule fois
    return new Response(
      JSON.stringify({
        message: "Mot de passe réinitialisé avec succès.",
        generated_password: newPassword,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("Erreur interne reset-fictitious-password:", err);
    return new Response(
      JSON.stringify({ error: "Une erreur interne est survenue." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
