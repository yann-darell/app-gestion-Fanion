-- ==========================================================
-- Migration Lot F3 — Paiements & Activation par Inscription
-- À exécuter dans l'éditeur SQL de Supabase
-- ==========================================================

-- 1. Modification du DEFAULT du statut élève (pending_registration par défaut pour les nouveaux élèves)
ALTER TABLE public.students 
ALTER COLUMN status SET DEFAULT 'pending_registration';

-- 2. Ajout de la colonne payment_category à la table payments
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS payment_category TEXT NOT NULL DEFAULT 'tuition' 
CHECK (payment_category IN ('registration', 'tuition'));

-- Index pour optimiser les calculs de cumul par catégorie
CREATE INDEX IF NOT EXISTS idx_payments_student_year_category 
ON public.payments (student_id, school_year_id, payment_category);


-- 2. Drop ancienne signature de create_payment_with_receipt
DROP FUNCTION IF EXISTS public.create_payment_with_receipt(UUID, UUID, NUMERIC, DATE, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_payment_with_receipt(UUID, UUID, NUMERIC, DATE, TEXT, TEXT, TEXT);

-- 3. Création de la RPC transactionnelle create_payment_with_receipt mise à jour
CREATE OR REPLACE FUNCTION public.create_payment_with_receipt(
    p_student_id UUID,
    p_school_year_id UUID,
    p_amount NUMERIC(12, 2),
    p_payment_date DATE,
    p_method TEXT,
    p_tranche_ciblee TEXT,
    p_payment_category TEXT DEFAULT 'tuition'
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
    payment_category TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
    v_receipt_number INTEGER;
    v_class_id UUID;
    v_registration_fee NUMERIC(12, 2) := 0;
    v_current_reg_paid NUMERIC(12, 2) := 0;
    v_remaining_reg NUMERIC(12, 2) := 0;
    v_new_reg_paid NUMERIC(12, 2) := 0;
    v_student_status TEXT;
BEGIN
    -- 1. Contrôle strict des permissions de rôle
    IF public.get_user_role() NOT IN ('principal', 'directeur_etudes') THEN
        RAISE EXCEPTION 'Accès refusé : privilèges insuffisants pour enregistrer un paiement';
    END IF;

    -- 2. Validation du montant et de la catégorie
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Le montant du paiement doit être supérieur à zéro';
    END IF;

    IF p_payment_category NOT IN ('registration', 'tuition') THEN
        RAISE EXCEPTION 'Catégorie de paiement invalide : %', p_payment_category;
    END IF;

    -- 3. Récupération des données élève et grille tarifaire
    SELECT class_id, status INTO v_class_id, v_student_status
    FROM public.students
    WHERE students.id = p_student_id;

    IF v_class_id IS NULL THEN
        RAISE EXCEPTION 'Élève non trouvé ou sans classe attribuée';
    END IF;

    SELECT registration_fee INTO v_registration_fee
    FROM public.fee_schedules
    WHERE fee_schedules.class_id = v_class_id 
      AND fee_schedules.school_year_id = p_school_year_id;

    IF v_registration_fee IS NULL THEN
        v_registration_fee := 0;
    END IF;

    -- 4. Traitement spécifique si paiement de catégorie 'registration'
    IF p_payment_category = 'registration' THEN
        SELECT COALESCE(SUM(payments.amount), 0) INTO v_current_reg_paid
        FROM public.payments
        WHERE payments.student_id = p_student_id
          AND payments.school_year_id = p_school_year_id
          AND payments.payment_category = 'registration';

        v_remaining_reg := GREATEST(0, v_registration_fee - v_current_reg_paid);

        IF p_amount > v_remaining_reg THEN
            RAISE EXCEPTION 'Le montant ( % FCFA) dépasse le solde restant des frais d''inscription (% FCFA)', p_amount, v_remaining_reg;
        END IF;

        v_new_reg_paid := v_current_reg_paid + p_amount;
    ELSE
        -- Calcul du cumul inscription existant pour la vérification du statut
        SELECT COALESCE(SUM(payments.amount), 0) INTO v_new_reg_paid
        FROM public.payments
        WHERE payments.student_id = p_student_id
          AND payments.school_year_id = p_school_year_id
          AND payments.payment_category = 'registration';
    END IF;

    -- 5. Inscription atomique du numéro de reçu
    UPDATE public.receipt_counters
    SET next_value = next_value + 1
    WHERE receipt_counters.id = (SELECT receipt_counters.id FROM public.receipt_counters LIMIT 1)
    RETURNING next_value - 1 INTO v_receipt_number;

    -- 6. Activation automatique de l'élève si l'inscription est totalement couverte
    IF v_new_reg_paid >= v_registration_fee AND v_student_status = 'pending_registration' THEN
        UPDATE public.students
        SET status = 'active'
        WHERE students.id = p_student_id;
    END IF;

    -- 7. Insertion atomique du paiement et retour
    RETURN QUERY
    INSERT INTO public.payments (
        student_id,
        school_year_id,
        amount,
        payment_date,
        method,
        receipt_number,
        tranche_ciblee,
        payment_category
    ) VALUES (
        p_student_id,
        p_school_year_id,
        p_amount,
        COALESCE(p_payment_date, CURRENT_DATE),
        p_method,
        v_receipt_number,
        p_tranche_ciblee,
        p_payment_category
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
        payments.payment_category,
        payments.created_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_payment_with_receipt(UUID, UUID, NUMERIC, DATE, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_payment_with_receipt(UUID, UUID, NUMERIC, DATE, TEXT, TEXT, TEXT) TO authenticated;


-- 4. RPC transactionnelle de suppression de paiement avec gestion du statut élève
CREATE OR REPLACE FUNCTION public.delete_payment_with_status_check(
    p_payment_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
    v_student_id UUID;
    v_school_year_id UUID;
    v_payment_category TEXT;
    v_class_id UUID;
    v_registration_fee NUMERIC(12, 2) := 0;
    v_remaining_reg_paid NUMERIC(12, 2) := 0;
    v_student_status TEXT;
BEGIN
    -- 1. Contrôle strict des permissions de rôle
    IF public.get_user_role() NOT IN ('principal', 'directeur_etudes') THEN
        RAISE EXCEPTION 'Accès refusé : privilèges insuffisants pour supprimer un paiement';
    END IF;

    -- 2. Récupération des détails du paiement à supprimer
    SELECT student_id, school_year_id, payment_category 
    INTO v_student_id, v_school_year_id, v_payment_category
    FROM public.payments
    WHERE payments.id = p_payment_id;

    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Paiement non trouvé';
    END IF;

    -- 3. Suppression du paiement (sans toucher au receipt_counters)
    DELETE FROM public.payments WHERE payments.id = p_payment_id;

    -- 4. Si c'était un paiement 'registration', vérifier si le statut élève doit repasser en 'pending_registration'
    IF v_payment_category = 'registration' THEN
        SELECT class_id, status INTO v_class_id, v_student_status
        FROM public.students
        WHERE students.id = v_student_id;

        IF v_class_id IS NOT NULL THEN
            SELECT registration_fee INTO v_registration_fee
            FROM public.fee_schedules
            WHERE fee_schedules.class_id = v_class_id 
              AND fee_schedules.school_year_id = v_school_year_id;

            IF v_registration_fee IS NULL THEN
                v_registration_fee := 0;
            END IF;

            SELECT COALESCE(SUM(payments.amount), 0) INTO v_remaining_reg_paid
            FROM public.payments
            WHERE payments.student_id = v_student_id
              AND payments.school_year_id = v_school_year_id
              AND payments.payment_category = 'registration';

            IF v_remaining_reg_paid < v_registration_fee AND v_student_status = 'active' THEN
                UPDATE public.students
                SET status = 'pending_registration'
                WHERE students.id = v_student_id;
            END IF;
        END IF;
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_payment_with_status_check(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_payment_with_status_check(UUID) TO authenticated;
