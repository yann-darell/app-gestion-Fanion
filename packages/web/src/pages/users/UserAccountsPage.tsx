import React, { useState, useEffect } from "react";
import { inviteTeacher, listUsers, UserProfile } from "@fanion/shared";

interface UserAccountsPageProps {
  userRole?: string;
}

export const UserAccountsPage: React.FC<UserAccountsPageProps> = ({ userRole }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);

  // Form State
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const isAuthorized = userRole === "principal" || userRole === "directeur_etudes";

  const fetchUsersList = async () => {
    try {
      setLoadingUsers(true);
      setUserError(null);
      const data = await listUsers();
      setUsers(data);
    } catch (err: any) {
      console.error("Erreur chargement utilisateurs:", err);
      setUserError(err?.message || "Impossible de charger la liste des comptes.");
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchUsersList();
    }
  }, [isAuthorized]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !fullName) return;

    try {
      setInviting(true);
      setInviteError(null);
      setInviteSuccess(null);

      const response = await inviteTeacher(email, fullName);
      setInviteSuccess(
        response.message || `L'invitation a été envoyée avec succès à ${email}.`
      );

      // Reset form
      setEmail("");
      setFullName("");

      // Refresh list
      await fetchUsersList();
    } catch (err: any) {
      console.error("Erreur invitation enseignant:", err);
      setInviteError(err?.message || "Échec de l'envoi de l'invitation.");
    } finally {
      setInviting(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <h1 className="font-display text-xl md:text-2xl font-bold text-ink mb-4">
          Gestion des Comptes Utilisateurs
        </h1>
        <div className="p-4 bg-signal-red/10 border border-signal-red/20 rounded text-signal-red text-sm font-medium">
          Accès restreint. Seuls le Principal et le Directeur des Études peuvent gérer les comptes utilisateurs.
        </div>
      </div>
    );
  }

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole = roleFilter === "all" ? true : u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "principal":
        return (
          <span className="px-2.5 py-1 rounded text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            Principal
          </span>
        );
      case "directeur_etudes":
        return (
          <span className="px-2.5 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            Dir. des Études
          </span>
        );
      case "enseignant":
        return (
          <span className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Enseignant
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded text-xs font-semibold bg-slate/10 text-slate">
            {role}
          </span>
        );
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-line flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h1 className="font-display text-xl md:text-2xl font-bold text-ink">
            Gestion des Comptes Utilisateurs
          </h1>
          <p className="text-xs md:text-sm text-slate mt-1">
            Invitez de nouveaux enseignants et visualisez l'ensemble des comptes de la plateforme.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-ink text-white rounded text-xs font-semibold uppercase tracking-wider">
            Lot D2bis
          </span>
        </div>
      </div>

      {/* Grid Invitation Form + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invitation Form Card */}
        <div className="lg:col-span-1 bg-white border border-line rounded p-5 shadow-sm h-fit">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-line">
            <svg
              className="w-5 h-5 text-ink"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
            <h2 className="font-display text-base font-bold text-ink">
              Inviter un Enseignant
            </h2>
          </div>

          {inviteError && (
            <div className="mb-4 p-3 bg-signal-red/10 border border-signal-red/20 rounded text-xs text-signal-red font-medium">
              {inviteError}
            </div>
          )}

          {inviteSuccess && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 font-medium">
              {inviteSuccess}
            </div>
          )}

          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate uppercase mb-1">
                Nom complet de l'enseignant *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: Alain MBIDA"
                className="w-full px-3 py-2 border border-line rounded text-sm bg-paper text-ink focus:outline-none focus:border-ink font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate uppercase mb-1">
                Adresse Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="enseignant@lefanion.com"
                className="w-full px-3 py-2 border border-line rounded text-sm bg-paper text-ink focus:outline-none focus:border-ink font-medium"
                required
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={inviting || !email || !fullName}
                className="w-full py-2.5 bg-ink hover:bg-opacity-90 text-white rounded text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {inviting ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>Envoi de l'invitation...</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    <span>Envoyer l'invitation</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate italic leading-tight text-center">
              Un email d'invitation sera envoyé automatiquement à l'enseignant pour lui permettre de configurer son mot de passe.
            </p>
          </form>
        </div>

        {/* Existing Accounts List */}
        <div className="lg:col-span-2 bg-white border border-line rounded p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-line">
            <div>
              <h2 className="font-display text-base font-bold text-ink">
                Comptes Enseignants & Staff ({filteredUsers.length})
              </h2>
              <p className="text-xs text-slate">
                Liste des comptes actifs et invités enregistrés.
              </p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-line rounded text-xs bg-white text-ink focus:outline-none focus:border-ink font-medium"
              >
                <option value="all">Tous les rôles</option>
                <option value="enseignant">Enseignants uniquement</option>
                <option value="principal">Principaux</option>
                <option value="directeur_etudes">Dir. des Études</option>
              </select>
            </div>
          </div>

          {/* Search bar */}
          <div className="mb-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par nom ou email..."
              className="w-full px-3 py-2 border border-line rounded text-sm bg-paper focus:outline-none focus:border-ink"
            />
          </div>

          {userError && (
            <div className="mb-4 p-3 bg-signal-red/10 border border-signal-red/20 rounded text-xs text-signal-red font-medium">
              {userError}
            </div>
          )}

          {loadingUsers ? (
            <div className="py-12 text-center text-sm font-medium text-slate">
              Chargement des utilisateurs...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 border border-dashed border-line rounded text-center">
              <p className="text-sm text-slate italic">
                Aucun compte trouvé correspondant aux critères.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden border border-line rounded">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-paper-dark border-b border-line text-xs font-semibold text-slate uppercase">
                    <tr>
                      <th className="px-4 py-3">Nom complet</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Rôle</th>
                      <th className="px-4 py-3 text-right">Créé le</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-paper-dark/30 transition">
                        <td className="px-4 py-3 text-sm font-semibold text-ink">
                          {u.full_name}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate">
                          {u.email || "— non renseigné —"}
                        </td>
                        <td className="px-4 py-3">{getRoleBadge(u.role)}</td>
                        <td className="px-4 py-3 text-xs text-slate text-right">
                          {new Date(u.created_at).toLocaleDateString("fr-FR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-line">
                {filteredUsers.map((u) => (
                  <div key={u.id} className="p-3.5 flex flex-col gap-1.5 bg-white">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-ink">{u.full_name}</span>
                      {getRoleBadge(u.role)}
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate font-mono">
                      <span>{u.email || "— email non disponible —"}</span>
                      <span className="text-[11px] font-sans">
                        {new Date(u.created_at).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserAccountsPage;
