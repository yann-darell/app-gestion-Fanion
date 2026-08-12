import { useState, useEffect } from "react";
import Modal from "../../../components/ui/Modal";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";
import { useFinance } from "../../../hooks/useFinance";
import { Installment } from "../../../../electron/types/finance";

interface FeeScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    classId: number;
    className: string;
    schoolYearId: number;
    onSuccess: () => void;
}

export default function FeeScheduleModal({
    isOpen,
    onClose,
    classId,
    className,
    schoolYearId,
    onSuccess
}: FeeScheduleModalProps) {
    const { getFeeSchedule, setFeeSchedule } = useFinance();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // States du formulaire — type string | number pour permettre un champ vide temporaire
    const [registrationFee, setRegistrationFee] = useState<number | string>(0);
    const [installments, setInstallments] = useState<Installment[]>([]);

    // Charger les tarifs existants si disponibles
    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        setError(null);
        getFeeSchedule(classId, schoolYearId)
            .then((schedule) => {
                if (schedule) {
                    setRegistrationFee(schedule.registration_fee);
                    try {
                        setInstallments(JSON.parse(schedule.installments_json));
                    } catch {
                        setInstallments([]);
                    }
                } else {
                    // Valeurs par défaut si pas de barème existant
                    setRegistrationFee(0);
                    setInstallments([
                        { name: "Tranche 1", amount: 0, due_date: "" }
                    ]);
                }
            })
            .catch((err) => setError(err.message || "Erreur de chargement du barème."))
            .finally(() => setLoading(false));
    }, [isOpen, classId, schoolYearId, getFeeSchedule]);

    // Calcul du total des tranches (scolarité)
    const totalTuition = installments.reduce((sum, inst) => sum + (inst.amount || 0), 0);

    const handleAddInstallment = () => {
        setInstallments([
            ...installments,
            { name: `Tranche ${installments.length + 1}`, amount: 0, due_date: "" }
        ]);
    };

    const handleRemoveInstallment = (index: number) => {
        const updated = [...installments];
        updated.splice(index, 1);
        setInstallments(updated);
    };

    const handleInstallmentChange = (index: number, key: keyof Installment, value: any) => {
        const updated = [...installments];
        if (key === "amount") {
            updated[index] = { ...updated[index], amount: Math.max(0, Number(value)) };
        } else {
            updated[index] = { ...updated[index], [key]: value };
        }
        setInstallments(updated);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Convertir en nombre au moment du submit (chaîne vide → 0)
        const numRegistrationFee = registrationFee === "" ? 0 : Number(registrationFee);

        // Validations basiques
        if (numRegistrationFee < 0 || isNaN(numRegistrationFee)) {
            setError("Les frais d'inscription ne peuvent pas être négatifs.");
            return;
        }

        if (installments.length === 0) {
            setError("Vous devez ajouter au moins une tranche de scolarité.");
            return;
        }

        for (const [i, inst] of installments.entries()) {
            if (!inst.name.trim()) {
                setError(`Le libellé de la tranche ${i + 1} est requis.`);
                return;
            }
            if (inst.amount <= 0) {
                setError(`Le montant de la tranche ${i + 1} doit être supérieur à 0.`);
                return;
            }
            if (!inst.due_date) {
                setError(`La date d'échéance de la tranche ${i + 1} est requise.`);
                return;
            }
        }

        setLoading(true);
        try {
            const res = await setFeeSchedule({
                class_id: classId,
                school_year_id: schoolYearId,
                registration_fee: numRegistrationFee,
                total_amount: totalTuition,
                installments
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
            title={`Tarifs et échéances — ${className}`}
            size="lg"
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {error && (
                    <div className="p-3 bg-signal-red/10 border border-signal-red/20 text-signal-red rounded text-xs font-semibold font-sans">
                        {error}
                    </div>
                )}

                {loading && installments.length === 0 ? (
                    <div className="text-center py-6 text-sm text-slate font-sans">Chargement...</div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Frais d'inscription (FCFA) *"
                                type="number"
                                fontMono
                                value={registrationFee === 0 ? "" : registrationFee}
                                onChange={(e) => {
                                    const raw = e.target.value;
                                    if (raw === "") {
                                        setRegistrationFee("");
                                    } else {
                                        setRegistrationFee(Math.max(0, Number(raw)));
                                    }
                                }}
                                placeholder="Ex: 15000"
                                required
                            />
                            <div className="flex flex-col gap-1">
                                <label className="font-sans text-xs font-semibold text-slate uppercase tracking-wider">
                                    Total scolarité (Calculé)
                                </label>
                                <div className="h-10 bg-paper-dark border border-line rounded flex items-center px-3 font-mono-data text-sm font-semibold text-ink">
                                    {totalTuition.toLocaleString("fr-FR")} FCFA
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-line pt-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-display text-sm font-semibold text-ink">
                                    Tranches de scolarité
                                </h3>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={handleAddInstallment}
                                    className="h-8 py-0 px-3 text-xs"
                                >
                                    + Ajouter une tranche
                                </Button>
                            </div>

                            <div className="flex flex-col gap-3 max-h-60 overflow-y-auto pr-1">
                                {installments.map((inst, index) => (
                                    <div key={index} className="flex items-end gap-2 border border-line/60 bg-paper-dark/30 p-2.5 rounded">
                                        <div className="flex-1">
                                            <Input
                                                label="Libellé *"
                                                type="text"
                                                value={inst.name}
                                                onChange={(e) => handleInstallmentChange(index, "name", e.target.value)}
                                                placeholder="Ex: Tranche 1"
                                                required
                                            />
                                        </div>
                                        <div className="w-1/3">
                                            <Input
                                                label="Montant (FCFA) *"
                                                type="number"
                                                fontMono
                                                value={inst.amount || ""}
                                                onChange={(e) => handleInstallmentChange(index, "amount", e.target.value)}
                                                placeholder="Ex: 50000"
                                                required
                                            />
                                        </div>
                                        <div className="w-1/3">
                                            <Input
                                                label="Échéance *"
                                                type="date"
                                                value={inst.due_date}
                                                onChange={(e) => handleInstallmentChange(index, "due_date", e.target.value)}
                                                required
                                            />
                                        </div>
                                        {installments.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveInstallment(index)}
                                                className="text-signal-red hover:bg-signal-red/10 p-2 rounded transition-colors duration-150 h-10 flex items-center justify-center"
                                                title="Supprimer la tranche"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
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
                                Enregistrer les tarifs
                            </Button>
                        </div>
                    </>
                )}
            </form>
        </Modal>
    );
}
