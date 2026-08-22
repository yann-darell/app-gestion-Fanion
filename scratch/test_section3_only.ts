import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });

import { supabase } from "../packages/shared/api/supabaseClient";
import {
  createPayment,
  deletePayment,
  upsertFeeSchedule,
  getFeeSchedule,
} from "../packages/shared/api/financeService";

async function runSection3Only() {
  console.log("=================================================");
  console.log(" SECTION 3 : TEST NON-RÉUTILISATION DU NUMÉRO DE REÇU");
  console.log("=================================================");

  const principalPw = process.env.TEST_PRINCIPAL_PW || "r6QT?K$N#PW2LpG";

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

  const { data: years } = await supabase.from("school_years").select("id").limit(1);
  const { data: students } = await supabase.from("students").select("id, class_id, last_name, first_name").limit(1);

  if (!years || years.length === 0 || !students || students.length === 0) {
    console.error("FAIL: Année scolaire ou élève introuvable en base de données pour le test réel.");
    process.exit(1);
  }

  const schoolYearId = years[0].id;
  const testStudent = students[0];
  console.log(`Utilisation de l'élève de test: ${testStudent.last_name} ${testStudent.first_name} (Class ID: ${testStudent.class_id})`);

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

  console.log(`\nSuppression du Paiement P1 (ID: ${p1Res.payment.id})...`);
  await deletePayment(p1Res.payment.id);
  console.log("Paiement P1 supprimé avec succès de la table payments.");

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

  if (receiptNumP2 === receiptNumP1) {
    console.error(`FAIL CRITIQUE : Le numéro de reçu ${receiptNumP1} a été réutilisé après suppression de P1 !`);
    process.exit(1);
  }

  if (receiptNumP2 !== receiptNumP1 + 1) {
    console.error(`FAIL CRITIQUE : Le numéro de P2 (${receiptNumP2}) n'est pas égal à P1 + 1 (${receiptNumP1 + 1}) !`);
    process.exit(1);
  }

  console.log(`\n[PASS NON-RÉUTILISATION] Reçu P1 = N°${receiptNumP1}, Reçu P2 = N°${receiptNumP2}.`);
  console.log(`Confirmation: Le numéro de P2 (N°${receiptNumP2}) est bien égal au numéro de P1 + 1 (N°${receiptNumP1} + 1).`);

  await deletePayment(p2Res.payment.id);

  console.log("\n=================================================");
  console.log("   SECTION 3 VALIDÉE AVEC SUCCÈS ! ");
  console.log("=================================================");
  process.exit(0);
}

runSection3Only().catch((err) => {
  console.error("Erreur fatale Section 3:", err);
  process.exit(1);
});
