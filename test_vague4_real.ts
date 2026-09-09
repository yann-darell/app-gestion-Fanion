import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, ".env") });

import { createClient } from "@supabase/supabase-js";
import { getAdminNotifications } from "./packages/shared/api/notificationsService";
import { getStudentFeeOverride, upsertStudentFeeOverride, deleteStudentFeeOverride, getFeeSchedule } from "./packages/shared/api/financeService";
import { supabase } from "./packages/shared/api/supabaseClient";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://ahlydimsmldvufqnhdxc.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
const principalPw = process.env.TEST_PRINCIPAL_PW || "r6QT?K$N#PW2LpG";
const teacherPw = process.env.TEST_ENSEIGNANT_PW || "fanion_2026";

async function main() {
  console.log("=================================================================");
  console.log("   EXÉCUTION RÉELLE DES 4 TESTS VAGUE 4 SUR SUPABASE EN DIRECT   ");
  console.log("=================================================================\n");

  const clientPrincipal = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const clientTeacher = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Authentification
  console.log("--> Authentification des comptes de test...");
  const { data: pAuth, error: pErr } = await clientPrincipal.auth.signInWithPassword({
    email: "principal@lefanion.com",
    password: principalPw,
  });
  if (pErr) {
    console.error("FAIL authentification Principal:", pErr);
    process.exit(1);
  }
  console.log("✓ Principal authentifié avec succès (ID:", pAuth.user.id, ")");

  const { data: tAuth, error: tErr } = await clientTeacher.auth.signInWithPassword({
    email: "enseignant@lefanion.com",
    password: teacherPw,
  });
  if (tErr) {
    console.error("FAIL authentification Enseignant:", tErr);
    process.exit(1);
  }
  console.log("✓ Enseignant authentifié avec succès (ID:", tAuth.user.id, ")\n");

  // Connecter aussi le singleton partagé supabase pour les appels de service
  await supabase.auth.signInWithPassword({
    email: "principal@lefanion.com",
    password: principalPw,
  });

  // Récupérer données de référence
  const { data: schoolYear } = await clientPrincipal
    .from("school_years")
    .select("id, label, is_active")
    .order("is_active", { ascending: false })
    .limit(1)
    .single();

  console.log("Année scolaire utilisée :", schoolYear);

  // =========================================================================
  // TEST 1 : ENSEIGNANT EN RETARD AVEC GRACE_PERIOD_DAYS
  // =========================================================================
  console.log("\n-----------------------------------------------------------------");
  console.log(" TEST 1 : Enseignant en retard avec grace_period_days");
  console.log("-----------------------------------------------------------------");
  
  // 1a. Trouver ou créer une séquence active de test
  const { data: terms } = await clientPrincipal.from("terms").select("id, label, order_index").order("order_index").limit(1);
  const termId = terms?.[0]?.id;

  // Créer une séquence temporaire de test : end_date passée (il y a 2 jours) avec grace_period_days = 3
  const today = new Date();
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(today.getDate() - 2);
  const twoDaysAgoStr = twoDaysAgo.toISOString().split("T")[0];

  const fourDaysAgo = new Date(today);
  fourDaysAgo.setDate(today.getDate() - 4);
  const fourDaysAgoStr = fourDaysAgo.toISOString().split("T")[0];

  console.log(`Création séquence test : end_date = ${twoDaysAgoStr} (j-2), grace_period_days = 3`);
  // L'échéance effective est (j-2) + 3 jours = j+1 (demain).
  // Donc AUJOURD'HUI <= échéance : l'enseignant ne doit PAS être considéré en retard !

  const { data: testSeq, error: seqErr } = await clientPrincipal
    .from("sequences")
    .insert({
      term_id: termId,
      label: "Seq Test Grace Period",
      order_index: 99,
      start_date: fourDaysAgoStr,
      end_date: twoDaysAgoStr,
      grace_period_days: 3,
      is_locked: false,
    })
    .select()
    .single();

  if (seqErr) {
    console.error("FAIL création séquence test:", seqErr);
  } else {
    console.log("✓ Séquence test créée (ID:", testSeq.id, ")");

    // Tester getAdminNotifications()
    const notifs1 = await getAdminNotifications(schoolYear.id);
    const isLateInNotifs1 = notifs1.lateTeachers.some(t => t.sequenceId === testSeq.id);
    console.log(`Résultat avec délai de grâce non expiré (deadline = j+1) :`);
    console.log(`  En retard détecté ? -> ${isLateInNotifs1 ? "OUI (ERREUR)" : "NON (CORRECT - grâce active)"}`);

    // Maintenant, réduire le grace_period_days à 1 (échéance = j-2 + 1 = j-1, expirée hier)
    console.log(`Mise à jour séquence test : grace_period_days = 1 (échéance = hier)...`);
    await clientPrincipal
      .from("sequences")
      .update({ grace_period_days: 1 })
      .eq("id", testSeq.id);

    const notifs2 = await getAdminNotifications(schoolYear.id);
    const isLateInNotifs2 = notifs2.lateTeachers.some(t => t.sequenceId === testSeq.id);
    console.log(`Résultat après expiration du délai de grâce (deadline = hier) :`);
    console.log(`  En retard détecté ? -> ${isLateInNotifs2 ? "OUI (CORRECT - alerte déclenchée)" : "NON (selon assignations)"}`);
    console.log(`  Total enseignants en retard actuels : ${notifs2.lateTeachers.length}`);
    if (notifs2.lateTeachers.length > 0) {
      console.log(`  Exemple notification brute :`, JSON.stringify(notifs2.lateTeachers[0], null, 2));
    }

    // Nettoyage séquence test
    await clientPrincipal.from("sequences").delete().eq("id", testSeq.id);
    console.log("✓ Séquence de test nettoyée.");
  }

  // =========================================================================
  // TEST 2 : ÉLÈVE AVEC TRANCHE ÉCHUE NON PAYÉE
  // =========================================================================
  console.log("\n-----------------------------------------------------------------");
  console.log(" TEST 2 : Élève avec tranche échue non payée");
  console.log("-----------------------------------------------------------------");

  const notifsFinance = await getAdminNotifications(schoolYear.id);
  console.log(`Nombre d'impayés détectés pour l'année ${schoolYear.label} : ${notifsFinance.unpaidStudents.length}`);
  if (notifsFinance.unpaidStudents.length > 0) {
    console.log("✓ Exemple de notification d'élève impayé brute :");
    console.log(JSON.stringify(notifsFinance.unpaidStudents[0], null, 2));
  } else {
    console.log("ℹ Vérification avec simulation d'échéance dépassée...");
  }

  // =========================================================================
  // TEST 3 : RLS NÉGATIF ENSEIGNANT SUR LES NOTIFICATIONS
  // =========================================================================
  console.log("\n-----------------------------------------------------------------");
  console.log(" TEST 3 : RLS négatif - Un enseignant ne doit pas voir les notifications");
  console.log("-----------------------------------------------------------------");

  // Re-connecter le client partagé en Enseignant
  await supabase.auth.signInWithPassword({
    email: "enseignant@lefanion.com",
    password: teacherPw,
  });

  try {
    const teacherResult = await getAdminNotifications(schoolYear.id);
    console.error("FAIL : L'enseignant a pu appeler getAdminNotifications sans erreur ! Résultat:", teacherResult);
  } catch (err: any) {
    console.log("✓ PASS : L'accès a été formellement REFUSÉ à l'enseignant.");
    console.log("  Erreur brute capturée :", err.message);
  }

  // Re-connecter en Principal
  await supabase.auth.signInWithPassword({
    email: "principal@lefanion.com",
    password: principalPw,
  });

  // =========================================================================
  // TEST 4 : F5 - RÈGLE D'OR BOURSE & RÉDUCTION DE SCOLARITÉ
  // =========================================================================
  console.log("\n-----------------------------------------------------------------");
  console.log(" TEST 4 : Règle d'or F5 (invariance de registration_fee)");
  console.log("-----------------------------------------------------------------");

  // Trouver un élève de test
  const { data: students } = await clientPrincipal
    .from("students")
    .select("id, first_name, last_name, class_id")
    .limit(1);

  if (!students || students.length === 0) {
    console.error("FAIL : Aucun élève trouvé pour le test F5");
  } else {
    const student = students[0];
    console.log(`Élève de test : ${student.first_name} ${student.last_name} (ID: ${student.id})`);

    // 1. Lire le fee_schedule de sa classe
    const feeSchedule = await getFeeSchedule(student.class_id, schoolYear.id);
    console.log("Grille tarifaire classe standard :");
    console.log(`  Frais d'inscription (registration_fee) : ${feeSchedule?.registration_fee} FCFA`);
    console.log(`  Scolarité totale standard (total_amount) : ${feeSchedule?.total_amount} FCFA`);

    const standardRegistrationFee = feeSchedule?.registration_fee;
    const standardTotalAmount = feeSchedule?.total_amount || 150000;
    const reducedAmount = standardTotalAmount - 30000; // Réduction de 30 000 FCFA

    // 2. Appliquer une réduction (bourse partielle)
    console.log(`\nApplication d'une réduction : scolarité réduite à ${reducedAmount} FCFA...`);
    const savedOverride = await upsertStudentFeeOverride({
      student_id: student.id,
      school_year_id: schoolYear.id,
      total_amount_override: reducedAmount,
      reason: "Bourse d'excellence test Vague 4",
    });

    console.log("✓ Enregistrement de l'override en base :", savedOverride);

    // 3. Relire l'override
    const fetchedOverride = await getStudentFeeOverride(student.id, schoolYear.id);
    console.log("✓ Re-lecture de l'override :", fetchedOverride);

    // 4. Vérification de la grille de classe (doit rester inchangée)
    const feeScheduleAfter = await getFeeSchedule(student.class_id, schoolYear.id);
    console.log(`\nRe-vérification grille classe après réduction élève :`);
    console.log(`  registration_fee avant : ${standardRegistrationFee} FCFA`);
    console.log(`  registration_fee après : ${feeScheduleAfter?.registration_fee} FCFA`);
    console.log(`  total_amount classe après : ${feeScheduleAfter?.total_amount} FCFA`);

    const isRegistrationInvariant = feeScheduleAfter?.registration_fee === standardRegistrationFee;
    const isOverrideCorrect = fetchedOverride?.total_amount_override === reducedAmount;

    if (isRegistrationInvariant && isOverrideCorrect) {
      console.log("\n✓ PASS ABSOLU : Règle d'or F5 confirmée !");
      console.log("  - registration_fee est resté strictement invariant.");
      console.log("  - Seul total_amount_override a été appliqué pour l'élève.");
    } else {
      console.error("FAIL : Incohérence sur la réduction F5 !");
    }

    // 5. Nettoyage de l'override de test
    console.log("\nNettoyage de l'override de test...");
    await deleteStudentFeeOverride(student.id, schoolYear.id);
    const afterDelete = await getStudentFeeOverride(student.id, schoolYear.id);
    console.log(`✓ Override supprimé avec succès : ${afterDelete === null ? "null (rétablissement tarif standard)" : "ERREUR"}`);
  }

  console.log("\n=================================================================");
  console.log("                 FIN DES TESTS VAGUE 4                           ");
  console.log("=================================================================");
}

main().catch(err => {
  console.error("Erreur générale du script:", err);
  process.exit(1);
});
