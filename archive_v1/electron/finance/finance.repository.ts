import { getDb } from "../db/connection";
import {
    FeeSchedule,
    StudentFeeOverride,
    Payment,
    Receipt
} from "../types/finance";

export const financeRepository = {
    // --- Fee Schedules ---

    getFeeSchedule(classId: number, schoolYearId: number): FeeSchedule | null {
        const db = getDb();
        const stmt = db.prepare(`
            SELECT fs.*, c.name as class_name, sy.label as school_year_label
            FROM fee_schedules fs
            JOIN classes c ON fs.class_id = c.id
            JOIN school_years sy ON fs.school_year_id = sy.id
            WHERE fs.class_id = ? AND fs.school_year_id = ?
        `);
        const row = stmt.get(classId, schoolYearId);
        return row ? (row as FeeSchedule) : null;
    },

    getFeeScheduleByStudentId(studentId: number, schoolYearId: number): FeeSchedule | null {
        const db = getDb();
        const stmt = db.prepare(`
            SELECT fs.*, c.name as class_name, sy.label as school_year_label
            FROM fee_schedules fs
            JOIN classes c ON fs.class_id = c.id
            JOIN school_years sy ON fs.school_year_id = sy.id
            JOIN students s ON s.class_id = c.id
            WHERE s.id = ? AND fs.school_year_id = ?
        `);
        const row = stmt.get(studentId, schoolYearId);
        return row ? (row as FeeSchedule) : null;
    },

    setFeeSchedule(
        classId: number,
        schoolYearId: number,
        registrationFee: number,
        totalAmount: number,
        installmentsJson: string
    ): void {
        const db = getDb();
        const stmt = db.prepare(`
            INSERT INTO fee_schedules (class_id, school_year_id, registration_fee, total_amount, installments_json)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(class_id, school_year_id)
            DO UPDATE SET registration_fee = excluded.registration_fee,
                          total_amount = excluded.total_amount,
                          installments_json = excluded.installments_json
        `);
        stmt.run(classId, schoolYearId, registrationFee, totalAmount, installmentsJson);
    },

    // --- Student Fee Overrides ---

    getStudentFeeOverride(studentId: number, schoolYearId: number): StudentFeeOverride | null {
        const db = getDb();
        const stmt = db.prepare(`
            SELECT * FROM student_fee_overrides
            WHERE student_id = ? AND school_year_id = ?
        `);
        const row = stmt.get(studentId, schoolYearId);
        return row ? (row as StudentFeeOverride) : null;
    },

    setStudentFeeOverride(
        studentId: number,
        schoolYearId: number,
        totalAmountOverride: number,
        reason: string
    ): void {
        const db = getDb();
        const stmt = db.prepare(`
            INSERT INTO student_fee_overrides (student_id, school_year_id, total_amount_override, reason)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(student_id, school_year_id)
            DO UPDATE SET total_amount_override = excluded.total_amount_override,
                          reason = excluded.reason
        `);
        stmt.run(studentId, schoolYearId, totalAmountOverride, reason);
    },

    removeStudentFeeOverride(studentId: number, schoolYearId: number): void {
        const db = getDb();
        const stmt = db.prepare(`
            DELETE FROM student_fee_overrides
            WHERE student_id = ? AND school_year_id = ?
        `);
        stmt.run(studentId, schoolYearId);
    },

    // --- Payments ---

    getStudentPayments(studentId: number, schoolYearId: number): Payment[] {
        const db = getDb();
        const stmt = db.prepare(`
            SELECT p.*,
                   CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END as has_receipt
            FROM payments p
            LEFT JOIN receipts r ON r.payment_id = p.id
            WHERE p.student_id = ? AND p.school_year_id = ?
            ORDER BY p.payment_date DESC, p.id DESC
        `);
        return stmt.all(studentId, schoolYearId) as Payment[];
    },

    getAllPayments(schoolYearId: number): Array<Payment & { student_name: string; class_name: string }> {
        const db = getDb();
        const stmt = db.prepare(`
            SELECT p.*,
                   (s.last_name || ' ' || s.first_name) as student_name,
                   c.name as class_name,
                   CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END as has_receipt
            FROM payments p
            JOIN students s ON p.student_id = s.id
            JOIN classes c ON s.class_id = c.id
            WHERE p.school_year_id = ?
            ORDER BY p.payment_date DESC, p.id DESC
        `);
        return stmt.all(schoolYearId) as Array<Payment & { student_name: string; class_name: string }>;
    },

    getTotalPaid(studentId: number, schoolYearId: number): number {
        const db = getDb();
        const stmt = db.prepare(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM payments
            WHERE student_id = ? AND school_year_id = ?
        `);
        const row = stmt.get(studentId, schoolYearId) as { total: number };
        return row.total;
    },

    addPayment(
        studentId: number,
        schoolYearId: number,
        amount: number,
        paymentDate: string,
        method: string,
        receiptNumber: string
    ): number {
        const db = getDb();
        const stmt = db.prepare(`
            INSERT INTO payments (student_id, school_year_id, amount, payment_date, method, receipt_number)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(studentId, schoolYearId, amount, paymentDate, method, receiptNumber);
        return info.lastInsertRowid as number;
    },

    // --- Receipts ---

    getReceiptByPaymentId(paymentId: number): Receipt | null {
        const db = getDb();
        const stmt = db.prepare(`SELECT * FROM receipts WHERE payment_id = ?`);
        const row = stmt.get(paymentId);
        return row ? (row as Receipt) : null;
    },

    addReceipt(paymentId: number, pdfPath: string): number {
        const db = getDb();
        const stmt = db.prepare(`
            INSERT INTO receipts (payment_id, pdf_path)
            VALUES (?, ?)
        `);
        const info = stmt.run(paymentId, pdfPath);
        return info.lastInsertRowid as number;
    },

    // --- Receipt Counter (séquentiel, persistant en base) ---

    getNextReceiptNumber(): { number: number; formatted: string } {
        const db = getDb();
        const row = db.prepare(
            "SELECT next_value FROM receipt_counters WHERE key = 'receipt'"
        ).get() as { next_value: number } | undefined;

        const nextVal = row ? row.next_value : 1;
        db.prepare(
            "UPDATE receipt_counters SET next_value = next_value + 1 WHERE key = 'receipt'"
        ).run();

        return {
            number: nextVal,
            formatted: `REC-${String(nextVal).padStart(5, "0")}`
        };
    },

    // --- Requêtes agrégées pour la vue d'ensemble ---

    getActiveSchoolYearId(): number | null {
        const db = getDb();
        const row = db.prepare(
            "SELECT id FROM school_years WHERE is_active = 1 LIMIT 1"
        ).get() as { id: number } | undefined;
        return row ? row.id : null;
    },

    getClassesForSchoolYear(schoolYearId: number): Array<{
        id: number;
        name: string;
        level: string;
    }> {
        const db = getDb();
        return db.prepare(`
            SELECT id, name, level FROM classes
            WHERE school_year_id = ?
            ORDER BY level ASC, name ASC
        `).all(schoolYearId) as Array<{ id: number; name: string; level: string }>;
    },

    getActiveStudentsByClass(classId: number): Array<{
        id: number;
        matricule: string;
        first_name: string;
        last_name: string;
        class_id: number;
    }> {
        const db = getDb();
        return db.prepare(`
            SELECT id, matricule, first_name, last_name, class_id
            FROM students
            WHERE class_id = ? AND status = 'active'
            ORDER BY last_name ASC, first_name ASC
        `).all(classId) as Array<{
            id: number;
            matricule: string;
            first_name: string;
            last_name: string;
            class_id: number;
        }>;
    },

    updatePayment(id: number, amount: number, paymentDate: string, method: string): void {
        const db = getDb();
        db.prepare(`
            UPDATE payments
            SET amount = ?, payment_date = ?, method = ?
            WHERE id = ?
        `).run(amount, paymentDate, method, id);
    },

    deletePayment(id: number): void {
        const db = getDb();
        db.prepare("DELETE FROM payments WHERE id = ?").run(id);
    },

    deleteReceiptByPaymentId(paymentId: number): void {
        const db = getDb();
        db.prepare("DELETE FROM receipts WHERE payment_id = ?").run(paymentId);
    }
};

export default financeRepository;
