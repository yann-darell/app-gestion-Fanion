import { getDb } from "../db/connection";
import { Student } from "../types/students";

export const studentsRepository = {
    list(filters: { classId?: number; search?: string } = {}): Student[] {
        const db = getDb();
        let query = `
            SELECT s.*, c.name as class_name
            FROM students s
            JOIN classes c ON s.class_id = c.id
            WHERE s.status = 'active'
        `;
        const params: any[] = [];

        if (filters.classId) {
            query += ` AND s.class_id = ?`;
            params.push(filters.classId);
        }

        if (filters.search) {
            query += ` AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.matricule LIKE ?)`;
            const searchPattern = `%${filters.search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }

        query += ` ORDER BY s.last_name ASC, s.first_name ASC`;
        const stmt = db.prepare(query);
        return stmt.all(...params) as Student[];
    },

    get(id: number): Student | null {
        const db = getDb();
        const stmt = db.prepare(`
            SELECT s.*, c.name as class_name
            FROM students s
            JOIN classes c ON s.class_id = c.id
            WHERE s.id = ?
        `);
        const result = stmt.get(id);
        return result ? (result as Student) : null;
    },

    create(input: Omit<Student, "id" | "status">): number {
        const db = getDb();
        const stmt = db.prepare(`
            INSERT INTO students (matricule, first_name, last_name, birth_date, gender, class_id, guardian_name, guardian_phone, photo_filename, birth_place, nationality, is_repeating, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
        `);
        const info = stmt.run(
            input.matricule,
            input.first_name,
            input.last_name,
            input.birth_date,
            input.gender,
            input.class_id,
            input.guardian_name,
            input.guardian_phone,
            input.photo_filename,
            input.birth_place || null,
            input.nationality || null,
            input.is_repeating ?? 0
        );
        return info.lastInsertRowid as number;
    },

    update(id: number, input: Partial<Omit<Student, "id">>): void {
        const db = getDb();
        const fields: string[] = [];
        const params: any[] = [];

        Object.entries(input).forEach(([key, value]) => {
            if (value !== undefined) {
                fields.push(`${key} = ?`);
                params.push(value);
            }
        });

        if (fields.length === 0) return;

        params.push(id);
        const query = `UPDATE students SET ${fields.join(", ")} WHERE id = ?`;
        const stmt = db.prepare(query);
        stmt.run(...params);
    },

    delete(id: number): void {
        const db = getDb();
        // SOFT DELETE: Mettre le statut à 'inactive' au lieu de faire un DELETE physique
        const stmt = db.prepare(`
            UPDATE students
            SET status = 'inactive'
            WHERE id = ?
        `);
        stmt.run(id);
    },

    existsMatricule(matricule: string, excludeId?: number): boolean {
        const db = getDb();
        if (excludeId) {
            const stmt = db.prepare("SELECT 1 FROM students WHERE matricule = ? AND id != ? LIMIT 1");
            return !!stmt.get(matricule, excludeId);
        } else {
            const stmt = db.prepare("SELECT 1 FROM students WHERE matricule = ? LIMIT 1");
            return !!stmt.get(matricule);
        }
    },

    getStudentCountForClass(classId: number): number {
        const db = getDb();
        const stmt = db.prepare("SELECT COUNT(*) as count FROM students WHERE class_id = ?");
        const row = stmt.get(classId) as { count: number };
        return row ? row.count : 0;
    }
};

export default studentsRepository;
