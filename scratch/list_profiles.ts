import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL || "";
const key = process.env.VITE_SUPABASE_ANON_KEY || "";

async function listProfiles() {
  const client = createClient(url, key);
  const { data, error } = await client.from("profiles").select("*");
  console.log("Error:", error);
  console.log("Profiles:", data);
}

listProfiles();
