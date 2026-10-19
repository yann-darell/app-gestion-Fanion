-- ============================================================
-- Migration 029 — RLS & RPC pour les élèves des classes primaires
-- Permet aux enseignants du primaire d'accéder aux élèves de leur classe
-- ============================================================

-- 1. Politique RLS SELECT sur students pour les enseignants titulaires du primaire
DROP POLICY IF EXISTS "students_primary_teacher_select" ON public.students;
CREATE POLICY "students_primary_teacher_select" ON public.students
    FOR SELECT TO authenticated
    USING (
        public.get_user_role() IN ('principal', 'directeur_etudes')
        OR EXISTS (
            SELECT 1 FROM public.primary_teacher_assignments pta
            WHERE pta.class_id = students.class_id AND pta.teacher_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.classes c
            JOIN public.profiles p ON p.id = auth.uid()
            WHERE c.id = students.class_id AND c.head_teacher_name = p.full_name
        )
    );

-- 2. Fonction SECURITY DEFINER get_my_primary_assigned_students
CREATE OR REPLACE FUNCTION public.get_my_primary_assigned_students(p_class_id UUID)
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
    -- Vérifier que l'enseignant connecté est titulaire de la classe primaire ou admin
    IF NOT (
        public.get_user_role() IN ('principal', 'directeur_etudes')
        OR EXISTS (
            SELECT 1 FROM public.primary_teacher_assignments pta
            WHERE pta.class_id = p_class_id AND pta.teacher_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.classes c
            JOIN public.profiles p ON p.id = auth.uid()
            WHERE c.id = p_class_id AND c.head_teacher_name = p.full_name
        )
    ) THEN
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
    ORDER BY st.last_name ASC, st.first_name ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_primary_assigned_students(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_primary_assigned_students(UUID) TO authenticated;
