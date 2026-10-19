-- ============================================================
-- Migration 028 — RLS & RPC pour primary_teacher_assignments
-- Permet aux enseignants de lire leurs attributions primaires
-- ============================================================

-- 1. Politique SELECT pour les enseignants sur leurs propres attributions primaires
DROP POLICY IF EXISTS "pta_teacher_select" ON public.primary_teacher_assignments;
CREATE POLICY "pta_teacher_select" ON public.primary_teacher_assignments
    FOR SELECT TO authenticated
    USING (teacher_id = auth.uid() OR public.get_user_role() IN ('principal', 'directeur_etudes'));

-- 2. Fonction SECURITY DEFINER get_my_primary_teacher_assignments
CREATE OR REPLACE FUNCTION public.get_my_primary_teacher_assignments()
RETURNS TABLE (
    id UUID,
    teacher_id UUID,
    class_id UUID,
    class_name TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pta.id,
        pta.teacher_id,
        pta.class_id,
        c.name AS class_name,
        pta.created_at
    FROM public.primary_teacher_assignments pta
    JOIN public.classes c ON c.id = pta.class_id
    WHERE pta.teacher_id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_primary_teacher_assignments() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_primary_teacher_assignments() TO authenticated;
