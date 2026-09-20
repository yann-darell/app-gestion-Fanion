import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, NavLink } from "react-router-dom";
import { supabase } from "@fanion/shared";
import TeacherGradesPage from "./pages/teacher/TeacherGradesPage";
import TeacherEvolutionPage from "./pages/teacher/TeacherEvolutionPage";
import BottomNav from "./components/layout/BottomNav";
import { MailIcon, LockIcon, EyeIcon, EyeOffIcon } from "./components/ui/Icons";

type Profile = {
  id: string;
  full_name: string;
  role: string;
  division_scope?: string | null;
};

// ─── ÉCRAN : Définir / Réinitialiser le mot de passe ─────────────────────────
const SetPasswordScreen: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 10) {
      setError("Le mot de passe doit contenir au moins 10 caractères.");
      return;
    }
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[^A-Za-z0-9]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
      setError("Le mot de passe doit inclure au moins une majuscule, une minuscule, un chiffre et un caractère spécial.");
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
            Espace Enseignant
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
              Bienvenue sur la plateforme Le Fanion. Veuillez choisir un mot de passe sécurisé pour accéder à votre espace enseignant.
            </p>
          </div>

          {success ? (
            <div className="p-4 bg-green-50 border border-fanion-green/30 text-fanion-green text-sm rounded font-semibold text-center">
              Mot de passe défini avec succès. Redirection en cours…
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
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate">
                      <LockIcon className="w-4 h-4" />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2 border border-line rounded focus:outline-none focus:ring-1 focus:ring-ink bg-paper text-sm"
                      placeholder="Minimum 10 caractères (maj, min, chiffre, symbole)"
                      required
                      minLength={10}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate hover:text-ink focus:outline-none"
                      tabIndex={-1}
                      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    >
                      {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate uppercase mb-1">
                    Confirmer le mot de passe
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate">
                      <LockIcon className="w-4 h-4" />
                    </span>
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="w-full pl-9 pr-10 py-2 border border-line rounded focus:outline-none focus:ring-1 focus:ring-ink bg-paper text-sm"
                      placeholder="Répétez le mot de passe"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate hover:text-ink focus:outline-none"
                      tabIndex={-1}
                      aria-label={showConfirm ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    >
                      {showConfirm ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                    </button>
                  </div>
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

// ─── HEADER LÉGER ENSEIGNANT ────────────────────────────────────────────────
const TeacherHeader: React.FC<{
  userFullName?: string;
  onLogout: () => void;
}> = ({ userFullName, onLogout }) => {
  return (
    <header className="h-16 border-b border-[#E4E0D6] bg-white px-4 md:px-6 flex items-center justify-between flex-shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <img src="/logo_fanion.webp" alt="Logo Le Fanion" className="w-7 h-7 object-contain" />
        <span className="font-sans text-sm font-semibold text-ink hidden sm:inline">
          Le Fanion — Espace Enseignant
        </span>
        <span className="font-sans text-sm font-semibold text-ink sm:hidden">
          Espace Enseignant
        </span>
      </div>

      {/* Navigation Desktop épurée */}
      <div className="hidden md:flex items-center gap-2">
        <NavLink
          to="/teacher/grades"
          className={({ isActive }) =>
            `px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              isActive
                ? "bg-ink text-white"
                : "text-slate hover:text-ink hover:bg-paper"
            }`
          }
        >
          Saisie des notes
        </NavLink>
        <NavLink
          to="/teacher/evolution"
          className={({ isActive }) =>
            `px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              isActive
                ? "bg-ink text-white"
                : "text-slate hover:text-ink hover:bg-paper"
            }`
          }
        >
          Évolution &amp; Bordereau
        </NavLink>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {userFullName && (
          <div className="flex items-center gap-2 md:gap-3 border-r border-line pr-2 md:pr-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-ink leading-tight">{userFullName}</p>
              <p className="text-[9px] text-slate uppercase tracking-wider font-medium">Enseignant</p>
            </div>
            <div 
              className="w-8 h-8 rounded-full bg-ink/10 text-ink flex items-center justify-center font-bold text-xs uppercase"
              title={userFullName}
            >
              {userFullName.charAt(0)}
            </div>
          </div>
        )}
        
        <button
          onClick={onLogout}
          className="px-2 py-1 md:px-3 md:py-1.5 border border-signal-red text-signal-red hover:bg-red-50 rounded text-xs font-semibold transition duration-150"
        >
          <span className="hidden sm:inline">Déconnexion</span>
          <span className="sm:hidden">Sortir</span>
        </button>
      </div>
    </header>
  );
};

// ─── DÉTECTION DU TYPE DE LIEN SUPABASE DANS L'URL ───────────────────────────
function detectSupabaseLinkType(): "invite" | "recovery" | null {
  const hash = window.location.hash;
  if (!hash) return null;

  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const type = params.get("type");
  const token = params.get("access_token");

  if (token && (type === "invite" || type === "recovery")) {
    return type;
  }
  return null;
}

// ─── APPLICATION ENSEIGNANT ──────────────────────────────────────────────────
export default function AppTeacher() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);

  useEffect(() => {
    const linkType = detectSupabaseLinkType();
    if (linkType !== null) {
      setNeedsPasswordSetup(true);
    }
  }, []);

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
      
      // Si l'utilisateur n'est pas enseignant, refuser l'accès sur ce portail web
      if (data && data.role !== "enseignant") {
        await supabase.auth.signOut();
        setProfile(null);
        setSession(null);
        setError("Ce portail web est exclusivement réservé aux enseignants. Veuillez utiliser l'application de bureau Le Fanion pour les accès administratifs.");
        return;
      }

      setProfile(data);
    } catch (err: any) {
      console.error("Erreur profil:", err);
      setError("Erreur lors du chargement du profil.");
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    if (session?.user?.id && !needsPasswordSetup) {
      fetchUserProfile(session.user.id);
    } else if (!session) {
      setProfile(null);
    }
  }, [session, needsPasswordSetup]);

  const handlePasswordSetupSuccess = async () => {
    window.history.replaceState(null, "", window.location.pathname);
    setNeedsPasswordSetup(false);
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
      const { data, error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
      if (loginErr) throw loginErr;
      if (data.user) {
        await fetchUserProfile(data.user.id);
      }
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
      setProfile(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (needsPasswordSetup) {
    return <SetPasswordScreen onSuccess={handlePasswordSetupSuccess} />;
  }

  if (!session || !profile) {
    return (
      <div className="min-h-screen bg-paper text-ink font-sans flex flex-col justify-between">
        <header className="border-b border-line bg-white py-3 px-6 shadow-sm flex-shrink-0">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo_fanion.webp" alt="Logo Le Fanion" className="w-10 h-10 object-contain" />
              <h1 className="text-xl font-display font-bold tracking-tight">Le Fanion</h1>
            </div>
            <span className="text-xs px-2.5 py-1 rounded bg-ink text-white font-semibold tracking-wider uppercase">
              Espace Enseignant
            </span>
          </div>
        </header>

        <main className="flex-grow flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-line rounded p-8 shadow-sm">
            <div className="text-center mb-6 flex flex-col items-center">
              <img src="/logo_fanion.webp" alt="Blason Collège Le Fanion" className="w-20 h-20 object-contain mb-3 drop-shadow-sm" />
              <h2 className="text-2xl font-display font-bold mb-1">Espace Enseignant</h2>
              <p className="text-sm text-slate">Connectez-vous pour saisir et suivre vos notes</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate uppercase mb-1">Adresse email</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate">
                    <MailIcon className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-line rounded focus:outline-none focus:ring-1 focus:ring-ink bg-paper text-sm"
                    placeholder="nom@lefanion.com"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate uppercase mb-1">Mot de passe</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate">
                    <LockIcon className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2 border border-line rounded focus:outline-none focus:ring-1 focus:ring-ink bg-paper text-sm"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate hover:text-ink focus:outline-none"
                    tabIndex={-1}
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || loadingProfile}
                className="w-full py-2 bg-ink hover:bg-opacity-90 text-white rounded text-sm font-semibold transition disabled:opacity-50"
              >
                {loading || loadingProfile ? "Connexion…" : "Se connecter"}
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

  const TeacherLayout = () => {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-paper text-ink">
        <TeacherHeader
          userFullName={profile.full_name}
          onLogout={handleLogout}
        />
        <main className="flex-1 overflow-y-auto custom-scrollbar pb-20 md:pb-6">
          <Outlet />
        </main>
        <BottomNav userRole="enseignant" />
      </div>
    );
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TeacherLayout />}>
          <Route index element={<Navigate to="/teacher/grades" replace />} />
          <Route path="teacher/grades" element={<TeacherGradesPage userRole="enseignant" />} />
          <Route path="teacher/evolution" element={<TeacherEvolutionPage userRole="enseignant" />} />
          {/* Toutes les autres URLs (y compris anciennes URLs admin) sont redirigées vers la saisie des notes */}
          <Route path="*" element={<Navigate to="/teacher/grades" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
