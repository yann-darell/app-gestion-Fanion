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
  supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase URL ou Anon Key non trouvée. Veuillez vérifier votre configuration d'environnement (.env)."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export default supabase;
