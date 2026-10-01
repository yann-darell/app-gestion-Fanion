import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  listSubjects,
  listDepartments,
  deleteDepartment,
  SubjectRecord,
  DepartmentRecord,
} from "@fanion/shared";
import { SubjectModal } from "./components/SubjectModal";
import { DepartmentModal } from "./components/DepartmentModal";

interface SubjectsPageProps {
  userRole?: string;
}

const DIVISION_LABELS: Record<string, string> = {
  college: "Collège",
  primaire: "Primaire",
};

export const SubjectsPage: React.FC<SubjectsPageProps> = ({ userRole }) => {
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDivision, setFilterDivision] = useState<string>("college");
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<SubjectRecord | null>(null);

  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentRecord | null>(null);
  const [showDeptManager, setShowDeptManager] = useState(false);

  const isWriteAuthorized =
    userRole === "principal" || userRole === "directeur_etudes";

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [subjectsData, deptsData] = await Promise.all([
        listSubjects(filterDivision !== "all" ? filterDivision : undefined),
        listDepartments(),
      ]);
      setSubjects(subjectsData);
      setDepartments(deptsData);
    } catch (err: any) {
      console.error("Erreur chargement données:", err);
      setError("Impossible de charger les données des matières et départements.");
    } finally {
      setLoading(false);
    }
  }, [filterDivision]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateSubject = () => {
    setEditingSubject(null);
    setIsModalOpen(true);
  };

  const handleEditSubject = (subject: SubjectRecord) => {
    setEditingSubject(subject);
    setIsModalOpen(true);
  };

  const handleCreateDepartment = () => {
    setEditingDept(null);
    setIsDeptModalOpen(true);
  };

  const handleEditDepartment = (dept: DepartmentRecord) => {
    setEditingDept(dept);
    setIsDeptModalOpen(true);
  };

  const handleDeleteDepartment = async (dept: DepartmentRecord) => {
    const hasSubjects = subjects.some((s) => s.department_id === dept.id);
    if (hasSubjects) {
      alert(`Impossible de supprimer le département "${dept.name}" car des matières y sont rattachées.`);
      return;
    }

    if (!window.confirm(`Confirmez-vous la suppression du département "${dept.name}" ?`)) {
      return;
    }

    try {
      await deleteDepartment(dept.id);
      loadData();
    } catch (err: any) {
      alert(`Erreur de suppression : ${err.message || "Impossible de supprimer le département"}`);
    }
  };

  // Groupement des matières par département pour le collège
  const groupedCollegeSubjects = useMemo(() => {
    if (filterDivision !== "college") return null;

    const map = new Map<string, { dept: DepartmentRecord | null; subjects: SubjectRecord[] }>();

    // Initialiser chaque département existant
    departments.forEach((dept) => {
      map.set(dept.id, { dept, subjects: [] });
    });

    // Catégorie pour les matières sans département
    map.set("none", { dept: null, subjects: [] });

    // Répartir les matières
    subjects.forEach((subj) => {
      const deptId = subj.department_id;
      if (deptId && map.has(deptId)) {
        map.get(deptId)!.subjects.push(subj);
      } else {
        map.get("none")!.subjects.push(subj);
      }
    });

    return Array.from(map.values()).filter(
      (entry) => entry.dept !== null || entry.subjects.length > 0
    );
  }, [subjects, departments, filterDivision]);

  const filters = [
    { key: "all", label: "Toutes" },
    { key: "college", label: "Collège" },
    { key: "primaire", label: "Primaire" },
  ] as const;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 pb-4 border-b border-line">
        <div className="flex flex-wrap items-center justify-between gap-3 min-h-[40px]">
          <div>
            <h1 className="font-display text-xl md:text-2xl font-semibold text-ink leading-tight">
              Gestion des Matières
            </h1>
            <p className="text-xs text-slate mt-0.5">
              Organisez les matières scolaires et gérez les départements pédagogiques du collège.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {filterDivision === "college" && (
              <button
                onClick={() => setShowDeptManager(!showDeptManager)}
                className={`px-3 py-2 rounded text-xs font-semibold border transition flex items-center gap-1.5 ${
                  showDeptManager
                    ? "bg-blue-50 border-blue-300 text-blue-900"
                    : "border-line text-slate hover:text-ink hover:bg-paper"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span>{showDeptManager ? "Masquer les départements" : "Gérer les départements"}</span>
              </button>
            )}

            {isWriteAuthorized && (
              <button
                onClick={handleCreateSubject}
                className="flex items-center gap-1.5 px-3 py-2 bg-ink text-white rounded text-xs font-semibold hover:bg-opacity-90 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                </svg>
                <span>Nouvelle matière</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Section Gestion des Départements (Accordéon / Panneau dédié) */}
      {filterDivision === "college" && showDeptManager && (
        <div className="bg-slate-50 border border-blue-200/80 rounded-lg p-4 md:p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-blue-200/60 pb-3">
            <div>
              <h2 className="text-sm font-bold text-ink uppercase tracking-wide flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                Départements Pédagogiques du Collège
              </h2>
              <p className="text-xs text-slate mt-0.5">
                Chaque département est coordonné par un enseignant désigné comme chef.
              </p>
            </div>
            {isWriteAuthorized && (
              <button
                onClick={handleCreateDepartment}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                </svg>
                Nouveau département
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {departments.length === 0 ? (
              <p className="text-xs text-slate italic col-span-full">Aucun département configuré.</p>
            ) : (
              departments.map((dept) => {
                const count = subjects.filter((s) => s.department_id === dept.id).length;
                return (
                  <div
                    key={dept.id}
                    className="bg-white border border-line rounded p-3 flex flex-col justify-between gap-2 shadow-sm"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-ink leading-tight">
                          {dept.name}
                        </span>
                        <span className="text-[10px] bg-paper-dark border border-line px-1.5 py-0.5 rounded text-slate font-semibold flex-shrink-0">
                          {count} matière{count > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="mt-2 text-xs">
                        <span className="text-slate text-[11px] block">Chef de département :</span>
                        {dept.head_teacher ? (
                          <span className="font-semibold text-blue-900 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                            {dept.head_teacher.full_name}
                          </span>
                        ) : (
                          <span className="text-slate/70 italic text-[11px]">Non assigné</span>
                        )}
                      </div>
                    </div>

                    {isWriteAuthorized && (
                      <div className="flex items-center justify-end gap-1 pt-2 border-t border-line/60">
                        <button
                          onClick={() => handleEditDepartment(dept)}
                          className="px-2 py-1 text-xs text-slate hover:text-ink hover:bg-paper rounded transition"
                          title="Modifier"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => handleDeleteDepartment(dept)}
                          className="px-2 py-1 text-xs text-signal-red hover:bg-signal-red/10 rounded transition"
                          title="Supprimer"
                        >
                          Supprimer
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Division Filter */}
      <div className="flex items-center gap-2 p-2 bg-paper-dark rounded border border-line overflow-x-auto">
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
        <div className="p-3 bg-signal-red/10 border border-signal-red/20 rounded text-sm text-signal-red font-medium">
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
              onClick={handleCreateSubject}
              className="mt-3 text-xs font-semibold text-ink hover:underline"
            >
              Créer la toute première matière
            </button>
          )}
        </div>
      ) : filterDivision === "college" && groupedCollegeSubjects ? (
        /* VUE DU COLLÈGE : Regroupement par département pédagogique */
        <div className="space-y-4">
          {groupedCollegeSubjects.map((group) => {
            const isUnassigned = !group.dept;
            return (
              <div
                key={group.dept ? group.dept.id : "unassigned"}
                className="bg-white border border-line rounded overflow-hidden shadow-sm"
              >
                {/* Header du département */}
                <div
                  className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 ${
                    isUnassigned
                      ? "bg-slate-50 border-line"
                      : "bg-gradient-to-r from-blue-50/70 to-white border-blue-100"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isUnassigned ? "bg-slate-400" : "bg-blue-600"
                      }`}
                    />
                    <div>
                      <h3 className="font-semibold text-sm text-ink flex items-center gap-2">
                        {isUnassigned ? "Matières sans département" : group.dept!.name}
                        <span className="text-[11px] font-normal text-slate">
                          ({group.subjects.length} matière{group.subjects.length > 1 ? "s" : ""})
                        </span>
                      </h3>
                      {!isUnassigned && (
                        <div className="text-[11px] text-slate mt-0.5 flex items-center gap-1.5">
                          <span>Chef de département :</span>
                          {group.dept!.head_teacher ? (
                            <span className="font-semibold text-ink">
                              {group.dept!.head_teacher.full_name}
                            </span>
                          ) : (
                            <span className="italic text-slate/70">Non assigné</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {!isUnassigned && isWriteAuthorized && (
                    <button
                      onClick={() => handleEditDepartment(group.dept!)}
                      className="text-xs text-blue-700 hover:text-blue-900 font-medium px-2 py-1 rounded hover:bg-blue-100/50 transition"
                    >
                      Modifier chef
                    </button>
                  )}
                </div>

                {/* Liste des matières du département */}
                {group.subjects.length === 0 ? (
                  <div className="p-4 text-xs text-slate italic text-center">
                    Aucune matière assignée à ce département.
                  </div>
                ) : (
                  <div className="divide-y divide-line">
                    {group.subjects.map((subject) => (
                      <div
                        key={subject.id}
                        className="px-4 py-2.5 flex items-center justify-between hover:bg-paper/40 transition"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-ink">
                            {subject.name}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-ink/10 text-ink">
                            Collège
                          </span>
                        </div>

                        {isWriteAuthorized && (
                          <button
                            onClick={() => handleEditSubject(subject)}
                            className="p-1.5 text-slate hover:text-ink hover:bg-paper rounded transition"
                            title="Modifier"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* VUE STANDARD (Primaire ou Toutes) */
        <>
          {/* Desktop Table */}
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
                  <th className="font-sans font-semibold text-xs text-slate uppercase tracking-wider px-4 py-2.5">
                    Département
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
                    <td className="px-4 py-2.5 text-sm">
                      {subject.department ? (
                        <span className="text-xs font-medium text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          {subject.department.name}
                        </span>
                      ) : subject.division_id === "college" ? (
                        <span className="text-xs text-slate/60 italic">— Non assigné —</span>
                      ) : (
                        <span className="text-xs text-slate/50">— N/A (Primaire) —</span>
                      )}
                    </td>
                    {isWriteAuthorized && (
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => handleEditSubject(subject)}
                          className="p-1.5 text-slate hover:text-ink hover:bg-paper rounded transition"
                          title="Modifier"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

          {/* Mobile Card List */}
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
                  {subject.department && (
                    <p className="text-xs text-blue-900 mt-1 font-medium">
                      Département : {subject.department.name}
                    </p>
                  )}
                </div>
                {isWriteAuthorized && (
                  <button
                    onClick={() => handleEditSubject(subject)}
                    className="p-2 text-slate hover:text-ink hover:bg-paper rounded transition flex-shrink-0"
                    title="Modifier"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {/* Modal Matière */}
      <SubjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={loadData}
        editingSubject={editingSubject}
        defaultDivision={filterDivision !== "all" ? filterDivision : "college"}
      />

      {/* Modal Département */}
      <DepartmentModal
        isOpen={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
        onSave={loadData}
        editingDepartment={editingDept}
      />
    </div>
  );
};

export default SubjectsPage;
