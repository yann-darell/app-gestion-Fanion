-- ============================================================
-- Migration 007 — Correction RLS Teacher Assignments & Grades
-- PROBLÈME : la policy RLS de teacher_assignments bloque TOUT
-- accès pour le rôle enseignant, y compris la sous-requête
-- EXISTS dans la policy de grades → un enseignant ne peut
-- ni voir ses attributions, ni lire/écrire ses propres notes.
-- De plus, la RLS de students bloque la résolution du class_id
-- d'un élève dans la policy de grades ET l'affichage de la
-- grille de saisie.
--
-- SOLUTION : 3 fonctions SECURITY DEFINER (même pattern que
-- get_user_role() du Lot A), contournant la RLS de façon
-- contrôlée et auditée.
-- ============================================================


-- ============================================================
-- 1. Fonction get_my_teacher_assignments()
--    Retourne les attributions de l'enseignant connecté
--    avec noms de classe et matière joints.
--    SECURITY DEFINER → contourne la RLS de teacher_assignments.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_teacher_assignments()
RETURNS TABLE (
    id UUID,
    teacher_id UUID,
    subject_id UUID,
    class_id UUID,
    class_name TEXT,
    subject_name TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ta.id,
        ta.teacher_id,
        ta.subject_id,
        ta.class_id,
        c.name AS class_name,
        s.name AS subject_name,
        ta.created_at
    FROM public.teacher_assignments ta
    JOIN public.classes c ON c.id = ta.class_id
    JOIN public.subjects s ON s.id = ta.subject_id
    WHERE ta.teacher_id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_teacher_assignments() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_teacher_assignments() TO authenticated;


-- ============================================================
-- 2. Fonction is_teacher_assigned(p_subject_id, p_student_id)
--    Vérifie si l'utilisateur connecté est assigné à la matière
--    pour la classe de l'élève donné.
--    SECURITY DEFINER → contourne la RLS de teacher_assignments
--    ET de students (jointure interne contrôlée).
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_teacher_assigned(
    p_subject_id UUID,
    p_student_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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


-- ============================================================
-- 3. Fonction get_my_assigned_students(p_class_id, p_subject_id)
--    Retourne les élèves d'une classe SI l'enseignant connecté
--    est assigné à cette combinaison classe/matière.
--    Ne retourne que les champs strictement nécessaires à la
--    grille de saisie (SECURITE.md : accès minimal, jamais
--    photo, contacts tuteur, etc.).
--    SECURITY DEFINER → contourne la RLS de students ET de
--    teacher_assignments de façon contrôlée.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_assigned_students(
    p_class_id UUID,
    p_subject_id UUID
)
RETURNS TABLE (
    id UUID,
    matricule TEXT,
    first_name TEXT,
    last_name TEXT,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Vérifier que l'enseignant est bien assigné à cette classe/matière
    IF NOT EXISTS (
        SELECT 1
        FROM public.teacher_assignments ta
        WHERE ta.teacher_id = auth.uid()
          AND ta.class_id = p_class_id
          AND ta.subject_id = p_subject_id
    ) THEN
        -- Pas assigné : retourne un ensemble vide, pas d'erreur
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        st.id,
        st.matricule,
        st.first_name,
        st.last_name,
        st.status
    FROM public.students st
    WHERE st.class_id = p_class_id
      AND st.status = 'active'
    ORDER BY st.last_name, st.first_name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_assigned_students(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_assigned_students(UUID, UUID) TO authenticated;


-- ============================================================
-- 4. Suppression de l'ancienne policy sur grades
--    Nom confirmé via pg_policies le 2026-08-19.
-- ============================================================

DROP POLICY IF EXISTS "Grades access policy for Direction and Assigned Teachers" ON public.grades;


-- ============================================================
-- 5. Nouvelle policy RLS unique sur grades (FOR ALL)
--    Utilise is_teacher_assigned(subject_id, student_id) —
--    la jointure vers students se fait à l'intérieur de la
--    fonction SECURITY DEFINER, pas dans la policy elle-même.
-- ============================================================

CREATE POLICY "grades_direction_or_assigned_teacher"
ON public.grades FOR ALL
TO authenticated
USING (
    public.get_user_role() IN ('principal', 'directeur_etudes')
    OR public.is_teacher_assigned(
        public.grades.subject_id,
        public.grades.student_id
    )
)
WITH CHECK (
    public.get_user_role() IN ('principal', 'directeur_etudes')
    OR public.is_teacher_assigned(
        public.grades.subject_id,
        public.grades.student_id
    )
);
