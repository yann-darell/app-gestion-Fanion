/**
 * verify_rls_subjects.js
 * Script de vérification RLS — Lot D1 (Matières, Groupes, Coefficients, Trimestres, Séquences)
 *
 * Exécution :
 *   $env:TEST_PRINCIPAL_PW="xxx"; $env:TEST_ENSEIGNANT_PW="yyy"; node scratch/verify_rls_subjects.js
 *
 * Résultat attendu : "TOUS LES TESTS RLS MATIÈRES SONT PASSÉS AVEC SUCCÈS !"
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
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Erreur : VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquants dans le .env.');
  process.exit(1);
}

const principalPw  = process.env.TEST_PRINCIPAL_PW;
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
  let testSubjectId   = null;
  let testCscId       = null;

  try {
    // ═══════════════════════════════════════════════════════
    // Étape 1 : Principal — droits en écriture
    // ═══════════════════════════════════════════════════════
    console.log('\n=== Étape 1 : Connexion Principal (doit pouvoir écrire) ===');
    await signIn('principal@lefanion.com', principalPw, 'Principal');

    // 1a. Récupère les IDs nécessaires
    const { data: groups, error: gErr } = await supabase
      .from('subject_groups')
      .select('id, label')
      .order('label');
    if (gErr || !groups?.length) fail('SELECT subject_groups (principal)', gErr?.message || 'Aucun groupe');
    pass(`SELECT subject_groups — ${groups.length} groupes trouvés (I, II, III, IV)`);
    const groupI = groups.find(g => g.label === 'I');

    const { data: terms, error: tErr } = await supabase
      .from('terms')
      .select('id, label')
      .order('order_index')
      .limit(1);
    if (tErr || !terms?.length) fail('SELECT terms (principal)', tErr?.message || 'Aucun trimestre — seed non exécuté ?');
    pass(`SELECT terms — Trimestre trouvé : "${terms[0].label}"`);

    const { data: sequences, error: sErr } = await supabase
      .from('sequences')
      .select('id, label')
      .eq('term_id', terms[0].id)
      .order('order_index')
      .limit(1);
    if (sErr || !sequences?.length) fail('SELECT sequences (principal)', sErr?.message || 'Aucune séquence');
    pass(`SELECT sequences — Séquence trouvée : "${sequences[0].label}"`);

    // 1b. Crée une matière de test
    const { data: newSubject, error: insErr } = await supabase
      .from('subjects')
      .insert({ name: `TEST-RLS-MATIERE-${Date.now()}`, division_id: 'college' })
      .select()
      .single();
    if (insErr) fail('INSERT subjects (principal)', insErr.message);
    testSubjectId = newSubject.id;
    pass(`INSERT subjects — Matière de test créée (id: ${testSubjectId})`);

    // 1c. Récupère une classe valide pour le coefficient
    const { data: classes, error: cErr } = await supabase
      .from('classes')
      .select('id, name')
      .limit(1);
    if (cErr || !classes?.length) fail('SELECT classes (principal)', cErr?.message || 'Aucune classe');
    const targetClass = classes[0];

    // 1d. Crée un coefficient de test
    const { data: newCsc, error: cscErr } = await supabase
      .from('class_subject_coefficients')
      .insert({
        class_id:        targetClass.id,
        subject_id:      testSubjectId,
        subject_group_id: groupI.id,
        coefficient:     2
      })
      .select()
      .single();
    if (cscErr) fail('INSERT class_subject_coefficients (principal)', cscErr.message);
    testCscId = newCsc.id;
    pass(`INSERT class_subject_coefficients — Coefficient créé pour "${targetClass.name}"`);

    await signOut();

    // ═══════════════════════════════════════════════════════
    // Étape 2 : Enseignant — lecture autorisée, écriture bloquée
    // ═══════════════════════════════════════════════════════
    console.log('\n=== Étape 2 : Connexion Enseignant (lecture ✅, écriture ❌) ===');
    await signIn('enseignant@lefanion.com', enseignantPw, 'Enseignant');

    // 2a. SELECT subjects — doit fonctionner
    const { data: readSubjects, error: rsErr } = await supabase
      .from('subjects')
      .select('*')
      .eq('id', testSubjectId);
    if (rsErr) fail('SELECT subjects (enseignant)', rsErr.message);
    if (!readSubjects || readSubjects.length === 0) fail('SELECT subjects (enseignant)', 'RLS a bloqué la lecture — attendu : accès autorisé');
    pass('SELECT subjects — lecture autorisée pour l\'enseignant');

    // 2b. SELECT terms — doit fonctionner
    const { data: readTerms, error: rtErr } = await supabase.from('terms').select('*').limit(3);
    if (rtErr) fail('SELECT terms (enseignant)', rtErr.message);
    if (!readTerms || readTerms.length === 0) fail('SELECT terms (enseignant)', 'Aucun trimestre visible — RLS trop restrictive');
    pass(`SELECT terms — ${readTerms.length} trimestre(s) visibles pour l'enseignant`);

    // 2c. SELECT sequences — doit fonctionner
    const { data: readSeq, error: rseqErr } = await supabase.from('sequences').select('*').limit(6);
    if (rseqErr) fail('SELECT sequences (enseignant)', rseqErr.message);
    if (!readSeq || readSeq.length === 0) fail('SELECT sequences (enseignant)', 'Aucune séquence visible — RLS trop restrictive');
    pass(`SELECT sequences — ${readSeq.length} séquence(s) visibles pour l'enseignant`);

    // 2d. SELECT class_subject_coefficients — doit fonctionner
    const { data: readCsc, error: rcscErr } = await supabase
      .from('class_subject_coefficients')
      .select('*')
      .eq('id', testCscId);
    if (rcscErr) fail('SELECT class_subject_coefficients (enseignant)', rcscErr.message);
    if (!readCsc || readCsc.length === 0) fail('SELECT class_subject_coefficients (enseignant)', 'Lecture bloquée — attendu : accès autorisé');
    pass('SELECT class_subject_coefficients — lecture autorisée pour l\'enseignant');

    // 2e. INSERT subjects — doit ÉCHOUER
    const { data: teacherIns, error: tiErr } = await supabase
      .from('subjects')
      .insert({ name: `TEST-TEACHER-${Date.now()}`, division_id: 'college' })
      .select()
      .single();
    if (tiErr) {
      pass(`INSERT subjects (enseignant) — rejeté par RLS comme attendu : "${tiErr.message}"`);
    } else {
      // Nettoyage de l'intrusion
      await supabase.from('subjects').delete().eq('id', teacherIns.id);
      fail('INSERT subjects (enseignant)', '⚠️  FAILLE DE SÉCURITÉ : l\'enseignant a pu créer une matière !');
    }

    // 2f. INSERT class_subject_coefficients — doit ÉCHOUER
    const { data: teacherCsc, error: tcscErr } = await supabase
      .from('class_subject_coefficients')
      .insert({
        class_id:         classes[0].id,
        subject_id:       testSubjectId,
        subject_group_id: groupI.id,
        coefficient:      9
      })
      .select()
      .single();
    if (tcscErr) {
      pass(`INSERT class_subject_coefficients (enseignant) — rejeté par RLS : "${tcscErr.message}"`);
    } else {
      await supabase.from('class_subject_coefficients').delete().eq('id', teacherCsc.id);
      fail('INSERT class_subject_coefficients (enseignant)', '⚠️  FAILLE DE SÉCURITÉ : l\'enseignant a pu créer un coefficient !');
    }

    await signOut();

    // ═══════════════════════════════════════════════════════
    // Étape 3 : Nettoyage par le Principal
    // ═══════════════════════════════════════════════════════
    console.log('\n=== Étape 3 : Nettoyage par le Principal ===');
    await signIn('principal@lefanion.com', principalPw, 'Principal (nettoyage)');

    if (testCscId) {
      const { error: delCsc } = await supabase.from('class_subject_coefficients').delete().eq('id', testCscId);
      if (delCsc) console.warn(`  ⚠️  Nettoyage coefficient : ${delCsc.message}`);
      else pass('Coefficient de test supprimé');
    }
    if (testSubjectId) {
      const { error: delSub } = await supabase.from('subjects').delete().eq('id', testSubjectId);
      if (delSub) console.warn(`  ⚠️  Nettoyage matière : ${delSub.message}`);
      else pass('Matière de test supprimée');
    }
    await signOut();

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  TOUS LES TESTS RLS MATIÈRES SONT PASSÉS AVEC SUCCÈS ! ✅   ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    process.exit(0);

  } catch (err) {
    console.error('\nERREUR INATTENDUE :', err.message || err);
    // Tentative de nettoyage en cas d'erreur
    try {
      await signIn('principal@lefanion.com', principalPw, 'Principal (urgence)');
      if (testCscId) await supabase.from('class_subject_coefficients').delete().eq('id', testCscId);
      if (testSubjectId) await supabase.from('subjects').delete().eq('id', testSubjectId);
      await signOut();
    } catch (_) {}
    process.exit(1);
  }
}

runTests();
