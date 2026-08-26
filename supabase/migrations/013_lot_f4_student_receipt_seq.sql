-- ==========================================================
-- Migration Lot F4 Additive — Numéro séquentiel de reçu par élève immuable
-- Logique F3 100% préservée avec correction du statut 'pending_registration'
-- ==========================================================

-- 1. Ajout de la colonne student_receipt_seq dans la table payments
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS student_receipt_seq INTEGER;

-- 2. Initialisation des paiements existants par ordre chronologique
WITH ranked_payments AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY student_id, school_year_id 
      ORDER BY created_at ASC, id ASC
    ) as seq_num
  FROM public.payments
)
UPDATE public.payments p
SET student_receipt_seq = rp.seq_num
FROM ranked_payments rp
WHERE p.id = rp.id AND p.student_receipt_seq IS NULL;

-- 3. Mise à jour de create_payment_with_receipt (Logique F3 intacte + student_receipt_seq + pending_registration)
CREATE OR REPLACE FUNCTION public.create_payment_with_receipt(
    p_student_id UUID,
    p_school_year_id UUID,
    p_amount NUMERIC,
    p_payment_date DATE,
    p_method TEXT,
    p_tranche_ciblee TEXT DEFAULT NULL,
    p_payment_category TEXT DEFAULT 'tuition'
)
RETURNS SETOF public.payments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role TEXT;
    v_class_id UUID;
    v_reg_fee NUMERIC;
    v_total_reg_paid NUMERIC;
    v_remaining_reg NUMERIC;
    v_next_receipt_number BIGINT;
    v_student_seq INTEGER;
    v_new_payment_id UUID;
    v_new_total_reg NUMERIC;
BEGIN
    -- 1. Contrôle de rôle RBAC strict (Lot F1/F3)
    v_role := public.get_user_role();
    IF v_role NOT IN ('principal', 'directeur_etudes') THEN
        RAISE EXCEPTION 'Accès refusé : Seuls le Principal et le Directeur des Études peuvent enregistrer un paiement.';
    END IF;

    -- 2. Validation du montant (Lot F1/F3)
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Le montant du paiement doit être supérieur à zéro.';
    END IF;

    -- 3. Validation de la catégorie (Lot F3)
    IF p_payment_category NOT IN ('registration', 'tuition') THEN
        RAISE EXCEPTION 'Catégorie de paiement invalide : %', p_payment_category;
    END IF;

    -- 4. Si paiement d'inscription, vérifier qu'on ne dépasse pas le tarif configuré (Lot F3)
    IF p_payment_category = 'registration' THEN
        SELECT class_id INTO v_class_id FROM public.students WHERE id = p_student_id;
        IF v_class_id IS NULL THEN
            RAISE EXCEPTION 'Élève non trouvé ou sans classe attribuée.';
        END IF;

        SELECT registration_fee INTO v_reg_fee 
        FROM public.fee_schedules 
        WHERE class_id = v_class_id AND school_year_id = p_school_year_id;

        IF v_reg_fee IS NULL THEN
            RAISE EXCEPTION 'Aucun tarif configuré pour cette classe et cette année scolaire.';
        END IF;

        SELECT COALESCE(SUM(amount), 0) INTO v_total_reg_paid
        FROM public.payments
        WHERE student_id = p_student_id 
          AND school_year_id = p_school_year_id
          AND payment_category = 'registration';

        v_remaining_reg := GREATEST(0, v_reg_fee - v_total_reg_paid);

        IF p_amount > v_remaining_reg THEN
            RAISE EXCEPTION 'Le montant saisi (% FCFA) dépasse le solde restant d''inscription (% FCFA).', 
                p_amount, v_remaining_reg;
        END IF;
    END IF;

    -- 5. Générer le numéro de reçu global (Lot F1 — sans paramètre)
    v_next_receipt_number := public.get_next_receipt_number();

    -- 6. Générer le numéro séquentiel immuable propre à cet élève (Lot F4)
    SELECT COALESCE(MAX(student_receipt_seq), 0) + 1
    INTO v_student_seq
    FROM public.payments
    WHERE student_id = p_student_id AND school_year_id = p_school_year_id;

    -- 7. Insérer le paiement avec son numéro séquentiel élève
    INSERT INTO public.payments (
        student_id,
        school_year_id,
        amount,
        payment_date,
        method,
        receipt_number,
        student_receipt_seq,
        tranche_ciblee,
        payment_category
    )
    VALUES (
        p_student_id,
        p_school_year_id,
        p_amount,
        p_payment_date,
        p_method,
        v_next_receipt_number,
        v_student_seq,
        p_tranche_ciblee,
        p_payment_category
    )
    RETURNING id INTO v_new_payment_id;

    -- 8. Activation automatique de l'élève si l'inscription est totalement couverte (Lot F3 - pending_registration)
    IF p_payment_category = 'registration' THEN
        v_new_total_reg := v_total_reg_paid + p_amount;
        IF v_new_total_reg >= v_reg_fee THEN
            UPDATE public.students 
            SET status = 'active' 
            WHERE id = p_student_id AND status = 'pending_registration';
        END IF;
    END IF;

    RETURN QUERY
    SELECT * FROM public.payments WHERE id = v_new_payment_id;
END;
$$;
