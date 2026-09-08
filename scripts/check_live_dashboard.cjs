const { createClient } = require("@supabase/supabase-js");

async function checkLiveDashboard() {
  const supabase = createClient(
    "https://ahlydimsmldvufqnhdxc.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFobHlkaW1zbWxkdnVmcW5oZHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MjI2NDUsImV4cCI6MjEwMjA5ODY0NX0.pd7S7LbJJcjeGaLwFCe8DKGbrppMYRzbDCx4BciDlCA"
  );

  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: "principal@lefanion.com",
    password: "r6QT?K$N#PW2LpG",
  });

  if (authErr) {
    console.error("Auth error:", authErr.message);
    return;
  }
  console.log("Connecté en tant que :", auth.user.email);

  // Exécution des requêtes réelles du dashboard
  const [
    { data: activeYear },
    { data: classes },
    { data: students },
    { data: assignments },
    { data: submissions },
    { data: payments },
    { data: schoolSettings }
  ] = await Promise.all([
    supabase.from("school_years").select("*").eq("is_active", true).single(),
    supabase.from("classes").select("id, name, division_id"),
    supabase.from("students").select("id, class_id, status"),
    supabase.from("teacher_assignments").select("id, class_id, subject_id"),
    supabase.from("grade_submissions").select("id, class_id, subject_id, sequence_id, is_locked"),
    supabase.from("payments").select("id, amount, payment_date"),
    supabase.from("school_settings").select("*").limit(1).maybeSingle(),
  ]);

  console.log("\n--- DONNÉES EN BASE SUPABASE ---");
  console.log("Établissement :", schoolSettings?.name);
  console.log("Année active :", activeYear?.label || activeYear?.name);
  console.log("Nombre de classes :", classes?.length);
  
  const activeStudents = (students || []).filter(s => s.status === 'active').length;
  const pendingStudents = (students || []).filter(s => s.status === 'pending_registration').length;
  console.log(`Élèves : ${students?.length} total (${activeStudents} actifs, ${pendingStudents} en attente)`);
  
  console.log(`Attributions enseignants : ${assignments?.length}`);
  console.log(`Soumissions notes réelles (grade_submissions) : ${submissions?.length}`);
  
  const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  console.log(`Paiements totaux encaissés : ${totalPaid.toLocaleString('fr-FR')} FCFA (${payments?.length} reçus)`);
}

checkLiveDashboard().catch(console.error);
