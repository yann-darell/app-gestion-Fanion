import Database from "better-sqlite3";
import path from "path";
import { app } from "electron";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
    if (!db) {
        const dbPath = path.join(app.getPath("userData"), "le-fanion.sqlite");
        db = new Database(dbPath);
        db.pragma("journal_mode = DELETE");
        db.pragma("foreign_keys = ON");
    }
    return db;
}