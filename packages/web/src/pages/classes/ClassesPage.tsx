import React, { useEffect, useState } from "react";
import {
  listClasses,
  ClassRecord,
  supabase,
} from "@fanion/shared";
import { ClassModal } from "./components/ClassModal";

interface ClassesPageProps {
  userRole?: string;
}

export const ClassesPage: React.FC<ClassesPageProps> = ({ userRole }) => {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [schoolYears, setSchoolYears] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDivision, setFilterDivision] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRecord | null>(null);

  const isWriteAuthorized =
    userRole === "principal" || userRole === "directeur_etudes";

  const fetchClassesData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listClasses(filterDivision);
      setClasses(data);

      const { data: syData, error: syErr } = await supabase
        .from("school_years")
        .select("id, label");
      if (syErr) throw syErr;

      const syMap: Record<string, string> = {};
      syData?.forEach((sy) => {
        syMap[sy.id] = sy.label;
      });
      setSchoolYears(syMap);
    } catch (err: any) {
      console.error("Erreur de chargement des classes:", err);
      setError("Impossible de charger la liste des classes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassesData();
  }, [filterDivision]);

  const handleEditClick = (cls: ClassRecord) => {
    setEditingClass(cls);
    setIsModalOpen(true);
  };

  const handleCreateClick = () => {
    setEditingClass(null);
    setIsModalOpen(true);
  };

  /* ─── Filter pills ─── */
  const filters = [
    { key: "all", label: "Toutes" },
    { key: "college", label: "Collège" },
    { key: "primaire", label: "Primaire" },
  ] as const;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 pb-4 border-b border-line mb-6">
        <div className="flex items-center justify-between min-h-[40px]">
          <h1 className="font-display text-xl md:text-2xl font-semibold text-ink leading-tight">
            Gestion des Classes
          </h1>
          {isWriteAuthorized && (
            <button
              onClick={handleCreateClick}
              className="flex items-center gap-1.5 px-3 py-2 bg-ink text-white rounded text-xs font-semibold hover:bg-opacity-90 transition"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="hidden sm:inline">Créer une classe</span>
              <span className="sm:hidden">Créer</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Division Filter ── */}
      <div className="flex items-center gap-2 mb-6 p-2 bg-paper-dark rounded border border-line overflow-x-auto">
        <span className="text-[10px] font-semibold text-slate uppercase tracking-wider px-2 flex-shrink-0">
          Division :
        </span>
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilterDivision(f.key)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition duration-150 flex-shrink-0 ${
              filterDivision === f.key
                ? "bg-ink text-white"
                : "text-slate hover:bg-paper"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mb-6 p-3 bg-signal-red/10 border border-signal-red/20 rounded text-sm text-signal-red font-medium">
          {error}
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div className="py-12 text-center text-sm font-medium text-slate">
          Chargement…
        </div>
      ) : classes.length === 0 ? (
        <div className="py-12 border border-dashed border-line rounded bg-white text-center">
          <p className="text-sm text-slate font-medium">
            Aucune classe trouvée
          </p>
          {isWriteAuthorized && (
            <button
              onClick={handleCreateClick}
              className="mt-3 text-xs font-semibold text-ink hover:underline"
            >
              Créer la toute première classe
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ── Desktop Table (hidden on mobile) ── */}
          <div className="hidden md:block w-full overflow-x-auto border border-line rounded">
            <table className="w-full border-collapse text-left">
              <thead className="bg-paper-dark text-ink border-b border-line sticky top-0 z-10">
                <tr>
                  <th className="font-sans font-semibold text-xs text-slate uppercase tracking-wider px-4 py-2.5">
                    Nom
                  </th>
                  <th className="font-sans font-semibold text-xs text-slate uppercase tracking-wider px-4 py-2.5">
                    Niveau
                  </th>
                  <th className="font-sans font-semibold text-xs text-slate uppercase tracking-wider px-4 py-2.5">
                    Division
                  </th>
                  <th className="font-sans font-semibold text-xs text-slate uppercase tracking-wider px-4 py-2.5">
                    Année
                  </th>
                  <th className="font-sans font-semibold text-xs text-slate uppercase tracking-wider px-4 py-2.5">
                    Prof. Principal
                  </th>
                  {isWriteAuthorized && (
                    <th className="font-sans font-semibold text-xs text-slate uppercase tracking-wider px-4 py-2.5 w-20 text-right">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-white">
                {classes.map((cls) => (
                  <tr
                    key={cls.id}
                    className="hover:bg-paper/50 transition-colors duration-100"
                  >
                    <td className="px-4 py-2.5 text-sm font-semibold text-ink">
                      {cls.name}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-ink">
                      {cls.level}
                    </td>
                    <td className="px-4 py-2.5 text-sm">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                          cls.division_id === "college"
                            ? "bg-ink/10 text-ink"
                            : "bg-fanion-green/10 text-fanion-green"
                        }`}
                      >
                        {cls.division_id === "college"
                          ? "Collège"
                          : "Primaire"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm font-mono-data text-ink">
                      {schoolYears[cls.school_year_id] || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-ink">
                      {cls.head_teacher_name || (
                        <span className="text-slate italic text-xs">
                          Non assigné
                        </span>
                      )}
                    </td>
                    {isWriteAuthorized && (
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => handleEditClick(cls)}
                          className="p-1.5 text-slate hover:text-ink hover:bg-paper rounded transition"
                          title="Modifier"
                        >
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
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobile Card List (hidden on desktop) ── */}
          <div className="md:hidden flex flex-col gap-3">
            {classes.map((cls) => (
              <div
                key={cls.id}
                className="bg-white border border-line rounded p-4 flex justify-between items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-ink truncate">
                      {cls.name}
                    </p>
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${
                        cls.division_id === "college"
                          ? "bg-ink/10 text-ink"
                          : "bg-fanion-green/10 text-fanion-green"
                      }`}
                    >
                      {cls.division_id === "college"
                        ? "Collège"
                        : "Primaire"}
                    </span>
                  </div>
                  <p className="text-xs text-slate mt-1">
                    Niveau : {cls.level} ·{" "}
                    {schoolYears[cls.school_year_id] || "—"}
                  </p>
                  <p className="text-xs text-slate mt-0.5">
                    Prof :{" "}
                    {cls.head_teacher_name || (
                      <span className="italic">Non assigné</span>
                    )}
                  </p>
                </div>
                {isWriteAuthorized && (
                  <button
                    onClick={() => handleEditClick(cls)}
                    className="p-2 text-slate hover:text-ink hover:bg-paper rounded transition flex-shrink-0"
                    title="Modifier"
                  >
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
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <ClassModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={fetchClassesData}
        editingClass={editingClass}
      />
    </div>
  );
};

export default ClassesPage;
