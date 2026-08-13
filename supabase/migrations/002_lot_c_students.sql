-- =========================================================
-- Migration Lot C : Table 'students', RLS et Supabase Storage
-- =========================================================

-- 1. Table des élèves
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matricule TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    birth_date DATE NOT NULL,
    birth_place TEXT,
    gender TEXT CHECK (gender IN ('M', 'F')) NOT NULL,
    nationality TEXT,
    is_repeating BOOLEAN DEFAULT FALSE NOT NULL,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
    guardian_name TEXT NOT NULL,
    guardian_phone TEXT NOT NULL,
    status TEXT CHECK (status IN ('active', 'inactive', 'pending_registration')) DEFAULT 'active' NOT NULL,
    photo_path TEXT,
    enrolled_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Sécurité RLS sur la table 'students'
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Seuls 'principal' et 'directeur_etudes' ont accès en lecture et écriture
DROP POLICY IF EXISTS students_admin_all ON public.students;
CREATE POLICY students_admin_all ON public.students
    FOR ALL
    USING (public.get_user_role() IN ('principal', 'directeur_etudes'));

-- 3. Configuration du Bucket Supabase Storage pour les photos (Non-public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-photos', 'student-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Policy de lecture réservée aux utilisateurs authentifiés uniquement (SECURITE.md §5)
DROP POLICY IF EXISTS student_photos_read_auth ON storage.objects;
CREATE POLICY student_photos_read_auth ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'student-photos' 
        AND auth.role() = 'authenticated'
    );

-- Policy de lecture réservée aux rôles admin, cohérente avec l'accès zéro de l'enseignant sur les élèves ce lot-ci
DROP POLICY IF EXISTS student_photos_read_auth ON storage.objects;
CREATE POLICY student_photos_read_auth ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'student-photos' 
        AND public.get_user_role() IN ('principal', 'directeur_etudes')
    );
