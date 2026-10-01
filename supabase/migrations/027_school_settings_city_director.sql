-- ============================================================
-- Migration 027 — Paramètres établissement : ville et directeur
-- Ajout des champs city et director_name à school_settings
-- ============================================================

ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'Yaoundé',
  ADD COLUMN IF NOT EXISTS director_name TEXT DEFAULT 'La Directrice';
