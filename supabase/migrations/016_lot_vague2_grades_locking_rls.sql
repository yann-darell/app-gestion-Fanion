-- 0. Re-définition sécurisée de is_teacher_assigned avec vérification profile active
CREATE OR REPLACE FUNCTION public.is_teacher_assigned(
    p_subject_id UUID,
    p_student_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_active BOOLEAN;
BEGIN
    SELECT COALESCE(is_active, true) INTO v_is_active
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_is_active IS FALSE THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.teacher_assignments ta
        JOIN public.students s ON s.class_id = ta.class_id
        WHERE ta.teacher_id = auth.uid()
          AND ta.subject_id = p_subject_id
          AND s.id = p_student_id
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_teacher_assigned(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_teacher_assigned(UUID, UUID) TO authenticated;

-- 1. Fonction SECURITY DEFINER can_write_grade
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
    v_is_locked BOOLEAN;
BEGIN
    SELECT role, COALESCE(is_active, true) INTO v_role, v_is_active
    FROM public.profiles
    WHERE id = auth.uid();

    -- Si l'utilisateur est inactif, accès refusé systématiquement
    IF v_is_active IS FALSE THEN
        RETURN FALSE;
    END IF;

    -- Le Principal et le DE ont TOUJOURS le droit d'écrire/supprimer, même si verrouillé
    IF v_role IN ('principal', 'directeur_etudes') THEN
        RETURN TRUE;
    END IF;

    -- Pour un enseignant : vérifier si la séquence est verrouillée
    SELECT is_locked INTO v_is_locked
    FROM public.sequences
    WHERE id = p_sequence_id;

    IF v_is_locked IS TRUE THEN
        RETURN FALSE; -- Bloqué en écriture/suppression
    END IF;

    -- Si non verrouillée, vérifier l'attribution normale
    RETURN public.is_teacher_assigned(p_subject_id, p_student_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_write_grade(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_write_grade(UUID, UUID, UUID) TO authenticated;

-- 2. Suppression de l'ancienne policy générique FOR ALL sur grades
DROP POLICY IF EXISTS "grades_direction_or_assigned_teacher" ON public.grades;
DROP POLICY IF EXISTS "grades_select_policy" ON public.grades;
DROP POLICY IF EXISTS "grades_insert_policy" ON public.grades;
DROP POLICY IF EXISTS "grades_update_policy" ON public.grades;
DROP POLICY IF EXISTS "grades_delete_policy" ON public.grades;

-- 3. Création des policies RLS scindées par commande HTTP/Postgres

-- SELECT : consultation autorisée pour la Direction ou l'enseignant assigné (même si verrouillé)
CREATE POLICY "grades_select_policy"
ON public.grades FOR SELECT
TO authenticated
USING (
    public.get_user_role() IN ('principal', 'directeur_etudes')
    OR public.is_teacher_assigned(
        public.grades.subject_id,
        public.grades.student_id
    )
);

-- INSERT : création soumise à can_write_grade
CREATE POLICY "grades_insert_policy"
ON public.grades FOR INSERT
TO authenticated
WITH CHECK (
    public.can_write_grade(
        public.grades.sequence_id,
        public.grades.subject_id,
        public.grades.student_id
    )
);

-- UPDATE : modification soumise à can_write_grade (en USING et WITH CHECK)
CREATE POLICY "grades_update_policy"
ON public.grades FOR UPDATE
TO authenticated
USING (
    public.can_write_grade(
        public.grades.sequence_id,
        public.grades.subject_id,
        public.grades.student_id
    )
)
WITH CHECK (
    public.can_write_grade(
        public.grades.sequence_id,
        public.grades.subject_id,
        public.grades.student_id
    )
);

-- DELETE : suppression soumise EXPLICITEMENT à can_write_grade via USING
CREATE POLICY "grades_delete_policy"
ON public.grades FOR DELETE
TO authenticated
USING (
    public.can_write_grade(
        public.grades.sequence_id,
        public.grades.subject_id,
        public.grades.student_id
    )
);
