import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import PageContainer from "../../components/ui/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import EmptyState from "../../components/ui/EmptyState";
import {
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell
} from "../../components/ui/Table";
import Button from "../../components/ui/Button";
import FeeScheduleModal from "./components/FeeScheduleModal";
import { useFinance } from "../../hooks/useFinance";
import {
    ClassFinanceSummary,
    StudentBalance,
    FinancialStatus,
    FeeSchedule,
    Payment
} from "../../../electron/types/finance";

/** Badge-fanion SVG — petit pennant triangulaire */
function FanionBadge({ status }: { status: FinancialStatus }) {
    // Payé = vert plein, Partiel = or plein, Impayé = rouge contour
    const config: Record<FinancialStatus, { fill: string; stroke: string; label: string }> = {
        paid: { fill: "#1E7A4C", stroke: "#1E7A4C", label: "Payé" },
        partial: { fill: "#C99A3B", stroke: "#C99A3B", label: "Partiel" },
        unpaid: { fill: "none", stroke: "#B3432E", label: "Impayé" }
    };
    const c = config[status];

    return (
        <span className="inline-flex items-center gap-1.5" title={c.label}>
            <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
                <path
                    d="M1 1h10l-3 6 3 6H1V1z"
                    fill={c.fill}
                    stroke={c.stroke}
                    strokeWidth="1.5"
                />
            </svg>
            <span
                className="text-xs font-semibold font-sans"
                style={{ color: c.stroke }}
            >
                {c.label}
            </span>
        </span>
    );
}

function formatCurrency(amount: number): string {
    return amount.toLocaleString("fr-FR") + " FCFA";
}

export default function FinanceOverviewPage() {
    const navigate = useNavigate();
    const {
        loading,
        error,
        getActiveSchoolYearId,
        getOverview,
        getStudentBalances,
        getFeeSchedule,
        getAllPayments,
        openReceipt,
        generateReceipt
    } = useFinance();

    const [schoolYearId, setSchoolYearId] = useState<number | null>(null);
    const [classSummaries, setClassSummaries] = useState<ClassFinanceSummary[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
    const [studentBalances, setStudentBalances] = useState<StudentBalance[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(false);

    // States additionnels pour le barème et le journal
    const [activeTab, setActiveTab] = useState<"overview" | "journal">("overview");
    const [feeSchedule, setFeeSchedule] = useState<FeeSchedule | null>(null);
    const [loadingSchedule, setLoadingSchedule] = useState(false);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [allPayments, setAllPayments] = useState<Array<Payment & { student_name: string; class_name: string }>>([]);
    const [loadingPayments, setLoadingPayments] = useState(false);
    const [timeFilter, setTimeFilter] = useState<"today" | "week" | "month" | "all">("all");

    // Charger l'année scolaire active puis la vue d'ensemble
    const loadOverview = useCallback(async () => {
        const yearId = await getActiveSchoolYearId();
        if (!yearId) return;
        setSchoolYearId(yearId);
        const data = await getOverview(yearId);
        setClassSummaries(data);
        if (data.length > 0 && !selectedClassId) {
            setSelectedClassId(data[0].class_id);
        }
    }, [getActiveSchoolYearId, getOverview, selectedClassId]);

    useEffect(() => {
        loadOverview();
    }, [loadOverview]);

    // Charger le barème de la classe sélectionnée
    const loadSchedule = useCallback(async () => {
        if (!selectedClassId || !schoolYearId) return;
        setLoadingSchedule(true);
        try {
            const sched = await getFeeSchedule(selectedClassId, schoolYearId);
            setFeeSchedule(sched);
        } catch (err) {
            console.error("Erreur de chargement du barème:", err);
        } finally {
            setLoadingSchedule(false);
        }
    }, [selectedClassId, schoolYearId, getFeeSchedule]);

    useEffect(() => {
        loadSchedule();
    }, [loadSchedule]);

    // Charger le journal des paiements
    const loadPayments = useCallback(async () => {
        if (!schoolYearId) return;
        setLoadingPayments(true);
        try {
            const data = await getAllPayments(schoolYearId);
            setAllPayments(data);
        } catch (err) {
            console.error("Erreur de chargement des paiements:", err);
        } finally {
            setLoadingPayments(false);
        }
    }, [schoolYearId, getAllPayments]);

    useEffect(() => {
        if (activeTab === "journal") {
            loadPayments();
        }
    }, [activeTab, loadPayments]);

    // Charger les soldes élèves quand on sélectionne une classe
    useEffect(() => {
        if (!selectedClassId || !schoolYearId) return;
        setLoadingStudents(true);
        getStudentBalances(selectedClassId, schoolYearId).then((data) => {
            setStudentBalances(data);
            setLoadingStudents(false);
        });
    }, [selectedClassId, schoolYearId, getStudentBalances]);

    // Filtre temporel du journal des paiements
    const filteredPayments = allPayments.filter((p) => {
        if (timeFilter === "all") return true;
        const pDate = new Date(p.payment_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (timeFilter === "today") {
            return pDate >= today;
        }
        if (timeFilter === "week") {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            oneWeekAgo.setHours(0, 0, 0, 0);
            return pDate >= oneWeekAgo;
        }
        if (timeFilter === "month") {
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            oneMonthAgo.setHours(0, 0, 0, 0);
            return pDate >= oneMonthAgo;
        }
        return true;
    });

    const totalFilteredPayments = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

    const selectedClass = classSummaries.find((c) => c.class_id === selectedClassId);

    return (
        <PageContainer>
            <PageHeader
                title="Finance & Scolarité"
                actions={
                    activeTab === "overview" && selectedClass && (
                        <Button
                            variant="secondary"
                            onClick={() => setIsScheduleModalOpen(true)}
                        >
                            {feeSchedule ? "Modifier les tarifs" : "Configurer les tarifs"}
                        </Button>
                    )
                }
            />

            {error && (
                <div className="p-4 mb-4 bg-signal-red/10 border border-signal-red/20 text-signal-red rounded font-sans text-sm font-medium">
                    {error}
                </div>
            )}

            {/* Onglets de navigation principaux */}
            {schoolYearId && (
                <div className="flex border-b border-line mb-6">
                    <button
                        onClick={() => setActiveTab("overview")}
                        className={`px-5 py-3 font-sans text-sm font-semibold transition-all duration-150 border-b-2 -mb-[2px] ${
                            activeTab === "overview"
                                ? "border-ink text-ink"
                                : "border-transparent text-slate hover:text-ink"
                        }`}
                    >
                        Vue d'ensemble par classe
                    </button>
                    <button
                        onClick={() => setActiveTab("journal")}
                        className={`px-5 py-3 font-sans text-sm font-semibold transition-all duration-150 border-b-2 -mb-[2px] ${
                            activeTab === "journal"
                                ? "border-ink text-ink"
                                : "border-transparent text-slate hover:text-ink"
                        }`}
                    >
                        Journal des paiements
                    </button>
                </div>
            )}

            {!schoolYearId && !loading ? (
                <EmptyState
                    title="Aucune année scolaire active"
                    description="Configurez une année scolaire active dans les Paramètres pour accéder au module Finance."
                />
            ) : classSummaries.length === 0 && !loading ? (
                <EmptyState
                    title="Aucune classe configurée"
                    description="Ajoutez des classes pour cette année scolaire afin de pouvoir gérer les frais."
                />
            ) : activeTab === "overview" ? (
                <div className="flex flex-col gap-6">
                    {/* Sélecteur de classes (onglets de classe) */}
                    <div className="flex items-center gap-2 flex-wrap border-b border-line pb-3">
                        {classSummaries.map((cls) => (
                            <button
                                key={cls.class_id}
                                onClick={() => setSelectedClassId(cls.class_id)}
                                className={`px-4 py-2 rounded text-sm font-sans font-medium transition-colors duration-150 ${
                                    selectedClassId === cls.class_id
                                        ? "bg-ink text-paper"
                                        : "bg-paper-dark text-slate hover:bg-line"
                                }`}
                            >
                                {cls.class_name}
                            </button>
                        ))}
                    </div>

                    {loadingSchedule ? (
                        <div className="text-center py-12 text-slate font-sans text-sm">
                            Vérification de la configuration des tarifs...
                        </div>
                    ) : !feeSchedule ? (
                        <EmptyState
                            title="Aucun barème de frais configuré"
                            description={`Les frais d'inscription et de scolarité ne sont pas encore configurés pour la classe ${selectedClass?.class_name || ""}.`}
                            actionLabel="Configurer les tarifs"
                            onAction={() => setIsScheduleModalOpen(true)}
                        />
                    ) : (
                        <>
                            {/* Résumé de la classe sélectionnée */}
                            {selectedClass && (
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="bg-white border border-line rounded p-4">
                                        <p className="text-xs text-slate font-sans uppercase tracking-wider mb-1">Élèves</p>
                                        <p className="text-2xl font-display font-semibold text-ink">{selectedClass.student_count}</p>
                                    </div>
                                    <div className="bg-white border border-line rounded p-4">
                                        <p className="text-xs text-slate font-sans uppercase tracking-wider mb-1">Attendu</p>
                                        <p className="text-lg font-mono-data font-semibold text-ink">{formatCurrency(selectedClass.total_expected)}</p>
                                    </div>
                                    <div className="bg-white border border-line rounded p-4">
                                        <p className="text-xs text-slate font-sans uppercase tracking-wider mb-1">Encaissé</p>
                                        <p className="text-lg font-mono-data font-semibold text-fanion-green">{formatCurrency(selectedClass.total_collected)}</p>
                                    </div>
                                    <div className="bg-white border border-line rounded p-4">
                                        <p className="text-xs text-slate font-sans uppercase tracking-wider mb-1">Statuts</p>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-xs font-sans">
                                                <span className="inline-block w-2 h-2 rounded-full bg-fanion-green mr-1"></span>
                                                {selectedClass.paid_count}
                                            </span>
                                            <span className="text-xs font-sans">
                                                <span className="inline-block w-2 h-2 rounded-full bg-fanion-gold mr-1"></span>
                                                {selectedClass.partial_count}
                                            </span>
                                            <span className="text-xs font-sans">
                                                <span className="inline-block w-2 h-2 rounded-full bg-signal-red mr-1"></span>
                                                {selectedClass.unpaid_count}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Liste des élèves */}
                            {loadingStudents ? (
                                <div className="flex items-center justify-center py-8 text-slate font-sans text-sm">
                                    Chargement des soldes…
                                </div>
                            ) : studentBalances.length === 0 ? (
                                <EmptyState
                                    title="Aucun élève actif"
                                    description="Il n'y a aucun élève actif dans cette classe."
                                />
                            ) : (
                                <div className="bg-white rounded border border-line overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableHead>Matricule</TableHead>
                                            <TableHead>Nom complet</TableHead>
                                            <TableHead>Total dû</TableHead>
                                            <TableHead>Total versé</TableHead>
                                            <TableHead>Solde</TableHead>
                                            <TableHead>Statut</TableHead>
                                            <TableHead className="text-right">Détails</TableHead>
                                        </TableHeader>
                                        <TableBody>
                                            {studentBalances.map((sb) => (
                                                <TableRow key={sb.student_id}>
                                                    <TableCell fontMono>{sb.matricule}</TableCell>
                                                    <TableCell>{sb.student_name}</TableCell>
                                                    <TableCell fontMono>{formatCurrency(sb.total_due)}</TableCell>
                                                    <TableCell fontMono>{formatCurrency(sb.total_paid)}</TableCell>
                                                    <TableCell fontMono>{formatCurrency(sb.balance)}</TableCell>
                                                    <TableCell>
                                                        <FanionBadge status={sb.status} />
                                                    </TableCell>
                                                    <TableCell alignRight>
                                                        <button
                                                            onClick={() => navigate(`/finance/student/${sb.student_id}`)}
                                                            className="text-xs font-sans font-semibold text-ink hover:underline"
                                                        >
                                                            Voir fiche →
                                                        </button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </>
                    )}
                </div>
            ) : (
                /* SECTION : JOURNAL DES PAIEMENTS */
                <div className="flex flex-col gap-6">
                    {/* Filtre de période et récapitulatif */}
                    <div className="flex flex-wrap items-center justify-between gap-4 border border-line bg-paper-dark/30 p-4 rounded">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-sans font-semibold text-slate uppercase tracking-wider mr-2">Période :</span>
                            {(["all", "today", "week", "month"] as const).map((filter) => {
                                const labels = { all: "Tout", today: "Aujourd'hui", week: "Cette semaine", month: "Ce mois" };
                                return (
                                    <button
                                        key={filter}
                                        onClick={() => setTimeFilter(filter)}
                                        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                                            timeFilter === filter
                                                ? "bg-ink text-paper font-semibold"
                                                : "bg-white text-slate border border-line hover:bg-paper-dark"
                                        }`}
                                    >
                                        {labels[filter]}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="bg-white px-4 py-2 border border-line rounded flex items-center gap-3">
                            <span className="text-xs font-sans font-semibold text-slate uppercase tracking-wider">Recette période :</span>
                            <span className="font-mono-data text-base font-bold text-fanion-green">
                                {formatCurrency(totalFilteredPayments)}
                            </span>
                        </div>
                    </div>

                    {loadingPayments ? (
                        <div className="text-center py-12 text-slate font-sans text-sm">
                            Chargement du journal des paiements...
                        </div>
                    ) : filteredPayments.length === 0 ? (
                        <EmptyState
                            title="Aucun paiement trouvé"
                            description="Aucun versement n'a été enregistré pour la période sélectionnée."
                        />
                    ) : (
                        <div className="bg-white rounded border border-line overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Élève</TableHead>
                                    <TableHead>Classe</TableHead>
                                    <TableHead>Mode</TableHead>
                                    <TableHead>N° Reçu</TableHead>
                                    <TableHead>Montant</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableHeader>
                                <TableBody>
                                    {filteredPayments.map((p) => (
                                        <TableRow key={p.id}>
                                            <TableCell fontMono>{new Date(p.payment_date).toLocaleDateString("fr-FR")}</TableCell>
                                            <TableCell className="font-medium text-ink">{p.student_name}</TableCell>
                                            <TableCell>{p.class_name}</TableCell>
                                            <TableCell className="capitalize font-sans text-xs">
                                                {p.method === "cash"
                                                    ? "Espèces"
                                                    : p.method === "mobile_money"
                                                    ? "Mobile Money"
                                                    : p.method === "bank"
                                                    ? "Virement"
                                                    : p.method === "cheque"
                                                    ? "Chèque"
                                                    : p.method}
                                            </TableCell>
                                            <TableCell fontMono className="text-xs font-semibold">{p.receipt_number}</TableCell>
                                            <TableCell fontMono className="font-semibold text-ink">{formatCurrency(p.amount)}</TableCell>
                                            <TableCell alignRight>
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={async () => {
                                                            const res = await openReceipt(p.id);
                                                            if (!res.ok) alert(res.error);
                                                        }}
                                                        className="text-xs font-sans font-semibold text-ink hover:underline"
                                                    >
                                                        Ouvrir PDF
                                                    </button>
                                                    <span className="text-line">|</span>
                                                    <button
                                                        onClick={async () => {
                                                            const res = await generateReceipt(p.id);
                                                            if (res.ok) {
                                                                alert("Reçu PDF régénéré avec succès.");
                                                            } else {
                                                                alert("Erreur de régénération : " + res.error);
                                                            }
                                                        }}
                                                        className="text-xs font-sans font-semibold text-slate hover:text-ink hover:underline"
                                                    >
                                                        Régénérer
                                                    </button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            )}

            {/* Modale de configuration des tarifs */}
            {selectedClassId && schoolYearId && selectedClass && (
                <FeeScheduleModal
                    isOpen={isScheduleModalOpen}
                    onClose={() => setIsScheduleModalOpen(false)}
                    classId={selectedClassId}
                    className={selectedClass.class_name}
                    schoolYearId={schoolYearId}
                    onSuccess={() => {
                        loadOverview();
                        loadSchedule();
                    }}
                />
            )}
        </PageContainer>
    );
}
