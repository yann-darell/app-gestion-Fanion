import { createClient } from "@supabase/supabase-js";

let supabaseUrl = "";
let supabaseAnonKey = "";

// Essai de chargement via Vite (Renderer)
try {
  // @ts-ignore - import.meta.env peut ne pas être défini sous Node standard
  if (typeof import.meta !== "undefined" && import.meta.env) {
    // @ts-ignore
    supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
    // @ts-ignore
    supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
  }
} catch (e) {
  // Ignorer si import.meta n'est pas disponible
}

// Essai de chargement via Node (Electron Main Process ou scripts de développement)
if (!supabaseUrl && typeof process !== "undefined" && process.env) {
  supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://ahlydimsmldvufqnhdxc.supabase.co";
  supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFobHlkaW1zbWxkdnVmcW5oZHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MjI2NDUsImV4cCI6MjEwMjA5ODY0NX0.pd7S7LbJJcjeGaLwFCe8DKGbrppMYRzbDCx4BciDlCA";
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase URL ou Anon Key non trouvée. Veuillez vérifier votre configuration d'environnement (.env)."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export default supabase;
