import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Rate limiter en mémoire : maximum 20 requêtes par minute par utilisateur
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;

function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }
  record.count += 1;
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Non autorisé : en-tête d'autorisation manquant." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error("Configuration Supabase manquante sur le serveur (SUPABASE_SERVICE_ROLE_KEY non configurée).");
      return new Response(
        JSON.stringify({ 
          error: "Configuration serveur indisponible."
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: callerUser },
      error: userError,
    } = await callerClient.auth.getUser();

    if (userError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Non autorisé : jeton utilisateur invalide ou expiré." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Contrôle de limitation de débit (Anti-Bruteforce / Anti-DoS)
    if (isRateLimited(callerUser.id)) {
      return new Response(
        JSON.stringify({ error: "Trop de requêtes. Veuillez patienter avant de réessayer." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
        JSON.stringify({
          error: "Accès refusé. Privilèges administratifs requis.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { user_id } = body;

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id (UUID) est requis." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify target user is not admin/direction
    const { data: targetProfile, error: targetError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user_id)
      .single();

    if (targetError) {
      console.error("Erreur lors de la récupération du profil cible:", targetError);
    } else if (targetProfile) {
      if (["principal", "directeur_etudes"].includes(targetProfile.role)) {
        return new Response(
          JSON.stringify({ error: "Action interdite : les comptes de l'équipe de direction ne peuvent pas être supprimés." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 1. Delete user from Auth first (this may cascade to profile via DB trigger)
    try {
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id);
      if (deleteError) {
        console.error("Erreur deleteUser Auth:", deleteError);
        // If auth user doesn't exist, still try to clean up the profile
        if (!deleteError.message?.includes("not found")) {
          return new Response(
            JSON.stringify({ error: "Échec de la suppression du compte utilisateur : " + deleteError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    } catch (delEx: any) {
      console.error("Exception deleteUser Auth:", delEx);
      // Continue to try profile deletion
    }

    // 2. Clean up profile if it still exists (fallback)
    try {
      const { error: profileDeleteError } = await adminClient
        .from("profiles")
        .delete()
        .eq("id", user_id);

      if (profileDeleteError) {
        console.warn("Avertissement suppression profil:", profileDeleteError.message);
      }
    } catch (profEx: any) {
      console.warn("Exception profil delete:", profEx.message);
    }

    return new Response(
      JSON.stringify({
        message: `Compte utilisateur supprimé avec succès.`,
        user_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Erreur serveur globale delete-user:", err);
    return new Response(
      JSON.stringify({ error: "Une erreur interne est survenue lors de l'opération." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
