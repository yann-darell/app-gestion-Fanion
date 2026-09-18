const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://ahlydimsmldvufqnhdxc.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFobHlkaW1zbWxkdnVmcW5oZHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MjI2NDUsImV4cCI6MjEwMjA5ODY0NX0.pd7S7LbJJcjeGaLwFCe8DKGbrppMYRzbDCx4BciDlCA"
);

async function main() {
  try {
    console.log("--> Authentification Principal...");
    const { data: auth, error: aErr } = await supabase.auth.signInWithPassword({
      email: "principal@lefanion.com",
      password: "r6QT?K$N#PW2LpG",
    });
    if (aErr) {
      console.error("Auth error:", aErr.message);
      process.exit(1);
    }
    console.log("✓ Connecté en tant que :", auth.user.email);

    console.log("--> Test toggle-teacher-status...");
    const { data: teachers } = await supabase
      .from("profiles")
      .select("id, full_name, is_active")
      .eq("role", "enseignant")
      .limit(1);

    if (teachers && teachers.length > 0) {
      const t = teachers[0];
      console.log(`Cible: ${t.full_name} (${t.id}), statut actuel: ${t.is_active}`);
      const { data: togRes, error: togErr } = await supabase.functions.invoke("toggle-teacher-status", {
        body: { teacher_id: t.id, is_active: !t.is_active }
      });
      if (togErr) {
        console.error("toggle-teacher-status ERROR:", togErr);
      } else {
        console.log("✓ toggle-teacher-status SUCCESS:", togRes);
        // Remettre dans l'état initial
        await supabase.functions.invoke("toggle-teacher-status", {
          body: { teacher_id: t.id, is_active: t.is_active }
        });
        console.log("✓ toggle-teacher-status reset à l'état initial");
      }
    }

    const testEmail = `prof.test.${Date.now()}@lefanion.com`;
    console.log(`--> Test invite-teacher avec ${testEmail}...`);
    const { data: invRes, error: invErr } = await supabase.functions.invoke("invite-teacher", {
      body: { email: testEmail, full_name: "Professeur Test Audit" }
    });
    if (invErr) {
      console.error("invite-teacher ERROR:", invErr);
    } else {
      console.log("✓ invite-teacher SUCCESS:", invRes);
    }

    console.log("--> FIN TESTS EDGE FUNCTIONS");
    process.exit(0);
  } catch (e) {
    console.error("Erreur générale:", e);
    process.exit(1);
  }
}

main();
