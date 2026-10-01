-- Migration 023 : Ajout du flag is_fictitious pour les comptes sans email réel
-- Un compte fictif est un compte enseignant créé avec un email auto-généré
-- par l'administrateur, pour les enseignants sans adresse email personnelle.

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_fictitious BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN profiles.is_fictitious IS
'TRUE si le compte a été créé avec un email fictif auto-généré (@fanion-ecole.local). Enseignant sans email réel.';
