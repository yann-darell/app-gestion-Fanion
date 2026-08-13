import React, { useState, useEffect } from "react";
import { HashRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { supabase } from "@fanion/shared";
import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";
import ClassesPage from "./pages/classes/ClassesPage";

type Profile = {
  id: string;
  full_name: string;
  role: string;
  division_scope?: string | null;
};

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // User Profile
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    // Listen to Supabase auth state changes
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      fetchUserProfile();
    } else {
      setProfile(null);
    }
  }, [session]);

  const fetchUserProfile = async () => {
    try {
      setLoadingProfile(true);
      setError(null);

      const { data: profileData, error: profileErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (profileErr) throw profileErr;
      setProfile(profileData);
    } catch (err: any) {
      console.error("Erreur lors de la récupération du profil :", err);
      setError("Erreur de chargement du profil utilisateur.");
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    try {
      setLoading(true);
      setError(null);
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
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

  if (!session) {
    /* Login Screen */
    return (
      <div className="min-h-screen bg-[#FAF9F5] text-[#150A5E] font-sans flex flex-col justify-between">
        {/* Header */}
        <header className="border-b border-[#E4E0D6] bg-white py-4 px-6 shadow-sm flex-shrink-0">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-[#150A5E] flex items-center justify-center text-white font-display font-bold text-lg">
                F
              </div>
              <h1 className="text-xl font-display font-bold tracking-tight">Le Fanion v2</h1>
            </div>
            <span className="text-xs px-2.5 py-1 rounded bg-[#150A5E] text-white font-semibold tracking-wider uppercase">
              Desktop Portal
            </span>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-grow flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-[#E4E0D6] rounded p-8 shadow-sm">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-display font-bold mb-1">Portail d'Accès Bureau</h2>
              <p className="text-sm text-slate">Connectez-vous pour accéder à l'application</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-[#B3432E] text-[#B3432E] text-sm rounded font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate uppercase mb-1">
                  Adresse email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E4E0D6] rounded focus:outline-none focus:ring-1 focus:ring-[#150A5E] bg-[#FAF9F5] text-sm"
                  placeholder="nom@lefanion.com"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate uppercase mb-1">
                  Mot de passe
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E4E0D6] rounded focus:outline-none focus:ring-1 focus:ring-[#150A5E] bg-[#FAF9F5] text-sm"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-[#150A5E] hover:bg-opacity-90 text-white rounded text-sm font-semibold transition disabled:opacity-50"
              >
                {loading ? "Connexion..." : "Se connecter"}
              </button>
            </form>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-[#E4E0D6] py-3 text-center text-xs text-slate bg-white flex-shrink-0">
          Collège Privé Bilingue Le Fanion — &copy; {new Date().getFullYear()} — Yaoundé, Cameroun
        </footer>
      </div>
    );
  }

  // Layout wrapper component
  const MainLayout = () => (
    <div className="flex h-screen w-screen overflow-hidden bg-paper text-ink">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header 
          userFullName={profile?.full_name} 
          userRole={profile?.role} 
          onLogout={handleLogout} 
        />
        <main className="flex-1 overflow-y-auto">
          {loadingProfile ? (
            <div className="py-12 text-center text-slate font-medium text-sm">
              Chargement du profil...
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );

  /* Authenticated Router */
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/classes" replace />} />
          <Route path="classes" element={<ClassesPage userRole={profile?.role} />} />
          
          {/* Fallback mock routes to avoid breaking links */}
          <Route path="students" element={<div className="p-6"><h2 className="text-2xl font-bold">Élèves</h2><p className="text-slate mt-2">Module en cours de migration...</p></div>} />
          <Route path="grades" element={<div className="p-6"><h2 className="text-2xl font-bold">Bulletins & Notes</h2><p className="text-slate mt-2">Module en cours de migration...</p></div>} />
          <Route path="finance" element={<div className="p-6"><h2 className="text-2xl font-bold">Finance & Scolarité</h2><p className="text-slate mt-2">Module en cours de migration...</p></div>} />
          <Route path="settings" element={<div className="p-6"><h2 className="text-2xl font-bold">Paramètres</h2><p className="text-slate mt-2">Module en cours de migration...</p></div>} />
          
          <Route path="*" element={<Navigate to="/classes" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}