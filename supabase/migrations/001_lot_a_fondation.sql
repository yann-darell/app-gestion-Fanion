-- ==========================================================
-- Migration Lot A — Fondation technique (Le Fanion v2)
-- À exécuter dans l'éditeur SQL de Supabase (dashboard)
-- ==========================================================

-- Active l'extension UUID si nécessaire
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Table Divisions
CREATE TABLE IF NOT EXISTS public.divisions (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL
);

-- 2. Table Années scolaires
CREATE TABLE IF NOT EXISTS public.school_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT check_dates CHECK (start_date < end_date)
);

-- Index pour assurer qu'une seule année scolaire est active à la fois
CREATE UNIQUE INDEX IF NOT EXISTS school_years_only_one_active_idx 
ON public.school_years (is_active) 
WHERE (is_active = true);

-- 3. Table Classes
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    level TEXT NOT NULL,
    division_id TEXT NOT NULL REFERENCES public.divisions(id),
    school_year_id UUID NOT NULL REFERENCES public.school_years(id) ON DELETE CASCADE,
    head_teacher_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Table Profils (liée à auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('principal', 'directeur_etudes', 'enseignant')),
    division_scope TEXT REFERENCES public.divisions(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================================
-- Données initiales (Seed)
-- ==========================================================

INSERT INTO public.divisions (id, nom) VALUES
('college', 'Collège'),
('primaire', 'Primaire')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.school_years (label, start_date, end_date, is_active) VALUES
('2026-2027', '2026-09-01', '2027-06-30', true)
ON CONFLICT (label) DO NOTHING;

-- ==========================================================
-- Activation du RLS sur toutes les tables
-- ==========================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- Fonction utilitaire SECURITY DEFINER
-- (évite la récursion infinie en lecture de profiles)
-- ==========================================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN (SELECT role FROM public.profiles WHERE id = auth.uid());
END;
$$;

-- ==========================================================
-- Policies RLS : profiles
-- ==========================================================

-- SELECT : un utilisateur lit son propre profil, ou un admin lit tout
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = id OR public.get_user_role() IN ('principal', 'directeur_etudes'));

-- INSERT/UPDATE/DELETE : réservé aux admins
CREATE POLICY "profiles_admin_all" ON public.profiles
    FOR ALL TO authenticated
    USING (public.get_user_role() IN ('principal', 'directeur_etudes'));

-- ==========================================================
-- Policies RLS : divisions
-- ==========================================================

CREATE POLICY "divisions_authenticated_select" ON public.divisions 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "divisions_admin_all" ON public.divisions 
    FOR ALL TO authenticated 
    USING (public.get_user_role() IN ('principal', 'directeur_etudes'));

-- ==========================================================
-- Policies RLS : school_years
-- ==========================================================

CREATE POLICY "school_years_authenticated_select" ON public.school_years 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "school_years_admin_all" ON public.school_years 
    FOR ALL TO authenticated 
    USING (public.get_user_role() IN ('principal', 'directeur_etudes'));

-- ==========================================================
-- Policies RLS : classes
-- ==========================================================

CREATE POLICY "classes_authenticated_select" ON public.classes 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "classes_admin_all" ON public.classes 
    FOR ALL TO authenticated 
    USING (public.get_user_role() IN ('principal', 'directeur_etudes'));
