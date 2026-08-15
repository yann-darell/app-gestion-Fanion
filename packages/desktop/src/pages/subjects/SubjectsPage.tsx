import React, { useEffect, useState, useCallback } from "react";
import {
  listSubjects,
  createSubject,
  updateSubject,
  SubjectRecord,
} from "@fanion/shared";
import PageContainer from "../../components/ui/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import { Button } from "../../components/ui/Button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../../components/ui/Table";
import { Badge } from "../../components/ui/Badge";
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

  return (
    <PageContainer>
      <PageHeader
        title="Gestion des Matières"
        actions={
          isWriteAuthorized && (
            <Button onClick={handleCreate} className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
              Nouvelle matière
            </Button>
          )
        }
      />

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-6 p-2 bg-paper rounded border border-line">
        <span className="text-xs font-semibold text-slate uppercase tracking-wider px-2">
          Division :
        </span>
        {(["all", "college", "primaire"] as const).map((div) => (
          <button
            key={div}
            id={`filter-division-${div}`}
            onClick={() => setFilterDivision(div)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition duration-150 ${
              filterDivision === div
                ? "bg-ink text-white"
                : "text-slate hover:bg-line/40"
            }`}
          >
            {div === "all" ? "Toutes" : DIVISION_LABELS[div]}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-signal-red/10 border border-signal-red/20 rounded text-sm text-signal-red font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm font-medium text-slate">
          Chargement des matières...
        </div>
      ) : subjects.length === 0 ? (
        <div className="py-12 border border-dashed border-line rounded bg-white text-center">
          <p className="text-sm text-slate font-medium">Aucune matière configurée pour cette division</p>
          {isWriteAuthorized && (
            <button
              onClick={handleCreate}
              className="mt-3 text-xs font-semibold text-ink hover:underline"
            >
              Créer la première matière
            </button>
          )}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Division</TableHead>
              {isWriteAuthorized && (
                <TableHead className="w-24 text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {subjects.map((subject) => (
              <TableRow key={subject.id}>
                <TableCell className="font-semibold text-ink">
                  {subject.name}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={subject.division_id === "college" ? "default" : "secondary"}
                  >
                    {DIVISION_LABELS[subject.division_id] || subject.division_id}
                  </Badge>
                </TableCell>
                {isWriteAuthorized && (
                  <TableCell className="text-right">
                    <button
                      id={`edit-subject-${subject.id}`}
                      onClick={() => handleEdit(subject)}
                      className="p-1 text-slate hover:text-ink hover:bg-paper rounded transition duration-150 inline-flex items-center justify-center"
                      title="Modifier la matière"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <SubjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={fetchSubjects}
        editingSubject={editingSubject}
        defaultDivision={filterDivision !== "all" ? filterDivision : "college"}
      />
    </PageContainer>
  );
};

export default SubjectsPage;
