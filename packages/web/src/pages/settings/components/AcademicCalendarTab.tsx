import React, { useState } from "react";
import { TermSetting, updateSequenceSettings, updateTermDates } from "@fanion/shared";

interface AcademicCalendarTabProps {
  terms: TermSetting[];
  onRefresh: () => void;
}

export const AcademicCalendarTab: React.FC<AcademicCalendarTabProps> = ({ terms, onRefresh }) => {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleTermDateChange = async (termId: string, startDate: string, endDate: string) => {
    setSavingId(`term-${termId}`);
    setToast(null);
    try {
      await updateTermDates(termId, startDate || null, endDate || null);
      setToast({ type: "success", message: "Dates du trimestre mises à jour !" });
      onRefresh();
    } catch (err: any) {
      setToast({ type: "error", message: err.message || "Erreur de mise à jour." });
    } finally {
      setSavingId(null);
    }
  };

  const handleSequenceToggleLock = async (seqId: string, currentLock: boolean) => {
    setSavingId(`seq-lock-${seqId}`);
    setToast(null);
    try {
      await updateSequenceSettings(seqId, { is_locked: !currentLock });
      setToast({
        type: "success",
        message: !currentLock
          ? "Séquence verrouillée avec succès (accès écriture bloqué pour les enseignants)."
          : "Séquence déverrouillée.",
      });
      onRefresh();
    } catch (err: any) {
      setToast({ type: "error", message: err.message || "Erreur lors du verrouillage." });
    } finally {
      setSavingId(null);
    }
  };

  const handleSequenceDateChange = async (seqId: string, startDate: string, endDate: string) => {
    setSavingId(`seq-date-${seqId}`);
    setToast(null);
    try {
      await updateSequenceSettings(seqId, { start_date: startDate || null, end_date: endDate || null });
      setToast({ type: "success", message: "Dates de la séquence mises à jour !" });
      onRefresh();
    } catch (err: any) {
      setToast({ type: "error", message: err.message || "Erreur lors de la mise à jour des dates." });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span>📅</span> Calendrier Académique & Verrouillage des Séquences
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Définissez les dates d'ouverture/fermeture et verrouillez les séquences pour empêcher toute modification de notes par les enseignants.
            </p>
          </div>
        </div>

        {toast && (
          <div
            className={`mb-4 p-4 rounded-lg text-sm font-medium ${
              toast.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            {toast.message}
          </div>
        )}

        <div className="space-y-6">
          {terms.map((term) => (
            <div key={term.id} className="border border-slate-200 rounded-lg p-5 bg-slate-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <h3 className="text-base font-bold text-indigo-900">{term.name}</h3>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Du:</span>
                    <input
                      type="date"
                      defaultValue={term.start_date || ""}
                      onBlur={(e) => handleTermDateChange(term.id, e.target.value, term.end_date || "")}
                      className="px-2 py-1 border border-slate-300 rounded bg-white text-xs text-slate-700"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Au:</span>
                    <input
                      type="date"
                      defaultValue={term.end_date || ""}
                      onBlur={(e) => handleTermDateChange(term.id, term.start_date || "", e.target.value)}
                      className="px-2 py-1 border border-slate-300 rounded bg-white text-xs text-slate-700"
                    />
                  </div>
                </div>
              </div>

              {/* Séquences associées */}
              <div className="mt-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Séquences rattachées :</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {term.sequences.map((seq) => (
                    <div
                      key={seq.id}
                      className={`p-4 rounded-lg border transition-all ${
                        seq.is_locked ? "bg-amber-50/80 border-amber-300" : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-sm text-slate-800">{seq.name}</span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              seq.is_locked ? "bg-amber-200 text-amber-900" : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {seq.is_locked ? "🔒 Verrouillée" : "🔓 Ouverte"}
                          </span>
                          <button
                            onClick={() => handleSequenceToggleLock(seq.id, seq.is_locked)}
                            disabled={savingId === `seq-lock-${seq.id}`}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md shadow-xs transition-colors ${
                              seq.is_locked
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                : "bg-amber-600 hover:bg-amber-700 text-white"
                            }`}
                          >
                            {seq.is_locked ? "Déverrouiller" : "Verrouiller"}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-slate-500 block mb-1">Début:</span>
                          <input
                            type="date"
                            defaultValue={seq.start_date || ""}
                            onBlur={(e) => handleSequenceDateChange(seq.id, e.target.value, seq.end_date || "")}
                            className="w-full px-2 py-1 border border-slate-300 rounded bg-white text-slate-700"
                          />
                        </div>
                        <div>
                          <span className="text-slate-500 block mb-1">Fin:</span>
                          <input
                            type="date"
                            defaultValue={seq.end_date || ""}
                            onBlur={(e) => handleSequenceDateChange(seq.id, seq.start_date || "", e.target.value)}
                            className="w-full px-2 py-1 border border-slate-300 rounded bg-white text-slate-700"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
