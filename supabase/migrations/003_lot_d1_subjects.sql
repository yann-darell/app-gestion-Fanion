-- ============================================================
-- Migration Lot D1 — Matières, Groupes, Coefficients,
--                    Trimestres et Séquences (Le Fanion v2)
-- À exécuter dans l'éditeur SQL de Supabase (dashboard)
-- ORDRE : Migration → RLS → Seed, jamais l'inverse (REGLES_TECHNIQUES §1)
-- ============================================================

-- ============================================================
-- 1. Table subjects — Matières par division
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subjects (
    id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    division_id TEXT NOT NULL REFERENCES public.divisions(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT subjects_name_division_unique UNIQUE (name, division_id)
);

-- ============================================================
-- 2. Table subject_groups — Groupes pédagogiques I à IV
--    (invariants, seed ci-dessous, jamais modifiés par l'UI)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subject_groups (
    id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL UNIQUE CHECK (label IN ('I', 'II', 'III', 'IV'))
);

-- ============================================================
-- 3. Table class_subject_coefficients
--    Une matière ne peut être configurée qu'une seule fois par classe
-- ============================================================
CREATE TABLE IF NOT EXISTS public.class_subject_coefficients (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id        UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    subject_id      UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    subject_group_id UUID NOT NULL REFERENCES public.subject_groups(id),
    coefficient     SMALLINT NOT NULL CHECK (coefficient >= 1),
    created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT csc_class_subject_unique UNIQUE (class_id, subject_id)
);

-- ============================================================
-- 4. Table terms — Trimestres (liés à une année scolaire)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.terms (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_year_id UUID NOT NULL REFERENCES public.school_years(id) ON DELETE CASCADE,
    label          TEXT NOT NULL,
    order_index    SMALLINT NOT NULL,
    created_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT terms_year_order_unique UNIQUE (school_year_id, order_index)
);

-- ============================================================
-- 5. Table sequences — Séquences (2 par trimestre)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sequences (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    term_id     UUID NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    order_index SMALLINT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT sequences_term_order_unique UNIQUE (term_id, order_index)
);

-- ============================================================
-- Activation RLS sur les 5 tables
-- (SECURITE.md §4 : toujours en même temps que la table)
-- ============================================================

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_subject_coefficients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequences ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Policies RLS : subjects
-- Lecture : tout utilisateur authentifié
-- Écriture : principal / directeur_etudes uniquement
-- ============================================================

DROP POLICY IF EXISTS subjects_select_authenticated ON public.subjects;
CREATE POLICY subjects_select_authenticated ON public.subjects
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS subjects_admin_all ON public.subjects;
CREATE POLICY subjects_admin_all ON public.subjects
    FOR ALL TO authenticated
    USING (public.get_user_role() IN ('principal', 'directeur_etudes'))
    WITH CHECK (public.get_user_role() IN ('principal', 'directeur_etudes'));

-- ============================================================
-- Policies RLS : subject_groups
-- Lecture : tout utilisateur authentifié (les enseignants en ont besoin)
-- Écriture : admin uniquement (données quasi-invariantes)
-- ============================================================

DROP POLICY IF EXISTS subject_groups_select_authenticated ON public.subject_groups;
CREATE POLICY subject_groups_select_authenticated ON public.subject_groups
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS subject_groups_admin_all ON public.subject_groups;
CREATE POLICY subject_groups_admin_all ON public.subject_groups
    FOR ALL TO authenticated
    USING (public.get_user_role() IN ('principal', 'directeur_etudes'))
    WITH CHECK (public.get_user_role() IN ('principal', 'directeur_etudes'));

-- ============================================================
-- Policies RLS : class_subject_coefficients
-- Lecture : tout utilisateur authentifié (besoin pour calcul moyennes)
-- Écriture : principal / directeur_etudes uniquement
-- ============================================================

DROP POLICY IF EXISTS csc_select_authenticated ON public.class_subject_coefficients;
CREATE POLICY csc_select_authenticated ON public.class_subject_coefficients
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS csc_admin_all ON public.class_subject_coefficients;
CREATE POLICY csc_admin_all ON public.class_subject_coefficients
    FOR ALL TO authenticated
    USING (public.get_user_role() IN ('principal', 'directeur_etudes'))
    WITH CHECK (public.get_user_role() IN ('principal', 'directeur_etudes'));

-- ============================================================
-- Policies RLS : terms
-- Lecture : tout utilisateur authentifié (nécessaire pour saisie notes)
-- Écriture : admin uniquement
-- ============================================================

DROP POLICY IF EXISTS terms_select_authenticated ON public.terms;
CREATE POLICY terms_select_authenticated ON public.terms
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS terms_admin_all ON public.terms;
CREATE POLICY terms_admin_all ON public.terms
    FOR ALL TO authenticated
    USING (public.get_user_role() IN ('principal', 'directeur_etudes'))
    WITH CHECK (public.get_user_role() IN ('principal', 'directeur_etudes'));

-- ============================================================
-- Policies RLS : sequences
-- Lecture : tout utilisateur authentifié
-- Écriture : admin uniquement
-- ============================================================

DROP POLICY IF EXISTS sequences_select_authenticated ON public.sequences;
CREATE POLICY sequences_select_authenticated ON public.sequences
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS sequences_admin_all ON public.sequences;
CREATE POLICY sequences_admin_all ON public.sequences
    FOR ALL TO authenticated
    USING (public.get_user_role() IN ('principal', 'directeur_etudes'))
    WITH CHECK (public.get_user_role() IN ('principal', 'directeur_etudes'));

-- ============================================================
-- Seed : subject_groups (I à IV — invariants)
-- ============================================================

INSERT INTO public.subject_groups (label) VALUES
    ('I'),
    ('II'),
    ('III'),
    ('IV')
ON CONFLICT (label) DO NOTHING;

-- ============================================================
-- Seed : trimestres et séquences pour l'année scolaire active
-- Décision validée : uniquement pour is_active = true
-- Si une nouvelle année est activée, relancer manuellement.
-- ============================================================

DO $$
DECLARE
    v_year_id UUID;
    v_term1_id UUID;
    v_term2_id UUID;
    v_term3_id UUID;
BEGIN
    -- Récupère l'année scolaire active
    SELECT id INTO v_year_id
    FROM public.school_years
    WHERE is_active = true
    LIMIT 1;

    IF v_year_id IS NULL THEN
        RAISE NOTICE 'Aucune année scolaire active trouvée — seed trimestres ignoré.';
        RETURN;
    END IF;

    -- Trimestre 1
    INSERT INTO public.terms (school_year_id, label, order_index)
    VALUES (v_year_id, 'Trimestre 1', 1)
    ON CONFLICT (school_year_id, order_index) DO NOTHING
    RETURNING id INTO v_term1_id;

    IF v_term1_id IS NULL THEN
        SELECT id INTO v_term1_id FROM public.terms
        WHERE school_year_id = v_year_id AND order_index = 1;
    END IF;

    INSERT INTO public.sequences (term_id, label, order_index) VALUES
        (v_term1_id, 'Séquence 1', 1),
        (v_term1_id, 'Séquence 2', 2)
    ON CONFLICT (term_id, order_index) DO NOTHING;

    -- Trimestre 2
    INSERT INTO public.terms (school_year_id, label, order_index)
    VALUES (v_year_id, 'Trimestre 2', 2)
    ON CONFLICT (school_year_id, order_index) DO NOTHING
    RETURNING id INTO v_term2_id;

    IF v_term2_id IS NULL THEN
        SELECT id INTO v_term2_id FROM public.terms
        WHERE school_year_id = v_year_id AND order_index = 2;
    END IF;

    INSERT INTO public.sequences (term_id, label, order_index) VALUES
        (v_term2_id, 'Séquence 3', 1),
        (v_term2_id, 'Séquence 4', 2)
    ON CONFLICT (term_id, order_index) DO NOTHING;

    -- Trimestre 3
    INSERT INTO public.terms (school_year_id, label, order_index)
    VALUES (v_year_id, 'Trimestre 3', 3)
    ON CONFLICT (school_year_id, order_index) DO NOTHING
    RETURNING id INTO v_term3_id;

    IF v_term3_id IS NULL THEN
        SELECT id INTO v_term3_id FROM public.terms
        WHERE school_year_id = v_year_id AND order_index = 3;
    END IF;

    INSERT INTO public.sequences (term_id, label, order_index) VALUES
        (v_term3_id, 'Séquence 5', 1),
        (v_term3_id, 'Séquence 6', 2)
    ON CONFLICT (term_id, order_index) DO NOTHING;

    RAISE NOTICE 'Seed trimestres/séquences terminé pour l''année %', v_year_id;
END;
$$;

-- ============================================================
-- 6. Trigger de cohérence de division : classe / matière
--    Empêche d'associer une matière d'une division à une classe
--    d'une autre division (séparation stricte).
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_subject_division_matches_class()
RETURNS TRIGGER AS $$
DECLARE
    v_class_division TEXT;
    v_subject_division TEXT;
BEGIN
    SELECT division_id INTO v_class_division FROM public.classes WHERE id = NEW.class_id;
    SELECT division_id INTO v_subject_division FROM public.subjects WHERE id = NEW.subject_id;

    IF v_class_division IS DISTINCT FROM v_subject_division THEN
        RAISE EXCEPTION 'La matière (division %) ne correspond pas à la division de la classe (%)', v_subject_division, v_class_division;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_subject_division ON public.class_subject_coefficients;
CREATE TRIGGER trg_check_subject_division
    BEFORE INSERT OR UPDATE ON public.class_subject_coefficients
    FOR EACH ROW EXECUTE FUNCTION public.check_subject_division_matches_class();

