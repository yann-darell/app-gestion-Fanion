import React, { useState, useEffect } from "react";
import {
  getStudentFeeOverride,
  upsertStudentFeeOverride,
  deleteStudentFeeOverride,
  getFeeSchedule,
  StudentFeeOverride,
  FeeSchedule,
} from "@fanion/shared";
import { CloseIcon } from "../../../components/ui/Icons";

interface StudentFeeOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  classId: string;
  schoolYearId: string;
  onSaved: () => void;
}

export const StudentFeeOverrideModal: React.FC<StudentFeeOverrideModalProps> = ({
  isOpen,
  onClose,
  studentId,
  studentName,
  classId,
  schoolYearId,
  onSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feeSchedule, setFeeSchedule] = useState<FeeSchedule | null>(null);
  const [currentOverride, setCurrentOverride] = useState<StudentFeeOverride | null>(null);
  const [amountOverride, setAmountOverride] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !studentId || !schoolYearId) return;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [sched, over] = await Promise.all([
          getFeeSchedule(classId, schoolYearId),
          getStudentFeeOverride(studentId, schoolYearId),
        ]);
        setFeeSchedule(sched);
        setCurrentOverride(over);
        if (over) {
          setAmountOverride(String(over.total_amount_override));
          setReason(over.reason || "");
        } else if (sched) {
          setAmountOverride(String(sched.total_amount));
          setReason("");
        }
      } catch (err: any) {
        setError(err.message || "Erreur lors du chargement du tarif.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [isOpen, studentId, classId, schoolYearId]);

  if (!isOpen) return null;

  const standardTuition = feeSchedule ? Number(feeSchedule.total_amount || 0) : 0;
  const registrationFee = feeSchedule ? Number(feeSchedule.registration_fee || 0) : 0;
  const parsedOverride = parseFloat(amountOverride) || 0;
  const discountAmount = Math.max(0, standardTuition - parsedOverride);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const val = parseFloat(amountOverride);
    if (isNaN(val) || val < 0) {
      setError("Le montant de la scolarité doit être un nombre positif ou nul.");
      return;
    }

    try {
      setSaving(true);
      await upsertStudentFeeOverride({
        student_id: studentId,
        school_year_id: schoolYearId,
        total_amount_override: val,
        reason: reason.trim() || undefined,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'enregistrement de la réduction.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetToStandard = async () => {
    if (!confirm("Voulez-vous réinitialiser au tarif standard de la classe (supprimer la bourse/réduction) ?")) {
      return;
    }
    setError(null);
    try {
      setSaving(true);
      await deleteStudentFeeOverride(studentId, schoolYearId);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Erreur lors de la suppression de la réduction.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-line max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-paper border-b border-line flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-lg text-ink">Bourse & Réduction Scolarité (F5)</h3>
            <p className="text-xs text-slate mt-0.5">Élève : <strong className="text-ink">{studentName}</strong></p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate hover:text-ink hover:bg-slate/10 transition cursor-pointer"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center text-xs text-slate italic">
              Chargement des paramètres financiers…
            </div>
          ) : (
            <>
              {/* Rappel Règle Métier & Frais Inscription */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs space-y-1.5 text-blue-900">
                <div className="font-bold flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Règle d'or financière (CONTEXTE §6.3)</span>
                </div>
                <p className="text-[11px] leading-relaxed text-blue-800">
                  La réduction ou bourse s'applique <strong>exclusivement à la scolarité</strong>. Les frais
                  d'inscription standard (<strong>{registrationFee.toLocaleString("fr-FR")} FCFA</strong>) restent
                  intégralement dus et ne sont jamais modifiés.
                </p>
              </div>

              {/* Récapitulatif du tarif standard de la classe */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-paper rounded-lg border border-line text-xs">
                <div>
                  <span className="text-slate block text-[10px] uppercase font-semibold">Frais d'inscription :</span>
                  <span className="font-bold text-ink font-mono">{registrationFee.toLocaleString("fr-FR")} FCFA</span>
                </div>
                <div>
                  <span className="text-slate block text-[10px] uppercase font-semibold">Scolarité standard :</span>
                  <span className="font-bold text-ink font-mono">{standardTuition.toLocaleString("fr-FR")} FCFA</span>
                </div>
              </div>

              {/* Champ Nouveau Montant de Scolarité */}
              <div>
                <label className="block text-xs font-bold text-ink uppercase mb-1">
                  Nouveau montant de scolarité personnalisée (FCFA) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="500"
                    required
                    value={amountOverride}
                    onChange={(e) => setAmountOverride(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg text-ink font-mono font-bold text-base focus:outline-none focus:ring-2 focus:ring-ink/20"
                    placeholder="Ex: 150000 (0 pour gratuité scolarité)"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate font-bold">FCFA</span>
                </div>
                {standardTuition > 0 && (
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="text-slate">
                      Tarif normal : {standardTuition.toLocaleString("fr-FR")} FCFA
                    </span>
                    {discountAmount > 0 && (
                      <span className="font-bold text-emerald-700">
                        Bourse / Déduction : -{discountAmount.toLocaleString("fr-FR")} FCFA (
                        {Math.round((discountAmount / standardTuition) * 100)}%)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Motif / Justification */}
              <div>
                <label className="block text-xs font-semibold text-slate uppercase mb-1">
                  Motif / Justification de la bourse
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-line rounded-lg text-xs text-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
                  placeholder="Ex: Enfant d'enseignant, bourse d'excellence, cas social, etc."
                />
              </div>

              {/* Total Élève Révisé */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs">
                <div>
                  <span className="text-emerald-900 font-bold block">Total annuel exigé de l'élève :</span>
                  <span className="text-emerald-700 text-[10px]">
                    {registrationFee.toLocaleString("fr-FR")} (inscr.) + {parsedOverride.toLocaleString("fr-FR")} (scol.)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold text-emerald-900 font-mono">
                    {(registrationFee + parsedOverride).toLocaleString("fr-FR")} FCFA
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-line flex items-center justify-between gap-3">
            {currentOverride ? (
              <button
                type="button"
                onClick={handleResetToStandard}
                disabled={saving || loading}
                className="px-3 py-2 border border-signal-red text-signal-red hover:bg-red-50 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Rétablir tarif standard
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 border border-line rounded-lg text-xs font-semibold text-slate hover:text-ink hover:bg-paper transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving || loading}
                className="px-4 py-2 bg-ink text-white rounded-lg text-xs font-bold hover:bg-opacity-90 transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {saving ? "Enregistrement…" : "Valider la réduction"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudentFeeOverrideModal;
