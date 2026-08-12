import { useState, useEffect } from "react";
import Modal from "../../../components/ui/Modal";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";
import { useFinance } from "../../../hooks/useFinance";

interface StudentOverrideModalProps {
    isOpen: boolean;
    onClose: () => void;
    studentId: number;
    studentName: string;
    schoolYearId: number;
    standardTuition: number;
    registrationFee: number;
    existingOverride: { amount: number; reason: string } | null;
    onSuccess: () => void;
}

export default function StudentOverrideModal({
    isOpen,
    onClose,
    studentId,
    studentName,
    schoolYearId,
    standardTuition,
    registrationFee,
    existingOverride,
    onSuccess
}: StudentOverrideModalProps) {
    const { setStudentOverride } = useFinance();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [amountOverride, setAmountOverride] = useState<number>(standardTuition);
    const [reason, setReason] = useState<string>("");

    useEffect(() => {
        if (isOpen) {
            if (existingOverride) {
                setAmountOverride(existingOverride.amount);
                setReason(existingOverride.reason || "");
            } else {
                setAmountOverride(standardTuition);
                setReason("");
            }
            setError(null);
        }
    }, [isOpen, existingOverride, standardTuition]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (amountOverride < 0) {
            setError("Le montant de la scolarité réduite ne peut pas être négatif.");
            return;
        }

        if (!reason.trim()) {
            setError("Vous devez renseigner un motif pour cette bourse/réduction.");
            return;
        }

        setLoading(true);
        try {
            const res = await setStudentOverride({
                student_id: studentId,
                school_year_id: schoolYearId,
                total_amount_override: amountOverride,
                reason: reason.trim()
            });

            if (res.ok) {
                onSuccess();
                onClose();
            } else {
                setError(res.error || "Une erreur est survenue.");
            }
        } catch (err: any) {
            setError(err.message || "Une erreur inattendue est survenue.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Bourse / Réduction — ${studentName}`}
            size="sm"
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {error && (
                    <div className="p-3 bg-signal-red/10 border border-signal-red/20 text-signal-red rounded text-xs font-semibold font-sans">
                        {error}
                    </div>
                )}

                <div className="bg-paper-dark border border-line p-3.5 rounded flex flex-col gap-1.5 font-sans">
                    <p className="text-xs text-slate font-medium uppercase tracking-wider">
                        Tarifs Standards de la Classe :
                    </p>
                    <div className="flex justify-between text-xs text-slate">
                        <span>Frais d'inscription (fixes) :</span>
                        <span className="font-mono-data font-bold text-ink">
                            {registrationFee.toLocaleString("fr-FR")} FCFA
                        </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate">
                        <span>Scolarité standard :</span>
                        <span className="font-mono-data font-bold text-ink">
                            {standardTuition.toLocaleString("fr-FR")} FCFA
                        </span>
                    </div>
                    <div className="mt-2 text-[11px] text-signal-red font-medium leading-relaxed bg-signal-red/5 p-2 rounded border border-signal-red/10">
                        ⚠️ <strong>Important :</strong> Seuls les frais de scolarité peuvent être réduits. Les frais d'inscription ({registrationFee.toLocaleString("fr-FR")} FCFA) ne sont jamais concernés par cette réduction et restent dus en totalité par l'élève.
                    </div>
                </div>

                <Input
                    label="Nouveau montant de scolarité (FCFA) *"
                    type="number"
                    fontMono
                    value={amountOverride}
                    onChange={(e) => setAmountOverride(Math.max(0, Number(e.target.value)))}
                    placeholder={`Ex: ${standardTuition / 2}`}
                    required
                />

                <div className="flex flex-col gap-1.5">
                    <label className="font-sans text-xs font-semibold text-slate uppercase tracking-wider">
                        Motif de la réduction *
                    </label>
                    <textarea
                        rows={3}
                        className="w-full px-3 py-2 border border-line rounded font-sans transition-colors duration-150 focus:outline-none focus:border-2 focus:border-ink text-sm bg-white resize-none"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Ex: Bourse d'excellence 50% ou Demi-tarif fratrie"
                        required
                    />
                </div>

                <div className="flex items-center justify-end gap-3 mt-4 border-t border-line pt-4">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Annuler
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        isLoading={loading}
                    >
                        Appliquer
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
