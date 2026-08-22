-- ==========================================
-- Migration Lot E (Correction / Extension) :
-- Distinguer bulletins de SÉQUENCE et de TRIMESTRE
-- ==========================================

-- 1. Ajout des colonnes period_type et period_id
ALTER TABLE public.bulletin_generations 
ADD COLUMN IF NOT EXISTS period_type TEXT NOT NULL DEFAULT 'term',
ADD COLUMN IF NOT EXISTS period_id UUID;

-- Récupérer la valeur de period_id = term_id pour la rétrocompatibilité des données existantes
UPDATE public.bulletin_generations 
SET period_id = term_id 
WHERE period_id IS NULL;

-- Passer period_id en NOT NULL après le rattrapage
ALTER TABLE public.bulletin_generations 
ALTER COLUMN period_id SET NOT NULL;

-- 2. Suppression de l'ancienne contrainte d'unicité basée sur term_id seul
ALTER TABLE public.bulletin_generations 
DROP CONSTRAINT IF EXISTS unique_student_term;

-- 3. Nouvelle contrainte d'unicité basée sur (student_id, period_type, period_id)
ALTER TABLE public.bulletin_generations 
ADD CONSTRAINT unique_student_period UNIQUE (student_id, period_type, period_id);

-- 4. Index de performance mis à jour
DROP INDEX IF EXISTS idx_bulletin_generations_student_term;
CREATE INDEX IF NOT EXISTS idx_bulletin_generations_student_period 
ON public.bulletin_generations(student_id, period_type, period_id);
