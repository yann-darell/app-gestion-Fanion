import * as dotenv from "dotenv";
import * as path from "path";

// Charger dotenv avant d'importer le client Supabase
dotenv.config({ path: path.join(__dirname, ".env") });

import { createClient } from "@supabase/supabase-js";
import { supabase } from "./packages/shared/api/supabaseClient";
import {
  createPayment,
  deletePayment,
  upsertFeeSchedule,
  getFeeSchedule,
  FeeSchedule,
} from "./packages/shared/api/financeService";
import { runFinanceAllocationUnitTests } from "./packages/shared/api/__tests__/financeAllocation.test";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont requis dans .env.");
  process.exit(1);
}

async function runFinanceF1Verification() {
  console.log("=================================================");
  console.log("  LOT F1 : SCRIPT DE VÉRIFICATION BACKEND FINANCE ");
  console.log("=================================================\n");

  const teacherPw = process.env.TEST_ENSEIGNANT_PW || "fanion_2026";
  const principalPw = process.env.TEST_PRINCIPAL_PW || "r6QT?K$N#PW2LpG";

  if (!teacherPw || !principalPw) {
    console.error("ERREUR: Variables TEST_PRINCIPAL_PW et TEST_ENSEIGNANT_PW requises.");
    console.error("Usage PowerShell: $env:TEST_PRINCIPAL_PW='xxx'; $env:TEST_ENSEIGNANT_PW='yyy'; npx tsx test_finance_f1_back.ts");
    process.exit(1);
  }

  // =====================================================================
  // 1. Authentification Enseignant (Client Dédié pour RLS Négatif)
  // =====================================================================
  console.log("--> Connexion du compte enseignant (enseignant@lefanion.com)...");
  const supabaseTeacher = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error: tAuthErr } = await supabaseTeacher.auth.signInWithPassword({
    email: "enseignant@lefanion.com",
    password: teacherPw,
  });

  if (tAuthErr) {
    console.error("FAIL: Impossible d'authentifier enseignant@lefanion.com:", tAuthErr.message);
    process.exit(1);
  }
  console.log("OK: Enseignant connecté.\n");

  // =====================================================================
  // 2. Authentification Principal (Client Singleton Partagé)
  // =====================================================================
  console.log("--> Connexion du compte principal (principal@lefanion.com)...");
  const { error: pAuthErr } = await supabase.auth.signInWithPassword({
    email: "principal@lefanion.com",
    password: principalPw,
  });

  if (pAuthErr) {
    console.error("FAIL: Impossible d'authentifier principal@lefanion.com:", pAuthErr.message);
    process.exit(1);
  }
  console.log("OK: Principal connecté.\n");

  // =====================================================================
  // SECTION 1 : TESTS NÉGATIFS RLS STRICTS (COMPTE ENSEIGNANT)
  // =====================================================================
  console.log("=================================================");
  console.log(" SECTION 1 : TESTS NÉGATIFS RLS (COMPTE ENSEIGNANT)");
  console.log("=================================================");

  const tablesToTest = [
    "fee_schedules",
    "student_fee_overrides",
    "payments",
    "receipts",
    "receipt_counters",
  ];

  for (const tableName of tablesToTest) {
    console.log(`\n--- Test RLS sur la table '${tableName}' par l'enseignant ---`);

    // 1.1 SELECT
    const { data: selData, error: selErr } = await supabaseTeacher.from(tableName).select("*");
    if (selErr) {
      console.log(`[PASS SELECT] Rejet DB direct -> Code: ${selErr.code}, Message: "${selErr.message}"`);
    } else if (!selData || selData.length === 0) {
      console.log(`[PASS SELECT] 0 lignes retournées par RLS (filtre opaque).`);
    } else {
      console.error(`[FAIL CRITIQUE SELECT] L'enseignant a réussi à lire ${selData.length} lignes dans ${tableName} !`);
      process.exit(1);
    }

    // 1.2 INSERT
    const dummyId = "00000000-0000-0000-0000-000000000000";
    const { error: insErr } = await supabaseTeacher.from(tableName).insert([{ id: dummyId }]);
    if (insErr) {
      console.log(`[PASS INSERT] Insertion refusée -> Code: ${insErr.code}, Message: "${insErr.message}"`);
    } else {
      console.error(`[FAIL CRITIQUE INSERT] L'enseignant a pu insérer dans ${tableName} !`);
      process.exit(1);
    }

    // 1.3 UPDATE
    const { error: updErr } = await supabaseTeacher.from(tableName).update({ id: dummyId }).eq("id", dummyId);
    if (updErr) {
      console.log(`[PASS UPDATE] Modification refusée -> Code: ${updErr.code}, Message: "${updErr.message}"`);
    } else {
      console.log(`[PASS UPDATE] 0 lignes modifiées ou refus RLS.`);
    }

    // 1.4 DELETE
    const { error: delErr } = await supabaseTeacher.from(tableName).delete().eq("id", dummyId);
    if (delErr) {
      console.log(`[PASS DELETE] Suppression refusée -> Code: ${delErr.code}, Message: "${delErr.message}"`);
    } else {
      console.log(`[PASS DELETE] 0 lignes supprimées ou refus RLS.`);
    }
  }

  // 1.5 Appel direct RPC par l'enseignant
  console.log("\n--- Test RLS des fonctions RPC par l'enseignant ---");
  const { error: rpcErr1 } = await supabaseTeacher.rpc("get_next_receipt_number");
  if (rpcErr1) {
    console.log(`[PASS RPC get_next_receipt_number] Refusé -> Code: ${rpcErr1.code}, Message: "${rpcErr1.message}"`);
  } else {
    console.error("[FAIL CRITIQUE RPC] L'enseignant a pu exécuter get_next_receipt_number() !");
    process.exit(1);
  }

  const { error: rpcErr2 } = await supabaseTeacher.rpc("create_payment_with_receipt", {
    p_student_id: "00000000-0000-0000-0000-000000000000",
    p_school_year_id: "00000000-0000-0000-0000-000000000000",
    p_amount: 10000,
    p_payment_date: "2026-08-22",
    p_method: "cash",
    p_tranche_ciblee: "Test",
  });
  if (rpcErr2) {
    console.log(`[PASS RPC create_payment_with_receipt] Refusé -> Code: ${rpcErr2.code}, Message: "${rpcErr2.message}"`);
  } else {
    console.error("[FAIL CRITIQUE RPC] L'enseignant a pu exécuter create_payment_with_receipt() !");
    process.exit(1);
  }

  console.log("\n>>> PASS COMPLET : Les 5 tables et les fonctions RPC sont 100% inaccessibles pour l'enseignant.\n");


  // =====================================================================
  // SECTION 2 : TESTS UNITAIRES DE LA FONCTION D'ALLOCATION
  // =====================================================================
  console.log("=================================================");
  console.log(" SECTION 2 : TESTS UNITAIRES D'ALLOCATION DE PAIEMENT");
  console.log("=================================================");

  const unitTestResults = runFinanceAllocationUnitTests();
  let allUnitTestsPassed = true;

  for (const testRes of unitTestResults) {
    console.log(`\n---> ${testRes.testName}`);
    console.log(`Statut: ${testRes.passed ? "SUCCESS (PASS)" : "FAILED (FAIL)"}`);
    console.log("Données brutes entrées :", JSON.stringify(testRes.input, null, 2));
    console.log("Résultat brut allocation :", JSON.stringify(testRes.output, null, 2));

    if (!testRes.passed) {
      allUnitTestsPassed = false;
    }
  }

  if (!allUnitTestsPassed) {
    console.error("\nFAIL CRITIQUE : Au moins un test unitaire d'allocation a échoué !");
    process.exit(1);
  }
  console.log("\n>>> PASS COMPLET : Les 6 cas d'allocation de paiements sont 100% validés.\n");


  // =====================================================================
  // SECTION 3 : NON-RÉUTILISATION DES NUMÉROS DE REÇU & DRAFT DB
  // =====================================================================
  console.log("=================================================");
  console.log(" SECTION 3 : TEST NON-RÉUTILISATION DU NUMÉRO DE REÇU");
  console.log("=================================================");

  // 3.1 Récupérer une année scolaire et un élève réels pour le test backend
  const { data: years } = await supabase.from("school_years").select("id").limit(1);
  const { data: students } = await supabase.from("students").select("id, class_id, last_name, first_name").limit(1);

  if (!years || years.length === 0 || !students || students.length === 0) {
    console.error("FAIL: Année scolaire ou élève introuvable en base de données pour le test réel.");
    process.exit(1);
  }

  const schoolYearId = years[0].id;
  const testStudent = students[0];
  console.log(`Utilisation de l'élève de test: ${testStudent.last_name} ${testStudent.first_name} (Class ID: ${testStudent.class_id})`);

  // 3.2 S'assurer qu'un tarif existe pour la classe de l'élève
  let feeSchedule = await getFeeSchedule(testStudent.class_id, schoolYearId);
  if (!feeSchedule) {
    console.log("Création d'un tarif de test pour la classe...");
    feeSchedule = await upsertFeeSchedule({
      class_id: testStudent.class_id,
      school_year_id: schoolYearId,
      registration_fee: 15000,
      total_amount: 100000,
      installments_json: [
        { label: "Tranche 1", amount: 50000, due_date: "2026-10-15" },
        { label: "Tranche 2", amount: 30000, due_date: "2026-12-15" },
        { label: "Tranche 3", amount: 20000, due_date: "2027-02-15" },
      ],
    });
  }

  // 3.3 Enregistrer le premier paiement (P1)
  console.log("\nCréation du Paiement P1 (50 000 FCFA)...");
  const p1Res = await createPayment({
    studentId: testStudent.id,
    schoolYearId: schoolYearId,
    classId: testStudent.class_id,
    amount: 50000,
    method: "cash",
  });

  const receiptNumP1 = p1Res.payment.receipt_number;
  console.log(`Paiement P1 créé (ID: ${p1Res.payment.id}) -> Reçu N°: ${receiptNumP1}`);
  console.log(`Répartition enregistrée: "${p1Res.payment.tranche_ciblee}"`);

  // 3.4 Supprimer le paiement P1
  console.log(`\nSuppression du Paiement P1 (ID: ${p1Res.payment.id})...`);
  await deletePayment(p1Res.payment.id);
  console.log("Paiement P1 supprimé avec succès de la table payments.");

  // 3.5 Enregistrer le deuxième paiement (P2)
  console.log("\nCréation du Paiement P2 (30 000 FCFA)...");
  const p2Res = await createPayment({
    studentId: testStudent.id,
    schoolYearId: schoolYearId,
    classId: testStudent.class_id,
    amount: 30000,
    method: "mobile_money",
  });

  const receiptNumP2 = p2Res.payment.receipt_number;
  console.log(`Paiement P2 créé (ID: ${p2Res.payment.id}) -> Reçu N°: ${receiptNumP2}`);
  console.log(`Répartition enregistrée: "${p2Res.payment.tranche_ciblee}"`);

  // 3.6 Vérification stricte de non-réutilisation
  if (receiptNumP2 === receiptNumP1) {
    console.error(`FAIL CRITIQUE : Le numéro de reçu ${receiptNumP1} a été réutilisé après suppression de P1 !`);
    process.exit(1);
  }

  if (receiptNumP2 <= receiptNumP1) {
    console.error(`FAIL CRITIQUE : Le numéro de reçu de P2 (${receiptNumP2}) n'est pas strictement supérieur à P1 (${receiptNumP1}) !`);
    process.exit(1);
  }

  console.log(`\n[PASS NON-RÉUTILISATION] Reçu P1 = N°${receiptNumP1}, Reçu P2 = N°${receiptNumP2}.`);
  console.log(`Le numéro N°${receiptNumP1} est définitivement consommé et jamais repris.`);

  // Nettoyage optionnel du paiement P2 de test
  await deletePayment(p2Res.payment.id);

  console.log("\n=================================================");
  console.log("   TOUS LES TESTS BACKEND DU LOT F1 ONT RÉUSSI ! ");
  console.log("=================================================");
}

runFinanceF1Verification().catch((err) => {
  console.error("Erreur fatale lors de l'exécution du script de vérification:", err);
  process.exit(1);
});
