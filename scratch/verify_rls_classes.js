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
  console.log("Veuillez lancer le script en définissant ces variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false
  }
});

async function runTests() {
  let testClassId = null;

  try {
    console.log("\n=== Étape 1 : Connexion en tant que Principal ===");
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'principal@lefanion.com',
      password: principalPw
    });

    if (authError) {
      throw new Error(`Échec de la connexion du principal : ${authError.message}`);
    }

    console.log("Principal connecté avec succès.");
    
    // Récupérer l'année scolaire active
    const { data: schoolYears, error: syError } = await supabase
      .from('school_years')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (syError || !schoolYears) {
      throw new Error(`Impossible de récupérer l'année active : ${syError ? syError.message : 'Aucune année active'}`);
    }
    
    console.log(`Année scolaire active trouvée : ${schoolYears.label} (ID: ${schoolYears.id})`);

    // Tenter de créer une classe
    console.log("Tentative de création d'une classe de test...");
    const { data: newClass, error: createError } = await supabase
      .from('classes')
      .insert({
        name: '6ème Test RLS',
        level: '6ème',
        division_id: 'college',
        school_year_id: schoolYears.id,
        head_teacher_name: 'Test RLS Principal'
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Échec de la création de la classe par le principal : ${createError.message}`);
    }

    testClassId = newClass.id;
    console.log(`Classe créée avec succès ! ID : ${testClassId}`);

    // Nettoyage de la base de données (suppression de la classe de test)
    console.log("Nettoyage de la base de données : suppression de la classe...");
    const { error: deleteError } = await supabase
      .from('classes')
      .delete()
      .eq('id', testClassId);

    if (deleteError) {
      throw new Error(`Échec de la suppression de la classe de test : ${deleteError.message}`);
    }
    console.log("Classe supprimée avec succès. Nettoyage OK.");

    // Sign out principal
    await supabase.auth.signOut();
    console.log("Principal déconnecté.");

    console.log("\n=== Étape 2 : Connexion en tant qu'Enseignant ===");
    const { data: teacherAuthData, error: teacherAuthError } = await supabase.auth.signInWithPassword({
      email: 'enseignant@lefanion.com',
      password: enseignantPw
    });

    if (teacherAuthError) {
      throw new Error(`Échec de la connexion de l'enseignant : ${teacherAuthError.message}`);
    }

    console.log("Enseignant connecté avec succès.");

    // Tenter de créer une classe (doit échouer via RLS)
    console.log("Tentative de création d'une classe par l'enseignant (doit échouer)...");
    const { data: teacherClass, error: teacherCreateError } = await supabase
      .from('classes')
      .insert({
        name: '6ème Test RLS Enseignant',
        level: '6ème',
        division_id: 'college',
        school_year_id: schoolYears.id,
        head_teacher_name: 'Test RLS Enseignant'
      })
      .select()
      .single();

    if (teacherCreateError) {
      console.log(`Succès : L'opération a été rejetée comme attendu par la base de données.`);
      console.log(`Message d'erreur Supabase RLS : ${teacherCreateError.message}`);
    } else {
      // Si la classe est créée, c'est une faille de sécurité !
      console.error("FAILLE DE SÉCURITÉ : L'enseignant a réussi à créer une classe !");
      // Suppression de sécurité
      await supabase.from('classes').delete().eq('id', teacherClass.id);
      process.exit(1);
    }

    // Sign out enseignant
    await supabase.auth.signOut();
    console.log("Enseignant déconnecté.");

    console.log("\n=== RÉSULTATS : TOUS LES TESTS SONT PASSÉS AVEC SUCCÈS ! ===");
    console.log("La RLS bloque correctement l'écriture pour l'enseignant et l'autorise pour le principal.");
    process.exit(0);

  } catch (err) {
    console.error("\nERREUR DANS LE SCRIPT DE VÉRIFICATION RLS :");
    console.error(err.message);
    
    // Nettoyage de sécurité de secours en cas d'erreur avant la suppression
    if (testClassId) {
      console.log("Tentative de nettoyage de sécurité après erreur...");
      await supabase.from('classes').delete().eq('id', testClassId);
    }
    process.exit(1);
  }
}

runTests();
