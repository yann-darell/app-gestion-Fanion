-- ==========================================
-- Migration Lot E : Génération des Bulletins PDF
-- Table bulletin_generations + Storage bucket 'bulletins' + RLS
-- ==========================================

-- 1. Création de la table bulletin_generations
CREATE TABLE IF NOT EXISTS public.bulletin_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    term_id UUID NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
    pdf_path TEXT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_student_term UNIQUE (student_id, term_id)
);

-- Index pour accélérer les requêtes
CREATE INDEX IF NOT EXISTS idx_bulletin_generations_student_term 
ON public.bulletin_generations(student_id, term_id);

-- Activation de RLS sur la table bulletin_generations
ALTER TABLE public.bulletin_generations ENABLE ROW LEVEL SECURITY;

-- Clean up existing policies if any
DROP POLICY IF EXISTS "Principal and DE full access on bulletin_generations" ON public.bulletin_generations;

-- 2. Policies RLS sur la table : Réservé à principal et directeur_etudes
CREATE POLICY "Principal and DE full access on bulletin_generations"
ON public.bulletin_generations
FOR ALL
TO authenticated
USING (public.get_user_role() IN ('principal', 'directeur_etudes'))
WITH CHECK (public.get_user_role() IN ('principal', 'directeur_etudes'));

-- 3. Création et configuration du Bucket Storage 'bulletins' (Privé)
INSERT INTO storage.buckets (id, name, public)
VALUES ('bulletins', 'bulletins', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Clean up existing storage policies if any
DROP POLICY IF EXISTS "Principal and DE storage select bulletins" ON storage.objects;
DROP POLICY IF EXISTS "Principal and DE storage insert bulletins" ON storage.objects;
DROP POLICY IF EXISTS "Principal and DE storage update bulletins" ON storage.objects;
DROP POLICY IF EXISTS "Principal and DE storage delete bulletins" ON storage.objects;

-- Policies RLS sur le bucket Storage 'bulletins' (Réservé à principal / directeur_etudes)
CREATE POLICY "Principal and DE storage select bulletins"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'bulletins' AND
    public.get_user_role() IN ('principal', 'directeur_etudes')
);

CREATE POLICY "Principal and DE storage insert bulletins"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'bulletins' AND
    public.get_user_role() IN ('principal', 'directeur_etudes')
);

CREATE POLICY "Principal and DE storage update bulletins"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'bulletins' AND
    public.get_user_role() IN ('principal', 'directeur_etudes')
);

CREATE POLICY "Principal and DE storage delete bulletins"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'bulletins' AND
    public.get_user_role() IN ('principal', 'directeur_etudes')
);
