-- ==========================================================
-- Migration Lot F4 — Bucket Storage 'receipts' (Le Fanion)
-- Pattern identique au bucket 'bulletins' (Lot E, migration 008)
-- À exécuter dans l'éditeur SQL de Supabase AVANT le code service
-- ==========================================================

-- 1. Création du bucket privé 'receipts'
--    public = false : jamais d'URL publique permanente (SECURITE.md §5)
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 2. Nettoyage des éventuelles anciennes policies (idempotent)
DROP POLICY IF EXISTS "Principal and DE storage select receipts" ON storage.objects;
DROP POLICY IF EXISTS "Principal and DE storage insert receipts" ON storage.objects;
DROP POLICY IF EXISTS "Principal and DE storage update receipts" ON storage.objects;
DROP POLICY IF EXISTS "Principal and DE storage delete receipts" ON storage.objects;

-- 3. Policy SELECT — lecture réservée principal / directeur_etudes
--    Un enseignant obtient 404/NoSuchKey (Supabase masque l'existence de l'objet)
CREATE POLICY "Principal and DE storage select receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'receipts' AND
    public.get_user_role() IN ('principal', 'directeur_etudes')
);

-- 4. Policy INSERT — upload réservé principal / directeur_etudes
CREATE POLICY "Principal and DE storage insert receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'receipts' AND
    public.get_user_role() IN ('principal', 'directeur_etudes')
);

-- 5. Policy UPDATE — écrasement réservé principal / directeur_etudes
--    (utilisé si un reçu devait être régénéré à l'avenir)
CREATE POLICY "Principal and DE storage update receipts"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'receipts' AND
    public.get_user_role() IN ('principal', 'directeur_etudes')
);

-- 6. Policy DELETE — suppression réservée principal / directeur_etudes
--    Utilisée explicitement par deletePayment() pour éviter les fichiers orphelins
--    (la suppression en cascade ne touche pas Storage, seulement la table receipts)
CREATE POLICY "Principal and DE storage delete receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'receipts' AND
    public.get_user_role() IN ('principal', 'directeur_etudes')
);

-- ==========================================================
-- Vérification post-migration (à exécuter en lecture après commit)
-- SELECT id, name, public FROM storage.buckets WHERE id = 'receipts';
-- → doit retourner : receipts | receipts | false
--
-- SELECT policyname, cmd FROM pg_policies
-- WHERE tablename = 'objects' AND policyname LIKE '%receipts%';
-- → doit retourner les 4 policies ci-dessus
-- ==========================================================
