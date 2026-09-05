-- ============================================================
-- Migration 015 — Vague 2 : Dates Périodes, Verrouillage & Paramètres Établissement
-- ============================================================

-- 1. Ajout des colonnes start_date et end_date sur terms et sequences
ALTER TABLE public.terms 
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE;

ALTER TABLE public.sequences 
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE;

-- 2. Ajout du flag is_locked sur sequences
ALTER TABLE public.sequences 
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;

-- 3. Table de configuration globale de l'établissement (school_settings)
CREATE TABLE IF NOT EXISTS public.school_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'Établissement Scolaire Le Fanion',
    address TEXT,
    phone TEXT,
    legal_notice TEXT,
    logo_url TEXT,
    watermark_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insertion de la configuration par défaut si la table est vide
INSERT INTO public.school_settings (name, address, phone, legal_notice)
SELECT 'Établissement Scolaire Le Fanion', 'Yaoundé, Cameroun', '+237 600 00 00 00', 'Établissement d''Enseignement Général et Bilingue'
WHERE NOT EXISTS (SELECT 1 FROM public.school_settings);

-- Activation RLS
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;

-- Policies RLS sur school_settings
DROP POLICY IF EXISTS school_settings_read_authenticated ON public.school_settings;
CREATE POLICY school_settings_read_authenticated ON public.school_settings
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS school_settings_admin_all ON public.school_settings;
CREATE POLICY school_settings_admin_all ON public.school_settings
    FOR ALL TO authenticated
    USING (public.get_user_role() IN ('principal', 'directeur_etudes'))
    WITH CHECK (public.get_user_role() IN ('principal', 'directeur_etudes'));

-- Fonction utilitaire update_updated_at_column si non présente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger updated_at automatique pour school_settings
DROP TRIGGER IF EXISTS trg_school_settings_updated_at ON public.school_settings;
CREATE TRIGGER trg_school_settings_updated_at
    BEFORE UPDATE ON public.school_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
