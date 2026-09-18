import * as dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
const principalPw = process.env.TEST_PRINCIPAL_PW || "r6QT?K$N#PW2LpG";

async function testEdgeFunctions() {
  console.log("=== TEST REEL DES EDGE FUNCTIONS ===");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // 1. Connexion Principal
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: "principal@lefanion.com",
    password: principalPw,
  });
  if (authErr) {
    console.error("Erreur login Principal:", authErr.message);
    process.exit(1);
  }
  console.log("Connecte en tant que Principal:", auth.user.email);

  // 2. Trouver un enseignant
  const { data: teachers, error: tErr } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active")
    .eq("role", "enseignant")
    .limit(1);

  if (tErr || !teachers || teachers.length === 0) {
    console.error("Aucun enseignant trouve pour le test:", tErr);
    process.exit(1);
  }

  const teacher = teachers[0];
  console.log("Enseignant cible:", teacher.full_name, "(ID:", teacher.id, "Statut actuel:", teacher.is_active, ")");

  // 3. Tester toggle-teacher-status (Désactivation puis Réactivation)
  console.log("\n-> Invocaton toggle-teacher-status (is_active = false)...");
  const { data: toggleRes1, error: toggleErr1 } = await supabase.functions.invoke("toggle-teacher-status", {
    body: { teacher_id: teacher.id, is_active: false },
  });
  if (toggleErr1) {
    console.error("FAIL toggle-teacher-status (false):", toggleErr1);
    process.exit(1);
  }
  console.log("SUCCESS toggle-teacher-status (false):", toggleRes1);

  console.log("\n-> Invocaton toggle-teacher-status (is_active = true)...");
  const { data: toggleRes2, error: toggleErr2 } = await supabase.functions.invoke("toggle-teacher-status", {
    body: { teacher_id: teacher.id, is_active: true },
  });
  if (toggleErr2) {
    console.error("FAIL toggle-teacher-status (true):", toggleErr2);
    process.exit(1);
  }
  console.log("SUCCESS toggle-teacher-status (true):", toggleRes2);

  // 4. Tester invite-teacher
  // Note: on utilise un email de test jetable
  const testEmail = `test.audit.${Date.now()}@lefanion.com`;
  console.log(`\n-> Invocaton invite-teacher pour ${testEmail}...`);
  const { data: inviteRes, error: inviteErr } = await supabase.functions.invoke("invite-teacher", {
    body: { email: testEmail, full_name: "Audit Test Teacher" },
  });
  if (inviteErr) {
    console.error("FAIL invite-teacher:", inviteErr);
    process.exit(1);
  }
  console.log("SUCCESS invite-teacher:", inviteRes);

  console.log("\n=== TOUS LES TESTS EDGE FUNCTIONS ONT REUSSI SANS ERREUR ===");
  process.exit(0);
}

testEdgeFunctions().catch((e) => {
  console.error("Exception fatale:", e);
  process.exit(1);
});
