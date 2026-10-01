-- ============================================================
-- Migration 026 : 11 Compétences APC et Barèmes du Primaire
-- ============================================================

-- 1. Ajout éventuel de class_id sur primary_scales pour configuration par classe
ALTER TABLE public.primary_scales
    ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE;

-- Supprimer l'ancienne contrainte unique si nécessaire et ajouter contrainte adaptée
ALTER TABLE public.primary_scales
    DROP CONSTRAINT IF EXISTS primary_scales_unique_level_sub;

CREATE UNIQUE INDEX IF NOT EXISTS idx_primary_scales_sub_level_class
    ON public.primary_scales (sub_evaluation_id, COALESCE(class_id, '00000000-0000-0000-0000-000000000000'), level);

-- 2. Insertion des 11 compétences dans primary_domains
INSERT INTO public.primary_domains (code, name, order_index) VALUES
    ('1A',  'COMMUNIQUER EN FRANÇAIS', 1),
    ('1B',  'COMMUNIQUER EN ANGLAIS', 2),
    ('1C',  'PRATIQUER UNE LANGUE NATIONALE', 3),
    ('2A',  'UTILISER LES NOTIONS DE BASE EN MATHÉMATIQUES', 4),
    ('2B',  'UTILISER LES NOTIONS DE BASE EN SCIENCES ET TECHNOLOGIES', 5),
    ('3B',  'PRATIQUER LES VALEURS CITOYENNES', 6),
    ('4',   'DÉMONTRER L''AUTONOMIE, L''ESPRIT D''INITIATIVE, DE CRÉATIVITÉ ET D''ENTREPRENEURIAT', 7),
    ('5',   'UTILISER LES CONCEPTS DE BASE ET LES OUTILS DES TIC', 8),
    ('6A1', 'PRATIQUER LES ACTIVITÉS PHYSIQUES ET SPORTIVES POUR LES APPRENANTS APTES', 9),
    ('6B',  'PRATIQUER LES ACTIVITÉS ARTISTIQUES', 10),
    ('6A2', 'LEADERSHIP & BON CARACTÈRE', 11)
ON CONFLICT DO NOTHING;

-- 3. Fonction pour insérer les critères de chaque compétence
DO $$
DECLARE
    v_dom_1a UUID;
    v_dom_1b UUID;
    v_dom_1c UUID;
    v_dom_2a UUID;
    v_dom_2b UUID;
    v_dom_3b UUID;
    v_dom_4 UUID;
    v_dom_5 UUID;
    v_dom_6a1 UUID;
    v_dom_6b UUID;
    v_dom_6a2 UUID;
    
    v_sub_id UUID;
    v_level TEXT;
    v_levels TEXT[] := ARRAY['SIL', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'];
BEGIN
    SELECT id INTO v_dom_1a  FROM public.primary_domains WHERE code = '1A';
    SELECT id INTO v_dom_1b  FROM public.primary_domains WHERE code = '1B';
    SELECT id INTO v_dom_1c  FROM public.primary_domains WHERE code = '1C';
    SELECT id INTO v_dom_2a  FROM public.primary_domains WHERE code = '2A';
    SELECT id INTO v_dom_2b  FROM public.primary_domains WHERE code = '2B';
    SELECT id INTO v_dom_3b  FROM public.primary_domains WHERE code = '3B';
    SELECT id INTO v_dom_4   FROM public.primary_domains WHERE code = '4';
    SELECT id INTO v_dom_5   FROM public.primary_domains WHERE code = '5';
    SELECT id INTO v_dom_6a1 FROM public.primary_domains WHERE code = '6A1';
    SELECT id INTO v_dom_6b  FROM public.primary_domains WHERE code = '6B';
    SELECT id INTO v_dom_6a2 FROM public.primary_domains WHERE code = '6A2';

    -- Helper d'insertion de sous-éval et de son barème
    -- 1A : 1: Orale (20), 2: Écrite (15), 3: Savoir-être (5) -> Total 40
    IF v_dom_1a IS NOT NULL THEN
        -- Critère 1: Orale
        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_1a, '1: Orale', 1) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 20);
        END LOOP;

        -- Critère 2: Écrite
        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_1a, '2: Écrite', 2) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 15);
        END LOOP;

        -- Critère 3: Savoir-être
        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_1a, '3: Savoir-être', 3) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 5);
        END LOOP;
    END IF;

    -- 1B : 1: Oral (20), 2: Written (15), 3: Attitude (5) -> Total 40
    IF v_dom_1b IS NOT NULL THEN
        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_1b, '1: Oral', 1) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 20);
        END LOOP;

        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_1b, '2: Written', 2) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 15);
        END LOOP;

        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_1b, '3: Attitude', 3) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 5);
        END LOOP;
    END IF;

    -- 1C : 1: Orale (10), 2: Écrite (5), 3: Pratique (3), 4: Savoir-être (2) -> Total 20
    IF v_dom_1c IS NOT NULL THEN
        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_1c, '1: Orale', 1) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 10);
        END LOOP;

        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_1c, '2: Écrite', 2) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 5);
        END LOOP;

        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_1c, '3: Pratique', 3) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 3);
        END LOOP;

        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_1c, '4: Savoir-être', 4) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 2);
        END LOOP;
    END IF;

    -- 2A : 1: Orale (5), 2: Écrite (20), 3: Savoir-être (5) -> Total 30
    IF v_dom_2a IS NOT NULL THEN
        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_2a, '1: Orale', 1) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 5);
        END LOOP;

        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_2a, '2: Écrite', 2) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 20);
        END LOOP;

        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_2a, '3: Savoir-être', 3) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 5);
        END LOOP;
    END IF;

    -- 2B : 1: Orale (5), 2: Écrite (5), 3: Pratique (15), 4: Savoir-être (5) -> Total 30
    IF v_dom_2b IS NOT NULL THEN
        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_2b, '1: Orale', 1) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 5);
        END LOOP;

        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_2b, '2: Écrite', 2) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 5);
        END LOOP;

        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_2b, '3: Pratique', 3) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 15);
        END LOOP;

        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_2b, '4: Savoir-être', 4) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 5);
        END LOOP;
    END IF;

    -- 3B : 1: Orale (5), 2: Écrite (5), 3: Pratique (8), 4: Savoir-être (2) -> Total 20
    IF v_dom_3b IS NOT NULL THEN
        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_3b, '1: Orale', 1) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 5);
        END LOOP;

        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_3b, '2: Écrite', 2) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 5);
        END LOOP;

        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_3b, '3: Pratique', 3) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 8);
        END LOOP;

        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_3b, '4: Savoir-être', 4) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 2);
        END LOOP;
    END IF;

    -- 4 : 1: Orale (5), 2: Écrite (3), 3: Pratique (10), 4: Savoir-être (2) -> Total 20
    IF v_dom_4 IS NOT NULL THEN
        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_4, '1: Orale', 1) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 5);
        END LOOP;

        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_4, '2: Écrite', 2) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 3);
        END LOOP;

        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_4, '3: Pratique', 3) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 10);
        END LOOP;

        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_4, '4: Savoir-être', 4) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 2);
        END LOOP;
    END IF;

    -- 5 : 1: Orale (3), 2: Écrite (3), 3: Pratique (10), 4: Savoir-être (4) -> Total 20
    IF v_dom_5 IS NOT NULL THEN
        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_5, '1: Orale', 1) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 3);
        END LOOP;

        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_5, '2: Écrite', 2) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 3);
        END LOOP;

        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_5, '3: Pratique', 3) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 10);
        END LOOP;

        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_5, '4: Savoir-être', 4) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 4);
        END LOOP;
    END IF;

    -- 6A1 : 1: Orale (3), 2: Écrite (3), 3: Pratique (10), 4: Savoir-être (4) -> Total 20
    IF v_dom_6a1 IS NOT NULL THEN
        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_6a1, '1: Orale', 1) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 3);
        END LOOP;

        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_6a1, '2: Écrite', 2) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 3);
        END LOOP;

        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_6a1, '3: Pratique', 3) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 10);
        END LOOP;

        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_6a1, '4: Savoir-être', 4) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 4);
        END LOOP;
    END IF;

    -- 6B : 1: Orale (4), 2: Écrite (3), 3: Pratique (10), 4: Savoir-être (3) -> Total 20
    IF v_dom_6b IS NOT NULL THEN
        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_6b, '1: Orale', 1) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 4);
        END LOOP;

        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_6b, '2: Écrite', 2) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 3);
        END LOOP;

        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_6b, '3: Pratique', 3) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 10);
        END LOOP;

        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_6b, '4: Savoir-être', 4) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 3);
        END LOOP;
    END IF;

    -- 6A2 : 1: Orale (6), 2: Écrite (12), 3: Savoir-être (2) -> Total 20
    IF v_dom_6a2 IS NOT NULL THEN
        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_6a2, '1: Orale', 1) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 6);
        END LOOP;

        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_6a2, '2: Écrite', 2) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 12);
        END LOOP;

        INSERT INTO public.primary_sub_evaluations (domain_id, label, order_index)
        VALUES (v_dom_6a2, '3: Savoir-être', 3) RETURNING id INTO v_sub_id;
        FOREACH v_level IN ARRAY v_levels LOOP
            INSERT INTO public.primary_scales (level, sub_evaluation_id, max_score) VALUES (v_level, v_sub_id, 2);
        END LOOP;
    END IF;

END $$;
