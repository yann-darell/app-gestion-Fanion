-- ============================================================
-- Migration 024 : Périodes Primaire — Mois & Bulletins
-- ============================================================
-- Le primaire utilise 9 mois (périodes fines) au lieu de séquences,
-- et 3 trimestres identiques à ceux du collège.
-- primary_months appartiennent à un term (trimestre).
-- primary_evaluations de la migration 022 sont désormais liées à
-- un primary_month (pas directement au term).
-- ============================================================

-- 1. Table primary_months : les 9 mois de l'année scolaire
CREATE TABLE IF NOT EXISTS public.primary_months (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    term_id UUID NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
    label TEXT NOT NULL,          -- ex: "Septembre", "Octobre", etc.
    order_index INTEGER NOT NULL, -- 1 → 9
    school_year_id UUID NOT NULL REFERENCES public.school_years(id) ON DELETE CASCADE,
    CONSTRAINT primary_months_unique_label_year UNIQUE (label, school_year_id)
);

COMMENT ON TABLE public.primary_months IS
'Les 9 mois de l''année scolaire du primaire. Chaque mois appartient à un trimestre (term).';

-- 2. Ajouter colonne primary_month_id à primary_evaluations
--    (référence au mois — les évaluations mensuelles du primaire)
ALTER TABLE public.primary_evaluations
    ADD COLUMN IF NOT EXISTS primary_month_id UUID
        REFERENCES public.primary_months(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.primary_evaluations.primary_month_id IS
'Mois du primaire auquel cette évaluation appartient. NULL = évaluation trimestrielle agrégée.';

-- 3. Table primary_bulletin_generations : suivi des bulletins générés
CREATE TABLE IF NOT EXISTS public.primary_bulletin_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    period_id UUID NOT NULL,           -- primary_month_id ou term_id selon period_type
    period_type TEXT NOT NULL CHECK (period_type IN ('month', 'term')),
    pdf_path TEXT,                     -- chemin dans le bucket supabase storage
    generated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT primary_bulletins_unique_student_period UNIQUE (student_id, period_id, period_type)
);

COMMENT ON TABLE public.primary_bulletin_generations IS
'Historique des bulletins PDF générés pour les élèves du primaire (par mois ou par trimestre).';

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.primary_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.primary_bulletin_generations ENABLE ROW LEVEL SECURITY;

-- primary_months : lecture par tous les authenticated, écriture par direction
DROP POLICY IF EXISTS "primary_months_read" ON public.primary_months;
CREATE POLICY "primary_months_read" ON public.primary_months
    FOR SELECT TO authenticated
    USING (public.get_user_role() IN ('principal', 'directeur_etudes', 'enseignant'));

DROP POLICY IF EXISTS "primary_months_write" ON public.primary_months;
CREATE POLICY "primary_months_write" ON public.primary_months
    FOR ALL TO authenticated
    USING (public.get_user_role() IN ('principal', 'directeur_etudes'))
    WITH CHECK (public.get_user_role() IN ('principal', 'directeur_etudes'));

-- primary_bulletin_generations : direction seule
DROP POLICY IF EXISTS "primary_bulletin_gen_admin" ON public.primary_bulletin_generations;
CREATE POLICY "primary_bulletin_gen_admin" ON public.primary_bulletin_generations
    FOR ALL TO authenticated
    USING (public.get_user_role() IN ('principal', 'directeur_etudes'))
    WITH CHECK (public.get_user_role() IN ('principal', 'directeur_etudes'));

-- ============================================================
-- Seed automatique : Les 9 mois scolaires du primaire
-- Trimestre 1 : Septembre (1), Octobre (2), Novembre (3)
-- Trimestre 2 : Décembre (4), Janvier (5), Février (6)
-- Trimestre 3 : Mars (7), Avril (8), Mai (9)
-- ============================================================
DO $$
DECLARE
    v_year_id UUID;
    v_term1_id UUID;
    v_term2_id UUID;
    v_term3_id UUID;
BEGIN
    -- Année scolaire active
    SELECT id INTO v_year_id FROM public.school_years WHERE is_active = true LIMIT 1;
    IF v_year_id IS NULL THEN
        SELECT id INTO v_year_id FROM public.school_years ORDER BY created_at DESC LIMIT 1;
    END IF;

    IF v_year_id IS NOT NULL THEN
        -- Trimestres 1, 2, 3
        SELECT id INTO v_term1_id FROM public.terms WHERE school_year_id = v_year_id AND order_index = 1;
        SELECT id INTO v_term2_id FROM public.terms WHERE school_year_id = v_year_id AND order_index = 2;
        SELECT id INTO v_term3_id FROM public.terms WHERE school_year_id = v_year_id AND order_index = 3;

        -- Insertion Trimestre 1 (mois 1, 2, 3)
        IF v_term1_id IS NOT NULL THEN
            INSERT INTO public.primary_months (term_id, label, order_index, school_year_id) VALUES
                (v_term1_id, 'Septembre', 1, v_year_id),
                (v_term1_id, 'Octobre',   2, v_year_id),
                (v_term1_id, 'Novembre',  3, v_year_id)
            ON CONFLICT (label, school_year_id) DO NOTHING;
        END IF;

        -- Insertion Trimestre 2 (mois 4, 5, 6)
        IF v_term2_id IS NOT NULL THEN
            INSERT INTO public.primary_months (term_id, label, order_index, school_year_id) VALUES
                (v_term2_id, 'Décembre', 4, v_year_id),
                (v_term2_id, 'Janvier',  5, v_year_id),
                (v_term2_id, 'Février',  6, v_year_id)
            ON CONFLICT (label, school_year_id) DO NOTHING;
        END IF;

        -- Insertion Trimestre 3 (mois 7, 8, 9)
        IF v_term3_id IS NOT NULL THEN
            INSERT INTO public.primary_months (term_id, label, order_index, school_year_id) VALUES
                (v_term3_id, 'Mars',  7, v_year_id),
                (v_term3_id, 'Avril', 8, v_year_id),
                (v_term3_id, 'Mai',   9, v_year_id)
            ON CONFLICT (label, school_year_id) DO NOTHING;
        END IF;
    END IF;
END $$;

