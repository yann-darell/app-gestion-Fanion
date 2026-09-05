import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
      return new Response(
        JSON.stringify({ 
          error: "Variables d'environnement Supabase manquantes sur le serveur (SUPABASE_SERVICE_ROLE_KEY non configurée).",
          details: { url: !!supabaseUrl, anon: !!supabaseAnonKey, service: !!serviceRoleKey }
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
          error: "Accès refusé. Seuls le Principal et le Directeur des Études sont autorisés à modifier le statut d'un enseignant.",
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
          return new Response(
            JSON.stringify({ error: `Erreur ban updateUserById : ${banError.message}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (banEx: any) {
        return new Response(
          JSON.stringify({ error: `Exception banUser : ${banEx.message}` }),
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
          return new Response(
            JSON.stringify({ error: `Erreur unban updateUserById : ${unbanError.message}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (unbanEx: any) {
        return new Response(
          JSON.stringify({ error: `Exception unbanUser : ${unbanEx.message}` }),
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
    return new Response(
      JSON.stringify({ error: `Erreur serveur globale : ${err?.message || err}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
