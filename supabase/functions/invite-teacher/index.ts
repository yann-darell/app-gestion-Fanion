import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Rate limiter en mémoire : maximum 10 requêtes par minute par utilisateur
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;

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
  // Gérer les requêtes CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Vérification de l'en-tête d'autorisation de l'appelant
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Non autorisé : en-tête d'autorisation manquant." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error("Configuration serveur manquante : SUPABASE_URL, ANON_KEY ou SERVICE_ROLE_KEY introuvables.");
      return new Response(
        JSON.stringify({ error: "Configuration serveur indisponible." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Client Supabase avec les identifiants de l'utilisateur qui effectue l'appel (JWT)
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

    // 2. Vérification du rôle dans la table profiles
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

    // 3. Extraction et validation des données transmises dans le body
    const body = await req.json();
    const { email, full_name } = body;

    if (!email || !full_name || typeof email !== "string" || typeof full_name !== "string") {
      return new Response(
        JSON.stringify({ error: "L'adresse email et le nom complet sont requis." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Client Admin Supabase avec la clé service_role (côté serveur uniquement)
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Invitation de l'utilisateur par email
    const { data: inviteData, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email.trim(), {
        data: { full_name: full_name.trim() },
      });

    if (inviteError) {
      console.error("Erreur inviteUserByEmail:", inviteError);
      return new Response(
        JSON.stringify({ error: "Impossible d'envoyer l'invitation à cette adresse email." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Création / Mise à jour du profil enseignant dans la table profiles
    const { error: profileInsertError } = await adminClient.from("profiles").upsert(
      {
        id: inviteData.user.id,
        email: email.trim(),
        full_name: full_name.trim(),
        role: "enseignant",
      },
      { onConflict: "id" }
    );

    if (profileInsertError) {
      console.error("Erreur upsert profil enseignant:", profileInsertError);
      return new Response(
        JSON.stringify({
          error: "Compte utilisateur créé mais échec de la mise à jour du profil.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        message: "Invitation envoyée et compte enseignant créé avec succès.",
        user: {
          id: inviteData.user.id,
          email: inviteData.user.email,
          full_name: full_name.trim(),
          role: "enseignant",
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Erreur interne invite-teacher:", err);
    return new Response(
      JSON.stringify({ error: "Une erreur interne est survenue lors du traitement." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
