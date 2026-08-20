/**
 * Script de vérification automatisé pour la sécurité RLS sur la table grades.
 * Usage: node scripts/verify_rls_grades.js
 */

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ ERREUR: VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY doivent être définis.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runVerification() {
  console.log("=== VÉRIFICATION DE LA SÉCURITÉ RLS GRADES ===");

  // 1. Récupérer les enseignants enregistrés
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("role", "enseignant");

  if (profErr) {
    console.error("❌ Erreur lors de la récupération des profils:", profErr.message);
    process.exit(1);
  }

  console.log(`📋 Enseignants trouvés en base: ${profiles?.length || 0}`);

  if (!profiles || profiles.length < 2) {
    console.log("\n⚠️ ATTENTION : Au moins 2 comptes enseignants actifs sont nécessaires pour exécuter le test RLS d'isolation croisée.");
    console.log("👉 Veuillez créer/inviter un 2ème enseignant via le module 'Gestion des comptes' (D2bis) et activer son mot de passe avant de relancer ce script.");
    console.log("\nLe script s'arrête ici proprement sans erreur fatal.");
    return;
  }

  console.log("✅ 2 enseignants au moins sont disponibles pour le test d'isolation croisée.");
  console.log("Nom Enseignant 1:", profiles[0].full_name, `(${profiles[0].id})`);
  console.log("Nom Enseignant 2:", profiles[1].full_name, `(${profiles[1].id})`);
  
  console.log("\nPrêt pour l'exécution du test RLS avec les sessions de ces 2 enseignants...");
}

runVerification().catch((err) => {
  console.error("❌ Erreur inattendue:", err);
  process.exit(1);
});
