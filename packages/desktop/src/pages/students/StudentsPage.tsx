import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  listStudents,
  listClasses,
  deactivateStudent,
  StudentRecord,
  ClassRecord,
} from "@fanion/shared";
import { PageHeader } from "../../components/ui/PageHeader";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
} from "../../components/ui/Table";
import StudentFilters from "./components/StudentFilters";
import StudentRow from "./components/StudentRow";
import NewStudentModal from "./components/NewStudentModal";

export default function StudentsPage({ userRole }: { userRole?: string }) {
  const navigate = useNavigate();

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [classNameMap, setClassNameMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [classIdFilter, setClassIdFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);

  const isWriteAuthorized =
    userRole === "principal" || userRole === "directeur_etudes";

  const fetchClasses = useCallback(async () => {
    try {
      const clsData = await listClasses();
      setClasses(clsData);

      const map: Record<string, string> = {};
      clsData.forEach((c) => {
        map[c.id] = `${c.name} (${c.level})`;
      });
      setClassNameMap(map);
    } catch (err) {
      console.error("Erreur chargement classes:", err);
    }
  }, []);

  const fetchStudentsList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listStudents({
        classId: classIdFilter,
        search: searchQuery,
      });
      setStudents(data);
    } catch (err: any) {
      console.error("Erreur chargement élèves:", err);
      setError("Impossible de charger la liste des élèves.");
    } finally {
      setLoading(false);
    }
  }, [classIdFilter, searchQuery]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    fetchStudentsList();
  }, [fetchStudentsList]);

  const handleOpenCreateModal = () => {
    setEditingStudent(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (student: StudentRecord) => {
    setEditingStudent(student);
    setIsModalOpen(true);
  };

  const handleDeleteStudent = async (student: StudentRecord) => {
    const confirmed = window.confirm(
      `Êtes-vous sûr de vouloir désactiver l'élève ${student.first_name.toUpperCase()} ${student.last_name.toUpperCase()} ? Son profil passera au statut Inactif.`
    );
    if (confirmed) {
      try {
        await deactivateStudent(student.id);
        fetchStudentsList();
      } catch (err: any) {
        alert(`Erreur de désactivation : ${err.message}`);
      }
    }
  };

  const hasFilters = classIdFilter !== "all" || searchQuery.trim() !== "";

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Gestion des Élèves"
        actions={
          isWriteAuthorized ? (
            <Button variant="primary" onClick={handleOpenCreateModal}>
              Inscrire un élève
            </Button>
          ) : undefined
        }
      />

      <StudentFilters
        classes={classes}
        classIdFilter={classIdFilter}
        setClassIdFilter={setClassIdFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {error && (
        <div className="p-4 mb-4 bg-signal-red/10 border border-signal-red/20 text-signal-red rounded font-sans text-sm font-medium">
          {error}
        </div>
      )}

      {loading && students.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-slate font-sans text-sm">
          Chargement des élèves en cours...
        </div>
      ) : students.length === 0 ? (
        <EmptyState
          title={hasFilters ? "Aucun élève trouvé" : "Aucun élève inscrit"}
          description={
            hasFilters
              ? "Essayez de modifier vos critères de recherche ou de filtre."
              : "Commencez par inscrire le premier élève de l'établissement en cliquant sur le bouton ci-dessus."
          }
        />
      ) : (
        <div className="bg-white rounded border border-line overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Matricule</TableHead>
                <TableHead>Nom complet</TableHead>
                <TableHead>Classe</TableHead>
                <TableHead>Tuteur / Contact</TableHead>
                <TableHead className="w-16 text-center">Genre</TableHead>
                <TableHead className="w-28">Statut</TableHead>
                <TableHead className="w-48 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <StudentRow
                  key={student.id}
                  student={student}
                  classNameMap={classNameMap}
                  isWriteAuthorized={isWriteAuthorized}
                  onEdit={handleOpenEditModal}
                  onDelete={handleDeleteStudent}
                  onViewDetails={(s) => navigate(`/students/${s.id}`)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <NewStudentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={fetchStudentsList}
        editingStudent={editingStudent}
        classes={classes}
      />
    </div>
  );
}
