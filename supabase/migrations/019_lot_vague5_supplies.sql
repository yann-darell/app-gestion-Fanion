-- ==========================================================
-- Migration Lot Vague 5 — Suivi Fournitures Scolaires (Le Fanion)
-- ==========================================================

-- 1. Table Fournitures Requises par Division / Année Scolaire
CREATE TABLE IF NOT EXISTS public.supply_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    division_id TEXT NOT NULL REFERENCES public.divisions(id) ON DELETE CASCADE,
    school_year_id UUID NOT NULL REFERENCES public.school_years(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_division_year_supply_label UNIQUE (division_id, school_year_id, label)
);

-- Index pour accélérer les requêtes par division et année scolaire
CREATE INDEX IF NOT EXISTS idx_supply_requirements_div_year 
    ON public.supply_requirements (division_id, school_year_id);

-- 2. Table Suivi Fournitures par Élève
CREATE TABLE IF NOT EXISTS public.student_supplies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    supply_requirement_id UUID NOT NULL REFERENCES public.supply_requirements(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'manquant' CHECK (status IN ('donne', 'manquant')),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_student_supply_requirement UNIQUE (student_id, supply_requirement_id)
);

-- Index pour optimiser les requêtes par élève
CREATE INDEX IF NOT EXISTS idx_student_supplies_student 
    ON public.student_supplies (student_id);

-- 3. Activation de Row Level Security (RLS)
ALTER TABLE public.supply_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_supplies ENABLE ROW LEVEL SECURITY;

-- 4. Politiques RLS
-- Principe : AUCUNE policy pour enseignant ni public (bloqué par défaut).
-- Seuls principal et directeur_etudes ont l'accès complet (lecture/écriture).

CREATE POLICY "supply_requirements_admin_all" ON public.supply_requirements
    FOR ALL TO authenticated
    USING (public.get_user_role() IN ('principal', 'directeur_etudes'))
    WITH CHECK (public.get_user_role() IN ('principal', 'directeur_etudes'));

CREATE POLICY "student_supplies_admin_all" ON public.student_supplies
    FOR ALL TO authenticated
    USING (public.get_user_role() IN ('principal', 'directeur_etudes'))
    WITH CHECK (public.get_user_role() IN ('principal', 'directeur_etudes'));
