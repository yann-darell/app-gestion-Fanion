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
} from "@fanion/shared";
import PageContainer from "../../components/ui/PageContainer";
import PageHeader from "../../components/ui/PageHeader";

interface CoefficientsPageProps {
  userRole?: string;
}

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

export const CoefficientsPage: React.FC<CoefficientsPageProps> = ({ userRole }) => {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [groups, setGroups] = useState<SubjectGroupRecord[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedDivision, setSelectedDivision] = useState<string>("college");

  const [groupedRows, setGroupedRows] = useState<GroupedRows>({});
  const [totalCoef, setTotalCoef] = useState<number>(0);

  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingCoefs, setLoadingCoefs] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

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
        setSelectedClassId("");
        setGroupedRows({});
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
    if (isNaN(num) || num < 1) return; // Validation sans bloquer l'input
    setGroupedRows((prev) => {
      const updated = { ...prev };
      updated[groupLabel] = updated[groupLabel].map((row) => {
        if (row.subject.id !== subjectId) return row;
        // Dirty si jamais sauvegardé en base (null) OU si valeur/groupe differ de l'originale
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
                // Mettre à jour l'originale pour les prochaines comparaisons
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
            ? { ...r, saving: false, error: "Erreur de sauvegarde." }
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

  const allDirty = Object.values(groupedRows).some((rows) =>
    rows.some((r) => r.dirty)
  );

  const handleSaveAll = async () => {
    for (const label of GROUP_ORDER) {
      await handleSaveGroup(label);
    }
  };

  return (
    <PageContainer>
      <PageHeader title="Coefficients par Classe" />

      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div>
          <label className="block text-xs font-semibold text-slate uppercase mb-1">
            Division
          </label>
          <div className="flex gap-1 p-1 bg-paper border border-line rounded">
            {["college", "primaire"].map((div) => (
              <button
                key={div}
                id={`coef-division-${div}`}
                onClick={() => { setSelectedDivision(div); setSelectedClassId(""); }}
                className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                  selectedDivision === div ? "bg-ink text-white" : "text-slate hover:bg-line/40"
                }`}
              >
                {div === "college" ? "Collège" : "Primaire"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label
            htmlFor="select-class-coef"
            className="block text-xs font-semibold text-slate uppercase mb-1"
          >
            Classe
          </label>
          <select
            id="select-class-coef"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-ink"
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

        {selectedClassId && (
          <div className="flex items-end gap-3">
            <div className="text-center px-4 py-2 bg-paper border border-line rounded">
              <span className="block text-xs font-semibold text-slate uppercase">Total coef.</span>
              <span
                className={`block text-2xl font-mono font-bold ${
                  totalCoef === 29 ? "text-fanion-green" : "text-fanion-gold"
                }`}
              >
                {totalCoef}
              </span>
              {totalCoef !== 29 && (
                <span className="text-[10px] text-slate">≠ 29 (réf. 6ème)</span>
              )}
            </div>
            {isWriteAuthorized && allDirty && (
              <button
                id="btn-save-all-coefs"
                onClick={handleSaveAll}
                className="px-4 py-2 bg-ink text-white text-sm font-semibold rounded hover:bg-opacity-90 transition"
              >
                Tout enregistrer
              </button>
            )}
          </div>
        )}
      </div>

      {pageError && (
        <div className="mb-4 p-4 bg-signal-red/10 border border-signal-red/20 rounded text-sm text-signal-red font-medium">
          {pageError}
        </div>
      )}

      {!selectedClassId ? (
        <div className="py-12 border border-dashed border-line rounded bg-white text-center">
          <p className="text-sm text-slate font-medium">
            Sélectionnez une classe pour configurer ses coefficients
          </p>
        </div>
      ) : loadingCoefs ? (
        <div className="py-12 text-center text-sm font-medium text-slate">
          Chargement des coefficients...
        </div>
      ) : (
        <div className="space-y-6">
          {GROUP_ORDER.map((groupLabel) => {
            const rows = groupedRows[groupLabel] ?? [];
            return (
              <div
                key={groupLabel}
                className="border border-line rounded bg-white overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 bg-ink/5 border-b border-line">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded bg-ink text-white text-xs font-bold font-mono flex items-center justify-center flex-shrink-0">
                      {groupLabel}
                    </span>
                    <span className="text-sm font-semibold text-ink">
                      Groupe {groupLabel}
                    </span>
                    <span className="text-xs text-slate font-mono">
                      ({rows.length} matière{rows.length !== 1 ? "s" : ""} —{" "}
                      Σ coef.{" "}
                      <strong>
                        {rows.reduce((s, r) => s + r.coefficient, 0)}
                      </strong>
                      )
                    </span>
                  </div>
                  {isWriteAuthorized && rows.some((r) => r.dirty) && (
                    <button
                      onClick={() => handleSaveGroup(groupLabel)}
                      className="text-xs px-3 py-1 rounded bg-ink text-white font-semibold hover:bg-opacity-80 transition"
                    >
                      Enregistrer le groupe
                    </button>
                  )}
                </div>

                {rows.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate italic">
                    Aucune matière assignée à ce groupe
                  </p>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-line text-left text-xs font-semibold text-slate uppercase tracking-wider">
                        <th className="px-4 py-2">Matière</th>
                        <th className="px-4 py-2 w-32">Groupe</th>
                        <th className="px-4 py-2 w-28">Coefficient</th>
                        {isWriteAuthorized && (
                          <th className="px-4 py-2 w-24 text-right">Action</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr
                          key={row.subject.id}
                          className={`border-b border-line/50 last:border-b-0 ${
                            row.dirty ? "bg-fanion-gold/5" : ""
                          }`}
                        >
                          <td className="px-4 py-2.5 text-sm font-medium text-ink">
                            {row.subject.name}
                            {row.dirty && (
                              <span className="ml-2 text-[10px] text-fanion-gold font-semibold uppercase">
                                modifié
                              </span>
                            )}
                            {row.error && (
                              <span className="ml-2 text-[10px] text-signal-red font-semibold">
                                {row.error}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            {isWriteAuthorized ? (
                              <select
                                id={`group-select-${row.subject.id}`}
                                value={row.subjectGroupId}
                                onChange={(e) =>
                                  handleGroupChange(groupLabel, row.subject.id, e.target.value)
                                }
                                className="text-xs border border-line rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-ink font-mono font-bold"
                              >
                                {groups.map((g) => (
                                  <option key={g.id} value={g.id}>
                                    Groupe {g.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs font-mono font-bold text-slate">
                                Groupe {groupLabel}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            {isWriteAuthorized ? (
                              <input
                                id={`coef-input-${row.subject.id}`}
                                type="number"
                                max={10}
                                value={row.coefficient}
                                onChange={(e) =>
                                  handleCoefficientChange(groupLabel, row.subject.id, e.target.value)
                                }
                                onBlur={() =>
                                  row.dirty && handleSaveRow(groupLabel, row.subject.id)
                                }
                                className="w-16 text-center border border-line rounded px-2 py-1 text-sm font-mono font-bold focus:outline-none focus:ring-1 focus:ring-ink"
                                disabled={row.saving}
                              />
                            ) : (
                              <span className="text-sm font-mono font-bold">
                                {row.coefficient}
                              </span>
                            )}
                            {row.saving && (
                              <span className="ml-2 text-[10px] text-slate">
                                Enreg...
                              </span>
                            )}
                          </td>
                          {isWriteAuthorized && (
                            <td className="px-4 py-2.5 text-right">
                              {row.dirty && !row.saving && (
                                <button
                                  onClick={() => handleSaveRow(groupLabel, row.subject.id)}
                                  className="text-xs text-fanion-green font-semibold hover:underline"
                                >
                                  Sauvegarder
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
};

export default CoefficientsPage;
