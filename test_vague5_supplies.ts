import * as dotenv from "dotenv";
dotenv.config();

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("ERREUR: VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont requis.");
  process.exit(1);
}

async function runVague5Tests() {
  console.log("=================================================");
  console.log("    VAGUE 5 : TESTS FOURNITURES SCOLAIRES         ");
  console.log("    RLS NÉGATIF ENSEIGNANT & WORKFLOW FONCTIONNEL ");
  console.log("=================================================\n");

  const teacherPw = process.env.TEST_ENSEIGNANT_PW || "fanion_2026";
  const principalPw = process.env.TEST_PRINCIPAL_PW || "r6QT?K$N#PW2LpG";

  const supabasePrincipal = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const supabaseTeacher = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // 1. Authentification Principal
  console.log("1. Authentification du Principal...");
  const { data: pAuth, error: pErr } = await supabasePrincipal.auth.signInWithPassword({
    email: "principal@lefanion.com",
    password: principalPw,
  });
  if (pErr || !pAuth.user) {
    console.error("FAIL: Échec connexion Principal:", pErr?.message);
    process.exit(1);
  }
  console.log("OK: Principal connecté avec succès.\n");

  // 2. Authentification Enseignant
  console.log("2. Authentification de l'Enseignant...");
  const { data: tAuth, error: tErr } = await supabaseTeacher.auth.signInWithPassword({
    email: "enseignant@lefanion.com",
    password: teacherPw,
  });
  if (tErr || !tAuth.user) {
    console.error("FAIL: Échec connexion Enseignant:", tErr?.message);
    process.exit(1);
  }
  console.log("OK: Enseignant connecté avec succès.\n");

  // Récupérer données de référence via Principal
  const { data: schoolYear } = await supabasePrincipal
    .from("school_years")
    .select("id, label")
    .eq("is_active", true)
    .single();

  const { data: division } = await supabasePrincipal
    .from("divisions")
    .select("id, nom")
    .limit(1)
    .single();

  const { data: student } = await supabasePrincipal
    .from("students")
    .select("id, matricule, first_name, last_name")
    .limit(1)
    .single();

  if (!schoolYear || !division || !student) {
    console.error("FAIL: Données de base introuvables (school_year, division ou student).");
    process.exit(1);
  }

  console.log(`Données de test: Année=${schoolYear.label} (${schoolYear.id}), Division=${division.nom} (${division.id}), Élève=${student.matricule}\n`);

  let createdRequirementId: string | null = null;

  try {
    // -------------------------------------------------------------
    // PARTIE A : WORKFLOW PRINCIPAL (Configuration & Cochage)
    // -------------------------------------------------------------
    console.log("---------------------------------------------");
    console.log("PARTIE A : TEST FONCTIONNEL PRINCIPAL / DE");
    console.log("---------------------------------------------");

    const testLabel = `Rame de papier A4 Test_${Date.now()}`;
    console.log(`- Création d'une fourniture requise: "${testLabel}"`);
    const { data: newReq, error: reqErr } = await supabasePrincipal
      .from("supply_requirements")
      .insert({
        division_id: division.id,
        school_year_id: schoolYear.id,
        label: testLabel,
      })
      .select()
      .single();

    if (reqErr || !newReq) {
      console.error("FAIL: Le principal n'a pas pu créer l'exigence de fourniture:", reqErr?.message);
      process.exit(1);
    }
    createdRequirementId = newReq.id;
    console.log(`OK: Exigence créée avec ID: ${newReq.id}`);

    // Lecture par le principal
    console.log("- Lecture des exigences par le Principal...");
    const { data: listReqs, error: listErr } = await supabasePrincipal
      .from("supply_requirements")
      .select("*")
      .eq("division_id", division.id)
      .eq("school_year_id", schoolYear.id);

    if (listErr || !listReqs || listReqs.length === 0) {
      console.error("FAIL: Impossible de relire les exigences côté Principal:", listErr?.message);
      process.exit(1);
    }
    console.log(`OK: ${listReqs.length} exigence(s) lue(s) par le Principal.`);

    // Cochage fourniture pour l'élève (donne)
    console.log(`- Cochage fourniture (statut: 'donne') pour l'élève ${student.matricule}...`);
    const { data: upsertSupply, error: supErr } = await supabasePrincipal
      .from("student_supplies")
      .upsert(
        {
          student_id: student.id,
          supply_requirement_id: newReq.id,
          status: "donne",
        },
        { onConflict: "student_id,supply_requirement_id" }
      )
      .select()
      .single();

    if (supErr || !upsertSupply) {
      console.error("FAIL: Échec du cochage fourniture côté Principal:", supErr?.message);
      process.exit(1);
    }
    console.log(`OK: Fourniture cochée avec statut '${upsertSupply.status}'.`);

    // Changement de statut (manquant)
    console.log(`- Modification du statut vers 'manquant'...`);
    const { data: updatedSupply, error: updErr } = await supabasePrincipal
      .from("student_supplies")
      .update({ status: "manquant" })
      .eq("id", upsertSupply.id)
      .select()
      .single();

    if (updErr || updatedSupply?.status !== "manquant") {
      console.error("FAIL: Échec du passage à 'manquant':", updErr?.message);
      process.exit(1);
    }
    console.log("OK: Statut modifié avec succès en 'manquant'.\n");

    // -------------------------------------------------------------
    // PARTIE B : TEST RLS NÉGATIF ENSEIGNANT (AUCUN ACCÈS)
    // -------------------------------------------------------------
    console.log("---------------------------------------------");
    console.log("PARTIE B : TEST RLS NÉGATIF ENSEIGNANT");
    console.log("---------------------------------------------");

    // Test B1 : Tentative de lecture supply_requirements
    console.log("- Test B1 : Enseignant tente de LIRE supply_requirements...");
    const { data: tReqs, error: tReqErr } = await supabaseTeacher
      .from("supply_requirements")
      .select("*");

    if (tReqErr) {
      console.log(`OK (RLS rejeté avec erreur SQL): ${tReqErr.message}`);
    } else if (tReqs && tReqs.length === 0) {
      console.log(`OK (RLS bloqué : 0 ligne retournée à l'enseignant, attendu sans policy).`);
    } else {
      console.error(`FAIL RLS : L'enseignant a pu lire ${tReqs?.length} lignes de supply_requirements !`);
      process.exit(1);
    }

    // Test B2 : Tentative d'insertion supply_requirements
    console.log("- Test B2 : Enseignant tente d'INSÉRER dans supply_requirements...");
    const { data: tInsertReq, error: tInsertReqErr } = await supabaseTeacher
      .from("supply_requirements")
      .insert({
        division_id: division.id,
        school_year_id: schoolYear.id,
        label: "Piratage Enseignant",
      })
      .select();

    if (tInsertReqErr) {
      console.log(`OK (RLS blocage écriture confirmé): ${tInsertReqErr.message}`);
    } else {
      console.error("FAIL RLS : L'enseignant a pu insérer dans supply_requirements !", tInsertReq);
      process.exit(1);
    }

    // Test B3 : Tentative de lecture student_supplies
    console.log("- Test B3 : Enseignant tente de LIRE student_supplies...");
    const { data: tSupplies, error: tSupErr } = await supabaseTeacher
      .from("student_supplies")
      .select("*");

    if (tSupErr) {
      console.log(`OK (RLS rejeté avec erreur SQL): ${tSupErr.message}`);
    } else if (tSupplies && tSupplies.length === 0) {
      console.log(`OK (RLS bloqué : 0 ligne retournée à l'enseignant).`);
    } else {
      console.error(`FAIL RLS : L'enseignant a pu lire ${tSupplies?.length} lignes de student_supplies !`);
      process.exit(1);
    }

    // Test B4 : Tentative d'insertion / modification student_supplies
    console.log("- Test B4 : Enseignant tente d'INSÉRER / MODIFIER student_supplies...");
    const { data: tInsertSup, error: tInsertSupErr } = await supabaseTeacher
      .from("student_supplies")
      .insert({
        student_id: student.id,
        supply_requirement_id: createdRequirementId,
        status: "donne",
      })
      .select();

    if (tInsertSupErr) {
      console.log(`OK (RLS blocage écriture confirmé): ${tInsertSupErr.message}`);
    } else {
      console.error("FAIL RLS : L'enseignant a pu insérer dans student_supplies !", tInsertSup);
      process.exit(1);
    }

    console.log("\n=================================================");
    console.log("  TOUS LES TESTS VAGUE 5 SONT VALIDES (100% SUCCÈS)");
    console.log("=================================================");
  } finally {
    // Nettoyage de l'exigence de test créée
    if (createdRequirementId) {
      console.log("\nNettoyage de l'exigence de test...");
      await supabasePrincipal
        .from("supply_requirements")
        .delete()
        .eq("id", createdRequirementId);
      console.log("Nettoyage terminé.");
    }
  }
}

runVague5Tests().catch((err) => {
  console.error("ERREUR INATTENDUE DANS LE SCRIPT DE TEST:", err);
  process.exit(1);
});
