const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 1. Charger le fichier .env
const envPath = path.join(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
  console.error("Erreur : Fichier .env introuvable à la racine.");
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.length > 0 && value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Erreur : VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquants dans le .env.");
  process.exit(1);
}

const principalPw = process.env.TEST_PRINCIPAL_PW;
const enseignantPw = process.env.TEST_ENSEIGNANT_PW;

if (!principalPw || !enseignantPw) {
  console.error("Erreur : Variables d'environnement TEST_PRINCIPAL_PW ou TEST_ENSEIGNANT_PW manquantes.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
});

async function runTests() {
  let testStudentId = null;

  try {
    console.log("\n=== Étape 1 : Connexion en tant que Principal ===");
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: 'principal@lefanion.com',
      password: principalPw
    });

    if (authError) {
      throw new Error(`Échec de la connexion du principal : ${authError.message}`);
    }
    console.log("Principal connecté avec succès.");

    // Récupérer une classe valide
    const { data: classes, error: classErr } = await supabase
      .from('classes')
      .select('id, name')
      .limit(1);

    if (classErr || !classes || classes.length === 0) {
      throw new Error("Aucune classe disponible pour rattacher l'élève de test.");
    }
    const targetClassId = classes[0].id;
    console.log(`Classe de test trouvée : ${classes[0].name} (ID: ${targetClassId})`);

    // Tenter de créer un élève
    console.log("Tentative de création d'un élève par le principal...");
    const { data: newStudent, error: createError } = await supabase
      .from('students')
      .insert({
        matricule: `TEST-RLS-${Date.now()}`,
        first_name: 'Élève',
        last_name: 'Test RLS',
        birth_date: '2012-05-15',
        gender: 'M',
        class_id: targetClassId,
        guardian_name: 'Tuteur Test',
        guardian_phone: '690000000',
        status: 'active'
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Échec de la création de l'élève par le principal : ${createError.message}`);
    }

    testStudentId = newStudent.id;
    console.log(`Élève créé avec succès par le principal ! ID : ${testStudentId}`);

    await supabase.auth.signOut();
    console.log("Principal déconnecté.");

    console.log("\n=== Étape 2 : Connexion en tant qu'Enseignant ===");
    const { error: teacherAuthError } = await supabase.auth.signInWithPassword({
      email: 'enseignant@lefanion.com',
      password: enseignantPw
    });

    if (teacherAuthError) {
      throw new Error(`Échec de la connexion de l'enseignant : ${teacherAuthError.message}`);
    }
    console.log("Enseignant connecté avec succès.");

    // 2a. Test lecture (SELECT) par l'enseignant (doit renvoyer 0 ligne ou erreur RLS)
    console.log("Test de lecture des élèves par l'enseignant (doit être bloqué par RLS)...");
    const { data: teacherReadData, error: teacherReadError } = await supabase
      .from('students')
      .select('*')
      .eq('id', testStudentId);

    if (teacherReadError) {
      console.log(`Succès (SELECT) : Rejeté par la base de données : ${teacherReadError.message}`);
    } else if (!teacherReadData || teacherReadData.length === 0) {
      console.log("Succès (SELECT) : RLS a filtré l'accès (0 ligne retournée pour l'enseignant).");
    } else {
      console.error("FAILLE DE SÉCURITÉ : L'enseignant peut lire la table 'students' !");
      process.exit(1);
    }

    // 2b. Test écriture (INSERT) par l'enseignant (doit échouer)
    console.log("Test de création d'un élève par l'enseignant (doit échouer via RLS)...");
    const { data: teacherInsertData, error: teacherInsertError } = await supabase
      .from('students')
      .insert({
        matricule: `TEST-TEACHER-${Date.now()}`,
        first_name: 'Élève',
        last_name: 'Test Enseignant',
        birth_date: '2012-01-01',
        gender: 'F',
        class_id: targetClassId,
        guardian_name: 'Tuteur Test',
        guardian_phone: '690000000'
      })
      .select()
      .single();

    if (teacherInsertError) {
      console.log(`Succès (INSERT) : Rejeté comme attendu par RLS : ${teacherInsertError.message}`);
    } else {
      console.error("FAILLE DE SÉCURITÉ : L'enseignant a réussi à créer un élève !");
      if (teacherInsertData?.id) {
        await supabase.from('students').delete().eq('id', teacherInsertData.id);
      }
      process.exit(1);
    }

    await supabase.auth.signOut();
    console.log("Enseignant déconnecté.");

    // Étape 3 : Nettoyage
    console.log("\n=== Étape 3 : Nettoyage par le Principal ===");
    await supabase.auth.signInWithPassword({
      email: 'principal@lefanion.com',
      password: principalPw
    });

    if (testStudentId) {
      const { error: delErr } = await supabase.from('students').delete().eq('id', testStudentId);
      if (delErr) {
        console.warn("Avertissement lors de la suppression de test:", delErr.message);
      } else {
        console.log("Élève de test nettoyé avec succès.");
      }
    }
    await supabase.auth.signOut();

    console.log("\n=== RÉSULTATS : TOUS LES TESTS RLS ÉLÈVES SONT PASSÉS AVEC SUCCÈS ! ===");
    process.exit(0);

  } catch (err) {
    console.error("\nERREUR DANS LE SCRIPT DE VÉRIFICATION RLS :");
    console.error(err.message);
    if (testStudentId) {
      try {
        await supabase.auth.signInWithPassword({ email: 'principal@lefanion.com', password: principalPw });
        await supabase.from('students').delete().eq('id', testStudentId);
      } catch (e) {}
    }
    process.exit(1);
  }
}

runTests();
