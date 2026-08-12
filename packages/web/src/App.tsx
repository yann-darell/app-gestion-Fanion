import React, { useState, useEffect } from "react";
import { supabase } from "@fanion/shared";

type Profile = {
  id: string;
  full_name: string;
  role: string;
  division_scope?: string | null;
};

type Division = {
  id: string;
  nom: string;
};

type SchoolYear = {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
};

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Données métier récupérées
  const [profile, setProfile] = useState<Profile | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    // Écouter les changements d'état de session Supabase
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
      fetchUserData();
    } else {
      setProfile(null);
      setDivisions([]);
      setSchoolYears([]);
    }
  }, [session]);

  const fetchUserData = async () => {
    try {
      setLoadingData(true);
      setError(null);

      // 1. Charger le profil de l'utilisateur connecté
      const { data: profileData, error: profileErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (profileErr) throw profileErr;
      setProfile(profileData);

      // 2. Charger les divisions (vérification RLS)
      const { data: divisionsData, error: divisionsErr } = await supabase
        .from("divisions")
        .select("*");

      if (divisionsErr) throw divisionsErr;
      setDivisions(divisionsData || []);

      // 3. Charger les années scolaires (vérification RLS)
      const { data: schoolYearsData, error: schoolYearsErr } = await supabase
        .from("school_years")
        .select("*");

      if (schoolYearsErr) throw schoolYearsErr;
      setSchoolYears(schoolYearsData || []);

    } catch (err: any) {
      console.error("Erreur lors de la récupération des données :", err);
      setError(err.message || "Erreur de chargement des données sécurisées RLS.");
    } finally {
      setLoadingData(false);
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

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#150A5E] font-sans flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-[#E4E0D6] bg-white py-4 px-6 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#150A5E] flex items-center justify-center text-white font-display font-bold text-lg">
              F
            </div>
            <h1 className="text-xl font-display font-bold tracking-tight">Le Fanion v2</h1>
          </div>
          <span className="text-xs px-2.5 py-1 rounded bg-[#F0EEEA] font-semibold text-slate tracking-wider uppercase">
            Web Portal
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center p-4">
        {!session ? (
          /* Écran de Connexion */
          <div className="w-full max-w-md bg-white border border-[#E4E0D6] rounded p-8 shadow-sm">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-display font-bold mb-1">Portail d'Accès</h2>
              <p className="text-sm text-slate">Connectez-vous pour accéder à l'application</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-[#B3432E] text-[#B3432E] text-sm rounded">
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
        ) : (
          /* Écran Session Active */
          <div className="w-full max-w-2xl bg-white border border-[#E4E0D6] rounded p-8 shadow-sm space-y-6">
            <div className="flex justify-between items-start border-b border-[#E4E0D6] pb-4">
              <div>
                <p className="text-xs font-semibold text-slate uppercase">Utilisateur connecté</p>
                <h2 className="text-2xl font-display font-bold">
                  {profile?.full_name || session.user.email}
                </h2>
                <p className="text-xs text-slate mt-1">
                  ID Auth: <span className="font-mono text-[10px]">{session.user.id}</span>
                </p>
              </div>
              <button
                onClick={handleLogout}
                disabled={loading}
                className="px-3 py-1.5 border border-[#B3432E] text-[#B3432E] hover:bg-red-50 rounded text-xs font-semibold transition disabled:opacity-50"
              >
                Déconnexion
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-[#B3432E] text-[#B3432E] text-sm rounded">
                {error}
              </div>
            )}

            {loadingData ? (
              <div className="text-center py-6 text-sm text-slate">Chargement des données sécurisées...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Rôle & Division Scope */}
                <div className="space-y-3 bg-[#FAF9F5] p-4 rounded border border-[#E4E0D6]">
                  <h3 className="font-display font-semibold text-base border-b border-[#E4E0D6] pb-1.5">
                    Habilitations (Profil)
                  </h3>
                  <div className="text-sm space-y-1">
                    <p>
                      <strong className="text-slate">Rôle :</strong>{" "}
                      <span className="px-2 py-0.5 rounded text-xs bg-[#1E7A4C] text-white font-semibold capitalize">
                        {profile?.role || "Non défini"}
                      </span>
                    </p>
                    <p>
                      <strong className="text-slate">Périmètre Division :</strong>{" "}
                      <span className="capitalize">
                        {profile?.division_scope || "Accès global (Collège + Primaire)"}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Année Scolaire Active */}
                <div className="space-y-3 bg-[#FAF9F5] p-4 rounded border border-[#E4E0D6]">
                  <h3 className="font-display font-semibold text-base border-b border-[#E4E0D6] pb-1.5">
                    Année Scolaire Active
                  </h3>
                  {schoolYears.length > 0 ? (
                    schoolYears.map((sy) => (
                      <div key={sy.id} className="text-sm">
                        <p className="font-bold text-[#1E7A4C]">{sy.label} (Active)</p>
                        <p className="text-xs text-slate">
                          Début: {sy.start_date} | Fin: {sy.end_date}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[#B3432E]">Aucune année active trouvée en base.</p>
                  )}
                </div>

                {/* Divisions Visibles */}
                <div className="md:col-span-2 space-y-3 bg-[#FAF9F5] p-4 rounded border border-[#E4E0D6]">
                  <h3 className="font-display font-semibold text-base border-b border-[#E4E0D6] pb-1.5">
                    Divisions configurées (Lecture RLS)
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {divisions.length > 0 ? (
                      divisions.map((div) => (
                        <div key={div.id} className="p-3 bg-white border border-[#E4E0D6] rounded shadow-sm">
                          <p className="text-xs text-slate font-mono">Code: {div.id}</p>
                          <p className="font-semibold text-sm mt-1">{div.nom}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate col-span-2">Aucune division visible.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E4E0D6] py-3 text-center text-xs text-slate bg-white">
        Collège Privé Bilingue Le Fanion — &copy; {new Date().getFullYear()} — Yaoundé, Cameroun
      </footer>
    </div>
  );
}
