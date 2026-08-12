import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Modal from "../../../components/ui/Modal";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";
import { Payment } from "../../../../electron/types/finance";

interface RecordPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: { amount: number; payment_date: string; method: string }) => Promise<boolean>;
    maxBalance: number;
    studentName: string;
    /** Si fourni, le modal passe en mode édition */
    payment?: Payment | null;
}

const paymentSchema = z.object({
    amount: z.coerce.number().positive("Le montant doit être positif."),
    payment_date: z.string().min(1, "La date est obligatoire."),
    method: z.enum(["cash", "mobile_money", "bank", "cheque"], {
        errorMap: () => ({ message: "Le mode de paiement est obligatoire." })
    })
});

type FormValues = z.infer<typeof paymentSchema>;

export default function RecordPaymentModal({
    isOpen,
    onClose,
    onSubmit,
    maxBalance,
    studentName,
    payment
}: RecordPaymentModalProps) {
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const isEditMode = !!payment;

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
        setError
    } = useForm<FormValues>();

    // Reset le formulaire quand le modal s'ouvre
    useEffect(() => {
        if (isOpen) {
            setFormError(null);
            if (payment) {
                reset({
                    amount: payment.amount,
                    payment_date: payment.payment_date,
                    method: payment.method as FormValues["method"]
                });
            } else {
                reset({
                    amount: undefined,
                    payment_date: new Date().toISOString().split("T")[0],
                    method: "cash"
                });
            }
        }
    }, [isOpen, payment, reset]);

    // En mode édition, le montant maximum autorisé = solde restant + montant actuel du paiement
    const effectiveMaxBalance = maxBalance + (payment ? payment.amount : 0);

    const handleFormSubmit = async (values: FormValues) => {
        setFormError(null);

        const validation = paymentSchema.safeParse(values);
        if (!validation.success) {
            validation.error.errors.forEach((err) => {
                const path = err.path[0] as keyof FormValues;
                setError(path, { message: err.message });
            });
            return;
        }

        if (effectiveMaxBalance > 0 && values.amount > effectiveMaxBalance) {
            setFormError(
                `Le montant (${values.amount.toLocaleString("fr-FR")} FCFA) dépasse le solde restant dû (${effectiveMaxBalance.toLocaleString("fr-FR")} FCFA).`
            );
            return;
        }

        setSubmitting(true);
        try {
            const success = await onSubmit({
                amount: values.amount,
                payment_date: values.payment_date,
                method: values.method
            });
            if (success) {
                reset();
                onClose();
            }
        } catch (err: any) {
            setFormError(err.message || "Erreur lors de l'enregistrement.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditMode ? "Modifier le paiement" : "Enregistrer un paiement"}
            size="sm"
        >
            <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-4">
                <p className="text-sm text-slate font-sans">
                    Élève : <span className="font-semibold text-ink">{studentName}</span>
                </p>

                {effectiveMaxBalance > 0 && (
                    <p className="text-xs text-slate font-sans">
                        Solde restant dû : <span className="font-mono-data font-semibold text-ink">{effectiveMaxBalance.toLocaleString("fr-FR")} FCFA</span>
                    </p>
                )}

                {formError && (
                    <div className="p-3 bg-signal-red/10 border border-signal-red/20 text-signal-red rounded text-xs font-medium font-sans">
                        {formError}
                    </div>
                )}

                <Input
                    label="Montant (FCFA) *"
                    type="number"
                    placeholder="Ex: 25000"
                    fontMono
                    error={errors.amount?.message}
                    {...register("amount")}
                />

                <Input
                    label="Date du paiement *"
                    type="date"
                    error={errors.payment_date?.message}
                    {...register("payment_date")}
                />

                <div className="flex flex-col gap-1.5">
                    <label className="font-sans text-xs font-semibold text-slate uppercase tracking-wider">
                        Mode de paiement *
                    </label>
                    <select
                        className={`w-full px-3 py-2 border rounded font-sans transition-colors duration-150 focus:outline-none focus:border-2 focus:border-ink h-10 bg-white text-sm ${
                            errors.method ? "border-signal-red" : "border-line"
                        }`}
                        {...register("method")}
                    >
                        <option value="cash">Espèces</option>
                        <option value="mobile_money">Mobile Money (MTN / Orange)</option>
                        <option value="bank">Virement bancaire</option>
                        <option value="cheque">Chèque</option>
                    </select>
                    {errors.method && (
                        <span className="font-sans text-xs text-signal-red font-medium">
                            {errors.method.message}
                        </span>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 mt-4 border-t border-line pt-4">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                        disabled={submitting}
                    >
                        Annuler
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        isLoading={submitting}
                    >
                        {isEditMode ? "Enregistrer les modifications" : "Enregistrer le paiement"}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
