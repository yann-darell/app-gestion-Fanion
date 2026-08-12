-- Migration 004: Ajout des colonnes de détails administratifs pour les élèves
ALTER TABLE students ADD COLUMN birth_place TEXT;
ALTER TABLE students ADD COLUMN nationality TEXT;
ALTER TABLE students ADD COLUMN is_repeating INTEGER DEFAULT 0;
