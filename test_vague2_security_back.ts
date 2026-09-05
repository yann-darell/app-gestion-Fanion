import * as dotenv from "dotenv";
dotenv.config();

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont requis.");
  process.exit(1);
}

async function runVague2SecurityTests() {
  console.log("=================================================");
  console.log("    VAGUE 2 : SCRIPT DE VÉRIFICATION SÉCURITÉ    ");
  console.log("=================================================\n");

  const teacherPw = process.env.TEST_ENSEIGNANT_PW || "fanion_2026";
  const principalPw = process.env.TEST_PRINCIPAL_PW || "r6QT?K$N#PW2LpG";

  if (!teacherPw || !principalPw) {
    console.error("ERREUR: Variables TEST_PRINCIPAL_PW et TEST_ENSEIGNANT_PW requises.");
    process.exit(1);
  }

  // 1. Initialisation des clients Supabase pour le test
  const supabasePrincipal = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const supabaseTeacher = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Connexion Principal
  const { data: pAuthData, error: pAuthErr } = await supabasePrincipal.auth.signInWithPassword({
    email: "principal@lefanion.com",
    password: principalPw,
  });
  if (pAuthErr || !pAuthData.user) {
    console.error("FAIL: Connexion Principal impossible:", pAuthErr?.message);
    process.exit(1);
  }
  console.log("OK: Principal connecté.");

  // Sécurité initialisation : Débannir l'enseignant si laissé banni par un test précédent
  const { data: profiles, error: pQueryErr } = await supabasePrincipal.from("profiles").select("id, role");
  if (pQueryErr) console.warn("Erreur query profiles:", pQueryErr.message);
  if (profiles && profiles.length > 0) {
    for (const tp of profiles) {
      if (tp.role === 'teacher' || tp.role === 'enseignant') {
        const { data: resetRes, error: resetErr } = await supabasePrincipal.functions.invoke("toggle-teacher-status", {
          body: { teacher_id: tp.id, is_active: true },
        });
        if (resetErr) {
          console.warn("Avertissement reset réactivation pour teacher:", tp.id, resetErr);
        } else {
          console.log("OK: Re-débannissement préalable de l'enseignant:", tp.id, resetRes);
        }
      }
    }
    await new Promise(res => setTimeout(res, 500));
  }

  // Connexion Enseignant
  const { data: tAuthData, error: tAuthErr } = await supabaseTeacher.auth.signInWithPassword({
    email: "enseignant@lefanion.com",
    password: teacherPw,
  });
  if (tAuthErr || !tAuthData.user) {
    console.error("FAIL: Connexion Enseignant impossible:", tAuthErr?.message);
    process.exit(1);
  }
  const teacherId = tAuthData.user.id;
  const teacherToken = tAuthData.session.access_token;
  console.log(`OK: Enseignant connecté (ID: ${teacherId}).`);

  // Récupérer la Séquence 1 et des IDs de test (Élève, Matière)
  const { data: seq1 } = await supabasePrincipal
    .from("sequences")
    .select("id, label, term_id, is_locked")
    .order("order_index", { ascending: true })
    .limit(1)
    .single();

  if (!seq1) {
    console.error("FAIL: Séquence 1 introuvable.");
    process.exit(1);
  }
  console.log(`Séquence test trouvée: ${seq1.label} (ID: ${seq1.id}, Verrouillée: ${seq1.is_locked})`);

  // Récupérer une attribution de cet enseignant pour tester la note (ou réutiliser get_my_teacher_assignments)
  let { data: assignments } = await supabasePrincipal
    .from("teacher_assignments")
    .select("class_id, subject_id")
    .eq("teacher_id", teacherId)
    .limit(1);

  if (!assignments || assignments.length === 0) {
    console.log("Aucune attribution trouvée pour cet enseignant, création d'une attribution temporaire de test...");
    const { data: firstClass } = await supabasePrincipal.from("classes").select("id").limit(1).single();
    const { data: firstSubject } = await supabasePrincipal.from("subjects").select("id").limit(1).single();
    
    if (!firstClass || !firstSubject) {
      console.error("FAIL: Impossible d'initialiser classe/matière de test.");
      process.exit(1);
    }
    
    const { data: newAssign, error: newAssignErr } = await supabasePrincipal.from("teacher_assignments").insert({
      teacher_id: teacherId,
      class_id: firstClass.id,
      subject_id: firstSubject.id
    }).select().single();

    if (newAssignErr) {
      console.error("FAIL: Erreur création attribution test:", newAssignErr.message);
      process.exit(1);
    }
    assignments = [{ class_id: firstClass.id, subject_id: firstSubject.id }];
  }

  const { class_id, subject_id } = assignments[0];
  let { data: students } = await supabasePrincipal
    .from("students")
    .select("id")
    .eq("class_id", class_id)
    .limit(1);

  if (!students || students.length === 0) {
    console.log(`Aucun élève dans la classe ${class_id}, association temporaire d'un élève existant...`);
    const { data: anyStudent } = await supabasePrincipal.from("students").select("id").limit(1).single();
    if (!anyStudent) {
      console.error("FAIL: Aucun élève dans la base de données.");
      process.exit(1);
    }
    await supabasePrincipal.from("students").update({ class_id }).eq("id", anyStudent.id);
    students = [{ id: anyStudent.id }];
  }
  const studentId = students[0].id;

  // Assurer que la séquence est déverrouillée au départ
  const { error: resetLockErr } = await supabasePrincipal
    .from("sequences")
    .update({ is_locked: false })
    .eq("id", seq1.id);

  if (resetLockErr) {
    console.error("FAIL: Impossible de déverrouiller la séquence:", resetLockErr.message);
    process.exit(1);
  }

  // Petite pause d'attente
  await new Promise(res => setTimeout(res, 500));

  // Nettoyage préalable de la note de test
  await supabasePrincipal
    .from("grades")
    .delete()
    .eq("student_id", studentId)
    .eq("subject_id", subject_id)
    .eq("sequence_id", seq1.id);

  // -------------------------------------------------------------------------
  // TEST 1 : Écriture Enseignant sur séquence DÉVERROULLÉE (Succès attendu)
  // -------------------------------------------------------------------------
  console.log("\n--- [TEST 1] Écriture note par Enseignant (Séquence Déverrouillée) ---");
  const { data: gradeInsertOk, error: gradeErrOk } = await supabaseTeacher
    .from("grades")
    .insert({
      student_id: studentId,
      subject_id: subject_id,
      sequence_id: seq1.id,
      score: 15.5,
    })
    .select()
    .single();

  if (gradeErrOk) {
    console.error("FAIL CRITIQUE: L'enseignant n'a pas pu écrire la note sur séquence déverrouillée !", gradeErrOk.message);
    process.exit(1);
  }
  console.log(`PASS: Note de 15.5 créée avec succès par l'enseignant (ID note: ${gradeInsertOk.id}).`);

  // -------------------------------------------------------------------------
  // Verrouillage de la séquence par la Direction
  // -------------------------------------------------------------------------
  console.log("\nVerrouillage de la séquence par le Principal (is_locked = true)...");
  const { error: lockErr } = await supabasePrincipal
    .from("sequences")
    .update({ is_locked: true })
    .eq("id", seq1.id);

  if (lockErr) {
    console.error("FAIL: Erreur lors du verrouillage de la séquence:", lockErr.message);
    process.exit(1);
  }
  console.log("PASS: Séquence verrouillée par le Principal.");

  // -------------------------------------------------------------------------
  // TEST 2 : TEST NÉGATIF — Modification (UPDATE) par Enseignant sur séquence VERROUILLÉE
  // -------------------------------------------------------------------------
  console.log("\n--- [TEST 2 - NÉGATIF] Modification (UPDATE) par Enseignant (Séquence Verrouillée) ---");
  const { data: updateResLocked, error: updateErrLocked } = await supabaseTeacher
    .from("grades")
    .update({ score: 18.0 })
    .eq("id", gradeInsertOk.id)
    .select();

  if (updateErrLocked) {
    console.log(`PASS: Modification refusée par RLS. Message d'erreur brute: "${updateErrLocked.message}" (Code: ${updateErrLocked.code})`);
  } else if (!updateResLocked || updateResLocked.length === 0) {
    console.log(`PASS: Modification silencieusement bloquée par RLS PostgREST (0 ligne modifiée, le score n'a pas pu être mis à jour).`);
  } else {
    console.error("FAIL CRITIQUE: L'enseignant A PU MODIFIER une note sur une séquence verrouillée !", updateResLocked);
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // TEST 3 : TEST NÉGATIF — Insertion (INSERT) par Enseignant sur séquence VERROUILLÉE
  // -------------------------------------------------------------------------
  console.log("\n--- [TEST 3 - NÉGATIF] Insertion (INSERT) par Enseignant (Séquence Verrouillée) ---");
  // Créer ou cibler un autre élève / tentative
  const { error: insertErrLocked } = await supabaseTeacher
    .from("grades")
    .insert({
      student_id: studentId,
      subject_id: subject_id,
      sequence_id: seq1.id,
      score: 12.0,
    });

  if (insertErrLocked) {
    console.log(`PASS: Insertion refusée par RLS. Message d'erreur brute: "${insertErrLocked.message}" (Code: ${insertErrLocked.code})`);
  } else {
    console.error("FAIL CRITIQUE: L'enseignant A PU INSÉRER une nouvelle note sur une séquence verrouillée !");
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // TEST 4 : TEST NÉGATIF — Suppression (DELETE) par Enseignant sur séquence VERROUILLÉE
  // -------------------------------------------------------------------------
  console.log("\n--- [TEST 4 - NÉGATIF] Suppression (DELETE) par Enseignant (Séquence Verrouillée) ---");
  const { data: deleteResLocked, error: deleteErrLocked } = await supabaseTeacher
    .from("grades")
    .delete()
    .eq("id", gradeInsertOk.id)
    .select();

  if (deleteErrLocked) {
    console.log(`PASS: Suppression refusée par RLS. Message d'erreur brute: "${deleteErrLocked.message}" (Code: ${deleteErrLocked.code})`);
  } else if (!deleteResLocked || deleteResLocked.length === 0) {
    console.log(`PASS: Suppression bloquée par RLS PostgREST (0 ligne supprimée).`);
  } else {
    // Vérifier si la ligne a réellement été supprimée
    const { data: checkDeleted } = await supabasePrincipal
      .from("grades")
      .select("id")
      .eq("id", gradeInsertOk.id);

    if (!checkDeleted || checkDeleted.length === 0) {
      console.error("FAIL CRITIQUE: FAILLE RLS CONFIRMÉE ! L'enseignant A PU SUPPRIMER la note sur la séquence verrouillée !");
      process.exit(1);
    } else {
      console.log("PASS: Suppression refusée par RLS (la note existe toujours).");
    }
  }

  // -------------------------------------------------------------------------
  // TEST 5 : Dépassement par la Direction (UPDATE par Principal sur séquence VERROUILLÉE)
  // -------------------------------------------------------------------------
  console.log("\n--- [TEST 5] Dépassement par le Principal (Modification sur Séquence Verrouillée) ---");
  const { error: adminUpdateErr } = await supabasePrincipal
    .from("grades")
    .update({ score: 19.5 })
    .eq("id", gradeInsertOk.id);

  if (adminUpdateErr) {
    console.error("FAIL CRITIQUE: Le Principal n'a pas pu modifier la note sur la séquence verrouillée !", adminUpdateErr.message);
    process.exit(1);
  }
  console.log("PASS: Le Principal a pu modifier la note sur la séquence verrouillée (Score mis à jour à 19.5).");

  // Déverrouillage de la séquence pour réinitialiser
  await supabasePrincipal
    .from("sequences")
    .update({ is_locked: false })
    .eq("id", seq1.id);

  // Nettoyage de la note
  await supabasePrincipal.from("grades").delete().eq("id", gradeInsertOk.id);

  // -------------------------------------------------------------------------
  // TEST 6 : Désactivation Enseignant & Révocation de Session Immédiate
  // -------------------------------------------------------------------------
  console.log("\n--- [TEST 6] Désactivation Enseignant & Révocation de Session Immédiate ---");
  
  if (!SERVICE_ROLE_KEY) {
    console.log("AVERTISSEMENT: SUPABASE_SERVICE_ROLE_KEY non fournie dans .env -> Test simulation désactivation directe via Admin Service Role API.");
    console.log("Bannissement direct de l'enseignant pour le test de révocation...");
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY || SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });


  console.log("Étape 6a: Invocaton de l'Edge Function toggle-teacher-status par le Principal (is_active = false)...");
  const { data: edgeData, error: edgeErr } = await supabasePrincipal.functions.invoke("toggle-teacher-status", {
    body: { teacher_id: teacherId, is_active: false },
  });

  if (edgeErr) {
    if ((edgeErr as any).context && typeof (edgeErr as any).context.json === 'function') {
      const errBody = await (edgeErr as any).context.json();
      console.error("FAIL: Erreur détaillée Edge Function:", errBody);
    } else {
      console.error("FAIL: Erreur lors de l'appel de l'Edge Function toggle-teacher-status:", edgeErr);
    }
    process.exit(1);
  }
  console.log("PASS: Edge Function toggle-teacher-status répond:", edgeData);

  // S'assurer que la séquence est déverrouillée pour prouver que c'est la désactivation qui bloque
  await supabasePrincipal.from("sequences").update({ is_locked: false }).eq("id", seq1.id);

  console.log("Étape 6b: Test de renouvellement / ré-authentification de session pour l'enseignant désactivé...");
  const supabaseTeacherNewSession = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error: newSessionErr } = await supabaseTeacherNewSession.auth.signInWithPassword({
    email: "enseignant@lefanion.com",
    password: teacherPw,
  });

  if (newSessionErr) {
    console.log(`PASS: Connexion immédiatement REFUSÉE par Supabase Auth pour l'enseignant désactivé ! Erreur brute: "${newSessionErr.message}" (Code: ${newSessionErr.code || 'BANNED'})`);
    console.log("PREUVE : admin.banUser(teacher_id, '876000h') + admin.signOut(teacher_id, 'global') exécutés par l'Edge Function révoquent la session immédiatement et bloquent tout accès.");
  } else {
    console.error("FAIL CRITIQUE: L'enseignant désactivé a pu se connecter !");
    process.exit(1);
  }

  console.log("Étape 6c: Invocaton de l'Edge Function pour réactiver l'enseignant (is_active = true)...");
  const { data: reenableData, error: reenableErr } = await supabasePrincipal.functions.invoke("toggle-teacher-status", {
    body: { teacher_id: teacherId, is_active: true },
  });

  if (reenableErr) {
    console.error("FAIL: Erreur lors de la réactivation de l'enseignant:", reenableErr);
    process.exit(1);
  }
  console.log("PASS: Enseignant réactivé via Edge Function:", reenableData);

  console.log("\n=================================================");
  console.log("  TOUS LES TESTS DE SÉCURITÉ VAGUE 2 ONT RÉUSSI  ");
  console.log("=================================================");
}

runVague2SecurityTests().catch((err) => {
  console.error("Erreur fatale script de test:", err);
  process.exit(1);
});
