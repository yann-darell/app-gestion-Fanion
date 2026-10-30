-- ==========================================
-- Migration 031 : Support des Bulletins Annuels Collège
-- Permettre la génération et le stockage des bulletins de type 'annual'
-- ==========================================

-- 1. Rendre term_id nullable dans bulletin_generations (pour le type annual)
ALTER TABLE public.bulletin_generations 
ALTER COLUMN term_id DROP NOT NULL;

-- 2. Commentaire explicatif
COMMENT ON COLUMN public.bulletin_generations.period_type IS 'Type de période du bulletin généré : sequence, term ou annual';
