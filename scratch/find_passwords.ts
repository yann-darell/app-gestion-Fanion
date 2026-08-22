import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL || "";
const key = process.env.VITE_SUPABASE_ANON_KEY || "";

const candidatePasswords = [
  "Fanion2026!",
  "Fanion2026",
  "lefanion2026",
  "Lefanion2026!",
  "password123",
  "12345678",
  "123456",
  "test_password",
  "Pass2026!"
];

const accounts = ["principal@lefanion.com", "enseignant@lefanion.com"];

async function check() {
  const client = createClient(url, key);

  for (const email of accounts) {
    console.log(`Testing email: ${email}`);
    let found = false;
    for (const pw of candidatePasswords) {
      const { data, error } = await client.auth.signInWithPassword({ email, password: pw });
      if (!error && data.user) {
        console.log(`SUCCESS! Email: ${email} -> Password: "${pw}"`);
        found = true;
        await client.auth.signOut();
        break;
      }
    }
    if (!found) {
      console.log(`FAILED to find password for ${email}`);
    }
  }
}

check();
