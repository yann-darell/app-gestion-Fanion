-- ==========================================================
-- Migration Lot D2bis — Ajout colonne email à public.profiles
-- À exécuter dans l'éditeur SQL de Supabase (dashboard)
-- ==========================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
