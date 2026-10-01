-- ============================================================
-- Migration 021 — Départements pédagogiques (Collège uniquement)
-- Table departments + colonne department_id sur subjects
-- ORDRE : Migration → RLS → Seed (REGLES_TECHNIQUES §1)
-- ============================================================

-- ============================================================
-- 1. Table departments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.departments (
    id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    head_teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================
-- 2. Colonne department_id sur subjects (nullable)
--    Les matières du primaire n'ont pas de département → NULL
-- ============================================================
ALTER TABLE public.subjects
    ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- ============================================================
-- 3. RLS (SECURITE.md §4 : en même temps que la table)
-- ============================================================
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Lecture : tout utilisateur authentifié
DROP POLICY IF EXISTS departments_select_authenticated ON public.departments;
CREATE POLICY departments_select_authenticated ON public.departments
    FOR SELECT TO authenticated USING (true);

-- Écriture : principal / directeur_etudes uniquement
DROP POLICY IF EXISTS departments_admin_all ON public.departments;
CREATE POLICY departments_admin_all ON public.departments
    FOR ALL TO authenticated
    USING (public.get_user_role() IN ('principal', 'directeur_etudes'))
    WITH CHECK (public.get_user_role() IN ('principal', 'directeur_etudes'));

-- ============================================================
-- 4. Seed : départements prédéfinis
-- ============================================================
INSERT INTO public.departments (name) VALUES
    ('Sciences Humaines'),
    ('Langue Française'),
    ('Langue Anglaise'),
    ('Langue Vivante'),
    ('Sciences Physiques et Mathématiques'),
    ('Sciences Informatiques'),
    ('Sciences Humaines et Biologie'),
    ('Sciences Sportives')
ON CONFLICT (name) DO NOTHING;
