import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase, isRouteAllowedForRole } from "@fanion/shared";
import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";
import ClassesPage from "./pages/classes/ClassesPage";
import StudentsPage from "./pages/students/StudentsPage";
import StudentDetailPage from "./pages/students/StudentDetailPage";
import SubjectsPage from "./pages/subjects/SubjectsPage";
import CoefficientsPage from "./pages/subjects/CoefficientsPage";
import TeacherAssignmentsPage from "./pages/assignments/TeacherAssignmentsPage";
import TeacherOverviewPage from "./pages/assignments/TeacherOverviewPage";
import UserAccountsPage from "./pages/users/UserAccountsPage";
import TeacherGradesPage from "./pages/teacher/TeacherGradesPage";
import TeacherEvolutionPage from "./pages/teacher/TeacherEvolutionPage";
import ClassReportPage from "./pages/reports/ClassReportPage";

type Profile = {
  id: string;
  full_name: string;
  role: string;
  division_scope?: string | null;
};

// ─── ÉCRAN : Définir / Réinitialiser le mot de passe ─────────────────────────
// Affiché dès qu'un lien d'invitation (type=invite) ou de récupération
// (type=recovery) Supabase est détecté dans le fragment d'URL.
const SetPasswordScreen: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    try {
      setLoading(true);
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) throw updateErr;
      setSuccess(true);
      // Laisser un bref délai pour que l'utilisateur lise le message, puis continuer
      setTimeout(() => onSuccess(), 1500);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la définition du mot de passe.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper text-ink font-sans flex flex-col justify-between">
      <header className="border-b border-line bg-white py-3 px-6 shadow-sm flex-shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo_fanion.webp" alt="Logo Le Fanion" className="w-10 h-10 object-contain" />
            <h1 className="text-xl font-display font-bold tracking-tight">Le Fanion</h1>
          </div>
          <span className="text-xs px-2.5 py-1 rounded bg-ink text-white font-semibold tracking-wider uppercase">
            Portail Web
          </span>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-line rounded p-8 shadow-sm">
          <div className="text-center mb-6 flex flex-col items-center">
            <img
              src="/logo_fanion.webp"
              alt="Blason Collège Le Fanion"
              className="w-20 h-20 object-contain mb-3 drop-shadow-sm"
            />
            <h2 className="text-2xl font-display font-bold mb-1">Définir votre mot de passe</h2>
            <p className="text-sm text-slate max-w-xs leading-relaxed">
              Bienvenue sur la plateforme Le Fanion. Veuillez choisir un mot de passe sécurisé pour accéder à votre espace.
            </p>
          </div>

          {success ? (
            <div className="p-4 bg-green-50 border border-fanion-green/30 text-fanion-green text-sm rounded font-semibold text-center">
              ✓ Mot de passe défini avec succès. Redirection en cours…
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate uppercase mb-1">
                    Nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded focus:outline-none focus:ring-1 focus:ring-ink bg-paper text-sm"
                    placeholder="Minimum 8 caractères"
                    required
                    minLength={8}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate uppercase mb-1">
                    Confirmer le mot de passe
                  </label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded focus:outline-none focus:ring-1 focus:ring-ink bg-paper text-sm"
                    placeholder="Répétez le mot de passe"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 bg-ink hover:bg-opacity-90 text-white rounded text-sm font-semibold transition disabled:opacity-50"
                >
                  {loading ? "Enregistrement…" : "Définir mon mot de passe"}
                </button>
              </form>
            </>
          )}
        </div>
      </main>

      <footer className="border-t border-line py-3 text-center text-xs text-slate bg-white flex-shrink-0">
        Collège Privé Bilingue Le Fanion — &copy; {new Date().getFullYear()} — Yaoundé, Cameroun
      </footer>
    </div>
  );
};

// ─── GARDE RBAC ──────────────────────────────────────────────────────────────
const ProtectedRoute: React.FC<{ userRole?: string; children?: React.ReactNode }> = ({ userRole, children }) => {
  const location = useLocation();
  if (!userRole) return null;
  const isAllowed = isRouteAllowedForRole(location.pathname, userRole);
  if (!isAllowed) return <Navigate to="/" replace />;
  return children ? <>{children}</> : <Outlet />;
};

// ─── ÉCRAN D'ACCUEIL SELON RÔLE ──────────────────────────────────────────────
const HomePage: React.FC<{ userRole?: string }> = ({ userRole }) => {
  if (userRole === "principal" || userRole === "directeur_etudes") {
    return <Navigate to="/students" replace />;
  }
  if (userRole === "enseignant") {
    return <Navigate to="/teacher/grades" replace />;
  }
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-slate/10 flex items-center justify-center mb-4 text-slate">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h2 className="text-xl font-display font-bold mb-2 text-ink">Chargement…</h2>
    </div>
  );
};

// ─── DÉTECTION DU TYPE DE LIEN SUPABASE DANS L'URL ───────────────────────────
function detectSupabaseLinkType(): "invite" | "recovery" | null {
  const hash = window.location.hash;
  if (!hash) return null;

  // Supabase place les paramètres dans le fragment : #access_token=...&type=invite
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const type = params.get("type");
  const token = params.get("access_token");

  if (token && (type === "invite" || type === "recovery")) {
    return type;
  }
  return null;
}

// ─── APPLICATION PRINCIPALE ──────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // true si l'URL actuelle contient un lien d'invitation/récupération Supabase
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);

  // ── Détection du lien Supabase dès le chargement ────────────────────────
  useEffect(() => {
    const linkType = detectSupabaseLinkType();
    if (linkType !== null) {
      setNeedsPasswordSetup(true);
    }
  }, []);

  // ── Gestion de la session Auth ───────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      setLoadingProfile(true);
      setError(null);
      const { data, error: err } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (err) throw err;
      setProfile(data);
    } catch (err: any) {
      console.error("Erreur profil:", err);
      setError("Erreur lors du chargement du profil.");
    } finally {
      setLoadingProfile(false);
    }
  };

  // ── Chargement du profil ─────────────────────────────────────────────────
  useEffect(() => {
    if (session?.user?.id && !needsPasswordSetup) {
      fetchUserProfile(session.user.id);
    } else if (!session) {
      setProfile(null);
    }
  }, [session, needsPasswordSetup]);

  const handlePasswordSetupSuccess = async () => {
    // Nettoyer le fragment d'URL pour éviter une re-détection au rechargement
    window.history.replaceState(null, "", window.location.pathname);
    setNeedsPasswordSetup(false);
    // Récupérer la session courante à jour pour garantir d'avoir l'user id immédiat
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (currentSession?.user?.id) {
      setSession(currentSession);
      fetchUserProfile(currentSession.user.id);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    try {
      setLoading(true);
      setError(null);
      const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
      if (loginErr) throw loginErr;
    } catch (err: any) {
      setError(err.message || "Identifiants invalides.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIORITÉ 1 : Lien d'invitation / récupération → définition du mot de passe
  // ═══════════════════════════════════════════════════════════════════════════
  if (needsPasswordSetup) {
    return <SetPasswordScreen onSuccess={handlePasswordSetupSuccess} />;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIORITÉ 2 : Non connecté → Écran de connexion
  // ═══════════════════════════════════════════════════════════════════════════
  if (!session) {
    return (
      <div className="min-h-screen bg-paper text-ink font-sans flex flex-col justify-between">
        <header className="border-b border-line bg-white py-3 px-6 shadow-sm flex-shrink-0">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo_fanion.webp" alt="Logo Le Fanion" className="w-10 h-10 object-contain" />
              <h1 className="text-xl font-display font-bold tracking-tight">Le Fanion</h1>
            </div>
            <span className="text-xs px-2.5 py-1 rounded bg-ink text-white font-semibold tracking-wider uppercase">
              Portail Web
            </span>
          </div>
        </header>

        <main className="flex-grow flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-line rounded p-8 shadow-sm">
            <div className="text-center mb-6 flex flex-col items-center">
              <img src="/logo_fanion.webp" alt="Blason Collège Le Fanion" className="w-20 h-20 object-contain mb-3 drop-shadow-sm" />
              <h2 className="text-2xl font-display font-bold mb-1">Portail Web Mobile</h2>
              <p className="text-sm text-slate">Connectez-vous pour accéder à votre espace</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate uppercase mb-1">Adresse email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-line rounded focus:outline-none focus:ring-1 focus:ring-ink bg-paper text-sm"
                  placeholder="nom@lefanion.com"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate uppercase mb-1">Mot de passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-line rounded focus:outline-none focus:ring-1 focus:ring-ink bg-paper text-sm"
                  placeholder="••••••••"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-ink hover:bg-opacity-90 text-white rounded text-sm font-semibold transition disabled:opacity-50"
              >
                {loading ? "Connexion…" : "Se connecter"}
              </button>
            </form>
          </div>
        </main>

        <footer className="border-t border-line py-3 text-center text-xs text-slate bg-white flex-shrink-0">
          Collège Privé Bilingue Le Fanion — &copy; {new Date().getFullYear()} — Yaoundé, Cameroun
        </footer>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIORITÉ 3 : Connecté → Interface de l'application
  // ═══════════════════════════════════════════════════════════════════════════
  const MainLayout = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
      <div className="flex h-screen w-screen overflow-hidden bg-paper text-ink">
        <Sidebar
          isOpenOnMobile={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          userRole={profile?.role}
        />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header
            userFullName={profile?.full_name}
            userRole={profile?.role}
            onLogout={handleLogout}
            onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
          />
          <main className="flex-1 overflow-y-auto">
            {loadingProfile ? (
              <div className="py-12 text-center text-slate font-medium text-sm">Chargement du profil…</div>
            ) : (
              <Outlet />
            )}
          </main>
        </div>
      </div>
    );
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<HomePage userRole={profile?.role} />} />

          <Route element={<ProtectedRoute userRole={profile?.role} />}>
            <Route path="classes" element={<ClassesPage userRole={profile?.role} />} />
            <Route path="students" element={<StudentsPage userRole={profile?.role} />} />
            <Route path="students/:id" element={<StudentDetailPage userRole={profile?.role} />} />
            <Route path="subjects" element={<SubjectsPage userRole={profile?.role} />} />
            <Route path="subjects/coefficients" element={<CoefficientsPage userRole={profile?.role} />} />
            <Route path="assignments" element={<TeacherAssignmentsPage userRole={profile?.role} />} />
            <Route path="assignments/overview" element={<TeacherOverviewPage userRole={profile?.role} />} />
            
            <Route path="reports/class" element={<ClassReportPage userRole={profile?.role} />} />
            
            <Route path="users" element={<UserAccountsPage userRole={profile?.role} />} />

            {/* ── Routes Enseignant D3 ── */}
            <Route path="teacher/grades" element={<TeacherGradesPage userRole={profile?.role} />} />
            <Route path="teacher/evolution" element={<TeacherEvolutionPage userRole={profile?.role} />} />

            <Route path="grades" element={<div className="p-6"><h2 className="text-2xl font-bold font-display">Bulletins &amp; Notes</h2><p className="text-slate mt-2">Module en cours de migration…</p></div>} />
            <Route path="finance" element={<div className="p-6"><h2 className="text-2xl font-bold font-display">Finance &amp; Scolarité</h2><p className="text-slate mt-2">Module en cours de migration…</p></div>} />
            <Route path="settings" element={<div className="p-6"><h2 className="text-2xl font-bold font-display">Paramètres</h2><p className="text-slate mt-2">Module en cours de migration…</p></div>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
