import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://ahlydimsmldvufqnhdxc.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
const principalPw = process.env.TEST_PRINCIPAL_PW || "r6QT?K$N#PW2LpG";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log("=== DIAGNOSTIC PAYMENTS TABLE ===");
  console.log(`Supabase URL: ${SUPABASE_URL}`);

  const { error: authErr } = await client.auth.signInWithPassword({
    email: "principal@lefanion.com",
    password: principalPw,
  });
  if (authErr) { console.error("Auth error:", authErr.message); return; }

  // 1. Tous les paiements sans filtre
  const { data: allPayments, error: payErr } = await client.from("payments").select("*");
  console.log(`\nTotal paiements (sans filtre): ${allPayments?.length ?? "ERR"}`);
  if (payErr) console.error("Erreur payments:", payErr);
  if (allPayments?.length) console.log(JSON.stringify(allPayments, null, 2));

  // 2. receipt_counters
  const { data: counters, error: cntErr } = await client.from("receipt_counters").select("*");
  console.log(`\nreceipt_counters:`);
  if (cntErr) console.error("Erreur counters:", cntErr);
  else console.log(JSON.stringify(counters, null, 2));

  // 3. Tous les étudiants avec leur class_id
  const { data: students } = await client.from("students").select("id, last_name, first_name, class_id");
  console.log("\nStudents:", JSON.stringify(students, null, 2));

  // 4. Toutes les années scolaires
  const { data: years } = await client.from("school_years").select("*");
  console.log("\nSchool years:", JSON.stringify(years, null, 2));

  // 5. Vérification que getClassPaymentsCount travaillerait correctement
  if (students && students.length > 0) {
    const classId = students[0].class_id;
    const schoolYearId = years?.[0]?.id;
    const { data: sameClassStudents } = await client.from("students").select("id").eq("class_id", classId);
    const studentIds = sameClassStudents?.map((s: any) => s.id) || [];
    const { count, error: cErr } = await client.from("payments")
      .select("id", { count: "exact", head: true })
      .eq("school_year_id", schoolYearId)
      .in("student_id", studentIds);
    console.log(`\nSimulation getClassPaymentsCount(classId=${classId}, yearId=${schoolYearId}): count = ${count}`);
    if (cErr) console.error("Erreur count:", cErr);
  }
}

main().catch(console.error);
