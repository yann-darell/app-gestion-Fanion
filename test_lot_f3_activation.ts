import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, ".env") });

import { supabase } from "./packages/shared/api/supabaseClient";
import {
  createPayment,
  deletePayment,
  upsertFeeSchedule,
  getFeeSchedule,
} from "./packages/shared/api/financeService";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont requis dans .env.");
  process.exit(1);
}

async function runLotF3Verification() {
  console.log("=================================================");
  console.log("  LOT F3 : SCRIPT DE VÉRIFICATION BACKEND ");
  console.log("=================================================\n");

  const principalPw = process.env.TEST_PRINCIPAL_PW || "r6QT?K$N#PW2LpG";

  // 1. Authentification Principal
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

  // 2. Récupérer année et classe
  const { data: years } = await supabase.from("school_years").select("id").limit(1);
  const { data: classes } = await supabase.from("classes").select("id, name").limit(1);

  if (!years || years.length === 0 || !classes || classes.length === 0) {
    console.error("FAIL: Année scolaire ou classe introuvable.");
    process.exit(1);
  }

  const schoolYearId = years[0].id;
  const testClass = classes[0];

  // Configurer tarif de classe avec Frais d'inscription = 15 000 FCFA
  await upsertFeeSchedule({
    class_id: testClass.id,
    school_year_id: schoolYearId,
    registration_fee: 15000,
    total_amount: 100000,
    installments_json: [
      { label: "Tranche 1", amount: 50000 },
      { label: "Tranche 2", amount: 30000 },
      { label: "Tranche 3", amount: 20000 },
    ],
  });

  // 3. Création d'un élève de test temporaire en pending_registration
  const matriculeTest = `TEST_F3_${Date.now()}`;
  console.log(`--> Création d'un élève de test en pending_registration (${matriculeTest})...`);
  
  const { data: newStudent, error: studErr } = await supabase
    .from("students")
    .insert([
      {
        matricule: matriculeTest,
        first_name: "TestF3",
        last_name: "ACTIVATION",
        birth_date: "2012-05-15",
        gender: "M",
        class_id: testClass.id,
        guardian_name: "Tuteur Test",
        guardian_phone: "690000000",
        status: "pending_registration",
      },
    ])
    .select()
    .single();

  if (studErr || !newStudent) {
    console.error("FAIL: Impossible de créer l'élève de test:", studErr?.message);
    process.exit(1);
  }

  console.log(`Élève créé: ID=${newStudent.id}, Statut initial=${newStudent.status}`);

  try {
    // TEST A : Paiement partiel d'inscription (10 000 FCFA sur 15 000 FCFA)
    console.log("\n--- TEST A : Paiement d'inscription partiel (10 000 FCFA) ---");
    const payA = await createPayment({
      studentId: newStudent.id,
      schoolYearId,
      classId: testClass.id,
      amount: 10000,
      method: "cash",
      paymentCategory: "registration",
    });
    console.log(`Paiement P1 créé. Reçu N°: ${payA.payment.receipt_number}, Catégorie: ${payA.payment.payment_category}`);

    // Vérifier le statut de l'élève après P1
    const { data: stAfterA } = await supabase.from("students").select("status").eq("id", newStudent.id).single();
    console.log(`Statut élève après P1 (10 000 FCFA / 15 000 FCFA): "${stAfterA?.status}"`);
    if (stAfterA?.status !== "pending_registration") {
      console.error("FAIL: Le statut aurait dû rester pending_registration !");
      process.exit(1);
    }
    console.log("PASS: Le statut est resté pending_registration (inscription incomplète).");

    // TEST B : Dépassement sur paiement 'registration' (Tentative de payer 10 000 FCFA alors qu'il ne reste que 5 000 FCFA)
    console.log("\n--- TEST B : Tentative de dépassement des frais d'inscription (10 000 FCFA pour solde 5 000 FCFA) ---");
    try {
      await createPayment({
        studentId: newStudent.id,
        schoolYearId,
        classId: testClass.id,
        amount: 10000,
        method: "cash",
        paymentCategory: "registration",
      });
      console.error("FAIL: La RPC aurait dû rejeter le dépassement !");
      process.exit(1);
    } catch (err: any) {
      console.log(`PASS REJET DÉPASSEMENT: Rejeté avec le message attendu -> "${err.message}"`);
    }

    // TEST C : Paiement complémentaire exact (5 000 FCFA) -> Activation automatique
    console.log("\n--- TEST C : Paiement d'inscription complémentaire (5 000 FCFA) ---");
    const payC = await createPayment({
      studentId: newStudent.id,
      schoolYearId,
      classId: testClass.id,
      amount: 5000,
      method: "mobile_money",
      paymentCategory: "registration",
    });
    console.log(`Paiement P2 créé. Reçu N°: ${payC.payment.receipt_number}`);

    const { data: stAfterC } = await supabase.from("students").select("status").eq("id", newStudent.id).single();
    console.log(`Statut élève après P2 (Cumul 15 000 FCFA / 15 000 FCFA): "${stAfterC?.status}"`);
    if (stAfterC?.status !== "active") {
      console.error("FAIL: Le statut aurait dû passer à 'active' !");
      process.exit(1);
    }
    console.log("PASS: Activation automatique réussie (Statut = active).");

    // TEST D : Suppression du paiement P2 -> Réversion automatique à pending_registration
    console.log("\n--- TEST D : Suppression du paiement P2 (5 000 FCFA) ---");
    await deletePayment(payC.payment.id);
    console.log("Paiement P2 supprimé via deletePayment (delete_payment_with_status_check).");

    const { data: stAfterD } = await supabase.from("students").select("status").eq("id", newStudent.id).single();
    console.log(`Statut élève après suppression de P2 (Cumul retombé à 10 000 FCFA): "${stAfterD?.status}"`);
    if (stAfterD?.status !== "pending_registration") {
      console.error("FAIL: Le statut aurait dû repasser en pending_registration !");
      process.exit(1);
    }
    console.log("PASS: Réversion automatique réussie (Statut = pending_registration).");

    // Nettoyage final du paiement P1 et de l'élève de test
    await deletePayment(payA.payment.id);
    await supabase.from("students").delete().eq("id", newStudent.id);

    console.log("\n=================================================");
    console.log("   TOUS LES TESTS BACKEND DU LOT F3 ONT RÉUSSI ! ");
    console.log("=================================================");
  } catch (err: any) {
    console.error("Erreur durant le test:", err);
    await supabase.from("students").delete().eq("id", newStudent.id);
    process.exit(1);
  }
}

runLotF3Verification();
