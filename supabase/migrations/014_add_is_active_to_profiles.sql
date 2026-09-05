-- ============================================================
-- Migration 014 — Vague 2 : Colonne is_active sur profiles
-- ============================================================

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
