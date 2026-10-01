-- ============================================================
-- Migration Primaire — APC Fondation
-- ============================================================

-- 1. primary_domains
CREATE TABLE IF NOT EXISTS public.primary_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    order_index INTEGER NOT NULL
);

-- 2. primary_sub_evaluations
CREATE TABLE IF NOT EXISTS public.primary_sub_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES public.primary_domains(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    order_index INTEGER NOT NULL
);

-- 3. primary_scales
CREATE TABLE IF NOT EXISTS public.primary_scales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level TEXT NOT NULL,
    sub_evaluation_id UUID NOT NULL REFERENCES public.primary_sub_evaluations(id) ON DELETE CASCADE,
    max_score NUMERIC NOT NULL,
    CONSTRAINT primary_scales_unique_level_sub UNIQUE (level, sub_evaluation_id)
);

-- 4. primary_evaluations
CREATE TABLE IF NOT EXISTS public.primary_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    term_id UUID NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    order_index INTEGER NOT NULL
);

-- 5. primary_teacher_assignments
CREATE TABLE IF NOT EXISTS public.primary_teacher_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT primary_teacher_assignments_unique_teacher_class UNIQUE (teacher_id, class_id)
);

-- 6. primary_grades
CREATE TABLE IF NOT EXISTS public.primary_grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    sub_evaluation_id UUID NOT NULL REFERENCES public.primary_sub_evaluations(id) ON DELETE CASCADE,
    primary_evaluation_id UUID NOT NULL REFERENCES public.primary_evaluations(id) ON DELETE CASCADE,
    score NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT primary_grades_unique_student_sub_eval UNIQUE (student_id, sub_evaluation_id, primary_evaluation_id)
);

-- ============================================================
-- Fonctions SECURITY DEFINER
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_primary_teacher_assigned(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.primary_teacher_assignments pta
        JOIN public.students s ON s.class_id = pta.class_id
        WHERE pta.teacher_id = auth.uid()
          AND s.id = p_student_id
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_primary_teacher_assigned(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_primary_teacher_assigned(UUID) TO authenticated;

-- ============================================================
-- RLS Activation
-- ============================================================
ALTER TABLE public.primary_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.primary_sub_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.primary_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.primary_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.primary_teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.primary_grades ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Policies: primary_domains
-- ============================================================
DROP POLICY IF EXISTS "primary_domains_read_policy" ON public.primary_domains;
CREATE POLICY "primary_domains_read_policy" ON public.primary_domains
    FOR SELECT TO authenticated
    USING (public.get_user_role() IN ('principal', 'directeur_etudes', 'enseignant'));

DROP POLICY IF EXISTS "primary_domains_write_policy" ON public.primary_domains;
CREATE POLICY "primary_domains_write_policy" ON public.primary_domains
    FOR ALL TO authenticated
    USING (public.get_user_role() IN ('principal', 'directeur_etudes'))
    WITH CHECK (public.get_user_role() IN ('principal', 'directeur_etudes'));

-- ============================================================
-- Policies: primary_sub_evaluations
-- ============================================================
DROP POLICY IF EXISTS "primary_sub_evaluations_read_policy" ON public.primary_sub_evaluations;
CREATE POLICY "primary_sub_evaluations_read_policy" ON public.primary_sub_evaluations
    FOR SELECT TO authenticated
    USING (public.get_user_role() IN ('principal', 'directeur_etudes', 'enseignant'));

DROP POLICY IF EXISTS "primary_sub_evaluations_write_policy" ON public.primary_sub_evaluations;
CREATE POLICY "primary_sub_evaluations_write_policy" ON public.primary_sub_evaluations
    FOR ALL TO authenticated
    USING (public.get_user_role() IN ('principal', 'directeur_etudes'))
    WITH CHECK (public.get_user_role() IN ('principal', 'directeur_etudes'));

-- ============================================================
-- Policies: primary_scales
-- ============================================================
DROP POLICY IF EXISTS "primary_scales_read_policy" ON public.primary_scales;
CREATE POLICY "primary_scales_read_policy" ON public.primary_scales
    FOR SELECT TO authenticated
    USING (public.get_user_role() IN ('principal', 'directeur_etudes', 'enseignant'));

DROP POLICY IF EXISTS "primary_scales_write_policy" ON public.primary_scales;
CREATE POLICY "primary_scales_write_policy" ON public.primary_scales
    FOR ALL TO authenticated
    USING (public.get_user_role() IN ('principal', 'directeur_etudes'))
    WITH CHECK (public.get_user_role() IN ('principal', 'directeur_etudes'));

-- ============================================================
-- Policies: primary_evaluations
-- ============================================================
DROP POLICY IF EXISTS "primary_evaluations_read_policy" ON public.primary_evaluations;
CREATE POLICY "primary_evaluations_read_policy" ON public.primary_evaluations
    FOR SELECT TO authenticated
    USING (public.get_user_role() IN ('principal', 'directeur_etudes', 'enseignant'));

DROP POLICY IF EXISTS "primary_evaluations_write_policy" ON public.primary_evaluations;
CREATE POLICY "primary_evaluations_write_policy" ON public.primary_evaluations
    FOR ALL TO authenticated
    USING (public.get_user_role() IN ('principal', 'directeur_etudes'))
    WITH CHECK (public.get_user_role() IN ('principal', 'directeur_etudes'));

-- ============================================================
-- Policies: primary_teacher_assignments
-- ============================================================
DROP POLICY IF EXISTS "pta_admin_all" ON public.primary_teacher_assignments;
CREATE POLICY "pta_admin_all" ON public.primary_teacher_assignments
    FOR ALL TO authenticated
    USING (public.get_user_role() IN ('principal', 'directeur_etudes'))
    WITH CHECK (public.get_user_role() IN ('principal', 'directeur_etudes'));

-- ============================================================
-- Policies: primary_grades
-- ============================================================
DROP POLICY IF EXISTS "primary_grades_read_policy" ON public.primary_grades;
CREATE POLICY "primary_grades_read_policy" ON public.primary_grades
    FOR SELECT TO authenticated
    USING (
        public.get_user_role() IN ('principal', 'directeur_etudes')
        OR (
            public.get_user_role() = 'enseignant'
            AND public.is_primary_teacher_assigned(public.primary_grades.student_id)
        )
    );

DROP POLICY IF EXISTS "primary_grades_write_policy" ON public.primary_grades;
CREATE POLICY "primary_grades_write_policy" ON public.primary_grades
    FOR ALL TO authenticated
    USING (
        public.get_user_role() IN ('principal', 'directeur_etudes')
        OR (
            public.get_user_role() = 'enseignant'
            AND public.is_primary_teacher_assigned(public.primary_grades.student_id)
        )
    )
    WITH CHECK (
        public.get_user_role() IN ('principal', 'directeur_etudes')
        OR (
            public.get_user_role() = 'enseignant'
            AND public.is_primary_teacher_assigned(public.primary_grades.student_id)
        )
    );

-- ============================================================
-- Triggers
-- ============================================================

-- updated_at trigger for grades
DROP TRIGGER IF EXISTS trg_primary_grades_updated_at ON public.primary_grades;
CREATE TRIGGER trg_primary_grades_updated_at
    BEFORE UPDATE ON public.primary_grades
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Verify teacher role trigger
CREATE OR REPLACE FUNCTION public.check_primary_assignment_teacher_role()
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

DROP TRIGGER IF EXISTS trg_check_primary_assignment_teacher_role ON public.primary_teacher_assignments;
CREATE TRIGGER trg_check_primary_assignment_teacher_role
    BEFORE INSERT OR UPDATE ON public.primary_teacher_assignments
    FOR EACH ROW EXECUTE FUNCTION public.check_primary_assignment_teacher_role();
