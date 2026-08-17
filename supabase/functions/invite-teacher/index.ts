import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
      return new Response(
        JSON.stringify({ error: "Variables d'environnement Supabase manquantes sur le serveur." }),
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

    // 2. Vérification du rôle dans la table profiles
    const { data: callerProfile, error: profileError } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", callerUser.id)
      .single();

    if (profileError || !callerProfile) {
      return new Response(
        JSON.stringify({ error: "Impossible de récupérer le profil de l'utilisateur appelant." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allowedRoles = ["principal", "directeur_etudes"];
    if (!allowedRoles.includes(callerProfile.role)) {
      return new Response(
        JSON.stringify({
          error: "Accès refusé. Seuls le Principal et le Directeur des Études sont autorisés à inviter des enseignants.",
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
      return new Response(
        JSON.stringify({ error: `Erreur Supabase Auth Admin : ${inviteError.message}` }),
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
      return new Response(
        JSON.stringify({
          error: `Compte utilisateur créé mais échec de la mise à jour du profil : ${profileInsertError.message}`,
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
    return new Response(
      JSON.stringify({ error: `Erreur serveur : ${err?.message || err}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
