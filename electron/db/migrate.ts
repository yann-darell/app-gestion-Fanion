import fs from "fs";
import path from "path";
import { getDb } from "./connection";

export function runMigrations() {
    const db = getDb();
    db.exec(`
    CREATE TABLE IF NOT EXISTS migrations_applied (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

    const migrationsDir = path.join(__dirname, "migrations");
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

    const already = new Set(
        db.prepare("SELECT filename FROM migrations_applied").all().map((r: any) => r.filename)
    );

    for (const file of files) {
        if (already.has(file)) continue;
        const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
        db.transaction(() => {
            db.exec(sql);
            db.prepare("INSERT INTO migrations_applied (filename) VALUES (?)").run(file);
        })();
        console.log(`Migration appliquée : ${file}`);
    }
}