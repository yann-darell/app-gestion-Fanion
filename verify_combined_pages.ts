import * as dotenv from "dotenv";
import * as path from "path";
import { PDFDocument } from "pdf-lib";

dotenv.config({ path: path.join(__dirname, ".env") });

import {
  supabase,
  generateClassCombinedBulletinsPdfBuffer,
} from "./packages/shared";

async function verifyCombinedPdfMultiStudents() {
  await supabase.auth.signInWithPassword({
    email: "principal@lefanion.com",
    password: "r6QT?K$N#PW2LpG",
  });

  // 1. Lister tous les élèves par classe
  const { data: classes } = await supabase.from("classes").select("id, name");
  console.log("=== VÉRIFICATION DU NOMBRE D'ÉLÈVES PAR CLASSE EN BASE ===");
  
  for (const c of classes || []) {
    const { data: students } = await supabase
      .from("students")
      .select("id, last_name, first_name, status")
      .eq("class_id", c.id);
    console.log(`Classe ${c.name} (${c.id}) : ${students?.length || 0} élève(s) au total`);
    students?.forEach((s) => console.log(`   - ${s.last_name} ${s.first_name || ""} [status: ${s.status}] (ID: ${s.id})`));
  }

  // 2. Vérifier les séquences
  const { data: sequences } = await supabase.from("sequences").select("id, label").limit(1);
  const seq = sequences?.[0];

  // 3. Trouver la classe avec le plus d'élèves ou créer temporairement un 2ème élève dans la classe pour tester la fusion multi-pages réelle
  const { data: sixieme } = await supabase.from("classes").select("id, name").ilike("name", "%6%").single();
  const classId = sixieme ? sixieme.id : classes![0].id;
  const className = sixieme ? sixieme.name : classes![0].name;

  // Créer temporairement un 2ème élève actif dans cette classe s'il n'y en a qu'un
  const { data: existingInClass } = await supabase
    .from("students")
    .select("id, last_name, first_name")
    .eq("class_id", classId)
    .eq("status", "active");

  let createdTempStudentId: string | null = null;
  if (existingInClass && existingInClass.length < 2) {
    console.log(`\n→ La classe ${className} n'a que ${existingInClass.length} élève actif. Création d'un second élève de test...`);
    const { data: newSt, error: stErr } = await supabase
      .from("students")
      .insert({
        class_id: classId,
        matricule: "TEST_COMBINE_" + Date.now().toString().slice(-4),
        last_name: "KAMGA",
        first_name: "Arthur Test",
        gender: "M",
        status: "active",
        birth_date: "2012-05-15",
        birth_place: "Yaoundé",
      })
      .select()
      .single();

    if (stErr) {
      console.error("Erreur insertion second élève:", stErr);
    } else {
      createdTempStudentId = newSt.id;
      console.log(`✓ Second élève créé temporairement: KAMGA Arthur Test (ID: ${newSt.id})`);
    }
  }

  // 4. Générer le PDF combiné et compter les pages et la taille
  console.log(`\n=== GÉNÉRATION DU PDF COMBINÉ SUR LA CLASSE ${className} ===`);
  const mergedBytes = await generateClassCombinedBulletinsPdfBuffer(
    classId,
    "sequence",
    seq!.id,
    (cur, tot) => console.log(`   [Progression fusion] Traitement bulletin ${cur} / ${tot}...`)
  );

  const mergedDoc = await PDFDocument.load(mergedBytes);
  const pageCount = mergedDoc.getPageCount();
  const byteSize = mergedBytes.length;

  console.log(`\n✓ RÉSULTAT DU PDF COMBINÉ :`);
  console.log(`   - Nombre de bulletins inclus : ${existingInClass?.length! + (createdTempStudentId ? 1 : 0)}`);
  console.log(`   - Nombre TOTAL de pages dans le document : ${pageCount} pages`);
  console.log(`   - Poids total du PDF combiné : ${byteSize} octets (~${(byteSize / 1024 / 1024).toFixed(2)} Mo)`);

  // 5. Nettoyage du 2ème élève de test
  if (createdTempStudentId) {
    await supabase.from("students").delete().eq("id", createdTempStudentId);
    console.log(`✓ Élève temporaire nettoyé avec succès.`);
  }

  await supabase.auth.signOut();
}

verifyCombinedPdfMultiStudents().catch(console.error);
