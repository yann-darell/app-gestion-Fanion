import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://ahlydimsmldvufqnhdxc.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
const principalPw = process.env.TEST_PRINCIPAL_PW || "r6QT?K$N#PW2LpG";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  const { data: auth, error: authErr } = await client.auth.signInWithPassword({
    email: "principal@lefanion.com",
    password: principalPw,
  });
  if (authErr) {
    console.error("Auth error:", authErr);
    return;
  }

  const { data: payments } = await client.from("payments").select("*");
  console.log("PAYMENTS:", JSON.stringify(payments, null, 2));

  const { data: students } = await client.from("students").select("*");
  console.log("STUDENTS:", JSON.stringify(students, null, 2));

  const { data: classes } = await client.from("classes").select("*");
  console.log("CLASSES:", JSON.stringify(classes, null, 2));

  const { data: schoolYears } = await client.from("school_years").select("*");
  console.log("SCHOOL_YEARS:", JSON.stringify(schoolYears, null, 2));

  const { data: enrollments } = await client.from("student_enrollments").select("*");
  console.log("STUDENT_ENROLLMENTS:", JSON.stringify(enrollments, null, 2));
}

main();
