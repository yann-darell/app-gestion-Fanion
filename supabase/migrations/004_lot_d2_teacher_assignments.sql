-- ============================================================
-- Migration Lot D2 — Attribution des enseignants
--                    (Le Fanion v2)
-- À exécuter dans l'éditeur SQL de Supabase (dashboard)
-- ORDRE : Migration → RLS → Triggers, jamais l'inverse
-- ============================================================

-- ============================================================
-- 1. Table teacher_assignments
--    Un enseignant ne peut être assigné qu'une seule fois
--    à la même combinaison matière/classe.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.teacher_assignments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id  UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    class_id    UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT ta_unique_teacher_subject_class UNIQUE (teacher_id, subject_id, class_id)
);

-- ============================================================
-- 2. Activation RLS
--    (SECURITE.md §4 : toujours en même temps que la table)
-- ============================================================

ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. Policy RLS : admin-only (lecture ET écriture)
--    L'enseignant n'a AUCUN accès direct à cette table.
--    Pas de policy SELECT pour authenticated → RLS bloque
--    tout par défaut pour les non-admins.
-- ============================================================

DROP POLICY IF EXISTS ta_admin_all ON public.teacher_assignments;
CREATE POLICY ta_admin_all ON public.teacher_assignments
    FOR ALL TO authenticated
    USING (public.get_user_role() IN ('principal', 'directeur_etudes'))
    WITH CHECK (public.get_user_role() IN ('principal', 'directeur_etudes'));

-- ============================================================
-- 4. Trigger de cohérence de division : matière / classe
--    Empêche d'assigner une matière d'une division à une
--    classe d'une autre division (séparation stricte).
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_assignment_division_matches_class()
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

DROP TRIGGER IF EXISTS trg_check_assignment_division ON public.teacher_assignments;
CREATE TRIGGER trg_check_assignment_division
    BEFORE INSERT OR UPDATE ON public.teacher_assignments
    FOR EACH ROW EXECUTE FUNCTION public.check_assignment_division_matches_class();

-- ============================================================
-- 5. Trigger de vérification du rôle enseignant
--    Empêche d'assigner un principal ou directeur_etudes
--    comme enseignant d'une matière.
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_assignment_teacher_role()
RETURNS TRIGGER AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = NEW.teacher_id;
    IF v_role IS DISTINCT FROM 'enseignant' THEN
        RAISE EXCEPTION 'teacher_id doit référencer un profil avec le rôle enseignant (rôle actuel : %)', v_role;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_assignment_teacher_role ON public.teacher_assignments;
CREATE TRIGGER trg_check_assignment_teacher_role
    BEFORE INSERT OR UPDATE ON public.teacher_assignments
    FOR EACH ROW EXECUTE FUNCTION public.check_assignment_teacher_role();
