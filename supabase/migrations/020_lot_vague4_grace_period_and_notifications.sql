-- ==============================================================================
-- Migration 020 : Vague 4 - Délai de grâce pour les séquences & Notifications
-- ==============================================================================

-- 1. Ajout de la colonne grace_period_days sur la table sequences
-- grace_period_days : délai supplémentaire en jours après end_date
-- avant de considérer qu'un enseignant assigné est en retard de soumission.
ALTER TABLE public.sequences
ADD COLUMN IF NOT EXISTS grace_period_days INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.sequences.grace_period_days IS 
'Délai de grâce en jours accordé aux enseignants après la date de fin (end_date) avant déclenchement de l''alerte de retard.';
