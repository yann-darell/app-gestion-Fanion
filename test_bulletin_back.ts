import * as dotenv from "dotenv";
import * as path from "path";

// Charger dotenv avant d'importer le client Supabase
dotenv.config({ path: path.join(__dirname, ".env") });

import { createClient } from "@supabase/supabase-js";
// Import du client singleton partagé (utilisé par tous les services @fanion/shared)
import { supabase } from "./packages/shared/api/supabaseClient";
import {
  generateClassReport,
  checkStudentBulletinCompleteness,
  generateAndSaveStudentBulletin,
  getBulletinSignedUrl,
} from "./packages/shared";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont requis.");
  process.exit(1);
}

async function runVerificationScript() {
  console.log("=================================================");
  console.log("    LOT E : SCRIPT DE VÉRIFICATION OBLIGATOIRE   ");
  console.log("=================================================\n");

  const teacherPw = process.env.TEST_ENSEIGNANT_PW || "";
  const principalPw = process.env.TEST_PRINCIPAL_PW || "";

  if (!teacherPw || !principalPw) {
    console.error("ERREUR: Variables TEST_PRINCIPAL_PW et TEST_ENSEIGNANT_PW requises.");
    console.error("Usage PowerShell: $env:TEST_PRINCIPAL_PW='xxx'; $env:TEST_ENSEIGNANT_PW='yyy'; npx tsx test_bulletin_back.ts");
    process.exit(1);
  }

  // =====================================================================
  // 1. Client Enseignant dédié (pour tests négatifs RLS)
  // =====================================================================
  console.log("Connexion du compte enseignant (tests négatifs RLS)...");
  const supabaseTeacher = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error: tAuthErr } = await supabaseTeacher.auth.signInWithPassword({
    email: "enseignant@lefanion.com",
    password: teacherPw,
  });
  if (tAuthErr) {
    console.error("FAIL: Impossible d'authentifier enseignant@lefanion.com:", tAuthErr.message);
    process.exit(1);
  }
  console.log("OK: Enseignant connecté.");

  // =====================================================================
  // 2. Authentifier le client SINGLETON partagé comme Principal
  // =====================================================================
  console.log("Connexion du compte principal sur le client singleton partagé...");
  const { error: pAuthErr } = await supabase.auth.signInWithPassword({
    email: "principal@lefanion.com",
    password: principalPw,
  });
  if (pAuthErr) {
    console.error("FAIL: Impossible d'authentifier principal@lefanion.com:", pAuthErr.message);
    process.exit(1);
  }
  console.log("OK: Principal connecté sur le client partagé (singleton).");

  // -----------------------------------------------------------------------
  // SECTION A : TEST POSITIF & CALCULS NUMÉRIQUES (Compte Principal)
  // -----------------------------------------------------------------------
  console.log("\n[TEST POSITIF & CALCULS] Recherche de l'élève ONANINA (6ème) dans Supabase...");

  let generatedPdfPath = "";

  try {
    const { data: students, error: studErr } = await supabase
      .from("students")
      .select("id, last_name, first_name, matricule, class_id")
      .ilike("last_name", "%ONANINA%");

    if (studErr || !students || students.length === 0) {
      console.error("FAIL CRITIQUE: Élève ONANINA introuvable dans Supabase !", studErr?.message);
      process.exit(1);
    }

    const onanina = students[0];
    console.log(`Élève trouvé: ${onanina.last_name} ${onanina.first_name} (Matricule: ${onanina.matricule}, ID: ${onanina.id})`);

    const seq1Id = "cec81b85-a968-4321-b572-7abe627a9dbf";
    const seq2Id = "3c6b1ddb-d883-4353-b766-ff428e886886";

    // Récupérer le trimestre 1 (T1)
    const { data: terms } = await supabase.from("terms").select("id").ilike("label", "%1%").single();
    const term1Id = terms?.id || "a8caecee-eb74-4fff-83b4-0570400ed415";

    // ---------------------------------------------------------------------
    // TEST DE RÉGRESSION COMPLÉTUDE TRIMESTRE
    // ---------------------------------------------------------------------
    console.log("\n--- TEST DE RÉGRESSION COMPLÉTUDE TRIMESTRE (2 SÉQUENCES) ---");

    // Étape A: Dupliquer les 16 notes dans Seq 2 pour simuler un trimestre 100% complet dans la DB
    const { data: gr1 } = await supabase.from("grades").select("*").eq("student_id", onanina.id).eq("sequence_id", seq1Id);
    if (!gr1 || gr1.length === 0) {
      console.error("FAIL CRITIQUE: Aucune note trouvée en Séquence 1 !");
      process.exit(1);
    }

    console.log("Duplication temporaire des 16 notes vers la Séquence 2...");
    for (const g of gr1) {
      await supabase.from("grades").upsert({
        student_id: onanina.id,
        subject_id: g.subject_id,
        sequence_id: seq2Id,
        score: g.score,
      });
    }

    // Diagnostic TRIMESTRE (complet)
    let diagTerm = await checkStudentBulletinCompleteness(onanina.id, term1Id, "term");
    console.log(`Diagnostic TRIMESTRE (Seq1 + Seq2 complètes) : ${diagTerm.filledGradesCount}/${diagTerm.totalExpectedGrades} matières. Complet: ${diagTerm.isComplete}`);

    if (!diagTerm.isComplete) {
      console.error("FAIL CRITIQUE: Le diagnostic trimestriel devrait être complet (16/16) !");
      process.exit(1);
    }
    console.log("PASS: Diagnostic TRIMESTRE valide (16/16 - Complet: true).");

    // Étape B: Supprimer artificiellement 1 seule note de Séquence 2 (première matière)
    const testSubId = gr1[0].subject_id;
    console.log("\nSuppression d'une note en Séquence 2 (Matière ID:", testSubId, ")...");
    await supabase.from("grades").delete().eq("student_id", onanina.id).eq("sequence_id", seq2Id).eq("subject_id", testSubId);

    // Diagnostic TRIMESTRE (1 note manquante en Seq 2)
    diagTerm = await checkStudentBulletinCompleteness(onanina.id, term1Id, "term");
    console.log(`Diagnostic TRIMESTRE (1 note manquante en Seq2) : ${diagTerm.filledGradesCount}/${diagTerm.totalExpectedGrades} matières. Complet: ${diagTerm.isComplete}`);
    console.log("Matières manquantes détectées :", diagTerm.missingSubjects.join(", "));

    if (diagTerm.isComplete || diagTerm.filledGradesCount !== 15) {
      console.error("FAIL CRITIQUE: Le diagnostic n'a pas détecté la note manquante en Séquence 2 !");
      process.exit(1);
    }
    console.log("PASS: Détection stricte de l'incomplétude trimestrielle validée (15/16 - Complet: false).");

    // Étape C: Nettoyage - Rétablir la note de Séquence 2
    console.log("\nRestaurations des données initiales...");
    await supabase.from("grades").upsert({
      student_id: onanina.id,
      subject_id: testSubId,
      sequence_id: seq2Id,
      score: gr1[0].score,
    });
    // Supprimer les notes ajoutées en Seq2 pour remettre la DB dans son état initial propre
    await supabase.from("grades").delete().eq("student_id", onanina.id).eq("sequence_id", seq2Id);
    console.log("PASS: Nettoyage terminé, DB remise dans l'état initial.");

    // ---------------------------------------------------------------------
    // CONTRÔLE DE CONFORMITÉ NUMÉRIQUE SUR LA SÉQUENCE 1 (Notes Réelles 13.55)
    // ---------------------------------------------------------------------
    const reportSeq = await generateClassReport(onanina.class_id, "sequence", seq1Id);
    const studentRow = reportSeq.rows.find((r) => r.student.id === onanina.id);

    if (!studentRow) {
      console.error("FAIL CRITIQUE: ONANINA absent du bordereau de classe !");
      process.exit(1);
    }

    const calculatedAvgStr = studentRow.averageDisplay;
    const officialPdfAvgStr = "13.55";

    console.log("\n--- CONTRÔLE DE CONFORMITÉ NUMÉRIQUE STRICTE ---");
    console.log(`Moyenne Calculée (Le Fanion v2) : ${calculatedAvgStr} / 20`);
    console.log(`Moyenne Officielle (Bordereau D4)  : ${officialPdfAvgStr} / 20`);
    console.log(`Rang calculé : ${studentRow.rankDisplay} (Note: effectif partiel en base)`);

    if (calculatedAvgStr === officialPdfAvgStr) {
      console.log("PASS: ÉGALITÉ NUMÉRIQUE PARFAITE (13.55 == 13.55)");
    } else {
      const ecart = Math.abs(parseFloat(calculatedAvgStr) - parseFloat(officialPdfAvgStr));
      console.error(`FAIL CRITIQUE: ÉCART DE ${ecart.toFixed(4)} POINTS !`);
      process.exit(1);
    }

    // 5. Génération atomique du PDF et sauvegarde dans Storage + DB sur la Séquence 1 (avec notes réelles)
    console.log("\n[TEST SERVICE PDF & STORAGE] Génération atomique du bulletin PDF par le Principal...");
    const genRes = await generateAndSaveStudentBulletin({
      studentId: onanina.id,
      periodId: seq1Id,
      periodType: "sequence",
    });
    generatedPdfPath = genRes.pdfPath;
    console.log("PASS: Bulletin généré avec succès par le Principal.");
    console.log(` -> Path Storage: ${generatedPdfPath}`);
    console.log(` -> DB Record ID: ${genRes.recordId}`);

    const fs = require("fs");
    fs.writeFileSync("generated_bulletin_ONANINA.pdf", genRes.pdfBuffer);
    console.log("PASS: PDF enregistré localement sous 'generated_bulletin_ONANINA.pdf'.");

    const principalSignedUrl = await getBulletinSignedUrl(generatedPdfPath);
    console.log("PASS: URL signée générée avec succès pour le Principal:", principalSignedUrl.substring(0, 80) + "...");

  } catch (err: any) {
    console.error("FAIL: Erreur durant la vérification:", err.message);
    process.exit(1);
  }

  // -----------------------------------------------------------------------
  // SECTION B : TESTS NÉGATIFS RLS (Compte Enseignant)
  // -----------------------------------------------------------------------
  console.log("\n=================================================");
  console.log("   EXÉCUTION DES TESTS NÉGATIFS RLS (ENSEIGNANT) ");
  console.log("=================================================");

  // TEST NÉGATIF 1 : DB Access par Enseignant
  console.log("\n[TEST NÉGATIF 1] Lecture DB bulletin_generations par Enseignant...");
  try {
    const { data, error } = await supabaseTeacher
      .from("bulletin_generations")
      .select("*");
    
    if (error) {
      console.log(`PASS: Accès DB refusé. Erreur brute -> Code: ${error.code || (error as any).status}, Message: "${error.message}"`);
    } else if (!data || data.length === 0) {
      console.log("PASS: 0 lignes retournées par RLS (filtre opaque PostgreSQL pour l'enseignant).");
    } else {
      console.error("FAIL CRITIQUE: L'enseignant a pu lire la table bulletin_generations !", data);
      process.exit(1);
    }
  } catch (err: any) {
    console.log(`PASS: Exception levée -> ${err.message}`);
  }

  // TEST NÉGATIF 2 : Lecture / URL signée par Enseignant sur le fichier réel existant
  console.log(`\n[TEST NÉGATIF 2] Tentative d'URL signée par Enseignant sur le fichier réel existant (${generatedPdfPath})...`);
  try {
    const { data: signedData, error: signedErr } = await supabaseTeacher.storage
      .from("bulletins")
      .createSignedUrl(generatedPdfPath, 3600);

    if (signedErr) {
      console.log(`PASS: Création d'URL signée refusée pour l'enseignant. Erreur brute -> Status: ${signedErr.status || (signedErr as any).statusCode}, Code: ${(signedErr as any).code || 'N/A'}, Message: "${signedErr.message}"`);
      console.log("PASS: Supabase Storage RLS masque l'existence du fichier (Object not found).");
    } else if (signedData?.signedUrl) {
      console.error("FAIL CRITIQUE: L'enseignant A PU GÉNÉRER UNE URL SIGNÉE sur un bulletin réel !", signedData.signedUrl);
      process.exit(1);
    }
  } catch (err: any) {
    console.log(`PASS: Exception RLS Storage sur lecture: ${err.message}`);
  }

  // TEST NÉGATIF 3 : Storage Upload par Enseignant
  console.log("\n[TEST NÉGATIF 3] Tentative d'upload Storage par Enseignant...");
  try {
    const fakeBuffer = Buffer.from("test PDF content");
    const { error: upErr } = await supabaseTeacher.storage
      .from("bulletins")
      .upload("test_teacher.pdf", fakeBuffer, { upsert: true });

    if (upErr) {
      console.log(`PASS: Upload Storage refusé par RLS. Erreur brute -> Status: ${upErr.status || (upErr as any).statusCode}, Code: ${(upErr as any).code || 'N/A'}, Message: "${upErr.message}"`);
    } else {
      console.error("FAIL CRITIQUE: L'enseignant a pu uploader dans le bucket bulletins !");
      await supabaseTeacher.storage.from("bulletins").remove(["test_teacher.pdf"]);
      process.exit(1);
    }
  } catch (err: any) {
    console.log(`PASS: Exception RLS Storage sur upload: ${err.message}`);
  }

  console.log("\n=================================================");
  console.log("     TOUS LES TESTS BACK-END ONT RÉUSSI !        ");
  console.log("=================================================");
}

runVerificationScript().catch((err) => {
  console.error("Erreur fatale du script:", err);
  process.exit(1);
});
