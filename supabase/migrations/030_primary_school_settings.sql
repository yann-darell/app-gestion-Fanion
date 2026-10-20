-- ============================================================
-- Migration 030 — Paramètres d'établissement pour le primaire
-- Ajout des champs spécifiques à l'école primaire
-- ============================================================

ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS primary_name TEXT DEFAULT 'École Primaire Le Fanion',
  ADD COLUMN IF NOT EXISTS primary_director_name TEXT DEFAULT 'La Directrice',
  ADD COLUMN IF NOT EXISTS primary_legal_notice TEXT DEFAULT 'Enseignement Primaire et Maternel - Système APC';

COMMENT ON COLUMN public.school_settings.primary_name IS 'Nom officiel de la section primaire affiché sur les bulletins APC';
COMMENT ON COLUMN public.school_settings.primary_director_name IS 'Titre/Nom du responsable de l''école primaire pour les signatures';
COMMENT ON COLUMN public.school_settings.primary_legal_notice IS 'Mention légale ou arrêté officiel pour l''ordre d''enseignement primaire';
