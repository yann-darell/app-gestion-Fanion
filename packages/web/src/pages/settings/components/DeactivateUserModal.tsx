export interface DeactivatableUser {
  full_name: string;
  email?: string | null;
}

interface DeactivateUserModalProps {
  isOpen: boolean;
  teacher: DeactivatableUser | null;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}

export const DeactivateUserModal: React.FC<DeactivateUserModalProps> = ({
  isOpen,
  teacher,
  onClose,
  onConfirm,
  isSubmitting,
}) => {
  if (!isOpen || !teacher) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
        <div className="flex items-center gap-3 text-rose-600 mb-4">
          <div className="p-2.5 bg-rose-100 rounded-full">
            <span className="text-xl">⚠️</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900">Désactiver cet enseignant ?</h3>
        </div>

        <p className="text-sm text-slate-600 mb-4 leading-relaxed">
          Voulez-vous vraiment désactiver <strong className="text-slate-900">{teacher.full_name}</strong> ({teacher.email || "sans email"}) ?
        </p>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 mb-6 font-medium">
          ⚡ <strong>Attention :</strong> Sa session en cours sera immédiatement interrompue et ses accès au système de saisie seront immédiatement coupés.
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? "Désactivation..." : "Confirmer la désactivation"}
          </button>
        </div>
      </div>
    </div>
  );
};
