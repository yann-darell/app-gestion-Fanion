import React, { useEffect, useState, useCallback } from "react";
import {
  listClasses,
  listSubjects,
  listSubjectGroups,
  listCoefficients,
  upsertCoefficient,
  ClassRecord,
  SubjectRecord,
  SubjectGroupRecord,
  CoefficientRecord,
  useSelectionPersistence,
} from "@fanion/shared";

interface SubjectRow {
  subject: SubjectRecord;
  coefficient: number;
  // Valeur en base au dernier chargement/sauvegarde (null = jamais sauvegardée en base)
  originalCoefficient: number | null;
  originalGroupId: string | null;
  coefficientId: string | null;
  subjectGroupId: string;
  dirty: boolean;
  saving: boolean;
  error: string | null;
}

type GroupedRows = Record<string, SubjectRow[]>;

const GROUP_ORDER = ["I", "II", "III", "IV"];

export const CoefficientsPage: React.FC<{ userRole?: string }> = ({ userRole }) => {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [groups, setGroups] = useState<SubjectGroupRecord[]>([]);
  const [selectedClassId, setSelectedClassId] = useSelectionPersistence("classId", "");
  const [selectedDivision, setSelectedDivision] = useSelectionPersistence("division", "college");

  const [groupedRows, setGroupedRows] = useState<GroupedRows>({});
  const [totalCoef, setTotalCoef] = useState<number>(0);

  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingCoefs, setLoadingCoefs] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  // Pour gérer les sections repliables sur mobile
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    I: false,
    II: false,
    III: false,
    IV: false,
  });

  const isWriteAuthorized =
    userRole === "principal" || userRole === "directeur_etudes";

  useEffect(() => {
    const init = async () => {
      setLoadingInit(true);
      try {
        const [classData, groupData] = await Promise.all([
          listClasses(selectedDivision),
          listSubjectGroups(),
        ]);
        setClasses(classData);
        setGroups(groupData);
      } catch (err: any) {
        setPageError("Impossible de charger les données initiales.");
      } finally {
        setLoadingInit(false);
      }
    };
    init();
  }, [selectedDivision]);

  const recalcTotal = (rows: GroupedRows) => {
    let sum = 0;
    Object.values(rows).forEach((group) =>
      group.forEach((row) => {
        sum += row.coefficient;
      })
    );
    setTotalCoef(sum);
  };

  const buildRows = useCallback(
    async (classId: string) => {
      if (!classId) return;
      setLoadingCoefs(true);
      setPageError(null);
      try {
        const [subjects, existingCoefs] = await Promise.all([
          listSubjects(selectedDivision),
          listCoefficients(classId),
        ]);

        const coefMap: Record<string, CoefficientRecord> = {};
        existingCoefs.forEach((c) => {
          coefMap[c.subject_id] = c;
        });

        const defaultGroupId = groups.find((g) => g.label === "I")?.id ?? groups[0]?.id ?? "";

        const grouped: GroupedRows = {};
        GROUP_ORDER.forEach((label) => {
          grouped[label] = [];
        });

        subjects.forEach((subject) => {
          const existing = coefMap[subject.id];
          const groupLabel =
            existing
              ? groups.find((g) => g.id === existing.subject_group_id)?.label ?? "I"
              : "I";

          const row: SubjectRow = {
            subject,
            coefficient: existing?.coefficient ?? 1,
            originalCoefficient: existing?.coefficient ?? null,
            originalGroupId: existing?.subject_group_id ?? null,
            coefficientId: existing?.id ?? null,
            subjectGroupId: existing?.subject_group_id ?? defaultGroupId,
            dirty: false,
            saving: false,
            error: null,
          };

          grouped[groupLabel].push(row);
        });

        setGroupedRows(grouped);
        recalcTotal(grouped);
      } catch (err: any) {
        setPageError("Impossible de charger les coefficients pour cette classe.");
      } finally {
        setLoadingCoefs(false);
      }
    },
    [selectedDivision, groups]
  );

  useEffect(() => {
    if (selectedClassId) buildRows(selectedClassId);
    else setGroupedRows({});
  }, [selectedClassId, buildRows]);

  const handleCoefficientChange = (
    groupLabel: string,
    subjectId: string,
    value: string
  ) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1) return;
    setGroupedRows((prev) => {
      const updated = { ...prev };
      updated[groupLabel] = updated[groupLabel].map((row) => {
        if (row.subject.id !== subjectId) return row;
        const newDirty =
          row.originalCoefficient === null ||
          num !== row.originalCoefficient ||
          row.subjectGroupId !== row.originalGroupId;
        return { ...row, coefficient: num, dirty: newDirty, error: null };
      });
      recalcTotal(updated);
      return updated;
    });
  };

  const handleGroupChange = (
    currentGroupLabel: string,
    subjectId: string,
    newGroupId: string
  ) => {
    const newGroupLabel = groups.find((g) => g.id === newGroupId)?.label ?? currentGroupLabel;
    setGroupedRows((prev) => {
      const updated: GroupedRows = {};
      GROUP_ORDER.forEach((label) => {
        updated[label] = [...(prev[label] ?? [])];
      });

      const row = updated[currentGroupLabel].find((r) => r.subject.id === subjectId);
      if (!row) return prev;
      updated[currentGroupLabel] = updated[currentGroupLabel].filter(
        (r) => r.subject.id !== subjectId
      );

      const newDirty =
        row.originalCoefficient === null ||
        newGroupId !== row.originalGroupId ||
        row.coefficient !== row.originalCoefficient;

      updated[newGroupLabel].push({
        ...row,
        subjectGroupId: newGroupId,
        dirty: newDirty,
        error: null,
      });

      recalcTotal(updated);
      return updated;
    });
  };

  const handleSaveRow = async (groupLabel: string, subjectId: string) => {
    const row = groupedRows[groupLabel]?.find((r) => r.subject.id === subjectId);
    if (!row || !selectedClassId) return;

    setGroupedRows((prev) => ({
      ...prev,
      [groupLabel]: prev[groupLabel].map((r) =>
        r.subject.id === subjectId ? { ...r, saving: true, error: null } : r
      ),
    }));

    try {
      const saved = await upsertCoefficient({
        class_id: selectedClassId,
        subject_id: subjectId,
        subject_group_id: row.subjectGroupId,
        coefficient: row.coefficient,
      });

      setGroupedRows((prev) => ({
        ...prev,
        [groupLabel]: prev[groupLabel].map((r) =>
          r.subject.id === subjectId
            ? {
                ...r,
                saving: false,
                dirty: false,
                coefficientId: saved.id,
                originalCoefficient: r.coefficient,
                originalGroupId: r.subjectGroupId,
              }
            : r
        ),
      }));
    } catch (err: any) {
      setGroupedRows((prev) => ({
        ...prev,
        [groupLabel]: prev[groupLabel].map((r) =>
          r.subject.id === subjectId
            ? { ...r, saving: false, error: "Erreur" }
            : r
        ),
      }));
    }
  };

  const handleSaveGroup = async (groupLabel: string) => {
    const dirtyRows = (groupedRows[groupLabel] ?? []).filter((r) => r.dirty);
    await Promise.all(
      dirtyRows.map((r) => handleSaveRow(groupLabel, r.subject.id))
    );
  };

  const toggleGroupCollapse = (groupLabel: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupLabel]: !prev[groupLabel],
    }));
  };

  const allDirty = Object.values(groupedRows).some((rows) =>
    rows.some((r) => r.dirty)
  );

  const handleSaveAll = async () => {
    for (const label of GROUP_ORDER) {
      await handleSaveGroup(label);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 pb-4 border-b border-line mb-6">
        <h1 className="font-display text-xl md:text-2xl font-semibold text-ink leading-tight">
          Coefficients par Classe
        </h1>
      </div>

      {/* Selectors */}
      <div className="flex flex-col md:flex-row md:items-end gap-4 mb-6 bg-paper-dark p-4 rounded border border-line">
        {/* Division */}
        <div className="flex-shrink-0">
          <label className="block text-xs font-semibold text-slate uppercase mb-1">
            Division
          </label>
          <div className="flex gap-1 p-1 bg-white border border-line rounded">
            {["college", "primaire"].map((div) => (
              <button
                key={div}
                onClick={() => { setSelectedDivision(div); setSelectedClassId(""); }}
                className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                  selectedDivision === div ? "bg-ink text-white" : "text-slate hover:bg-paper-dark"
                }`}
              >
                {div === "college" ? "Collège" : "Primaire"}
              </button>
            ))}
          </div>
        </div>

        {/* Classe */}
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate uppercase mb-1">
            Classe
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded text-sm bg-white focus:outline-none focus:border-ink h-10"
            disabled={loadingInit}
          >
            <option value="">— Sélectionner une classe —</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        {/* Total indicator & actions */}
        {selectedClassId && (
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <div className="text-center px-4 py-1 bg-white border border-line rounded min-w-[100px]">
              <span className="block text-[10px] font-semibold text-slate uppercase">Total coef.</span>
              <span
                className={`block text-xl font-mono font-bold ${
                  totalCoef === 29 ? "text-fanion-green" : "text-fanion-gold"
                }`}
              >
                {totalCoef}
              </span>
            </div>
            {isWriteAuthorized && allDirty && (
              <button
                onClick={handleSaveAll}
                className="px-4 py-2 bg-ink text-white text-xs font-semibold rounded hover:bg-opacity-90 transition flex-shrink-0"
              >
                Tout enregistrer
              </button>
            )}
          </div>
        )}
      </div>

      {pageError && (
        <div className="mb-4 p-3 bg-signal-red/10 border border-signal-red/20 rounded text-sm text-signal-red font-medium">
          {pageError}
        </div>
      )}

      {/* Content */}
      {!selectedClassId ? (
        <div className="py-12 border border-dashed border-line rounded bg-white text-center">
          <p className="text-sm text-slate font-medium">
            Sélectionnez une classe pour commencer
          </p>
        </div>
      ) : loadingCoefs ? (
        <div className="py-12 text-center text-sm font-medium text-slate">
          Chargement des coefficients...
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {GROUP_ORDER.map((groupLabel) => {
            const rows = groupedRows[groupLabel] ?? [];
            const isCollapsed = collapsedGroups[groupLabel];
            const groupSum = rows.reduce((s, r) => s + r.coefficient, 0);

            return (
              <div key={groupLabel} className="border border-line rounded bg-white overflow-hidden shadow-sm">
                {/* Header of Section */}
                <div
                  className="flex items-center justify-between px-4 py-3 bg-paper-dark border-b border-line cursor-pointer"
                  onClick={() => toggleGroupCollapse(groupLabel)}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded bg-ink text-white text-xs font-bold font-mono flex items-center justify-center flex-shrink-0">
                      {groupLabel}
                    </span>
                    <span className="text-sm font-semibold text-ink">Groupe {groupLabel}</span>
                    <span className="text-[11px] text-slate font-mono">
                      ({rows.length} mat. · Sum : {groupSum})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isWriteAuthorized && rows.some((r) => r.dirty) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveGroup(groupLabel);
                        }}
                        className="text-[11px] px-2 py-1 rounded bg-ink text-white font-semibold hover:bg-opacity-80 transition"
                      >
                        Sauver
                      </button>
                    )}
                    <svg
                      className={`w-4 h-4 text-slate transition-transform duration-200 ${
                        isCollapsed ? "transform -rotate-90" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Body of Section */}
                {!isCollapsed && (
                  <div>
                    {rows.length === 0 ? (
                      <p className="px-4 py-4 text-xs text-slate italic bg-white">
                        Aucune matière dans ce groupe.
                      </p>
                    ) : (
                      <>
                        {/* Desktop Table (hidden on mobile) */}
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full text-left">
                            <thead className="bg-paper-dark border-b border-line text-[11px] font-semibold text-slate uppercase">
                              <tr>
                                <th className="px-4 py-2">Matière</th>
                                <th className="px-4 py-2 w-36">Groupe</th>
                                <th className="px-4 py-2 w-32">Coefficient</th>
                                {isWriteAuthorized && <th className="px-4 py-2 w-24 text-right">Actions</th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                              {rows.map((row) => (
                                <tr key={row.subject.id} className={row.dirty ? "bg-fanion-gold/5" : ""}>
                                  <td className="px-4 py-2.5 text-sm font-semibold text-ink">
                                    {row.subject.name}
                                    {row.error && <span className="ml-2 text-xs text-signal-red font-medium">({row.error})</span>}
                                  </td>
                                  <td className="px-4 py-2.5">
                                    {isWriteAuthorized ? (
                                      <select
                                        value={row.subjectGroupId}
                                        onChange={(e) => handleGroupChange(groupLabel, row.subject.id, e.target.value)}
                                        className="text-xs border border-line rounded px-2 py-1 bg-white focus:outline-none"
                                      >
                                        {groups.map((g) => (
                                          <option key={g.id} value={g.id}>
                                            Groupe {g.label}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span className="text-xs font-semibold text-slate font-mono">Groupe {groupLabel}</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2.5">
                                    {isWriteAuthorized ? (
                                      <input
                                        type="number"
                                        max={10}
                                        value={row.coefficient}
                                        onChange={(e) => handleCoefficientChange(groupLabel, row.subject.id, e.target.value)}
                                        onBlur={() => row.dirty && handleSaveRow(groupLabel, row.subject.id)}
                                        className="w-16 text-center border border-line rounded px-2 py-1 text-xs font-mono font-bold"
                                        disabled={row.saving}
                                      />
                                    ) : (
                                      <span className="text-sm font-mono font-bold">{row.coefficient}</span>
                                    )}
                                  </td>
                                  {isWriteAuthorized && (
                                    <td className="px-4 py-2.5 text-right">
                                      {row.dirty && (
                                        <button
                                          onClick={() => handleSaveRow(groupLabel, row.subject.id)}
                                          className="text-xs text-ink font-semibold hover:underline"
                                        >
                                          Enregistrer
                                        </button>
                                      )}
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Cards (hidden on desktop) */}
                        <div className="md:hidden divide-y divide-line">
                          {rows.map((row) => (
                            <div
                              key={row.subject.id}
                              className={`p-4 flex flex-col gap-3 ${row.dirty ? "bg-fanion-gold/5" : ""}`}
                            >
                              <div className="flex justify-between items-start">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-ink truncate">{row.subject.name}</p>
                                  {row.error && <p className="text-xs text-signal-red mt-0.5">{row.error}</p>}
                                </div>
                                {row.dirty && !row.saving && isWriteAuthorized && (
                                  <button
                                    onClick={() => handleSaveRow(groupLabel, row.subject.id)}
                                    className="text-xs px-2 py-1 bg-ink text-white rounded font-medium"
                                  >
                                    Sauver
                                  </button>
                                )}
                              </div>

                              {isWriteAuthorized ? (
                                <div className="flex items-center gap-3">
                                  {/* Select group */}
                                  <div className="flex-1">
                                    <span className="block text-[10px] text-slate uppercase font-semibold mb-0.5">Groupe</span>
                                    <select
                                      value={row.subjectGroupId}
                                      onChange={(e) => handleGroupChange(groupLabel, row.subject.id, e.target.value)}
                                      className="w-full text-xs border border-line rounded px-2 py-1.5 bg-white"
                                    >
                                      {groups.map((g) => (
                                        <option key={g.id} value={g.id}>
                                          Groupe {g.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  {/* Coef input */}
                                  <div className="w-24">
                                    <span className="block text-[10px] text-slate uppercase font-semibold mb-0.5">Coef.</span>
                                    <input
                                      type="number"
                                      max={10}
                                      inputMode="decimal"
                                      value={row.coefficient}
                                      onChange={(e) => handleCoefficientChange(groupLabel, row.subject.id, e.target.value)}
                                      onBlur={() => row.dirty && handleSaveRow(groupLabel, row.subject.id)}
                                      className="w-full border border-line rounded px-2 py-1.5 text-xs text-center font-mono font-bold"
                                      disabled={row.saving}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-4 text-xs text-slate font-medium">
                                  <span>Groupe : <strong className="text-ink font-mono">{groupLabel}</strong></span>
                                  <span>Coef : <strong className="text-ink font-mono">{row.coefficient}</strong></span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CoefficientsPage;
