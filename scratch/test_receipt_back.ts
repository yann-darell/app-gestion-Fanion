import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });

import { supabase } from "../packages/shared/api/supabaseClient";
import { generateAndSaveReceipt, getReceiptSignedUrl, getReceiptForPayment } from "../packages/shared/api/receiptPdfService";
import { createPayment, deletePayment, getStudentPayments } from "../packages/shared/api/financeService";

const principalPw = process.env.TEST_PRINCIPAL_PW || "r6QT?K$N#PW2LpG";
const enseignantPw = process.env.TEST_ENSEIGNANT_PW || "fanion_2026";

async function runTests() {
  console.log("==========================================");
  console.log("LANCEMENT DES TESTS BACKEND OBLIGATOIRES - LOT F4");
  console.log("==========================================");

  // Connexion initiale admin pour récupérer les données de test
  const { error: initAuthErr } = await supabase.auth.signInWithPassword({
    email: "principal@lefanion.com",
    password: principalPw || "",
  });

  if (initAuthErr) {
    console.error("Échec de connexion initiale Principal:", initAuthErr.message);
    process.exit(1);
  }

  // 1. Récupération d'une année scolaire et classe pour les tests
  const { data: schoolYear } = await supabase.from("school_years").select("id").eq("is_active", true).single();
  const { data: student } = await supabase.from("students").select("id, class_id").limit(1).single();

  if (!schoolYear || !student) {
    console.error("Impossible de trouver un élève ou une année scolaire active pour le test.");
    process.exit(1);
  }

  // Déconnexion avant le test enseignant
  await supabase.auth.signOut();

  // ---------------------------------------------------------
  // TEST A : RLS Négatif Enseignant sur bucket 'receipts'
  // ---------------------------------------------------------
  console.log("\n--- TEST A : RLS Négatif Enseignant sur bucket receipts ---");
  const teacherEmail = "enseignant@lefanion.com";
  const teacherPassword = enseignantPw || "";

  // Connexion en tant qu'enseignant
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: teacherEmail,
    password: teacherPassword,
  });

  if (authErr || !authData.session) {
    console.error("Échec de connexion avec le compte enseignant de test:", authErr?.message);
  } else {
    const teacherClient = supabase;
    
    // A1: Tentative de lecture d'un fichier fictif dans 'receipts' (Attendu: 404 / NoSuchKey)
    const { data: selectData, error: selectErr } = await teacherClient.storage
      .from("receipts")
      .download("fake_year/fake_payment.pdf");

    console.log("Test A1 - Download Enseignant :");
    console.log("  - Result Data:", selectData);
    console.log("  - Raw Error Message:", selectErr?.message);
    console.log("  - Status/Code:", (selectErr as any)?.status || (selectErr as any)?.statusCode || selectErr?.name);

    // A2: Tentative d'upload dans 'receipts' (Attendu: 403 / RLS Violation)
    const dummyBuffer = Buffer.from("test rls receipt");
    const { data: uploadData, error: uploadErr } = await teacherClient.storage
      .from("receipts")
      .upload("test_rls/forbidden.pdf", dummyBuffer, { contentType: "application/pdf" });

    console.log("Test A2 - Upload Enseignant :");
    console.log("  - Result Data:", uploadData);
    console.log("  - Raw Error Message:", uploadErr?.message);
    console.log("  - Status/Code:", (uploadErr as any)?.status || (uploadErr as any)?.statusCode || uploadErr?.name);

    // A3: Tentative de lecture direct de la table 'receipts' (Attendu: 0 rows)
    const { data: tableData, error: tableErr } = await teacherClient.from("receipts").select("*");
    console.log("Test A3 - SELECT Table receipts Enseignant :");
    console.log("  - Rows returned:", tableData?.length ?? 0);
    console.log("  - Raw Error Message:", tableErr?.message);

    // Se déconnecter pour revenir aux privilèges admin
    await supabase.auth.signOut();
  }

  // Reconnexion en admin (Principal/DE) pour le reste des tests
  const { error: adminAuthErr } = await supabase.auth.signInWithPassword({
    email: "principal@lefanion.com",
    password: principalPw || "",
  });

  if (adminAuthErr) {
    console.error("Échec de re-connexion Admin:", adminAuthErr.message);
    process.exit(1);
  }

  // ---------------------------------------------------------
  // TEST B : Génération réelle et Vérification Reçu PDF
  // ---------------------------------------------------------
  console.log("\n--- TEST B : Génération réelle Reçu PDF ---");
  const testPaymentRes = await createPayment({
    studentId: student.id,
    schoolYearId: schoolYear.id,
    classId: student.class_id,
    amount: 15000,
    method: "cash",
    paymentCategory: "tuition",
  });

  console.log("Paiement de test créé :");
  console.log("  - Payment ID:", testPaymentRes.payment.id);
  console.log("  - Reçu N°:", testPaymentRes.payment.receipt_number);
  console.log("  - Reçu PDF Path:", testPaymentRes.receiptPdfPath);

  if (!testPaymentRes.receiptPdfPath) {
    console.error("ÉCHEC: Aucun chemin PDF retourné par createPayment !");
    process.exit(1);
  }

  const signedUrl = await getReceiptSignedUrl(testPaymentRes.receiptPdfPath);
  console.log("  - URL Signée générée avec succès (1h):", signedUrl);

  // Sauvegarde locale du PDF pour inspection utilisateur
  const { data: pdfBlob, error: downloadErr } = await supabase.storage
    .from("receipts")
    .download(testPaymentRes.receiptPdfPath);

  if (downloadErr || !pdfBlob) {
    console.error("Échec du téléchargement pour sauvegarde locale:", downloadErr);
  } else {
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fs = require("fs");
    const path = require("path");
    const savePath = path.resolve(process.cwd(), "artifacts/recu_test_B_no11.pdf");
    const artifactsDir = path.dirname(savePath);
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }
    fs.writeFileSync(savePath, buffer);
    console.log(`  - Fichier PDF local sauvegardé sous : ${savePath}`);
  }

  // ---------------------------------------------------------
  // TEST C : Test de suppression (anti-orphelin)
  // ---------------------------------------------------------
  console.log("\n--- TEST C : Suppression et Vérification Anti-Orphelin ---");
  const paymentIdToDelete = testPaymentRes.payment.id;
  const pdfPathToDelete = testPaymentRes.receiptPdfPath;

  // Verification AVANT suppression
  const { data: beforePayment } = await supabase.from("payments").select("id").eq("id", paymentIdToDelete).maybeSingle();
  const { data: beforeReceiptDb } = await supabase.from("receipts").select("id, pdf_path").eq("payment_id", paymentIdToDelete).maybeSingle();
  const { data: beforeStorageFile } = await supabase.storage.from("receipts").download(pdfPathToDelete);

  console.log("[AVANT SUPPRESSION]");
  console.log("  - Présence dans 'payments':", beforePayment ? "OUI (id: " + beforePayment.id + ")" : "NON");
  console.log("  - Présence dans 'receipts' DB:", beforeReceiptDb ? "OUI (pdf_path: " + beforeReceiptDb.pdf_path + ")" : "NON");
  console.log("  - Fichier Storage présent:", beforeStorageFile ? "OUI (" + beforeStorageFile.size + " octets)" : "NON");

  console.log(`\nSuppression du paiement ${paymentIdToDelete}...`);
  await deletePayment(paymentIdToDelete);

  // Délai de 3 secondes pour absorber la latence de propagation Supabase Storage
  console.log("  [Attente 3s avant vérification post-suppression Storage...]");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Verification APRÈS suppression
  const { data: checkPayment } = await supabase.from("payments").select("id").eq("id", paymentIdToDelete).maybeSingle();
  const { data: checkReceiptDb } = await supabase.from("receipts").select("id").eq("payment_id", paymentIdToDelete).maybeSingle();
  const { data: storageFile, error: storageErr } = await supabase.storage.from("receipts").download(pdfPathToDelete);

  const storageClean = !storageFile;
  const dbPaymentClean = !checkPayment;
  const dbReceiptClean = !checkReceiptDb;
  const allClean = storageClean && dbPaymentClean && dbReceiptClean;

  console.log("\n[APRÈS SUPPRESSION] (après délai 3s)");
  console.log("  - Présence dans 'payments':", dbPaymentClean ? "NON ✅ (OK)" : "OUI ❌ (ERREUR - ligne persistante)");
  console.log("  - Présence dans 'receipts' DB:", dbReceiptClean ? "NON ✅ (OK)" : "OUI ❌ (ERREUR - ligne persistante)");
  console.log("  - Fichier Storage:", storageClean
    ? `NON ✅ (OK - ${storageErr?.message})`
    : "OUI ❌ (ERREUR ORPHELIN CONFIRMÉ - le fichier n'a pas été supprimé)"
  );

  console.log("\n==========================================");
  if (allClean) {
    console.log("FIN DES TESTS BACKEND - SUCCÈS TOTAL ✅");
    console.log("  Verdict Test C : suppression atomique confirmée (délai latence = normal)");
  } else {
    console.log("FIN DES TESTS BACKEND - ÉCHEC ❌");
    console.log("  Verdict Test C : ORPHELIN DÉTECTÉ après délai de 3s — BUG DE SUPPRESSION STORAGE");
  }
  console.log("==========================================");
}

runTests().catch((err) => {
  console.error("ERREUR FATALE TEST BACK:", err);
  process.exit(1);
});
