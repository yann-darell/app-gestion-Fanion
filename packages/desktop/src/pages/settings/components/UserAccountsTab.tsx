import { UsersIcon } from "../../../components/ui/Icons";
import React, { useState } from "react";
import { TeacherAccount, toggleTeacherStatus } from "@fanion/shared";
import { DeactivateUserModal } from "./DeactivateUserModal";

interface UserAccountsTabProps {
  teachers: TeacherAccount[];
  onRefresh: () => void;
}

export const UserAccountsTab: React.FC<UserAccountsTabProps> = ({ teachers, onRefresh }) => {
  const [selectedTeacherForDeactivation, setSelectedTeacherForDeactivation] = useState<TeacherAccount | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleToggleClick = async (teacher: TeacherAccount) => {
    if (teacher.is_active) {
      // Pour désactiver : ouvrir la modale de confirmation
      setSelectedTeacherForDeactivation(teacher);
    } else {
      // Pour réactiver : exécution directe (action sécurisée)
      setSubmittingId(teacher.id);
      setToast(null);
      try {
        await toggleTeacherStatus(teacher.id, true);
        setToast({ type: "success", message: `Compte de ${teacher.full_name} réactivé avec succès.` });
        onRefresh();
      } catch (err: any) {
        setToast({ type: "error", message: err.message || "Erreur lors de la réactivation." });
      } finally {
        setSubmittingId(null);
      }
    }
  };

  const handleConfirmDeactivation = async () => {
    if (!selectedTeacherForDeactivation) return;
    const teacher = selectedTeacherForDeactivation;
    setSubmittingId(teacher.id);
    setToast(null);

    try {
      await toggleTeacherStatus(teacher.id, false);
      setToast({
        type: "success",
        message: `Compte de ${teacher.full_name} désactivé et session révoquée immédiatement.`,
      });
      setSelectedTeacherForDeactivation(null);
      onRefresh();
    } catch (err: any) {
      setToast({ type: "error", message: err.message || "Erreur lors de la désactivation." });
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-indigo-700" /> Gestion des Comptes Enseignants
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Activez ou désactivez les accès des enseignants. La désactivation coupe immédiatement toute session en cours.
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

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Enseignant</th>
              <th className="py-3 px-4">Email</th>
              <th className="py-3 px-4">Statut</th>
              <th className="py-3 px-4 text-right">Action / Accès</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {teachers.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-400">
                  Aucun enseignant enregistré dans le système.
                </td>
              </tr>
            ) : (
              teachers.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-medium text-slate-900">{t.full_name}</td>
                  <td className="py-3 px-4 text-slate-500">{t.email || "Non renseigné"}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        t.is_active ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${t.is_active ? "bg-emerald-500" : "bg-rose-500"}`} />
                      {t.is_active ? "Actif" : "Inactif / Bloqué"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleToggleClick(t)}
                      disabled={submittingId === t.id}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg shadow-xs transition-colors ${
                        t.is_active
                          ? "bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700 border border-slate-200"
                          : "bg-emerald-600 text-white hover:bg-emerald-700"
                      }`}
                    >
                      {submittingId === t.id
                        ? "Traitement..."
                        : t.is_active
                        ? "Désactiver le compte"
                        : "Réactiver le compte"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <DeactivateUserModal
        isOpen={selectedTeacherForDeactivation !== null}
        teacher={selectedTeacherForDeactivation}
        onClose={() => setSelectedTeacherForDeactivation(null)}
        onConfirm={handleConfirmDeactivation}
        isSubmitting={submittingId === selectedTeacherForDeactivation?.id}
      />
    </div>
  );
};
