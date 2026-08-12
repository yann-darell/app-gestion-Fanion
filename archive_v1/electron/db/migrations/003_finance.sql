-- Migration 003: Tables du module Finance

CREATE TABLE IF NOT EXISTS fee_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL REFERENCES classes(id),
    school_year_id INTEGER NOT NULL REFERENCES school_years(id),
    registration_fee INTEGER NOT NULL DEFAULT 0,
    total_amount INTEGER NOT NULL DEFAULT 0,
    installments_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(class_id, school_year_id)
);

CREATE TABLE IF NOT EXISTS student_fee_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id),
    school_year_id INTEGER NOT NULL REFERENCES school_years(id),
    total_amount_override INTEGER NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(student_id, school_year_id)
);

CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id),
    school_year_id INTEGER NOT NULL REFERENCES school_years(id),
    amount INTEGER NOT NULL,
    payment_date TEXT NOT NULL,
    method TEXT NOT NULL,
    receipt_number TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id INTEGER NOT NULL REFERENCES payments(id),
    pdf_path TEXT NOT NULL,
    generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS receipt_counters (
    key TEXT PRIMARY KEY,
    next_value INTEGER NOT NULL
);

INSERT OR IGNORE INTO receipt_counters (key, next_value) VALUES ('receipt', 1);
