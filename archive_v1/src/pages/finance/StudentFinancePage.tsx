import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageContainer from "../../components/ui/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useFinance } from "../../hooks/useFinance";
import PaymentHistoryTable from "./components/PaymentHistoryTable";
import RecordPaymentModal from "./components/RecordPaymentModal";
import StudentOverrideModal from "./components/StudentOverrideModal";
import {
    StudentBalance,
    Payment,
    FeeSchedule,
    Installment,
    FinancialStatus
} from "../../../electron/types/finance";

function formatCurrency(amount: number): string {
    return amount.toLocaleString("fr-FR") + " FCFA";
}

/** Badge-fanion SVG */
function FanionBadge({ status }: { status: FinancialStatus }) {
    const config: Record<FinancialStatus, { fill: string; stroke: string; label: string }> = {
        paid: { fill: "#1E7A4C", stroke: "#1E7A4C", label: "Payé" },
        partial: { fill: "#C99A3B", stroke: "#C99A3B", label: "Partiel" },
        unpaid: { fill: "none", stroke: "#B3432E", label: "Impayé" }
    };
    const c = config[status];
    return (
        <span className="inline-flex items-center gap-1.5">
            <svg width="14" height="16" viewBox="0 0 12 14" fill="none">
                <path d="M1 1h10l-3 6 3 6H1V1z" fill={c.fill} stroke={c.stroke} strokeWidth="1.5" />
            </svg>
            <span className="text-sm font-semibold font-sans" style={{ color: c.stroke }}>
                {c.label}
            </span>
        </span>
    );
}

/**
 * Distribution d'affichage uniquement — jamais stockée en base.
 * Distribue total_paid sur inscription puis tranches successivement.
 */
function distributePayments(
    registrationFee: number,
    installments: Installment[],
    totalPaid: number
): { label: string; due: number; paid: number }[] {
    const result: { label: string; due: number; paid: number }[] = [];
    let remaining = totalPaid;

    // Inscription d'abord
    const regPaid = Math.min(remaining, registrationFee);
    result.push({ label: "Frais d'inscription", due: registrationFee, paid: regPaid });
    remaining -= regPaid;

    // Puis chaque tranche
    for (const inst of installments) {
        const instPaid = Math.min(remaining, inst.amount);
        result.push({ label: inst.name, due: inst.amount, paid: instPaid });
        remaining -= instPaid;
    }

    return result;
}

export default function StudentFinancePage() {
    const { studentId } = useParams<{ studentId: string }>();
    const navigate = useNavigate();
    const {
        getActiveSchoolYearId,
        getBalance,
        getPaymentHistory,
        getFeeSchedule,
        recordPayment,
        updatePayment,
        deletePayment,
        openReceipt,
        generateReceipt,
        getStudentFeeOverride
    } = useFinance();

    const [schoolYearId, setSchoolYearId] = useState<number | null>(null);
    const [balance, setBalance] = useState<StudentBalance | null>(null);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [schedule, setSchedule] = useState<FeeSchedule | null>(null);
    const [existingOverride, setExistingOverride] = useState<{ amount: number; reason: string } | null>(null);
    const [loading, setLoading] = useState(true);

    // Modale de création de paiement
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    // Modale d'édition de paiement
    const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
    // Dialogue de confirmation de suppression
    const [deletingPayment, setDeletingPayment] = useState<Payment | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);

    const numStudentId = Number(studentId);

    const loadData = useCallback(async () => {
        setLoading(true);
        const yearId = await getActiveSchoolYearId();
        if (!yearId || !numStudentId) {
            setLoading(false);
            return;
        }
        setSchoolYearId(yearId);

        const [bal, hist, overrideData] = await Promise.all([
            getBalance(numStudentId, yearId),
            getPaymentHistory(numStudentId, yearId),
            getStudentFeeOverride(numStudentId, yearId)
        ]);

        setBalance(bal);
        setPayments(hist);
        if (overrideData) {
            setExistingOverride({
                amount: overrideData.total_amount_override,
                reason: overrideData.reason || ""
            });
        } else {
            setExistingOverride(null);
        }

        // Récupérer le schedule à partir de la classe de l'élève
        if (bal) {
            // On a besoin du class_id — on le récupère via l'IPC students
            try {
                const studentRes = await window.api.students.get(numStudentId);
                if (studentRes.ok) {
                    const sched = await getFeeSchedule(studentRes.data.class_id, yearId);
                    setSchedule(sched);
                }
            } catch {
                // Pas critique
            }
        }

        setLoading(false);
    }, [numStudentId, getActiveSchoolYearId, getBalance, getPaymentHistory, getFeeSchedule, getStudentFeeOverride]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleRecordPayment = async (data: {
        amount: number;
        payment_date: string;
        method: string;
    }): Promise<boolean> => {
        if (!schoolYearId) return false;
        const res = await recordPayment({
            student_id: numStudentId,
            school_year_id: schoolYearId,
            amount: data.amount,
            payment_date: data.payment_date,
            method: data.method as "cash" | "mobile_money" | "bank"
        });
        if (res.ok) {
            await loadData();
            if (res.pdfError) {
                alert(`Paiement enregistré, mais le reçu n'a pas pu être généré : ${res.pdfError}`);
            }
            return true;
        }
        throw new Error(res.error || "Erreur d'enregistrement.");
    };

    const handleUpdatePayment = async (data: {
        amount: number;
        payment_date: string;
        method: string;
    }): Promise<boolean> => {
        if (!editingPayment) return false;
        const res = await updatePayment(
            editingPayment.id,
            data.amount,
            data.payment_date,
            data.method
        );
        if (res.ok) {
            await loadData();
            if (res.pdfError) {
                alert(`Paiement modifié, mais le reçu n'a pas pu être régénéré : ${res.pdfError}`);
            }
            return true;
        }
        throw new Error(res.error || "Erreur de mise à jour.");
    };

    const handleDeletePayment = async () => {
        if (!deletingPayment) return;
        setIsDeleting(true);
        const res = await deletePayment(deletingPayment.id);
        setIsDeleting(false);
        if (res.ok) {
            setDeletingPayment(null);
            await loadData();
        } else {
            alert(res.error || "Erreur lors de la suppression.");
        }
    };

    const handleOpenReceipt = async (paymentId: number) => {
        const res = await openReceipt(paymentId);
        if (!res.ok) {
            alert(res.error || "Impossible d'ouvrir le reçu.");
        }
    };

    const handleRegenerateReceipt = async (paymentId: number) => {
        const res = await generateReceipt(paymentId);
        if (res.ok) {
            await loadData();
            alert("Reçu régénéré avec succès.");
        } else {
            alert(res.error || "Erreur lors de la régénération.");
        }
    };

    // Distribution dynamique des paiements sur les tranches (affichage uniquement)
    let installmentDistribution: { label: string; due: number; paid: number }[] = [];
    if (balance && schedule) {
        let installments: Installment[] = [];
        try {
            installments = JSON.parse(schedule.installments_json);
        } catch {
            installments = [];
        }
        installmentDistribution = distributePayments(
            balance.registration_fee,
            installments,
            balance.total_paid
        );
    }

    if (loading) {
        return (
            <PageContainer>
                <div className="flex items-center justify-center py-12 text-slate font-sans text-sm">
                    Chargement de la fiche financière…
                </div>
            </PageContainer>
        );
    }

    if (!balance) {
        return (
            <PageContainer>
                <PageHeader
                    title="Fiche financière"
                    actions={
                        <Button variant="secondary" onClick={() => navigate("/finance")}>
                            ← Retour
                        </Button>
                    }
                />
                <p className="text-sm text-slate font-sans">Élève introuvable ou aucune année scolaire active.</p>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            <PageHeader
                title={`Fiche financière — ${balance.student_name}`}
                actions={
                    <div className="flex items-center gap-3">
                        <Button variant="secondary" onClick={() => navigate("/finance")}>
                            ← Retour
                        </Button>
                        <Button variant="secondary" onClick={() => setIsOverrideModalOpen(true)}>
                            {balance.has_override ? "Modifier Bourse/Réduction" : "Accorder Bourse/Réduction"}
                        </Button>
                        <Button variant="primary" onClick={() => setIsPaymentModalOpen(true)}>
                            Enregistrer un paiement
                        </Button>
                    </div>
                }
            />

            {/* Résumé du solde */}
            <div className="grid grid-cols-5 gap-4 mb-6">
                <div className="bg-white border border-line rounded p-4">
                    <p className="text-xs text-slate font-sans uppercase tracking-wider mb-1">Inscription</p>
                    <p className="text-base font-mono-data font-semibold text-ink">
                        {formatCurrency(balance.registration_fee)}
                    </p>
                </div>
                <div className="bg-white border border-line rounded p-4 flex flex-col justify-between">
                    <div>
                        <p className="text-xs text-slate font-sans uppercase tracking-wider mb-1">
                            Scolarité{balance.has_override && " (réduite)"}
                        </p>
                        <p className="text-base font-mono-data font-semibold text-ink">
                            {formatCurrency(balance.tuition_amount)}
                        </p>
                    </div>
                    {balance.has_override && existingOverride?.reason && (
                        <p className="text-[10px] text-slate font-sans mt-1 bg-paper-dark px-1.5 py-0.5 rounded truncate" title={existingOverride.reason}>
                            Motif : {existingOverride.reason}
                        </p>
                    )}
                </div>
                <div className="bg-white border border-line rounded p-4">
                    <p className="text-xs text-slate font-sans uppercase tracking-wider mb-1">Total dû</p>
                    <p className="text-base font-mono-data font-semibold text-ink">
                        {formatCurrency(balance.total_due)}
                    </p>
                </div>
                <div className="bg-white border border-line rounded p-4">
                    <p className="text-xs text-slate font-sans uppercase tracking-wider mb-1">Total versé</p>
                    <p className="text-base font-mono-data font-semibold text-fanion-green">
                        {formatCurrency(balance.total_paid)}
                    </p>
                </div>
                <div className="bg-white border border-line rounded p-4">
                    <p className="text-xs text-slate font-sans uppercase tracking-wider mb-1">Statut</p>
                    <div className="mt-1">
                        <FanionBadge status={balance.status} />
                    </div>
                </div>
            </div>

            {/* Deux colonnes : Échéancier + Historique */}
            <div className="grid grid-cols-2 gap-6">
                {/* Échéancier dynamique */}
                <div className="bg-white border border-line rounded p-5">
                    <h2 className="font-display text-lg font-semibold text-ink mb-4">
                        Échéancier de paiement
                    </h2>
                    {installmentDistribution.length === 0 ? (
                        <p className="text-sm text-slate font-sans">
                            Aucun barème configuré pour cette classe.
                        </p>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {installmentDistribution.map((item, i) => {
                                const pct = item.due > 0 ? Math.min(100, (item.paid / item.due) * 100) : 0;
                                const isComplete = item.paid >= item.due;
                                return (
                                    <div key={i} className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-sans font-medium text-ink">
                                                {item.label}
                                            </span>
                                            <span className="text-xs font-mono-data text-slate">
                                                {formatCurrency(item.paid)} / {formatCurrency(item.due)}
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-paper-dark rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-300 ${
                                                    isComplete ? "bg-fanion-green" : "bg-fanion-gold"
                                                }`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Historique des paiements */}
                <div className="bg-white border border-line rounded p-5">
                    <h2 className="font-display text-lg font-semibold text-ink mb-4">
                        Historique des paiements
                    </h2>
                    <PaymentHistoryTable
                        payments={payments}
                        onOpenReceipt={handleOpenReceipt}
                        onRegenerateReceipt={handleRegenerateReceipt}
                        onEditPayment={(p) => setEditingPayment(p)}
                        onDeletePayment={(p) => setDeletingPayment(p)}
                    />
                </div>
            </div>

            {/* Modale de création de paiement */}
            <RecordPaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                onSubmit={handleRecordPayment}
                maxBalance={balance.balance}
                studentName={balance.student_name}
            />

            {/* Modale d'édition de paiement */}
            <RecordPaymentModal
                isOpen={!!editingPayment}
                onClose={() => setEditingPayment(null)}
                onSubmit={handleUpdatePayment}
                maxBalance={balance.balance}
                studentName={balance.student_name}
                payment={editingPayment}
            />

            {/* Dialogue de confirmation de suppression */}
            <ConfirmDialog
                isOpen={!!deletingPayment}
                onClose={() => setDeletingPayment(null)}
                onConfirm={handleDeletePayment}
                title="Supprimer ce paiement ?"
                message={
                    deletingPayment
                        ? `Vous êtes sur le point de supprimer le paiement de ${formatCurrency(deletingPayment.amount)} (reçu n°${deletingPayment.receipt_number}). Cette action est irréversible et le fichier PDF du reçu sera également supprimé.`
                        : ""
                }
                confirmLabel="Supprimer"
                isDestructive
                isLoading={isDeleting}
            />

            {/* Modale de bourse/réduction */}
            {schoolYearId && schedule && (
                <StudentOverrideModal
                    isOpen={isOverrideModalOpen}
                    onClose={() => setIsOverrideModalOpen(false)}
                    studentId={numStudentId}
                    studentName={balance.student_name}
                    schoolYearId={schoolYearId}
                    standardTuition={schedule.total_amount}
                    registrationFee={schedule.registration_fee}
                    existingOverride={existingOverride}
                    onSuccess={loadData}
                />
            )}
        </PageContainer>
    );
}
