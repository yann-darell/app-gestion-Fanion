/**
 * verify_rls_teacher_assignments.js
 * Script de vérification RLS — Lot D2 (Attribution des enseignants)
 *
 * Exécution :
 *   $env:TEST_PRINCIPAL_PW="xxx"; $env:TEST_ENSEIGNANT_PW="yyy"; node scratch/verify_rls_teacher_assignments.js
 *
 * Résultat attendu : "TOUS LES TESTS RLS TEACHER_ASSIGNMENTS SONT PASSÉS AVEC SUCCÈS !"
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ── 1. Charger .env ─────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
  console.error('Erreur : Fichier .env introuvable à la racine.');
  process.exit(1);
}
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?$/);
  if (match) {
    let value = (match[2] || '').trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Erreur : VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquants dans le .env.');
  process.exit(1);
}

const principalPw = process.env.TEST_PRINCIPAL_PW;
const enseignantPw = process.env.TEST_ENSEIGNANT_PW;
if (!principalPw || !enseignantPw) {
  console.error('Erreur : TEST_PRINCIPAL_PW ou TEST_ENSEIGNANT_PW manquants.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function pass(label) { console.log(`  ✅ PASS — ${label}`); }
function fail(label, detail) {
  console.error(`  ❌ FAIL — ${label}`);
  if (detail) console.error(`     → ${detail}`);
  process.exit(1);
}

async function signIn(email, password, role) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) fail(`Connexion ${role}`, error.message);
  console.log(`\n→ Connecté en tant que ${role}`);
}

async function signOut() {
  await supabase.auth.signOut();
}

// ── Tests ────────────────────────────────────────────────────────────────────
async function runTests() {
  let testAssignmentId = null;

  try {
    // ═══════════════════════════════════════════════════════
    // Étape 1 : Principal — préparation des données de test
    // ═══════════════════════════════════════════════════════
    console.log('\n=== Étape 1 : Connexion Principal — récupération des données ===');
    await signIn('principal@lefanion.com', principalPw, 'Principal');

    // Récupère un enseignant valide
    const { data: teachers, error: tErr } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('role', 'enseignant')
      .limit(1);
    if (tErr || !teachers?.length) fail('SELECT profiles (enseignant)', tErr?.message || 'Aucun enseignant trouvé dans profiles');
    const teacher = teachers[0];
    pass(`Enseignant de test : "${teacher.full_name}" (id: ${teacher.id})`);

    // Récupère le profil du principal lui-même (pour le test trigger rôle)
    const { data: { user: principalUser } } = await supabase.auth.getUser();
    const principalId = principalUser?.id;
    if (!principalId) fail('Récupération profil principal', 'Impossible de récupérer l\'UUID du principal connecté');
    pass(`UUID Principal récupéré : ${principalId}`);

    // Récupère une matière collège
    const { data: subjects, error: sErr } = await supabase
      .from('subjects')
      .select('id, name, division_id')
      .eq('division_id', 'college')
      .limit(1);
    if (sErr || !subjects?.length) fail('SELECT subjects (collège)', sErr?.message || 'Aucune matière collège trouvée');
    const subject = subjects[0];
    pass(`Matière de test : "${subject.name}" (division: ${subject.division_id})`);

    // Récupère une classe collège
    const { data: classesCollege, error: ccErr } = await supabase
      .from('classes')
      .select('id, name, division_id')
      .eq('division_id', 'college')
      .limit(1);
    if (ccErr || !classesCollege?.length) fail('SELECT classes (collège)', ccErr?.message || 'Aucune classe collège trouvée');
    const classCollege = classesCollege[0];
    pass(`Classe collège de test : "${classCollege.name}"`);

    // Récupère une classe primaire (pour test trigger division)
    const { data: classesPrimaire, error: cpErr } = await supabase
      .from('classes')
      .select('id, name, division_id')
      .eq('division_id', 'primaire')
      .limit(1);
    if (cpErr || !classesPrimaire?.length) {
      console.warn('  ⚠️  Aucune classe primaire trouvée — test trigger division ignoré.');
    }
    const classPrimaire = classesPrimaire?.[0] ?? null;

    // ═══════════════════════════════════════════════════════
    // Test 1 : Principal — INSERT une attribution valide
    // ═══════════════════════════════════════════════════════
    console.log('\n=== Test 1 : Principal — INSERT attribution valide ===');
    const { data: newAssignment, error: insErr } = await supabase
      .from('teacher_assignments')
      .insert({
        teacher_id: teacher.id,
        subject_id: subject.id,
        class_id: classCollege.id,
      })
      .select()
      .single();
    if (insErr) fail('INSERT teacher_assignments (principal)', insErr.message);
    testAssignmentId = newAssignment.id;
    pass(`Attribution créée (id: ${testAssignmentId})`);

    // ═══════════════════════════════════════════════════════
    // Test 2 : Principal — SELECT cette attribution
    // ═══════════════════════════════════════════════════════
    console.log('\n=== Test 2 : Principal — SELECT attribution ===');
    const { data: readData, error: readErr } = await supabase
      .from('teacher_assignments')
      .select('*')
      .eq('id', testAssignmentId);
    if (readErr) fail('SELECT teacher_assignments (principal)', readErr.message);
    if (!readData?.length) fail('SELECT teacher_assignments (principal)', 'Attribution non trouvée');
    pass('SELECT teacher_assignments — lecture autorisée pour le principal');

    // ═══════════════════════════════════════════════════════
    // Test 3 : Principal — Trigger rôle : INSERT avec principal comme teacher_id
    // ═══════════════════════════════════════════════════════
    console.log('\n=== Test 3 : Principal — Trigger rôle : assigner le principal lui-même ===');
    const { data: badRoleData, error: badRoleErr } = await supabase
      .from('teacher_assignments')
      .insert({
        teacher_id: principalId,
        subject_id: subject.id,
        class_id: classCollege.id,
      })
      .select()
      .single();
    if (badRoleErr) {
      pass(`Trigger rôle — rejeté comme attendu : "${badRoleErr.message}"`);
      if (!badRoleErr.message.includes('enseignant')) {
        console.warn('  ⚠️  Le message d\'erreur ne mentionne pas "enseignant" — vérifier le trigger.');
      }
    } else {
      // Nettoyage de l'intrusion avant d'échouer
      await supabase.from('teacher_assignments').delete().eq('id', badRoleData.id);
      fail('Trigger rôle', '⚠️  FAILLE : le principal a pu être assigné comme enseignant !');
    }

    // ═══════════════════════════════════════════════════════
    // Test 4 : Principal — Trigger division : matière collège + classe primaire
    // ═══════════════════════════════════════════════════════
    if (classPrimaire) {
      console.log('\n=== Test 4 : Principal — Trigger division : matière collège / classe primaire ===');
      const { data: badDivData, error: badDivErr } = await supabase
        .from('teacher_assignments')
        .insert({
          teacher_id: teacher.id,
          subject_id: subject.id,   // division = college
          class_id: classPrimaire.id, // division = primaire
        })
        .select()
        .single();
      if (badDivErr) {
        pass(`Trigger division — rejeté comme attendu : "${badDivErr.message}"`);
      } else {
        await supabase.from('teacher_assignments').delete().eq('id', badDivData.id);
        fail('Trigger division', '⚠️  FAILLE : attribution inter-division acceptée !');
      }
    } else {
      console.log('  ⏭️  Test 4 ignoré (aucune classe primaire disponible)');
    }

    await signOut();

    // ═══════════════════════════════════════════════════════
    // Test 5 : Enseignant — SELECT bloqué par RLS
    // ═══════════════════════════════════════════════════════
    console.log('\n=== Test 5 : Enseignant — SELECT bloqué (RLS admin-only) ===');
    await signIn('enseignant@lefanion.com', enseignantPw, 'Enseignant');

    const { data: teacherRead, error: trErr } = await supabase
      .from('teacher_assignments')
      .select('*');
    if (trErr) {
      // Certaines configs RLS retournent une erreur plutôt que 0 lignes
      pass(`SELECT teacher_assignments (enseignant) — bloqué par RLS : "${trErr.message}"`);
    } else if (!teacherRead?.length) {
      pass('SELECT teacher_assignments (enseignant) — 0 lignes retournées (RLS opaque)');
    } else {
      fail('SELECT teacher_assignments (enseignant)', `⚠️  FAILLE : l'enseignant voit ${teacherRead.length} attribution(s) !`);
    }

    // ═══════════════════════════════════════════════════════
    // Test 6 : Enseignant — INSERT bloqué par RLS
    // ═══════════════════════════════════════════════════════
    console.log('\n=== Test 6 : Enseignant — INSERT bloqué (RLS admin-only) ===');
    const { data: teacherIns, error: tiErr } = await supabase
      .from('teacher_assignments')
      .insert({
        teacher_id: teacher.id,
        subject_id: subject.id,
        class_id: classCollege.id,
      })
      .select()
      .single();
    if (tiErr) {
      pass(`INSERT teacher_assignments (enseignant) — rejeté par RLS : "${tiErr.message}"`);
    } else {
      await supabase.from('teacher_assignments').delete().eq('id', teacherIns.id);
      fail('INSERT teacher_assignments (enseignant)', '⚠️  FAILLE DE SÉCURITÉ : l\'enseignant a pu créer une attribution !');
    }

    await signOut();

    // ═══════════════════════════════════════════════════════
    // Étape finale : Nettoyage par le Principal
    // ═══════════════════════════════════════════════════════
    console.log('\n=== Nettoyage : Suppression de l\'attribution de test ===');
    await signIn('principal@lefanion.com', principalPw, 'Principal (nettoyage)');

    if (testAssignmentId) {
      const { error: delErr } = await supabase
        .from('teacher_assignments')
        .delete()
        .eq('id', testAssignmentId);
      if (delErr) console.warn(`  ⚠️  Nettoyage attribution : ${delErr.message}`);
      else pass('Attribution de test supprimée');
    }
    await signOut();

    console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║  TOUS LES TESTS RLS TEACHER_ASSIGNMENTS SONT PASSÉS AVEC SUCCÈS ! ✅ ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝\n');
    process.exit(0);

  } catch (err) {
    console.error('\nERREUR INATTENDUE :', err.message || err);
    // Tentative de nettoyage d'urgence
    try {
      await signIn('principal@lefanion.com', principalPw, 'Principal (urgence)');
      if (testAssignmentId) await supabase.from('teacher_assignments').delete().eq('id', testAssignmentId);
      await signOut();
    } catch (_) { }
    process.exit(1);
  }
}

runTests();
