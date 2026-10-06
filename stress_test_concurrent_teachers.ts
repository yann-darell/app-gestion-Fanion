/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   STRESS TEST — Soumission de Notes Concurrentes (Le Fanion)    ║
 * ║   Simule N enseignants se connectant et envoyant des notes       ║
 * ║   en même temps pour tester le comportement sous charge.        ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Usage: npx tsx stress_test_concurrent_teachers.ts
 *
 * Modes:
 *   - MODE_REAL  : Utilise des données réelles de la base (élèves, matières, séquences)
 *   - MODE_PURE  : Test pur de la connexion DB (lecture seule), sans écrire de notes
 */

import "dotenv/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

// ─── Configuration ────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";

const NB_TEACHERS = 10;          // Enseignants simultanés
const GRADES_PER_TEACHER = 20;   // Notes par enseignant
const JITTER_MAX_MS = 50;        // Délai max entre chaque note (ms)

// ─── Types ────────────────────────────────────────────────────────────────────
interface TestResult {
  teacherIndex: number;
  success: number;
  errors: number;
  latencies: number[];
  errorMessages: string[];
  totalDurationMs: number;
}

interface SummaryStats {
  totalRequests: number;
  totalSuccess: number;
  totalErrors: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  maxLatencyMs: number;
  minLatencyMs: number;
  throughputRps: number;
  overallDurationMs: number;
  errorRate: number;
}

interface TestData {
  sequenceId: string;
  subjectId: string;
  students: Array<{ id: string }>;
  mode: "real" | "read_only";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomScore(): number {
  return Math.round(Math.random() * 2000) / 100;
}
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}
function c(text: string, color: "green"|"red"|"yellow"|"cyan"|"magenta"|"bold"|"dim") {
  const codes: Record<string, string> = {
    green:"\x1b[32m", red:"\x1b[31m", yellow:"\x1b[33m",
    cyan:"\x1b[36m", magenta:"\x1b[35m", bold:"\x1b[1m", dim:"\x1b[2m"
  };
  return `${codes[color] || ""}${text}\x1b[0m`;
}
function bar(value: number, max: number, width = 25): string {
  if (max === 0) return "░".repeat(width);
  const filled = Math.min(width, Math.round((value / max) * width));
  return "█".repeat(filled) + "░".repeat(width - filled);
}

// ─── Diagnostic des tables disponibles ────────────────────────────────────────
async function diagnoseTables(client: SupabaseClient): Promise<Record<string, number>> {
  const tables = ["sequences", "terms", "students", "subjects", "grades", "classes", "primary_grades", "primary_evaluations"];
  const counts: Record<string, number> = {};
  await Promise.all(
    tables.map(async (t) => {
      const r = await client.from(t).select("*", { count: "exact", head: true });
      counts[t] = r.count ?? -1;
    })
  );
  return counts;
}

// ─── Récupération des données de test ─────────────────────────────────────────
async function fetchTestData(client: SupabaseClient): Promise<TestData> {
  console.log(c("\n🔍 Analyse de la base de données...", "cyan"));

  const counts = await diagnoseTables(client);

  console.log(c("\n   État des tables:", "dim"));
  for (const [t, n] of Object.entries(counts)) {
    const statusStr = n === -1 ? c("erreur", "red") : n === 0 ? c("vide", "yellow") : c(`${n} lignes`, "green");
    console.log(`   ├─ ${t.padEnd(25)} ${statusStr}`);
  }
  console.log();

  // Cas 1 : Il y a des séquences ET des élèves ET des matières → mode réel
  if (counts.sequences > 0 && counts.students > 0 && counts.subjects > 0) {
    console.log(c("   ✅ Mode RÉEL : utilisation des données existantes", "green"));

    const { data: seqs } = await client.from("sequences").select("id, label").limit(1);
    const { data: subs } = await client.from("subjects").select("id, name").limit(1);
    const { data: studs } = await client
      .from("students")
      .select("id")
      .limit(GRADES_PER_TEACHER * NB_TEACHERS);

    const sequenceId = seqs![0].id;
    const subjectId = subs![0].id;
    const students = studs!;

    console.log(`   ✔ Séquence   : ${seqs![0].label} (${sequenceId})`);
    console.log(`   ✔ Matière    : ${subs![0].name} (${subjectId})`);
    console.log(`   ✔ Élèves     : ${students.length}`);

    return { sequenceId, subjectId, students, mode: "real" };
  }

  // Cas 2 : Il n'y a pas de séquences → mode lecture seule
  // On mesure la latence des lectures DB au lieu des écritures
  console.log(c("   ⚠️  Séquences manquantes → MODE LECTURE SEULE (latences)", "yellow"));
  console.log(c("   (Les notes ne seront PAS écrites, on mesure les lectures)", "dim"));

  let students: Array<{ id: string }> = [];
  if (counts.students > 0) {
    const { data: studs } = await client.from("students").select("id").limit(50);
    students = studs || [];
  } else {
    // Génère des IDs fictifs juste pour simuler des requêtes
    students = Array.from({ length: 50 }, () => ({ id: randomUUID() }));
  }

  return {
    sequenceId: randomUUID(), // UUID fictif
    subjectId: randomUUID(),  // UUID fictif
    students,
    mode: "read_only",
  };
}

// ─── Simulation d'un enseignant (mode écriture) ───────────────────────────────
async function simulateTeacherWrite(
  teacherIndex: number,
  data: TestData,
  client: SupabaseClient
): Promise<TestResult> {
  const result: TestResult = {
    teacherIndex, success: 0, errors: 0,
    latencies: [], errorMessages: [], totalDurationMs: 0,
  };
  const startTime = Date.now();
  const startIdx = (teacherIndex * GRADES_PER_TEACHER) % data.students.length;

  for (let i = 0; i < GRADES_PER_TEACHER; i++) {
    const student = data.students[(startIdx + i) % data.students.length];
    const score = randomScore();
    if (JITTER_MAX_MS > 0) await sleep(randomBetween(0, JITTER_MAX_MS));

    const t0 = Date.now();
    try {
      const { error } = await client
        .from("grades")
        .upsert(
          { student_id: student.id, subject_id: data.subjectId, sequence_id: data.sequenceId, score },
          { onConflict: "student_id,subject_id,sequence_id" }
        );
      result.latencies.push(Date.now() - t0);
      if (error) {
        result.errors++;
        result.errorMessages.push(`[T${teacherIndex + 1}] ${error.code}: ${error.message}`);
      } else {
        result.success++;
      }
    } catch (err: any) {
      result.latencies.push(Date.now() - t0);
      result.errors++;
      result.errorMessages.push(`[T${teacherIndex + 1}] ${err.message}`);
    }
  }

  result.totalDurationMs = Date.now() - startTime;
  return result;
}

// ─── Simulation d'un enseignant (mode lecture seule) ─────────────────────────
async function simulateTeacherRead(
  teacherIndex: number,
  data: TestData,
  client: SupabaseClient
): Promise<TestResult> {
  const result: TestResult = {
    teacherIndex, success: 0, errors: 0,
    latencies: [], errorMessages: [], totalDurationMs: 0,
  };
  const startTime = Date.now();

  for (let i = 0; i < GRADES_PER_TEACHER; i++) {
    if (JITTER_MAX_MS > 0) await sleep(randomBetween(0, JITTER_MAX_MS));
    const t0 = Date.now();
    try {
      // Lecture des notes existantes pour un élève (simuler la consultation de notes)
      const student = data.students[i % data.students.length];
      const { error } = await client
        .from("grades")
        .select("id, score")
        .eq("student_id", student.id)
        .limit(10);

      result.latencies.push(Date.now() - t0);
      if (error) {
        result.errors++;
        result.errorMessages.push(`[T${teacherIndex + 1}] ${error.message}`);
      } else {
        result.success++;
      }
    } catch (err: any) {
      result.latencies.push(Date.now() - t0);
      result.errors++;
      result.errorMessages.push(`[T${teacherIndex + 1}] ${err.message}`);
    }
  }

  result.totalDurationMs = Date.now() - startTime;
  return result;
}

// ─── Rapport ──────────────────────────────────────────────────────────────────
function printReport(results: TestResult[], stats: SummaryStats, mode: "real" | "read_only") {
  const modeLabel = mode === "real"
    ? c("📝 ÉCRITURE DE NOTES (mode réel)", "bold")
    : c("👁  LECTURE DE NOTES (mode lecture seule — pas de données à écrire)", "yellow");

  console.log("\n" + "═".repeat(72));
  console.log(c("  📊 RAPPORT DE STRESS TEST — LE FANION", "bold"));
  console.log(`  Mode : ${modeLabel}`);
  console.log("═".repeat(72));

  console.log(c("\n  Résultats par enseignant:", "cyan"));
  console.log("  " + "─".repeat(68));

  const allLats = results.flatMap((r) => r.latencies);
  const maxLat = allLats.length > 0 ? Math.max(...allLats) : 1;

  for (const r of results.sort((a, b) => a.teacherIndex - b.teacherIndex)) {
    const avgLat = r.latencies.length > 0
      ? Math.round(r.latencies.reduce((s, v) => s + v, 0) / r.latencies.length)
      : 0;
    const ok = r.errors === 0;
    const status = ok ? c("✅ OK      ", "green") : c(`⚠️  ${r.errors} err  `, "red");
    const latBar = bar(avgLat, maxLat, 20);
    const barColor: "green"|"yellow"|"red" = avgLat < 200 ? "green" : avgLat < 500 ? "yellow" : "red";
    console.log(
      `  Enseignant #${String(r.teacherIndex + 1).padStart(2)} │ ${status} │ ${String(r.success).padStart(3)}/${GRADES_PER_TEACHER} req │ moy: ${String(avgLat).padStart(4)}ms │ ${c(latBar, barColor)}`
    );
  }

  const errRate = stats.totalRequests > 0
    ? ((stats.totalErrors / stats.totalRequests) * 100).toFixed(1)
    : "0.0";
  const errColor: "green"|"yellow"|"red" = stats.errorRate < 5 ? "green" : stats.errorRate < 20 ? "yellow" : "red";

  console.log("\n" + "═".repeat(72));
  console.log(c("  📈 STATISTIQUES GLOBALES", "bold"));
  console.log("═".repeat(72));
  console.log(`
  Total requêtes       : ${c(String(stats.totalRequests), "bold")}
  Succès               : ${c(String(stats.totalSuccess), "green")}
  Erreurs              : ${c(String(stats.totalErrors), stats.totalErrors > 0 ? "red" : "green")}
  Taux d'erreur        : ${c(errRate + "%", errColor)}
  Durée totale mur     : ${c(stats.overallDurationMs + " ms", "cyan")}
  Débit (req/s)        : ${c(stats.throughputRps.toFixed(1), "magenta")}

  Latences (toutes):
    Min                : ${c(stats.minLatencyMs + " ms", "green")}
    Médiane (P50)      : ${c(stats.p50LatencyMs + " ms", "green")}
    Moyenne            : ${c(stats.avgLatencyMs + " ms", "cyan")}
    95e percentile     : ${c(stats.p95LatencyMs + " ms", stats.p95LatencyMs > 500 ? "yellow" : "green")}
    99e percentile     : ${c(stats.p99LatencyMs + " ms", stats.p99LatencyMs > 1000 ? "red" : "yellow")}
    Max                : ${c(stats.maxLatencyMs + " ms", stats.maxLatencyMs > 2000 ? "red" : "yellow")}
`);

  console.log(c("  Distribution des latences:", "cyan"));
  const buckets    = [0, 50, 100, 200, 500, 1000, Infinity];
  const bLabels    = ["< 50ms   ", "50-100ms ", "100-200ms", "200-500ms", "500ms-1s ", "> 1s     "];
  for (let i = 0; i < buckets.length - 1; i++) {
    const cnt = allLats.filter((l) => l >= buckets[i] && l < buckets[i + 1]).length;
    const pct = allLats.length > 0 ? (cnt / allLats.length) * 100 : 0;
    const col: "green"|"yellow"|"red" = i <= 1 ? "green" : i <= 3 ? "yellow" : "red";
    const b = bar(cnt, allLats.length, 28);
    console.log(`  ${bLabels[i]} │ ${c(b, col)} │ ${String(cnt).padStart(4)} req (${pct.toFixed(1).padStart(5)}%)`);
  }

  const allErrors = results.flatMap((r) => r.errorMessages);
  if (allErrors.length > 0) {
    console.log(c(`\n  ⚠️  ERREURS (${allErrors.length} total):`, "red"));
    [...new Set(allErrors)].slice(0, 10).forEach((e) => console.log(`  • ${c(e, "red")}`));
    if (allErrors.length > 10) console.log(c(`  ... et ${allErrors.length - 10} autres`, "dim"));
  }

  // Verdict
  console.log("\n" + "═".repeat(72));
  if (mode === "read_only") {
    console.log(c("  ℹ️  NOTE : Test en lecture seule (aucune séquence dans la BDD).", "yellow"));
    console.log(c("     Pour un test complet d'écriture, créez d'abord une séquence", "dim"));
    console.log(c("     depuis l'interface admin, puis relancez ce script.", "dim"));
    console.log();
  }

  if (stats.errorRate === 0 && stats.p95LatencyMs < 500) {
    console.log(c("  🎉 VERDICT : EXCELLENT — Le serveur gère la charge sans problème.", "green"));
    console.log(c("     Supabase gère les accès concurrents sans conflit.", "dim"));
  } else if (stats.errorRate < 5 && stats.p95LatencyMs < 1000) {
    console.log(c("  ✅ VERDICT : BON — Quelques lenteurs mais aucun problème critique.", "yellow"));
    console.log(c("     Acceptable pour un usage scolaire standard.", "dim"));
  } else if (stats.errorRate < 20) {
    console.log(c("  ⚠️  VERDICT : DÉGRADÉ — Latences élevées ou erreurs détectées.", "yellow"));
    console.log(c("     Vérifier RLS Supabase, rate limits et connexions réseau.", "dim"));
  } else {
    console.log(c("  🔴 VERDICT : PROBLÈME — Trop d'erreurs, charge trop élevée.", "red"));
  }
  console.log("═".repeat(72) + "\n");
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(c("\n╔══════════════════════════════════════════════════╗", "cyan"));
  console.log(c("║  🚀 STRESS TEST — LE FANION — Notes Concurrentes  ║", "cyan"));
  console.log(c("╚══════════════════════════════════════════════════╝", "cyan"));
  console.log(`
  Paramètres:
  ├─ Enseignants simultanés : ${c(String(NB_TEACHERS), "bold")}
  ├─ Notes par enseignant   : ${c(String(GRADES_PER_TEACHER), "bold")}
  ├─ Total requêtes prévues : ${c(String(NB_TEACHERS * GRADES_PER_TEACHER), "bold")}
  └─ Jitter max             : ${c(JITTER_MAX_MS + " ms", "bold")}
`);

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error(c("❌ ERREUR: Variables VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquantes.", "red"));
    process.exit(1);
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  let testData: TestData;

  try {
    testData = await fetchTestData(adminClient);
  } catch (err: any) {
    console.error(c(`\n❌ Erreur de préparation: ${err.message}`, "red"));
    process.exit(1);
  }

  if (testData.students.length < GRADES_PER_TEACHER) {
    console.warn(c(
      `\n⚠️  Seulement ${testData.students.length} élèves dispo → UPSERT sur les mêmes élèves.\n`,
      "yellow"
    ));
  }

  const modeStr = testData.mode === "real" ? c("ÉCRITURE RÉELLE", "green") : c("LECTURE SEULE", "yellow");
  console.log(c(`\n⚡ Lancement de ${NB_TEACHERS} enseignants simultanés (${modeStr})...\n`, "bold"));

  const globalStart = Date.now();

  const teacherPromises = Array.from({ length: NB_TEACHERS }, (_, i) => {
    const teacherClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    process.stdout.write(`  👤 Enseignant #${String(i + 1).padStart(2)} lancé\n`);
    return testData.mode === "real"
      ? simulateTeacherWrite(i, testData, teacherClient)
      : simulateTeacherRead(i, testData, teacherClient);
  });

  const results = await Promise.all(teacherPromises);
  const overallDurationMs = Date.now() - globalStart;

  console.log(c("\n  ✅ Tous les enseignants ont terminé !", "green"));

  const allLatencies = results.flatMap((r) => r.latencies);
  const totalSuccess = results.reduce((s, r) => s + r.success, 0);
  const totalErrors  = results.reduce((s, r) => s + r.errors, 0);
  const totalRequests = totalSuccess + totalErrors;
  const avgLatencyMs = allLatencies.length > 0
    ? Math.round(allLatencies.reduce((s, v) => s + v, 0) / allLatencies.length)
    : 0;

  const stats: SummaryStats = {
    totalRequests, totalSuccess, totalErrors, avgLatencyMs,
    p50LatencyMs: percentile(allLatencies, 50),
    p95LatencyMs: percentile(allLatencies, 95),
    p99LatencyMs: percentile(allLatencies, 99),
    maxLatencyMs: allLatencies.length > 0 ? Math.max(...allLatencies) : 0,
    minLatencyMs: allLatencies.length > 0 ? Math.min(...allLatencies) : 0,
    throughputRps: totalRequests / (overallDurationMs / 1000),
    overallDurationMs,
    errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
  };

  printReport(results, stats, testData.mode);
}

main().catch((err) => {
  console.error(c(`\n💥 ERREUR FATALE: ${err.message}`, "red"));
  process.exit(1);
});
