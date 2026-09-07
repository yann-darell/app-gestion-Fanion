import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, ".env") });

import { supabase } from "./packages/shared/api/supabaseClient";
import { getClassFinancialReport } from "./packages/shared/api/financialReportService";
import { generateClassFinancialReportPdf } from "./packages/shared/api/classFinancialReportPdfService";

async function main() {
  console.log("--> Connexion Principal (direction)...");
  const principalPw = process.env.TEST_PRINCIPAL_PW || "r6QT?K$N#PW2LpG";
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: "principal@lefanion.com",
    password: principalPw,
  });

  if (authErr) {
    console.error("Erreur auth direction:", authErr.message);
    process.exit(1);
  }
  console.log("✓ Direction connectée avec succès.");

  console.log("--> Récupération d'une classe et de l'année scolaire active...");
  const { data: classes } = await supabase.from("classes").select("id, name").order("name").limit(1);
  const { data: years } = await supabase.from("school_years").select("id, label").eq("is_active", true).limit(1);

  if (!classes || !classes[0] || !years || !years[0]) {
    console.error("Aucune classe ou année active trouvée en base.");
    process.exit(1);
  }

  const classId = classes[0].id;
  const yearId = years[0].id;
  console.log(`✓ Classe: ${classes[0].name} (${classId}), Année: ${years[0].label} (${yearId})`);

  console.log("--> Calcul de l'état financier (getClassFinancialReport)...");
  const report = await getClassFinancialReport(classId, yearId);
  console.log(`✓ Élèves analysés: ${report.students.length}`);
  console.log(`✓ Total Attendu: ${report.summary.totalExpected} FCFA`);
  console.log(`✓ Total Encaissé: ${report.summary.totalPaid} FCFA`);
  console.log(`✓ Reste à recouvrer: ${report.summary.totalRemainingDue} FCFA`);
  console.log(`✓ Taux de recouvrement: ${report.summary.collectionRate}%`);

  console.log("--> Génération du PDF A4 Paysage...");
  const pdfBytes = await generateClassFinancialReportPdf(report, years[0].label);
  console.log(`✓ PDF généré avec succès ! Taille: ${pdfBytes.length} octets`);

  console.log("\n=======================================================");
  console.log("  TOUTES LES VÉRIFICATIONS SERVICE & PDF ONT RÉUSSI ! ");
  console.log("=======================================================");
  process.exit(0);
}

main().catch((e) => {
  console.error("Erreur fatale:", e);
  process.exit(1);
});
