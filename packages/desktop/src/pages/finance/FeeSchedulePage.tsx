import React, { useEffect, useState, useCallback } from "react";
import {
  listClasses,
  listSchoolYears,
  getActiveSchoolYear,
  ClassRecord,
  SchoolYearRecord,
  useSelectionPersistence,
  getFeeSchedule,
  upsertFeeSchedule,
  getClassPaymentsCount,
  Installment,
} from "@fanion/shared";

interface FeeSchedulePageProps {
  userRole?: string;
}

export const FeeSchedulePage: React.FC<FeeSchedulePageProps> = ({ userRole }) => {
  const [selectedDivision, setSelectedDivision] = useSelectionPersistence("division", "college");
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [selectedClassId, setSelectedClassId] = useSelectionPersistence("classId", "");

  const [schoolYears, setSchoolYears] = useState<SchoolYearRecord[]>([]);
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useSelectionPersistence("schoolYearId", "");

  // Form State
  const [registrationFee, setRegistrationFee] = useState<number>(15000);
  const [totalAmount, setTotalAmount] = useState<number>(100000);
  const [installments, setInstallments] = useState<Installment[]>([
    { label: "Tranche 1", amount: 50000, due_date: "" },
    { label: "Tranche 2", amount: 30000, due_date: "" },
    { label: "Tranche 3", amount: 20000, due_date: "" },
  ]);

  const [existingPaymentsCount, setExistingPaymentsCount] = useState<number>(0);
  const [isExistingSchedule, setIsExistingSchedule] = useState<boolean>(false);

  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [showMismatchModal, setShowMismatchModal] = useState(false);

  const isAuthorized = userRole === "principal" || userRole === "directeur_etudes";

  // Formatter monétaire
  const formatAmount = (amt: number) =>
    Math.round(amt || 0)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  // 1. Initialisation des classes et années scolaires
  useEffect(() => {
    const fetchInit = async () => {
      setLoadingInit(true);
      setError(null);
      try {
        const [classData, yearData, activeYear] = await Promise.all([
          listClasses(selectedDivision),
          listSchoolYears(),
          getActiveSchoolYear(),
        ]);
        setClasses(classData);
        setSchoolYears(yearData);

        if (!selectedSchoolYearId && activeYear) {
          setSelectedSchoolYearId(activeYear.id);
        } else if (!selectedSchoolYearId && yearData.length > 0) {
          setSelectedSchoolYearId(yearData[0].id);
        }

        if (classData.length > 0 && (!selectedClassId || !classData.some((c) => c.id === selectedClassId))) {
          setSelectedClassId(classData[0].id);
        }
      } catch (err: any) {
        console.error("Erreur d'initialisation FeeSchedulePage desktop:", err);
        setError("Impossible de charger les classes et années scolaires.");
      } finally {
        setLoadingInit(false);
      }
    };
    fetchInit();
  }, [selectedDivision]);

  // 2. Chargement de la grille tarifaire et du nombre de paiements
  const loadScheduleData = useCallback(async () => {
    if (!selectedClassId || !selectedSchoolYearId) return;
    setLoadingData(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const [schedule, pCount] = await Promise.all([
        getFeeSchedule(selectedClassId, selectedSchoolYearId),
        getClassPaymentsCount(selectedClassId, selectedSchoolYearId),
      ]);

      setExistingPaymentsCount(pCount);

      if (schedule) {
        setIsExistingSchedule(true);
        setRegistrationFee(Number(schedule.registration_fee) || 0);
        setTotalAmount(Number(schedule.total_amount) || 0);
        setInstallments(
          Array.isArray(schedule.installments_json) && schedule.installments_json.length > 0
            ? schedule.installments_json.map((inst) => ({
                label: inst.label || "Tranche",
                amount: Number(inst.amount) || 0,
                due_date: inst.due_date || "",
              }))
            : [{ label: "Tranche 1", amount: Number(schedule.total_amount) || 0, due_date: "" }]
        );
      } else {
        setIsExistingSchedule(false);
        setRegistrationFee(15000);
        setTotalAmount(100000);
        setInstallments([
          { label: "Tranche 1", amount: 50000, due_date: "" },
          { label: "Tranche 2", amount: 30000, due_date: "" },
          { label: "Tranche 3", amount: 20000, due_date: "" },
        ]);
      }
    } catch (err: any) {
      console.error("Erreur lors du chargement du tarif de classe desktop:", err);
      setError("Impossible de charger le tarif de la classe sélectionnée.");
    } finally {
      setLoadingData(false);
    }
  }, [selectedClassId, selectedSchoolYearId]);

  useEffect(() => {
    if (selectedClassId && selectedSchoolYearId) {
      loadScheduleData();
    }
  }, [selectedClassId, selectedSchoolYearId, loadScheduleData]);

  // Gestion dynamique des tranches
  const handleAddInstallment = () => {
    const nextNum = installments.length + 1;
    setInstallments((prev) => [...prev, { label: `Tranche ${nextNum}`, amount: 0, due_date: "" }]);
  };

  const handleRemoveInstallment = (index: number) => {
    if (installments.length <= 1) return;
    setInstallments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateInstallment = (index: number, field: keyof Installment, value: any) => {
    setInstallments((prev) =>
      prev.map((inst, i) => (i === index ? { ...inst, [field]: field === "amount" ? Number(value) || 0 : value } : inst))
    );
  };

  // Calculs d'écart
  const sumInstallments = installments.reduce((sum, inst) => sum + (Number(inst.amount) || 0), 0);
  const diffAmount = sumInstallments - totalAmount;

  // Enregistrement effectif
  const executeSave = async () => {
    if (!selectedClassId || !selectedSchoolYearId) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await upsertFeeSchedule({
        class_id: selectedClassId,
        school_year_id: selectedSchoolYearId,
        registration_fee: Number(registrationFee) || 0,
        total_amount: Number(totalAmount) || 0,
        installments_json: installments.map((inst) => ({
          label: inst.label.trim() || "Tranche",
          amount: Number(inst.amount) || 0,
          due_date: inst.due_date || undefined,
        })),
      });

      setSuccessMsg("Grille tarifaire enregistrée avec succès.");
      setIsExistingSchedule(true);
      setShowMismatchModal(false);
    } catch (err: any) {
      console.error("Erreur lors de la sauvegarde du tarif:", err);
      setError(err.message || "Erreur lors de l'enregistrement de la grille tarifaire.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (diffAmount !== 0) {
      setShowMismatchModal(true);
    } else {
      executeSave();
    }
  };

  if (!isAuthorized) {
    return (
      <div className="p-6">
        <h1 className="font-display text-2xl font-bold text-ink mb-4">Tarifs des Classes</h1>
        <div className="p-4 bg-rose-50 border border-rose-200 rounded text-rose-700 font-medium text-sm">
          Accès restreint. Seuls le Principal et le Directeur des Études peuvent configurer les tarifs de scolarité.
        </div>
      </div>
    );
  }

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Tarifs des Classes</h1>
        <p className="text-xs text-slate mt-1">
          Configuration des frais d'inscription et de l'échéancier des tranches de scolarité.
        </p>
      </div>

      {/* Zone de sélection */}
      <div className="bg-white p-4 border border-line rounded shadow-sm flex flex-col sm:flex-row sm:items-end gap-4">
        {/* Division */}
        <div>
          <label className="block text-xs font-semibold text-slate uppercase mb-1">Division</label>
          <div className="flex gap-1 p-1 bg-paper border border-line rounded">
            {["college", "primaire"].map((div) => (
              <button
                key={div}
                type="button"
                onClick={() => {
                  setSelectedDivision(div);
                  setSelectedClassId("");
                }}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded text-xs font-medium transition ${
                  selectedDivision === div ? "bg-ink text-white font-semibold" : "text-slate hover:bg-line/40"
                }`}
              >
                {div === "college" ? "Collège" : "Primaire"}
              </button>
            ))}
          </div>
        </div>

        {/* Classe */}
        <div className="flex-1 min-w-[180px]">
          <label htmlFor="select-class-fee-desktop" className="block text-xs font-semibold text-slate uppercase mb-1">
            Classe
          </label>
          <select
            id="select-class-fee-desktop"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-ink"
            disabled={loadingInit}
          >
            <option value="">— Sélectionner une classe —</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name} ({cls.level})
              </option>
            ))}
          </select>
        </div>

        {/* Année Scolaire */}
        <div className="min-w-[180px]">
          <label htmlFor="select-year-fee-desktop" className="block text-xs font-semibold text-slate uppercase mb-1">
            Année Scolaire
          </label>
          <select
            id="select-year-fee-desktop"
            value={selectedSchoolYearId}
            onChange={(e) => setSelectedSchoolYearId(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-ink font-medium"
            disabled={loadingInit}
          >
            {schoolYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label} {y.is_active ? "(Active)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded text-sm text-rose-700 font-medium">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-800 font-semibold flex items-center gap-2">
          <span>✓</span> {successMsg}
        </div>
      )}

      {!selectedClassId || !selectedSchoolYearId ? (
        <div className="py-12 border border-dashed border-line rounded bg-white text-center">
          <p className="text-sm text-slate font-medium">Veuillez sélectionner une classe pour afficher son tarif.</p>
        </div>
      ) : loadingData ? (
        <div className="py-12 text-center text-sm font-medium text-slate">Chargement du tarif de classe...</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Information d'existence de paiements */}
          {existingPaymentsCount > 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900 leading-relaxed flex items-start gap-2.5">
              <span className="text-blue-600 font-bold text-base leading-none">ℹ</span>
              <div>
                <span className="font-semibold">
                  {existingPaymentsCount} paiement(s) ont déjà été enregistrés pour cette classe et cette année.
                </span>
                <p className="mt-0.5 text-blue-800">
                  La modification du tarif n'altérera pas les reçus et paiements passés, mais les nouveaux calculs
                  d'allocation utiliseront la nouvelle grille.
                </p>
              </div>
            </div>
          )}

          {/* Formulaire Tarif Général */}
          <div className="bg-white border border-line rounded p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="font-display font-bold text-lg text-ink">
                Tarif Général — {selectedClass?.name || "Classe"}
              </h2>
              {isExistingSchedule ? (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Tarif Configuré (Édition)
                </span>
              ) : (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded bg-amber-100 text-amber-800">
                  Nouveau Tarif
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate uppercase mb-1">
                  Frais d'inscription (FCFA)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={registrationFee}
                  onChange={(e) => setRegistrationFee(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-line rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-ink font-mono font-medium"
                  required
                />
                <span className="text-[11px] text-slate mt-1 block">
                  Tarif fixe de classe (non modifiable individuellement par élève).
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate uppercase mb-1">
                  Scolarité totale (FCFA)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-line rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-ink font-mono font-bold text-ink"
                  required
                />
                <span className="text-[11px] text-slate mt-1 block">
                  Somme globale due au titre de la scolarité annuelle.
                </span>
              </div>
            </div>
          </div>

          {/* Échéancier Dynamique des Tranches */}
          <div className="bg-white border border-line rounded p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-display font-bold text-base text-ink">Échéancier des Tranches</h3>
                <p className="text-xs text-slate mt-0.5">Répartition du montant de scolarité globale par tranches.</p>
              </div>
              <button
                type="button"
                onClick={handleAddInstallment}
                className="px-3 py-1.5 bg-paper hover:bg-line/40 border border-line text-ink rounded text-xs font-semibold transition flex items-center gap-1.5"
              >
                <span>+</span> Ajouter une tranche
              </button>
            </div>

            {/* Liste des tranches */}
            <div className="space-y-3">
              {installments.map((inst, index) => (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-paper/60 border border-line rounded"
                >
                  <div className="sm:w-1/3">
                    <label className="block text-[10px] font-semibold text-slate uppercase mb-1 sm:hidden">
                      Libellé Tranche
                    </label>
                    <input
                      type="text"
                      value={inst.label}
                      onChange={(e) => handleUpdateInstallment(index, "label", e.target.value)}
                      placeholder={`Tranche ${index + 1}`}
                      className="w-full px-3 py-1.5 border border-line rounded text-xs bg-white font-medium focus:outline-none focus:ring-1 focus:ring-ink"
                      required
                    />
                  </div>

                  <div className="sm:w-1/3">
                    <label className="block text-[10px] font-semibold text-slate uppercase mb-1 sm:hidden">
                      Montant (FCFA)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        value={inst.amount}
                        onChange={(e) => handleUpdateInstallment(index, "amount", e.target.value)}
                        className="w-full px-3 py-1.5 border border-line rounded text-xs bg-white font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-ink"
                        required
                      />
                      <span className="absolute right-2 top-1.5 text-[10px] font-semibold text-slate">FCFA</span>
                    </div>
                  </div>

                  <div className="sm:w-1/3">
                    <label className="block text-[10px] font-semibold text-slate uppercase mb-1 sm:hidden">
                      Date d'échéance (optionnelle)
                    </label>
                    <input
                      type="date"
                      value={inst.due_date || ""}
                      onChange={(e) => handleUpdateInstallment(index, "due_date", e.target.value)}
                      className="w-full px-3 py-1.5 border border-line rounded text-xs bg-white text-slate focus:outline-none focus:ring-1 focus:ring-ink"
                    />
                  </div>

                  <div className="flex justify-end sm:justify-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveInstallment(index)}
                      disabled={installments.length <= 1}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded disabled:opacity-30 disabled:hover:bg-transparent transition"
                      title="Supprimer la tranche"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Bannière de calcul et d'écart */}
            {diffAmount === 0 ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900 font-semibold flex items-center justify-between">
                <span>🟢 Échéancier équilibré : La somme des tranches correspond exactement à la scolarité totale.</span>
                <span className="font-mono">{formatAmount(sumInstallments)} FCFA</span>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded text-xs text-amber-900 font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span>
                  ⚠️ Attention : La somme des tranches ({formatAmount(sumInstallments)} FCFA) diffère de la scolarité
                  totale ({formatAmount(totalAmount)} FCFA).
                </span>
                <span className="font-mono text-amber-950 font-bold whitespace-nowrap">
                  Écart : {diffAmount > 0 ? `+${formatAmount(diffAmount)}` : formatAmount(diffAmount)} FCFA
                </span>
              </div>
            )}
          </div>

          {/* Bouton de Soumission */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-ink hover:bg-opacity-90 text-white rounded text-sm font-semibold transition disabled:opacity-50 shadow-sm"
            >
              {saving ? "Enregistrement en cours..." : "Enregistrer la grille tarifaire"}
            </button>
          </div>
        </form>
      )}

      {/* Modal de Confirmation en cas d'écart */}
      {showMismatchModal && (
        <div
          className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowMismatchModal(false); }}
        >
          <div className="bg-white border border-line rounded-t-2xl sm:rounded-lg w-full sm:max-w-md shadow-xl flex flex-col max-h-[90vh] overflow-y-auto">
            {/* Header fixe */}
            <div className="flex items-center gap-3 p-6 pb-4 border-b border-line">
              <span className="text-2xl flex-shrink-0">⚠️</span>
              <h3 className="font-display font-bold text-lg text-ink">Écart de montant détecté</h3>
            </div>

            {/* Corps */}
            <div className="p-6 space-y-3 flex-1">
              <p className="text-sm text-slate leading-relaxed">
                La somme des tranches (<strong className="text-ink">{formatAmount(sumInstallments)} FCFA</strong>) ne
                correspond pas à la scolarité totale (<strong className="text-ink">{formatAmount(totalAmount)} FCFA</strong>).
              </p>
              <p className="text-sm font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                Écart : {diffAmount > 0 ? "+" : ""}{formatAmount(diffAmount)} FCFA
              </p>
              <p className="text-xs text-slate">
                Voulez-vous tout de même enregistrer cette grille tarifaire ?
              </p>
            </div>

            {/* Boutons — toujours visibles, collés en bas */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 p-6 pt-4 border-t border-line bg-white rounded-b-lg">
              <button
                type="button"
                onClick={() => setShowMismatchModal(false)}
                className="w-full sm:w-auto px-5 py-2.5 border border-line text-slate hover:bg-paper rounded text-sm font-semibold transition"
              >
                Annuler et corriger
              </button>
              <button
                type="button"
                onClick={executeSave}
                disabled={saving}
                className="w-full sm:w-auto px-5 py-2.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded text-sm font-semibold transition disabled:opacity-50 shadow-sm"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Enregistrement...</span>
                  </span>
                ) : (
                  <span>Enregistrer quand même</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeeSchedulePage;
