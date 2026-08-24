import React, { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  listClasses,
  listSchoolYears,
  getActiveSchoolYear,
  listStudents,
  getFeeSchedule,
  getStudentFeeOverride,
  getStudentPayments,
  createPayment,
  allocatePaymentToInstallments,
  ClassRecord,
  SchoolYearRecord,
  StudentRecord,
  FeeSchedule,
  StudentFeeOverride,
  Payment,
  AllocationResult,
  useSelectionPersistence,
} from "@fanion/shared";

interface PaymentEntryPageProps {
  userRole?: string;
}

export const PaymentEntryPage: React.FC<PaymentEntryPageProps> = ({ userRole }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // URL query params extraction
  const queryParams = new URLSearchParams(location.search);
  const paramStudentId = queryParams.get("studentId");
  const paramClassId = queryParams.get("classId");

  // Selection persistence
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [selectedClassId, setSelectedClassId] = useSelectionPersistence("classId", paramClassId || "");
  const [schoolYears, setSchoolYears] = useState<SchoolYearRecord[]>([]);
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useSelectionPersistence("schoolYearId", "");

  // Students list
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(paramStudentId || "");
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);

  // Financial details
  const [feeSchedule, setFeeSchedule] = useState<FeeSchedule | null>(null);
  const [feeOverride, setFeeOverride] = useState<StudentFeeOverride | null>(null);
  const [paymentsHistory, setPaymentsHistory] = useState<Payment[]>([]);

  // Form State
  const [category, setCategory] = useState<"registration" | "tuition">("registration");
  const [amount, setAmount] = useState<number | "">("");
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [method, setMethod] = useState<"cash" | "bank_transfer" | "mobile_money" | "check">(
    "cash"
  );

  // Loading & Error States
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingStudent, setLoadingStudent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Confirmation Modal State
  const [createdPaymentResult, setCreatedPaymentResult] = useState<{
    payment: Payment;
    allocation: AllocationResult;
    activatedNow: boolean;
  } | null>(null);

  const isAuthorized = userRole === "principal" || userRole === "directeur_etudes";

  const formatAmount = (amt: number) =>
    Math.round(amt || 0)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  // 1. Charger l'initialisation (Années scolaires & Classes)
  useEffect(() => {
    const fetchInit = async () => {
      setLoadingInit(true);
      setError(null);
      try {
        const [yearsData, activeYear, classesData] = await Promise.all([
          listSchoolYears(),
          getActiveSchoolYear(),
          listClasses(),
        ]);

        setSchoolYears(yearsData);
        setClasses(classesData);

        if (!selectedSchoolYearId && activeYear) {
          setSelectedSchoolYearId(activeYear.id);
        } else if (!selectedSchoolYearId && yearsData.length > 0) {
          setSelectedSchoolYearId(yearsData[0].id);
        }

        if (!selectedClassId && classesData.length > 0) {
          setSelectedClassId(classesData[0].id);
        }
      } catch (err: any) {
        console.error("Erreur initialisation finance:", err);
        setError("Erreur lors du chargement des données initiales.");
      } finally {
        setLoadingInit(false);
      }
    };
    fetchInit();
  }, []);

  // 2. Charger les élèves de la classe sélectionnée
  useEffect(() => {
    const fetchClassStudents = async () => {
      if (!selectedClassId) {
        setStudents([]);
        return;
      }
      try {
        const data = await listStudents({ classId: selectedClassId });
        setStudents(data);
        if (paramStudentId && data.some((s) => s.id === paramStudentId)) {
          setSelectedStudentId(paramStudentId);
        } else if (data.length > 0 && !data.some((s) => s.id === selectedStudentId)) {
          setSelectedStudentId(data[0].id);
        }
      } catch (err: any) {
        console.error("Erreur chargement élèves de la classe:", err);
      }
    };
    fetchClassStudents();
  }, [selectedClassId, paramStudentId]);

  // 3. Charger les détails financiers de l'élève sélectionné
  const loadStudentFinanceDetails = useCallback(async () => {
    if (!selectedStudentId || !selectedClassId || !selectedSchoolYearId) {
      setSelectedStudent(null);
      setFeeSchedule(null);
      setFeeOverride(null);
      setPaymentsHistory([]);
      return;
    }

    setLoadingStudent(true);
    setError(null);
    try {
      const student = students.find((s) => s.id === selectedStudentId) || null;
      setSelectedStudent(student);

      const [schedule, override, payments] = await Promise.all([
        getFeeSchedule(selectedClassId, selectedSchoolYearId),
        getStudentFeeOverride(selectedStudentId, selectedSchoolYearId),
        getStudentPayments(selectedStudentId, selectedSchoolYearId),
      ]);

      setFeeSchedule(schedule);
      setFeeOverride(override);
      setPaymentsHistory(payments);

      // Auto-basculer la catégorie par défaut
      if (schedule) {
        const regPaid = payments
          .filter((p) => (p.payment_category || "tuition") === "registration")
          .reduce((sum, p) => sum + Number(p.amount), 0);

        if (regPaid < Number(schedule.registration_fee)) {
          setCategory("registration");
        } else {
          setCategory("tuition");
        }
      }
    } catch (err: any) {
      console.error("Erreur chargement détails financiers élève:", err);
      setError("Impossible de charger les données financières de cet élève.");
    } finally {
      setLoadingStudent(false);
    }
  }, [selectedStudentId, selectedClassId, selectedSchoolYearId, students]);

  useEffect(() => {
    loadStudentFinanceDetails();
  }, [loadStudentFinanceDetails]);

  // Calculs financiers
  const totalRegistrationFee = Number(feeSchedule?.registration_fee || 0);
  const totalTuitionFee = feeOverride
    ? Number(feeOverride.total_amount_override)
    : Number(feeSchedule?.total_amount || 0);

  const registrationPaid = paymentsHistory
    .filter((p) => (p.payment_category || "tuition") === "registration")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const tuitionPaid = paymentsHistory
    .filter((p) => (p.payment_category || "tuition") === "tuition")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const registrationRemaining = Math.max(0, totalRegistrationFee - registrationPaid);
  const tuitionRemaining = Math.max(0, totalTuitionFee - tuitionPaid);

  const numAmount = typeof amount === "number" ? amount : 0;
  const isRegistrationSurplus =
    category === "registration" && registrationRemaining > 0 && numAmount > registrationRemaining;
  const isRegistrationAlreadyPaid =
    category === "registration" && registrationRemaining === 0 && numAmount > 0;

  // Calcul d'allocation en direct pour la scolarité
  const liveAllocation: AllocationResult | null =
    category === "tuition" && feeSchedule && numAmount > 0
      ? allocatePaymentToInstallments(
          feeSchedule.installments_json,
          tuitionPaid,
          numAmount,
          feeOverride?.total_amount_override
        )
      : null;

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !selectedClassId || !selectedSchoolYearId || numAmount <= 0) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const initialStatus = selectedStudent?.status;

      const result = await createPayment({
        studentId: selectedStudentId,
        schoolYearId: selectedSchoolYearId,
        classId: selectedClassId,
        amount: numAmount,
        paymentDate,
        method,
        paymentCategory: category,
      });

      // Recharger les données financières et le statut de l'élève
      await loadStudentFinanceDetails();

      const isActivated =
        initialStatus === "pending_registration" &&
        (category === "registration" || registrationPaid + numAmount >= totalRegistrationFee);

      setCreatedPaymentResult({
        payment: result.payment,
        allocation: result.allocation,
        activatedNow: isActivated,
      });

      setAmount("");
    } catch (err: any) {
      console.error("Erreur enregistrement paiement:", err);
      setError(err?.message || "Échec de l'enregistrement du paiement.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderStatusBadge = (status?: string) => {
    switch (status) {
      case "active":
        return (
          <span className="px-2.5 py-1 rounded text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Actif / Inscrit
          </span>
        );
      case "pending_registration":
        return (
          <span className="px-2.5 py-1 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            En attente d'inscription
          </span>
        );
      case "inactive":
      default:
        return (
          <span className="px-2.5 py-1 rounded text-xs font-bold bg-slate/10 text-slate border border-slate/20">
            Inactif
          </span>
        );
    }
  };

  if (!isAuthorized) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <h1 className="font-display text-xl md:text-2xl font-bold text-ink mb-4">
          Enregistrer un paiement
        </h1>
        <div className="p-4 bg-signal-red/10 border border-signal-red/20 rounded text-signal-red text-sm font-medium">
          Accès restreint. Seuls le Principal et le Directeur des Études peuvent enregistrer des paiements.
        </div>
      </div>
    );
  }

  if (loadingInit) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto text-center py-12 text-slate font-medium text-sm">
        Chargement du module de paiement...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* En-tête de la page */}
      <div className="pb-4 border-b border-line flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl md:text-2xl font-bold text-ink">
            Enregistrer un Paiement
          </h1>
          <p className="text-xs md:text-sm text-slate mt-0.5">
            Saisie des règlements d'inscription ou de scolarité avec attribution atomique de numéro de reçu.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-ink text-white rounded text-xs font-semibold uppercase tracking-wider">
            Lot F3
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-signal-red/10 border border-signal-red/20 rounded text-signal-red text-sm font-medium">
          {error}
        </div>
      )}

      {/* Barre de sélection : Année scolaire, Classe, Élève */}
      <div className="bg-white border border-line rounded p-4 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate uppercase mb-1">
            Année scolaire
          </label>
          <select
            value={selectedSchoolYearId}
            onChange={(e) => setSelectedSchoolYearId(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded text-sm bg-paper text-ink font-medium focus:outline-none focus:border-ink"
          >
            {schoolYears.map((sy) => (
              <option key={sy.id} value={sy.id}>
                {sy.label} {sy.is_active ? "(Active)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate uppercase mb-1">
            Classe
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded text-sm bg-paper text-ink font-medium focus:outline-none focus:border-ink"
          >
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name} ({cls.level})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate uppercase mb-1">
            Sélectionner un élève
          </label>
          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded text-sm bg-paper text-ink font-semibold focus:outline-none focus:border-ink"
          >
            {students.length === 0 ? (
              <option value="">Aucun élève dans cette classe</option>
            ) : (
              students.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.last_name.toUpperCase()} {st.first_name} ({st.matricule})
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {loadingStudent ? (
        <div className="py-12 text-center text-sm font-medium text-slate">
          Chargement de la situation financière de l'élève...
        </div>
      ) : !selectedStudent ? (
        <div className="py-12 border border-dashed border-line rounded text-center text-sm text-slate">
          Veuillez sélectionner un élève pour enregistrer un paiement.
        </div>
      ) : !feeSchedule ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-900 text-sm font-medium">
          Aucun tarif n'a encore été configuré pour la classe{" "}
          <strong>{classes.find((c) => c.id === selectedClassId)?.name}</strong> sur l'année scolaire sélectionnée. Veuillez configurer le tarif dans l'écran "Tarifs des classes" avant d'enregistrer un paiement.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Synthèse Élève & Solde */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white border border-line rounded p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <span className="text-xs font-semibold text-slate uppercase tracking-wider">
                  Fiche de Règlement
                </span>
                {renderStatusBadge(selectedStudent.status)}
              </div>

              <div>
                <h3 className="font-display text-lg font-bold text-ink uppercase">
                  {selectedStudent.last_name} {selectedStudent.first_name}
                </h3>
                <p className="text-xs font-mono text-slate">Matricule : {selectedStudent.matricule}</p>
                <p className="text-xs text-slate mt-1">
                  Classe :{" "}
                  <strong className="text-ink">
                    {classes.find((c) => c.id === selectedClassId)?.name}
                  </strong>
                </p>
              </div>

              {/* Récapitulatif Inscription */}
              <div className="p-3 bg-paper border border-line rounded space-y-1 text-xs">
                <div className="flex justify-between font-semibold text-ink">
                  <span>Frais d'inscription :</span>
                  <span>{formatAmount(totalRegistrationFee)} FCFA</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Déjà payé :</span>
                  <span>{formatAmount(registrationPaid)} FCFA</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-line/60">
                  <span className={registrationRemaining > 0 ? "text-amber-800" : "text-emerald-800"}>
                    Solde inscription :
                  </span>
                  <span className={registrationRemaining > 0 ? "text-amber-800 font-bold" : "text-emerald-800 font-bold"}>
                    {registrationRemaining > 0
                      ? `${formatAmount(registrationRemaining)} FCFA`
                      : "SOLDER (100%)"}
                  </span>
                </div>
              </div>

              {/* Récapitulatif Scolarité */}
              <div className="p-3 bg-paper border border-line rounded space-y-1 text-xs">
                <div className="flex justify-between font-semibold text-ink">
                  <span>Scolarité annuelle :</span>
                  <span>
                    {formatAmount(totalTuitionFee)} FCFA
                    {feeOverride && <span className="text-amber-700 ml-1">(Bourse)</span>}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Déjà payé :</span>
                  <span>{formatAmount(tuitionPaid)} FCFA</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-line/60">
                  <span className={tuitionRemaining > 0 ? "text-ink" : "text-emerald-800"}>
                    Reste scolarité :
                  </span>
                  <span className={tuitionRemaining > 0 ? "text-ink font-bold" : "text-emerald-800 font-bold"}>
                    {tuitionRemaining > 0
                      ? `${formatAmount(tuitionRemaining)} FCFA`
                      : "SOLDER (100%)"}
                  </span>
                </div>
              </div>
            </div>

            {/* Historique rapide des paiements */}
            <div className="bg-white border border-line rounded p-4 shadow-sm">
              <h4 className="font-display text-xs font-bold text-ink uppercase mb-3 border-b border-line pb-2">
                Historique paiements ({paymentsHistory.length})
              </h4>

              {paymentsHistory.length === 0 ? (
                <p className="text-xs text-slate italic text-center py-4">
                  Aucun paiement enregistré pour cet élève.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {paymentsHistory.map((p) => (
                    <div
                      key={p.id}
                      className="p-2 border border-line rounded bg-paper text-xs flex justify-between items-center"
                    >
                      <div>
                        <div className="font-bold text-ink">
                          Reçu N°{p.receipt_number} — {formatAmount(Number(p.amount))} FCFA
                        </div>
                        <div className="text-[11px] text-slate font-mono">
                          {p.payment_date} • {p.payment_category === "registration" ? "Inscription" : "Scolarité"}
                        </div>
                      </div>
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 bg-slate/10 text-slate rounded">
                        {p.method}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Formulaire d'enregistrement */}
          <div className="lg:col-span-2 bg-white border border-line rounded p-5 shadow-sm space-y-6">
            <h2 className="font-display text-base font-bold text-ink border-b border-line pb-3">
              Nouveau versement
            </h2>

            <form onSubmit={handleSubmitPayment} className="space-y-5">
              {/* Choix de la catégorie */}
              <div>
                <label className="block text-xs font-semibold text-slate uppercase mb-2">
                  Catégorie du paiement *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCategory("registration")}
                    className={`p-3 rounded border text-left flex flex-col transition ${
                      category === "registration"
                        ? "border-ink bg-ink/5 ring-1 ring-ink"
                        : "border-line bg-paper hover:border-slate/50"
                    }`}
                  >
                    <span className="text-sm font-bold text-ink">Frais d'inscription</span>
                    <span className="text-xs text-slate mt-1">
                      {registrationRemaining > 0
                        ? `Reste : ${formatAmount(registrationRemaining)} FCFA`
                        : "✓ Déjà intégralement réglé"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCategory("tuition")}
                    className={`p-3 rounded border text-left flex flex-col transition ${
                      category === "tuition"
                        ? "border-ink bg-ink/5 ring-1 ring-ink"
                        : "border-line bg-paper hover:border-slate/50"
                    }`}
                  >
                    <span className="text-sm font-bold text-ink">Frais de scolarité</span>
                    <span className="text-xs text-slate mt-1">
                      Ventilation par tranche (Reste : {formatAmount(tuitionRemaining)} FCFA)
                    </span>
                  </button>
                </div>
              </div>

              {/* Montant et Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate uppercase mb-1">
                    Montant du versement (FCFA) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={amount}
                    onChange={(e) =>
                      setAmount(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    placeholder="Ex: 25000"
                    className="w-full px-3 py-2 border border-line rounded text-base font-bold bg-paper text-ink focus:outline-none focus:border-ink"
                    required
                  />

                  {/* Information préventive sur la ventilation automatique du surplus */}
                  {isRegistrationSurplus && (
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900 font-medium mt-2">
                      ℹ️ <strong>{formatAmount(registrationRemaining)} FCFA</strong> vont solder l'inscription et le surplus de <strong>{formatAmount(numAmount - registrationRemaining)} FCFA</strong> sera automatiquement attribué aux frais de scolarité.
                    </div>
                  )}

                  {isRegistrationAlreadyPaid && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900 font-medium mt-2">
                      ℹ️ L'inscription étant déjà intégralement réglée, la totalité des <strong>{formatAmount(numAmount)} FCFA</strong> sera directement versée aux frais de scolarité.
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate uppercase mb-1">
                    Mode de règlement *
                  </label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as any)}
                    className="w-full px-3 py-2 border border-line rounded text-sm bg-paper text-ink font-medium focus:outline-none focus:border-ink"
                  >
                    <option value="cash">Espèces (Caisse)</option>
                    <option value="mobile_money">Mobile Money (OM / MTN)</option>
                    <option value="bank_transfer">Virement bancaire</option>
                    <option value="check">Chèque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate uppercase mb-1">
                  Date de versement
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full sm:w-1/2 px-3 py-2 border border-line rounded text-sm bg-paper text-ink font-medium focus:outline-none focus:border-ink"
                  required
                />
              </div>

              {/* Aperçu en direct de la ventilation (si scolarité) */}
              {category === "tuition" && liveAllocation && numAmount > 0 && (
                <div className="p-4 bg-paper-dark/50 border border-line rounded space-y-3">
                  <h4 className="font-display text-xs font-bold text-ink uppercase">
                    Simulation de ventilation par tranche
                  </h4>
                  <div className="space-y-2">
                    {liveAllocation.trancheDetails.map((td, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <span className="font-medium text-ink">{td.label} :</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate">
                            {formatAmount(td.previouslyPaid)} / {formatAmount(td.targetAmount)} FCFA
                          </span>
                          {td.allocatedNow > 0 && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded">
                              +{formatAmount(td.allocatedNow)} FCFA
                            </span>
                          )}
                          {td.isCompleted && (
                            <span className="text-emerald-700 font-bold">✓ Soldé</span>
                          )}
                        </div>
                      </div>
                    ))}

                    {liveAllocation.excessAdvance > 0 && (
                      <div className="p-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded flex justify-between">
                        <span>Avance globale sur scolarité :</span>
                        <span>+{formatAmount(liveAllocation.excessAdvance)} FCFA</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={submitting || numAmount <= 0}
                  className="w-full py-3 bg-ink hover:bg-opacity-90 text-white rounded font-bold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <span>Enregistrement du paiement...</span>
                  ) : (
                    <span>Valider et Générer le Reçu N°</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale de Confirmation & Reçu */}
      {createdPaymentResult && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-line rounded-lg max-w-lg w-full p-6 shadow-xl space-y-5">
            <div className="text-center space-y-2 border-b border-line pb-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center text-xl font-bold">
                ✓
              </div>
              <h3 className="font-display text-xl font-bold text-ink">
                Paiement Enregistré avec Succès !
              </h3>
              <p className="text-xs text-slate font-mono">
                Reçu N° {createdPaymentResult.payment.receipt_number}
              </p>
            </div>

            {createdPaymentResult.activatedNow && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded text-xs font-bold text-center">
                🎉 Félicitations ! L'inscription de cet élève a été intégralement couverte. Son statut a été automatiquement passé à **ACTIF / INSCRIT**.
              </div>
            )}

            <div className="p-4 bg-paper rounded border border-line text-xs space-y-2 font-medium">
              <div className="flex justify-between">
                <span className="text-slate">Élève :</span>
                <span className="font-bold text-ink">
                  {selectedStudent?.last_name.toUpperCase()} {selectedStudent?.first_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate">Montant versé :</span>
                <span className="font-bold text-ink">
                  {formatAmount(Number(createdPaymentResult.payment.amount))} FCFA
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate">Mode de règlement :</span>
                <span className="font-semibold text-ink uppercase">
                  {createdPaymentResult.payment.method}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate">Répartition :</span>
                <span className="font-semibold text-emerald-800">
                  {createdPaymentResult.payment.tranche_ciblee}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => setCreatedPaymentResult(null)}
                className="flex-1 py-2.5 bg-ink text-white font-bold rounded text-xs hover:bg-opacity-90 transition text-center"
              >
                Nouveau versement
              </button>
              <button
                onClick={() => {
                  setCreatedPaymentResult(null);
                  navigate(`/students/${selectedStudentId}`);
                }}
                className="flex-1 py-2.5 bg-paper text-ink font-bold border border-line rounded text-xs hover:bg-paper-dark transition text-center"
              >
                Voir fiche élève
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentEntryPage;
