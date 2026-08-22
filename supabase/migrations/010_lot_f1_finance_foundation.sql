-- ==========================================================
-- Migration Lot F1 — Fondation Finance (Le Fanion)
-- À exécuter dans l'éditeur SQL de Supabase
-- ==========================================================

-- 1. Table Tarifs de Classe (fee_schedules)
CREATE TABLE IF NOT EXISTS public.fee_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    school_year_id UUID NOT NULL REFERENCES public.school_years(id) ON DELETE CASCADE,
    registration_fee NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (registration_fee >= 0),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    installments_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_class_school_year_fee UNIQUE (class_id, school_year_id)
);

-- 2. Table Réductions / Bourses Individuelles (student_fee_overrides)
CREATE TABLE IF NOT EXISTS public.student_fee_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    school_year_id UUID NOT NULL REFERENCES public.school_years(id) ON DELETE CASCADE,
    total_amount_override NUMERIC(12, 2) NOT NULL CHECK (total_amount_override >= 0),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_student_school_year_override UNIQUE (student_id, school_year_id)
);

-- 3. Table Compteur Global de Reçus (receipt_counters)
CREATE TABLE IF NOT EXISTS public.receipt_counters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    next_value INTEGER NOT NULL DEFAULT 1 CHECK (next_value >= 1)
);

-- Initialisation du compteur à 1 s'il n'existe pas encore
INSERT INTO public.receipt_counters (next_value)
SELECT 1
WHERE NOT EXISTS (SELECT 1 FROM public.receipt_counters);

-- 4. Table Paiements (payments)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    school_year_id UUID NOT NULL REFERENCES public.school_years(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    method TEXT NOT NULL CHECK (method IN ('cash', 'bank_transfer', 'mobile_money', 'check')),
    receipt_number INTEGER NOT NULL UNIQUE CHECK (receipt_number >= 1),
    tranche_ciblee TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index pour optimiser les requêtes par élève et année scolaire
CREATE INDEX IF NOT EXISTS idx_payments_student_year ON public.payments (student_id, school_year_id);

-- 5. Table Reçus Générés (receipts)
CREATE TABLE IF NOT EXISTS public.receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE CASCADE,
    pdf_path TEXT NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- ==========================================================
-- Activation du Row Level Security (RLS) sur les 5 tables
-- ==========================================================

ALTER TABLE public.fee_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_fee_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_counters ENABLE ROW LEVEL SECURITY;


-- ==========================================================
-- Policies RLS : Principal & Directeur des Études uniquement
-- Enseignant : AUCUNE policy (0 accès lecture/écriture)
-- ==========================================================

-- fee_schedules
CREATE POLICY "fee_schedules_admin_all" ON public.fee_schedules
    FOR ALL TO authenticated
    USING (public.get_user_role() IN ('principal', 'directeur_etudes'))
    WITH CHECK (public.get_user_role() IN ('principal', 'directeur_etudes'));

-- student_fee_overrides
CREATE POLICY "student_fee_overrides_admin_all" ON public.student_fee_overrides
    FOR ALL TO authenticated
    USING (public.get_user_role() IN ('principal', 'directeur_etudes'))
    WITH CHECK (public.get_user_role() IN ('principal', 'directeur_etudes'));

-- payments
CREATE POLICY "payments_admin_all" ON public.payments
    FOR ALL TO authenticated
    USING (public.get_user_role() IN ('principal', 'directeur_etudes'))
    WITH CHECK (public.get_user_role() IN ('principal', 'directeur_etudes'));

-- receipts
CREATE POLICY "receipts_admin_all" ON public.receipts
    FOR ALL TO authenticated
    USING (public.get_user_role() IN ('principal', 'directeur_etudes'))
    WITH CHECK (public.get_user_role() IN ('principal', 'directeur_etudes'));

-- receipt_counters
CREATE POLICY "receipt_counters_admin_all" ON public.receipt_counters
    FOR ALL TO authenticated
    USING (public.get_user_role() IN ('principal', 'directeur_etudes'))
    WITH CHECK (public.get_user_role() IN ('principal', 'directeur_etudes'));


-- ==========================================================
-- Fonctions RPC avec vérification explicite des rôles
-- ==========================================================

-- 1. Fonction atomique d'obtention de numéro de reçu (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_next_receipt_number()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
    v_next INTEGER;
BEGIN
    -- Contrôle strict des permissions de rôle
    IF public.get_user_role() NOT IN ('principal', 'directeur_etudes') THEN
        RAISE EXCEPTION 'Accès refusé : privilèges insuffisants pour générer un numéro de reçu';
    END IF;

    UPDATE public.receipt_counters
    SET next_value = next_value + 1
    WHERE id = (SELECT id FROM public.receipt_counters LIMIT 1)
    RETURNING next_value - 1 INTO v_next;

    RETURN v_next;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_next_receipt_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_next_receipt_number() TO authenticated;


-- 2. Fonction RPC transactionnelle de création de paiement (SECURITY DEFINER)
-- Englobe l'incrémentation atomique du numéro de reçu ET l'insertion du paiement
CREATE OR REPLACE FUNCTION public.create_payment_with_receipt(
    p_student_id UUID,
    p_school_year_id UUID,
    p_amount NUMERIC(12, 2),
    p_payment_date DATE,
    p_method TEXT,
    p_tranche_ciblee TEXT
)
RETURNS TABLE (
    id UUID,
    student_id UUID,
    school_year_id UUID,
    amount NUMERIC(12, 2),
    payment_date DATE,
    method TEXT,
    receipt_number INTEGER,
    tranche_ciblee TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
    v_receipt_number INTEGER;
BEGIN
    -- 1. Contrôle strict des permissions de rôle
    IF public.get_user_role() NOT IN ('principal', 'directeur_etudes') THEN
        RAISE EXCEPTION 'Accès refusé : privilèges insuffisants pour enregistrer un paiement';
    END IF;

    -- 2. Validation du montant
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Le montant du paiement doit être supérieur à zéro';
    END IF;

    -- 3. Inscription atomique du numéro de reçu
    UPDATE public.receipt_counters
    SET next_value = next_value + 1
    WHERE receipt_counters.id = (SELECT receipt_counters.id FROM public.receipt_counters LIMIT 1)
    RETURNING next_value - 1 INTO v_receipt_number;

    -- 4. Insertion atomique du paiement et retour direct des données
    RETURN QUERY
    INSERT INTO public.payments (
        student_id,
        school_year_id,
        amount,
        payment_date,
        method,
        receipt_number,
        tranche_ciblee
    ) VALUES (
        p_student_id,
        p_school_year_id,
        p_amount,
        COALESCE(p_payment_date, CURRENT_DATE),
        p_method,
        v_receipt_number,
        p_tranche_ciblee
    )
    RETURNING 
        payments.id,
        payments.student_id,
        payments.school_year_id,
        payments.amount,
        payments.payment_date,
        payments.method,
        payments.receipt_number,
        payments.tranche_ciblee,
        payments.created_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_payment_with_receipt(UUID, UUID, NUMERIC, DATE, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_payment_with_receipt(UUID, UUID, NUMERIC, DATE, TEXT, TEXT) TO authenticated;
