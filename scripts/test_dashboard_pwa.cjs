// Script de test d'extraction et validation des métriques du dashboard
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erreur: Supabase URL ou clé manquante.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log("=== VÉRIFICATION DES DONNÉES DU DASHBOARD ===");

  // 1. Année scolaire active
  const { data: year, error: yErr } = await supabase
    .from('school_years')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();

  if (yErr) {
    console.error("Erreur school_years:", yErr);
    return;
  }
  console.log("Année active :", year?.name, "(ID:", year?.id, ")");

  // 2. Séquences & Trimestres
  const { data: seqs } = await supabase.from('sequences').select('*').order('order_index');
  const { data: terms } = await supabase.from('terms').select('*').order('order_index');
  console.log("Trimestres trouvés :", terms?.length, "| Séquences :", seqs?.length);

  // 3. Élèves par statut
  const { data: students } = await supabase.from('students').select('id, status, class_id');
  const activeCount = (students || []).filter(s => s.status === 'active').length;
  const pendingCount = (students || []).filter(s => s.status === 'pending_registration').length;
  console.log("Élèves total :", students?.length, "| Actifs :", activeCount, "| En attente :", pendingCount);

  // 4. Classes
  const { data: classes } = await supabase.from('classes').select('id, name, division_id');
  console.log("Classes trouvées :", classes?.length);

  // 5. Attributions d'enseignants
  const { data: assignments } = await supabase.from('teacher_assignments').select('id, class_id, subject_id');
  console.log("Attributions totales :", assignments?.length);

  // 6. Soumissions réelles dans grade_submissions
  const { data: submissions } = await supabase.from('grade_submissions').select('id, class_id, subject_id, sequence_id, is_locked');
  console.log("Soumissions réelles dans grade_submissions :", submissions?.length);
  if (submissions && submissions.length > 0) {
    console.log("Exemple soumission :", submissions[0]);
  }

  // 7. Paiements pour l'année active
  const { data: payments } = await supabase
    .from('payments')
    .select('id, amount, payment_date')
    .eq('school_year_id', year.id);

  const totalPaid = (payments || []).reduce((acc, p) => acc + Number(p.amount || 0), 0);
  console.log("Paiements enregistrés :", payments?.length, "| Total encaissé :", totalPaid, "FCFA");

  // 8. Vérification du manifest.json et SW
  const manifestPath = path.resolve(__dirname, '../packages/web/public/manifest.json');
  const swPath = path.resolve(__dirname, '../packages/web/public/sw.js');
  const icon192Path = path.resolve(__dirname, '../packages/web/public/icon-192.png');
  const icon512Path = path.resolve(__dirname, '../packages/web/public/icon-512.png');

  console.log("\n=== VÉRIFICATION PWA ===");
  console.log("manifest.json existe :", fs.existsSync(manifestPath));
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log("Manifest short_name :", manifest.short_name);
    console.log("Manifest display :", manifest.display);
    console.log("Manifest icons :", manifest.icons?.map(i => `${i.sizes} (${i.src})`).join(', '));
  }
  console.log("sw.js existe :", fs.existsSync(swPath));
  console.log("icon-192.png existe :", fs.existsSync(icon192Path), "(taille:", fs.statSync(icon192Path).size, "octets)");
  console.log("icon-512.png existe :", fs.existsSync(icon512Path), "(taille:", fs.statSync(icon512Path).size, "octets)");

  console.log("\n=== TEST COMPLÉTÉ AVEC SUCCÈS ===");
}

runTest().catch(console.error);
