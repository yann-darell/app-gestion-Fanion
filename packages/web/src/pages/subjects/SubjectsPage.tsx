import React, { useEffect, useState, useCallback } from "react";
import {
  listSubjects,
  SubjectRecord,
} from "@fanion/shared";
import { SubjectModal } from "./components/SubjectModal";

interface SubjectsPageProps {
  userRole?: string;
}

const DIVISION_LABELS: Record<string, string> = {
  college: "Collège",
  primaire: "Primaire",
};

export const SubjectsPage: React.FC<SubjectsPageProps> = ({ userRole }) => {
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDivision, setFilterDivision] = useState<string>("college");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<SubjectRecord | null>(null);

  const isWriteAuthorized =
    userRole === "principal" || userRole === "directeur_etudes";

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listSubjects(
        filterDivision !== "all" ? filterDivision : undefined
      );
      setSubjects(data);
    } catch (err: any) {
      setError("Impossible de charger les matières.");
    } finally {
      setLoading(false);
    }
  }, [filterDivision]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const handleCreate = () => {
    setEditingSubject(null);
    setIsModalOpen(true);
  };

  const handleEdit = (subject: SubjectRecord) => {
    setEditingSubject(subject);
    setIsModalOpen(true);
  };

  const filters = [
    { key: "all", label: "Toutes" },
    { key: "college", label: "Collège" },
    { key: "primaire", label: "Primaire" },
  ] as const;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 pb-4 border-b border-line mb-6">
        <div className="flex items-center justify-between min-h-[40px]">
          <h1 className="font-display text-xl md:text-2xl font-semibold text-ink leading-tight">
            Gestion des Matières
          </h1>
          {isWriteAuthorized && (
            <button
              onClick={handleCreate}
              className="flex items-center gap-1.5 px-3 py-2 bg-ink text-white rounded text-xs font-semibold hover:bg-opacity-90 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Nouvelle matière</span>
              <span className="sm:hidden">Créer</span>
            </button>
          )}
        </div>
      </div>

      {/* Division Filter */}
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

      {error && (
        <div className="mb-6 p-3 bg-signal-red/10 border border-signal-red/20 rounded text-sm text-signal-red font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm font-medium text-slate">
          Chargement des matières...
        </div>
      ) : subjects.length === 0 ? (
        <div className="py-12 border border-dashed border-line rounded bg-white text-center">
          <p className="text-sm text-slate font-medium">Aucune matière configurée</p>
          {isWriteAuthorized && (
            <button
              onClick={handleCreate}
              className="mt-3 text-xs font-semibold text-ink hover:underline"
            >
              Créer la toute première matière
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table (hidden on mobile) */}
          <div className="hidden md:block w-full overflow-x-auto border border-line rounded">
            <table className="w-full border-collapse text-left">
              <thead className="bg-paper-dark text-ink border-b border-line sticky top-0 z-10">
                <tr>
                  <th className="font-sans font-semibold text-xs text-slate uppercase tracking-wider px-4 py-2.5">
                    Nom
                  </th>
                  <th className="font-sans font-semibold text-xs text-slate uppercase tracking-wider px-4 py-2.5">
                    Division
                  </th>
                  {isWriteAuthorized && (
                    <th className="font-sans font-semibold text-xs text-slate uppercase tracking-wider px-4 py-2.5 w-20 text-right">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-white">
                {subjects.map((subject) => (
                  <tr
                    key={subject.id}
                    className="hover:bg-paper/50 transition-colors duration-100"
                  >
                    <td className="px-4 py-2.5 text-sm font-semibold text-ink">
                      {subject.name}
                    </td>
                    <td className="px-4 py-2.5 text-sm">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                          subject.division_id === "college"
                            ? "bg-ink/10 text-ink"
                            : "bg-fanion-green/10 text-fanion-green"
                        }`}
                      >
                        {DIVISION_LABELS[subject.division_id] || subject.division_id}
                      </span>
                    </td>
                    {isWriteAuthorized && (
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => handleEdit(subject)}
                          className="p-1.5 text-slate hover:text-ink hover:bg-paper rounded transition"
                          title="Modifier"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List (hidden on desktop) */}
          <div className="md:hidden flex flex-col gap-3">
            {subjects.map((subject) => (
              <div
                key={subject.id}
                className="bg-white border border-line rounded p-4 flex justify-between items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-ink truncate">
                      {subject.name}
                    </p>
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${
                        subject.division_id === "college"
                          ? "bg-ink/10 text-ink"
                          : "bg-fanion-green/10 text-fanion-green"
                      }`}
                    >
                      {DIVISION_LABELS[subject.division_id] || subject.division_id}
                    </span>
                  </div>
                </div>
                {isWriteAuthorized && (
                  <button
                    onClick={() => handleEdit(subject)}
                    className="p-2 text-slate hover:text-ink hover:bg-paper rounded transition flex-shrink-0"
                    title="Modifier"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <SubjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={fetchSubjects}
        editingSubject={editingSubject}
        defaultDivision={filterDivision !== "all" ? filterDivision : "college"}
      />
    </div>
  );
};

export default SubjectsPage;
