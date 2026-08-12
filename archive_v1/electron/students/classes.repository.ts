import { getDb } from "../db/connection";
import { Class, CreateClassInput } from "../types/students";

export const classesRepository = {
    list(): Class[] {
        const db = getDb();
        const stmt = db.prepare(`
            SELECT c.*, sy.label as school_year_label
            FROM classes c
            JOIN school_years sy ON c.school_year_id = sy.id
            ORDER BY sy.label DESC, c.name ASC
        `);
        return stmt.all() as Class[];
    },

    get(id: number): Class | null {
        const db = getDb();
        const stmt = db.prepare(`
            SELECT c.*, sy.label as school_year_label
            FROM classes c
            JOIN school_years sy ON c.school_year_id = sy.id
            WHERE c.id = ?
        `);
        const result = stmt.get(id);
        return result ? (result as Class) : null;
    },

    create(input: CreateClassInput): number {
        const db = getDb();
        const stmt = db.prepare(`
            INSERT INTO classes (name, level, school_year_id, apc_enabled)
            VALUES (?, ?, ?, ?)
        `);
        const info = stmt.run(
            input.name,
            input.level,
            input.school_year_id,
            input.apc_enabled
        );
        return info.lastInsertRowid as number;
    }
};

export default classesRepository;
