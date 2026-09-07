-- ============================================================
-- Migration 017 — Compétences Évaluées par Séquence (Le Fanion v2)
-- Table `sequence_competencies` : 1 description par (classe, matière, séquence)
-- RLS : Lecture pour tous les authentifiés (bulletin PDF),
--       Écriture réservée à l'enseignant assigné ou Direction (Principal/DE).
-- ============================================================

-- 1. Création de la fonction SECURITY DEFINER is_teacher_assigned_to_class
CREATE OR REPLACE FUNCTION public.is_teacher_assigned_to_class(
    p_subject_id UUID,
    p_class_id UUID
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
        WHERE ta.teacher_id = auth.uid()
          AND ta.subject_id = p_subject_id
          AND ta.class_id = p_class_id
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_teacher_assigned_to_class(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_teacher_assigned_to_class(UUID, UUID) TO authenticated;

-- 2. Création de la table sequence_competencies
CREATE TABLE IF NOT EXISTS public.sequence_competencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    sequence_id UUID NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    updated_by UUID REFERENCES public.profiles(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_sequence_competency UNIQUE (class_id, subject_id, sequence_id)
);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_sequence_competencies_updated_at ON public.sequence_competencies;
CREATE TRIGGER trg_sequence_competencies_updated_at
    BEFORE UPDATE ON public.sequence_competencies
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Activation RLS
ALTER TABLE public.sequence_competencies ENABLE ROW LEVEL SECURITY;

-- 4. Policies RLS
-- Lecture : tous les utilisateurs authentifiés (nécessaire pour les bulletins)
DROP POLICY IF EXISTS "sequence_competencies_select_policy" ON public.sequence_competencies;
CREATE POLICY "sequence_competencies_select_policy"
ON public.sequence_competencies FOR SELECT
TO authenticated
USING (true);

-- Écriture (INSERT / UPDATE / DELETE) : Enseignant assigné ou Direction
DROP POLICY IF EXISTS "sequence_competencies_write_policy" ON public.sequence_competencies;
CREATE POLICY "sequence_competencies_write_policy"
ON public.sequence_competencies FOR ALL
TO authenticated
USING (
    public.get_user_role() IN ('principal', 'directeur_etudes')
    OR public.is_teacher_assigned_to_class(
        public.sequence_competencies.subject_id,
        public.sequence_competencies.class_id
    )
)
WITH CHECK (
    public.get_user_role() IN ('principal', 'directeur_etudes')
    OR public.is_teacher_assigned_to_class(
        public.sequence_competencies.subject_id,
        public.sequence_competencies.class_id
    )
);
