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

    // Contrôle de limitation de débit (Anti-Bruteforce / Anti-DoS - Faille 5)
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
    const { teacher_id, is_active } = body;

    if (!teacher_id || typeof is_active !== "boolean") {
      return new Response(
        JSON.stringify({ error: "teacher_id (UUID) et is_active (boolean) sont requis." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    if (!is_active) {
      // 1. Désactivation : ban via updateUserById({ ban_duration: '876000h' }) + signOut global
      try {
        const { error: banError } = await adminClient.auth.admin.updateUserById(teacher_id, {
          ban_duration: "876000h",
        });
        if (banError) {
          console.error("Erreur ban updateUserById:", banError);
          return new Response(
            JSON.stringify({ error: "Échec de la suspension du compte utilisateur." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (banEx: any) {
        console.error("Exception banUser:", banEx);
        return new Response(
          JSON.stringify({ error: "Erreur lors de la suspension du compte." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        await adminClient.auth.admin.signOut(teacher_id, "global");
      } catch (soEx: any) {
        console.warn("Avertissement signOut global :", soEx.message);
      }
    } else {
      // 2. Réactivation : unban via updateUserById({ ban_duration: 'none' })
      try {
        const { error: unbanError } = await adminClient.auth.admin.updateUserById(teacher_id, {
          ban_duration: "none",
        });
        if (unbanError) {
          console.error("Erreur unban updateUserById:", unbanError);
          return new Response(
            JSON.stringify({ error: "Échec de la réactivation du compte utilisateur." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (unbanEx: any) {
        console.error("Exception unbanUser:", unbanEx);
        return new Response(
          JSON.stringify({ error: "Erreur lors de la réactivation du compte." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 3. Tenter la mise à jour si la colonne is_active existe dans profiles
    try {
      const { error: profileUpdateError } = await adminClient
        .from("profiles")
        .update({ is_active })
        .eq("id", teacher_id);

      if (profileUpdateError) {
        console.warn("Mise à jour profil is_active ignorée si la colonne n'existe pas encore :", profileUpdateError.message);
      }
    } catch (profEx: any) {
      console.warn("Exception profil is_active :", profEx.message);
    }

    return new Response(
      JSON.stringify({
        message: `Statut Auth de l'enseignant mis à jour avec succès : is_active = ${is_active}`,
        teacher_id,
        is_active,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Erreur serveur globale toggle-teacher-status:", err);
    return new Response(
      JSON.stringify({ error: "Une erreur interne est survenue lors de l'opération." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
