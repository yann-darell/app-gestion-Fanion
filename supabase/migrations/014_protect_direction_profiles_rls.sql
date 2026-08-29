-- Migration 014: Protection RLS des comptes de direction (Principal et DE)
-- Empêche la modification et la suppression des comptes 'principal' et 'directeur_etudes' dans la table profiles via RLS.

-- Supprime l'ancienne policy permissive d'écriture pour les admins
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;

-- Policy pour la modification (UPDATE) : seuls les profils ayant un rôle 'enseignant' peuvent être modifiés par un admin
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

-- Policy pour la suppression (DELETE) : seuls les profils 'enseignant' peuvent être supprimés
CREATE POLICY "profiles_admin_delete" ON public.profiles
    FOR DELETE TO authenticated
    USING (
        public.get_user_role() IN ('principal', 'directeur_etudes')
        AND role NOT IN ('principal', 'directeur_etudes')
    );

-- Policy pour l'insertion (INSERT) : création autorisée par les admins
CREATE POLICY "profiles_admin_insert" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (
        public.get_user_role() IN ('principal', 'directeur_etudes')
    );
