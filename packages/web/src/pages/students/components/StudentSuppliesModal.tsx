import React, { useEffect, useState } from "react";
import {
  StudentRecord,
  ClassRecord,
  StudentSupplyItem,
  getStudentSupplies,
  setStudentSupplyStatus,
} from "@fanion/shared";
import {
  CloseIcon,
  PackageIcon,
  CheckIcon,
  SpinnerIcon,
  AlertTriangleIcon,
} from "../../../components/ui/Icons";

interface StudentSuppliesModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentRecord | null;
  studentClass?: ClassRecord | null;
  onUpdateSummary?: () => void;
}

export const StudentSuppliesModal: React.FC<StudentSuppliesModalProps> = ({
  isOpen,
  onClose,
  student,
  studentClass,
  onUpdateSummary,
}) => {
  const [supplies, setSupplies] = useState<StudentSupplyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingReqId, setUpdatingReqId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && student && studentClass) {
      loadSupplies();
    } else {
      setSupplies([]);
      setError(null);
    }
  }, [isOpen, student, studentClass]);

  const loadSupplies = async () => {
    if (!student || !studentClass) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getStudentSupplies(
        student.id,
        studentClass.division_id,
        studentClass.school_year_id
      );
      setSupplies(data);
    } catch (err: any) {
      console.error("Erreur getStudentSupplies:", err);
      setError(err.message || "Impossible de charger les fournitures.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (item: StudentSupplyItem) => {
    if (!student) return;
    const nextStatus: "donne" | "manquant" =
      item.status === "donne" ? "manquant" : "donne";

    // Mise à jour optimiste immédiate dans l'UI
    setSupplies((prev) =>
      prev.map((s) =>
        s.requirement_id === item.requirement_id ? { ...s, status: nextStatus } : s
      )
    );

    setUpdatingReqId(item.requirement_id);
    try {
      await setStudentSupplyStatus(student.id, item.requirement_id, nextStatus);
      if (onUpdateSummary) {
        onUpdateSummary();
      }
    } catch (err: any) {
      console.error("Erreur maj statut fourniture:", err);
      // Rollback en cas d'erreur
      setSupplies((prev) =>
        prev.map((s) =>
          s.requirement_id === item.requirement_id ? { ...s, status: item.status } : s
        )
      );
      setError("Échec de l'enregistrement de la fourniture.");
    } finally {
      setUpdatingReqId(null);
    }
  };

  if (!isOpen || !student) return null;

  const total = supplies.length;
  const donneCount = supplies.filter((s) => s.status === "donne").length;
  const percentage = total > 0 ? Math.round((donneCount / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* En-tête */}
        <div className="p-5 border-b border-slate-200 flex items-start justify-between bg-slate-50/70">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0 mt-0.5">
              <PackageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Fournitures : {student.first_name} {student.last_name.toUpperCase()}
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Matricule : <span className="font-semibold text-slate-700">{student.matricule || "—"}</span>
                {studentClass && (
                  <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-700 font-sans text-[11px]">
                    {studentClass.name}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Barre de progression */}
        <div className="px-5 py-3 bg-white border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-slate-700">Fournitures apportées</span>
              <span className="text-indigo-600 font-mono">
                {donneCount} / {total} ({percentage}%)
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  donneCount === total && total > 0
                    ? "bg-emerald-500"
                    : donneCount > 0
                    ? "bg-indigo-500"
                    : "bg-slate-300"
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Corps - Liste des fournitures */}
        <div className="p-5 overflow-y-auto flex-1 space-y-2">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium">
              <AlertTriangleIcon className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center">
              <div className="flex justify-center mb-2">
                <SpinnerIcon className="w-6 h-6 text-indigo-600 animate-spin" />
              </div>
              <p className="text-xs text-slate-500">Chargement des fournitures de la classe...</p>
            </div>
          ) : total === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <PackageIcon className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-700">
                Aucune fourniture configurée pour cette division
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Configurez la liste des fournitures requises dans le menu <strong>Paramètres &gt; Fournitures Scolaires</strong>.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {supplies.map((item) => {
                const isDonne = item.status === "donne";
                const isUpdating = updatingReqId === item.requirement_id;

                return (
                  <div
                    key={item.requirement_id}
                    onClick={() => !isUpdating && handleToggle(item)}
                    className={`flex items-center justify-between p-3.5 transition-colors cursor-pointer select-none ${
                      isDonne
                        ? "bg-emerald-50/40 hover:bg-emerald-50/70"
                        : "bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Checkbox personnalisée stylisée */}
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                          isDonne
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isUpdating ? (
                          <SpinnerIcon className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                        ) : isDonne ? (
                          <CheckIcon className="w-3.5 h-3.5" />
                        ) : null}
                      </div>

                      <span
                        className={`text-xs font-medium ${
                          isDonne ? "text-slate-900 font-semibold" : "text-slate-700"
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>

                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                        isDonne
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      {isDonne ? "Donné" : "Manquant"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pied de page */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Sauvegarde immédiate au clic</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-lg transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
