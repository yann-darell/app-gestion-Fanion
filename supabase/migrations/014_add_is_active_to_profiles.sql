-- ============================================================
-- Migration 014 — Vague 2 : Colonne is_active sur profiles & Protection RLS des comptes direction
-- ============================================================

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Protection RLS des comptes de direction (Principal et DE)
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;

DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update" ON public.profiles
    FOR UPDATE TO authenticated
    USING (
        public.get_user_role() IN ('principal', 'directeur_etudes')
        AND role NOT IN ('principal', 'directeur_etudes')
    )
    WITH CHECK (
        public.get_user_role() IN ('principal', 'directeur_etudes')
        AND role NOT IN ('principal', 'directeur_etudes')
    );

DROP POLICY IF EXISTS "profiles_admin_delete" ON public.profiles;
CREATE POLICY "profiles_admin_delete" ON public.profiles
    FOR DELETE TO authenticated
    USING (
        public.get_user_role() IN ('principal', 'directeur_etudes')
        AND role NOT IN ('principal', 'directeur_etudes')
    );

DROP POLICY IF EXISTS "profiles_admin_insert" ON public.profiles;
CREATE POLICY "profiles_admin_insert" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (
        public.get_user_role() IN ('principal', 'directeur_etudes')
    );
