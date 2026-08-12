CREATE TABLE IF NOT EXISTS school_years (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  level TEXT NOT NULL,
  school_year_id INTEGER NOT NULL REFERENCES school_years(id),
  apc_enabled INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  matricule TEXT NOT NULL UNIQUE,
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  birth_date TEXT,
  gender TEXT,
  class_id INTEGER REFERENCES classes(id),
  guardian_name TEXT,
  guardian_phone TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  enrolled_at TEXT NOT NULL DEFAULT (datetime('now'))
);