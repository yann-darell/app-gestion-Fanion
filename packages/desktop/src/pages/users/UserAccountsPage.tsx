import { CloseIcon } from "../../components/ui/Icons";
import React, { useState, useEffect } from "react";
import { inviteTeacher, listUsers, updateUser, deleteUser, UserProfile } from "@fanion/shared";

interface UserAccountsPageProps {
  userRole?: string;
}

export const UserAccountsPage: React.FC<UserAccountsPageProps> = ({ userRole }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);

  // Form State (Invite)
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Edit Modal State
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("enseignant");
  const [editDivision, setEditDivision] = useState<string>("");
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Modal State
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isAuthorized = userRole === "principal" || userRole === "directeur_etudes";

  const fetchUsersList = async () => {
    try {
      setLoadingUsers(true);
      setUserError(null);
      const data = await listUsers();
      setUsers(data);
    } catch (err: any) {
      console.error("Erreur chargement utilisateurs desktop:", err);
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
      setGlobalSuccess(null);

      const response = await inviteTeacher(email, fullName);
      setGlobalSuccess(
        response.message || `L'invitation a été envoyée avec succès à ${email}.`
      );

      setEmail("");
      setFullName("");

      await fetchUsersList();
    } catch (err: any) {
      console.error("Erreur invitation enseignant desktop:", err);
      setInviteError(err?.message || "Échec de l'envoi de l'invitation.");
    } finally {
      setInviting(false);
    }
  };

  const openEditModal = (user: UserProfile) => {
    setEditingUser(user);
    setEditFullName(user.full_name);
    setEditEmail(user.email || "");
    setEditRole(user.role || "enseignant");
    setEditDivision(user.division_scope || "");
    setEditError(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editFullName) return;

    try {
      setUpdating(true);
      setEditError(null);

      await updateUser(editingUser.id, {
        full_name: editFullName,
        email: editEmail,
        role: editRole,
        division_scope: editDivision || null,
      });

      setGlobalSuccess(`Le compte de ${editFullName} a été mis à jour avec succès.`);
      setEditingUser(null);
      await fetchUsersList();
    } catch (err: any) {
      console.error("Erreur mise à jour utilisateur desktop:", err);
      setEditError(err?.message || "Échec de la mise à jour du compte.");
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;

    try {
      setDeleting(true);
      await deleteUser(deletingUser.id);
      setGlobalSuccess(`Le compte de ${deletingUser.full_name} a été supprimé.`);
      setDeletingUser(null);
      await fetchUsersList();
    } catch (err: any) {
      console.error("Erreur suppression utilisateur desktop:", err);
      setUserError(err?.message || "Échec de la suppression du compte.");
    } finally {
      setDeleting(false);
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
      <div className="pb-4 border-b border-line flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h1 className="font-display text-xl md:text-2xl font-bold text-ink">
            Gestion des Comptes Utilisateurs
          </h1>
          <p className="text-xs md:text-sm text-slate mt-1">
            Gérez les comptes enseignants et staff (Création, Édition, Suppression).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-ink text-white rounded text-xs font-semibold uppercase tracking-wider">
            Gestion des Comptes
          </span>
        </div>
      </div>

      {/* Global Success Notification */}
      {globalSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-sm font-medium flex items-center justify-between">
          <span>{globalSuccess}</span>
          <button
            onClick={() => setGlobalSuccess(null)}
            className="text-emerald-600 hover:text-emerald-900 font-bold ml-4"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invitation Form */}
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

        {/* Existing Accounts List Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bar de recherche et de filtrage */}
          <div className="bg-white border border-line rounded p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher un compte par nom ou email..."
                className="w-full px-3 py-2 border border-line rounded text-sm bg-paper text-ink focus:outline-none focus:border-ink font-medium"
              />
            </div>
            <div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 border border-line rounded text-xs bg-white text-ink focus:outline-none focus:border-ink font-medium"
              >
                <option value="all">Tous les rôles</option>
                <option value="enseignant">Enseignants uniquement</option>
                <option value="principal">Principal uniquement</option>
                <option value="directeur_etudes">Dir. des Études uniquement</option>
              </select>
            </div>
          </div>

          {userError && (
            <div className="p-3 bg-signal-red/10 border border-signal-red/20 rounded text-xs text-signal-red font-medium">
              {userError}
            </div>
          )}

          {loadingUsers ? (
            <div className="py-12 bg-white border border-line rounded text-center text-sm font-medium text-slate shadow-sm">
              Chargement des utilisateurs...
            </div>
          ) : (
            <>
              {/* SECTION 1 : COMPTES DIRECTION & ADMINISTRATION (MIS À PART) */}
              {(roleFilter === "all" || roleFilter === "principal" || roleFilter === "directeur_etudes") && (
                <div className="bg-white border border-purple-200 rounded p-5 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-purple-100">
                    <svg className="w-5 h-5 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <div>
                      <h2 className="font-display text-sm font-bold text-ink uppercase tracking-wider">
                        Direction &amp; Administration ({filteredUsers.filter((u) => u.role === "principal" || u.role === "directeur_etudes").length})
                      </h2>
                      <p className="text-[11px] text-slate">
                        Comptes d'administration système et de direction (non supprimables).
                      </p>
                    </div>
                  </div>

                  {filteredUsers.filter((u) => u.role === "principal" || u.role === "directeur_etudes").length === 0 ? (
                    <p className="text-xs text-slate italic text-center py-3">
                      Aucun membre de la direction trouvé avec ces filtres.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {filteredUsers
                        .filter((u) => u.role === "principal" || u.role === "directeur_etudes")
                        .map((u) => (
                          <div
                            key={u.id}
                            className="p-3 bg-purple-50/50 border border-purple-100 rounded flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-ink truncate">
                                  {u.full_name}
                                </span>
                                {getRoleBadge(u.role)}
                              </div>
                              <p className="text-xs font-mono text-slate truncate">
                                {u.email || "— sans email —"}
                              </p>
                              <p className="text-[11px] text-slate">
                                Périmètre : <strong className="text-ink">{u.division_scope ? u.division_scope.toUpperCase() : "Toutes divisions"}</strong>
                              </p>
                            </div>
                            <div>
                              {/* Bouton verrouillé — Point 7b : l'édition est bloquée côté DB (RLS) */}
                              <span
                                className="px-2.5 py-1 text-xs font-medium bg-white border border-purple-100 rounded text-purple-300 flex items-center gap-1 cursor-not-allowed select-none"
                                title="Compte protégé — non modifiable (voir SECURITE.md)"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                <span>Protégé</span>
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 2 : COMPTES ENSEIGNANTS & STAFF */}
              {(roleFilter === "all" || roleFilter === "enseignant") && (
                <div className="bg-white border border-line rounded p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-line">
                    <div>
                      <h2 className="font-display text-base font-bold text-ink">
                        Comptes Enseignants &amp; Personnel ({filteredUsers.filter((u) => u.role !== "principal" && u.role !== "directeur_etudes").length})
                      </h2>
                      <p className="text-xs text-slate">
                        Liste des enseignants avec options d'édition et de suppression.
                      </p>
                    </div>
                  </div>

                  {filteredUsers.filter((u) => u.role !== "principal" && u.role !== "directeur_etudes").length === 0 ? (
                    <div className="py-10 border border-dashed border-line rounded text-center">
                      <p className="text-sm text-slate italic">
                        Aucun compte enseignant trouvé correspondant aux critères.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-hidden border border-line rounded">
                      {/* Table Desktop */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-paper-dark border-b border-line text-xs font-semibold text-slate uppercase">
                            <tr>
                              <th className="px-4 py-3">Nom complet</th>
                              <th className="px-4 py-3">Email</th>
                              <th className="px-4 py-3">Rôle</th>
                              <th className="px-4 py-3">Division</th>
                              <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {filteredUsers
                              .filter((u) => u.role !== "principal" && u.role !== "directeur_etudes")
                              .map((u) => (
                                <tr key={u.id} className="hover:bg-paper-dark/30 transition">
                                  <td className="px-4 py-3 text-sm font-semibold text-ink">
                                    {u.full_name}
                                  </td>
                                  <td className="px-4 py-3 text-xs font-mono text-slate">
                                    {u.email || "— non renseigné —"}
                                  </td>
                                  <td className="px-4 py-3">{getRoleBadge(u.role)}</td>
                                  <td className="px-4 py-3 text-xs text-slate">
                                    {u.division_scope ? u.division_scope.toUpperCase() : "Toutes"}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={() => openEditModal(u)}
                                        className="px-2.5 py-1 text-xs font-medium bg-white hover:bg-paper border border-line rounded text-ink transition flex items-center gap-1"
                                        title="Modifier ce compte"
                                      >
                                        <svg className="w-3.5 h-3.5 text-slate" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        <span>Éditer</span>
                                      </button>
                                      <button
                                        onClick={() => setDeletingUser(u)}
                                        className="px-2 py-1 text-xs font-medium bg-red-50 hover:bg-red-100 border border-red-200 rounded text-red-700 transition flex items-center gap-1"
                                        title="Supprimer ce compte"
                                      >
                                        <svg className="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        <span>Supprimer</span>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Version Mobile */}
                      <div className="md:hidden divide-y divide-line">
                        {filteredUsers
                          .filter((u) => u.role !== "principal" && u.role !== "directeur_etudes")
                          .map((u) => (
                            <div key={u.id} className="p-3.5 flex flex-col gap-2 bg-white">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-ink">{u.full_name}</span>
                                {getRoleBadge(u.role)}
                              </div>
                              <div className="flex items-center justify-between text-xs text-slate font-mono">
                                <span>{u.email || "— email non disponible —"}</span>
                                <span className="text-[11px] font-sans">
                                  {u.division_scope ? u.division_scope.toUpperCase() : "Toutes"}
                                </span>
                              </div>
                              <div className="flex items-center justify-end gap-2 pt-1 border-t border-line/40">
                                <button
                                  onClick={() => openEditModal(u)}
                                  className="px-2.5 py-1 text-xs font-medium bg-paper border border-line rounded text-ink"
                                >
                                  Éditer
                                </button>
                                <button
                                  onClick={() => setDeletingUser(u)}
                                  className="px-2.5 py-1 text-xs font-medium bg-red-50 border border-red-200 rounded text-red-700"
                                >
                                  Supprimer
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg border border-line max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="font-display font-bold text-lg text-ink">
                Éditer le profil utilisateur
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate hover:text-ink text-lg font-bold"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-signal-red/10 border border-signal-red/20 rounded text-xs text-signal-red font-medium">
                {editError}
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate uppercase mb-1">
                  Nom complet *
                </label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-line rounded text-sm bg-paper text-ink focus:outline-none focus:border-ink font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate uppercase mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-line rounded text-sm bg-paper text-ink focus:outline-none focus:border-ink font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate uppercase mb-1">
                  Rôle *
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full px-3 py-2 border border-line rounded text-sm bg-paper text-ink focus:outline-none focus:border-ink font-medium"
                >
                  <option value="enseignant">Enseignant</option>
                  <option value="directeur_etudes">Directeur des Études</option>
                  <option value="principal">Principal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate uppercase mb-1">
                  Division attribuée
                </label>
                <select
                  value={editDivision}
                  onChange={(e) => setEditDivision(e.target.value)}
                  className="w-full px-3 py-2 border border-line rounded text-sm bg-paper text-ink focus:outline-none focus:border-ink font-medium"
                >
                  <option value="">Toutes les divisions</option>
                  <option value="college">Collège</option>
                  <option value="primaire">Primaire</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 border border-line rounded text-xs font-semibold text-slate hover:bg-paper"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={updating || !editFullName}
                  className="px-4 py-2 bg-ink hover:bg-opacity-90 text-white rounded text-xs font-semibold transition disabled:opacity-50"
                >
                  {updating ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE USER CONFIRMATION MODAL */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg border border-line max-w-sm w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="font-display font-bold text-lg text-ink">
                Confirmer la suppression
              </h3>
            </div>

            <p className="text-xs text-slate leading-relaxed">
              Êtes-vous sûr de vouloir supprimer le compte utilisateur de <strong className="text-ink">{deletingUser.full_name}</strong> ({deletingUser.email || "Sans email"}) ?
              Cette action est irréversible.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 border border-line rounded text-xs font-semibold text-slate hover:bg-paper"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold transition disabled:opacity-50"
              >
                {deleting ? "Suppression..." : "Supprimer définitivement"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAccountsPage;

