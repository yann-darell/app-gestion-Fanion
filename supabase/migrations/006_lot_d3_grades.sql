-- ============================================================
-- Migration Lot D3 — Saisie des Notes & Sécurité RLS (Le Fanion v2)
-- Table `grades` avec score (0-20), unicité et isolation RLS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    sequence_id UUID NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
    score NUMERIC(4, 2) NOT NULL CHECK (score >= 0 AND score <= 20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_student_subject_sequence UNIQUE (student_id, subject_id, sequence_id)
);

ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Policies RLS : grades
-- ============================================================

-- Policy SELECT / READ
DROP POLICY IF EXISTS "Grades read policy" ON public.grades;
CREATE POLICY "Grades read policy"
ON public.grades FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('principal', 'directeur_etudes')
    )
    OR EXISTS (
        SELECT 1 
        FROM public.students s
        JOIN public.teacher_assignments ta 
          ON ta.class_id = s.class_id AND ta.subject_id = public.grades.subject_id
        WHERE s.id = public.grades.student_id
          AND ta.teacher_id = auth.uid()
    )
);

-- Policy ALL (INSERT / UPDATE / DELETE)
DROP POLICY IF EXISTS "Grades write policy" ON public.grades;
CREATE POLICY "Grades write policy"
ON public.grades FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('principal', 'directeur_etudes')
    )
    OR EXISTS (
        SELECT 1 
        FROM public.students s
        JOIN public.teacher_assignments ta 
          ON ta.class_id = s.class_id AND ta.subject_id = public.grades.subject_id
        WHERE s.id = public.grades.student_id
          AND ta.teacher_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('principal', 'directeur_etudes')
    )
    OR EXISTS (
        SELECT 1 
        FROM public.students s
        JOIN public.teacher_assignments ta 
          ON ta.class_id = s.class_id AND ta.subject_id = public.grades.subject_id
        WHERE s.id = public.grades.student_id
          AND ta.teacher_id = auth.uid()
    )
);

-- ============================================================
-- Trigger updated_at automatique
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_grades_updated_at ON public.grades;
CREATE TRIGGER trg_grades_updated_at
    BEFORE UPDATE ON public.grades
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

