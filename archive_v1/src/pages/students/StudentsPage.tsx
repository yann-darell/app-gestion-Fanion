import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageContainer from "../../components/ui/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import EmptyState from "../../components/ui/EmptyState";
import Button from "../../components/ui/Button";
import {
    Table,
    TableHeader,
    TableBody,
    TableHead
} from "../../components/ui/Table";
import { useStudents } from "../../hooks/useStudents";
import { useClasses } from "../../hooks/useClasses";
import StudentFilters from "./components/StudentFilters";
import StudentRow from "./components/StudentRow";
import NewStudentModal from "./components/NewStudentModal";
import { Student } from "../../../electron/types/students";

export default function StudentsPage() {
    const navigate = useNavigate();
    const {
        students,
        loading: loadingStudents,
        error: studentsError,
        fetchStudents,
        createStudent,
        updateStudent,
        deleteStudent,
        pickPhoto
    } = useStudents();

    const { classes } = useClasses();

    // Filtres
    const [classIdFilter, setClassIdFilter] = useState<number | undefined>(undefined);
    const [searchQuery, setSearchQuery] = useState("");

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);

    // Charger les élèves lors du changement de filtre
    useEffect(() => {
        fetchStudents({ classId: classIdFilter, search: searchQuery });
    }, [classIdFilter, searchQuery, fetchStudents]);

    const handleOpenCreateModal = () => {
        setEditingStudent(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (student: Student) => {
        setEditingStudent(student);
        setIsModalOpen(true);
    };

    const handleModalSubmit = async (data: any) => {
        if (editingStudent) {
            const res = await updateStudent(editingStudent.id, data);
            if (res.ok) {
                fetchStudents({ classId: classIdFilter, search: searchQuery });
                return true;
            } else {
                throw new Error(res.error);
            }
        } else {
            const res = await createStudent(data);
            if (res.ok) {
                fetchStudents({ classId: classIdFilter, search: searchQuery });
                return true;
            } else {
                throw new Error(res.error);
            }
        }
    };

    const handleDeleteStudent = async (student: Student) => {
        const confirmed = window.confirm(
            `Êtes-vous sûr de vouloir désactiver l'élève ${student.first_name.toUpperCase()} ${student.last_name.toUpperCase()} ? Son profil passera au statut Inactif.`
        );
        if (confirmed) {
            const res = await deleteStudent(student.id);
            if (res.ok) {
                fetchStudents({ classId: classIdFilter, search: searchQuery });
            } else {
                alert(`Erreur de désactivation : ${res.error}`);
            }
        }
    };

    const hasFilters = classIdFilter !== undefined || searchQuery.trim() !== "";

    return (
        <PageContainer>
            <PageHeader
                title="Gestion des Élèves"
                actions={
                    <Button variant="primary" onClick={handleOpenCreateModal}>
                        Inscrire un élève
                    </Button>
                }
            />

            {/* Barre de filtres */}
            <StudentFilters
                classes={classes}
                classIdFilter={classIdFilter}
                setClassIdFilter={setClassIdFilter}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
            />

            {/* Affichage des états de chargement / erreur */}
            {studentsError && (
                <div className="p-4 mb-4 bg-signal-red/10 border border-signal-red/20 text-signal-red rounded font-sans text-sm font-medium">
                    {studentsError}
                </div>
            )}

            {loadingStudents && students.length === 0 ? (
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
                <div className="bg-white rounded border border-line overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Matricule</TableHead>
                            <TableHead>Nom complet</TableHead>
                            <TableHead>Classe</TableHead>
                            <TableHead>Tuteur / Contact</TableHead>
                            <TableHead className="w-16 text-center">Genre</TableHead>
                            <TableHead className="w-28">Statut</TableHead>
                            <TableHead className="w-48 text-right">Actions</TableHead>
                        </TableHeader>
                        <TableBody>
                            {students.map((student) => (
                                <StudentRow
                                    key={student.id}
                                    student={student}
                                    onEdit={handleOpenEditModal}
                                    onDelete={handleDeleteStudent}
                                    onViewDetails={(s) => navigate(`/students/${s.id}`)}
                                />
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Modal d'inscription / édition */}
            <NewStudentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleModalSubmit}
                student={editingStudent}
                classes={classes}
                pickPhoto={pickPhoto}
            />
        </PageContainer>
    );
}
