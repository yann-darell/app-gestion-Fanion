-- ============================================================
-- Migration 018 — Verrouillage des notes par enseignant / classe / matière
-- Table `grade_submissions` + Refonte de `can_write_grade()`
-- ============================================================

-- 1. Table grade_submissions
CREATE TABLE IF NOT EXISTS public.grade_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    sequence_id UUID NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_locked BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT unique_submission UNIQUE (class_id, subject_id, sequence_id)
);

ALTER TABLE public.grade_submissions ENABLE ROW LEVEL SECURITY;

-- SELECT : Direction ou Enseignant assigné
DROP POLICY IF EXISTS "grade_submissions_select" ON public.grade_submissions;
CREATE POLICY "grade_submissions_select"
ON public.grade_submissions FOR SELECT
TO authenticated
USING (
    public.get_user_role() IN ('principal', 'directeur_etudes')
    OR public.is_teacher_assigned_to_class(
        public.grade_submissions.subject_id,
        public.grade_submissions.class_id
    )
);

-- INSERT : Enseignant assigné ou Direction
DROP POLICY IF EXISTS "grade_submissions_insert" ON public.grade_submissions;
CREATE POLICY "grade_submissions_insert"
ON public.grade_submissions FOR INSERT
TO authenticated
WITH CHECK (
    public.get_user_role() IN ('principal', 'directeur_etudes')
    OR (
        teacher_id = auth.uid()
        AND public.is_teacher_assigned_to_class(
            public.grade_submissions.subject_id,
            public.grade_submissions.class_id
        )
    )
);

-- UPDATE / DELETE : Direction uniquement (permet au Principal/DE de déverrouiller)
DROP POLICY IF EXISTS "grade_submissions_manage_direction" ON public.grade_submissions;
CREATE POLICY "grade_submissions_manage_direction"
ON public.grade_submissions FOR ALL
TO authenticated
USING (public.get_user_role() IN ('principal', 'directeur_etudes'))
WITH CHECK (public.get_user_role() IN ('principal', 'directeur_etudes'));


-- 2. Refonte de can_write_grade() pour inclure le verrou local
CREATE OR REPLACE FUNCTION public.can_write_grade(
    p_sequence_id UUID,
    p_subject_id UUID,
    p_student_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
    v_is_active BOOLEAN;
    v_is_sequence_locked BOOLEAN;
    v_class_id UUID;
    v_is_submission_locked BOOLEAN;
BEGIN
    SELECT role, COALESCE(is_active, true) INTO v_role, v_is_active
    FROM public.profiles
    WHERE id = auth.uid();

    -- Compte inactif -> refus
    IF v_is_active IS FALSE THEN
        RETURN FALSE;
    END IF;

    -- Le Principal et le DE ont TOUJOURS le droit d'écrire/supprimer
    IF v_role IN ('principal', 'directeur_etudes') THEN
        RETURN TRUE;
    END IF;

    -- 1er verrou : Séquence globalement verrouillée par la Direction
    SELECT is_locked INTO v_is_sequence_locked
    FROM public.sequences
    WHERE id = p_sequence_id;

    IF v_is_sequence_locked IS TRUE THEN
        RETURN FALSE;
    END IF;

    -- Récupérer la classe de l'élève
    SELECT class_id INTO v_class_id
    FROM public.students
    WHERE id = p_student_id;

    IF v_class_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 2ème verrou : Soumission validée pour cette classe / matière / séquence
    SELECT is_locked INTO v_is_submission_locked
    FROM public.grade_submissions
    WHERE class_id = v_class_id
      AND subject_id = p_subject_id
      AND sequence_id = p_sequence_id;

    IF v_is_submission_locked IS TRUE THEN
        RETURN FALSE;
    END IF;

    -- Si non verrouillé, vérifier l'attribution normale
    RETURN public.is_teacher_assigned(p_subject_id, p_student_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_write_grade(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_write_grade(UUID, UUID, UUID) TO authenticated;
