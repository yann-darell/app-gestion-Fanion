import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageContainer from "../../components/ui/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { Student, Class } from "../../../electron/types/students";
import NewStudentModal from "./components/NewStudentModal";

function formatDate(dateStr: string | undefined | null): string {
    if (!dateStr) return "—";
    const parts = dateStr.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
}

export default function StudentDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const numId = Number(id);

    const [student, setStudent] = useState<Student | null>(null);
    const [classes, setClasses] = useState<Class[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const loadStudent = useCallback(async () => {
        setLoading(true);
        try {
            const [studentRes, classesRes] = await Promise.all([
                window.api.students.get(numId),
                window.api.classes.list()
            ]);
            if (studentRes.ok) {
                setStudent(studentRes.data);
            }
            if (classesRes.ok) {
                setClasses(classesRes.data);
            }
        } catch {
            // silencieux
        }
        setLoading(false);
    }, [numId]);

    useEffect(() => {
        loadStudent();
    }, [loadStudent]);

    const handleEditSubmit = async (data: any) => {
        const res = await window.api.students.update(numId, data);
        if (res.ok) {
            await loadStudent();
            return true;
        }
        throw new Error(res.error);
    };

    const handlePickPhoto = async () => {
        return await window.api.students.pickPhoto();
    };

    if (loading) {
        return (
            <PageContainer>
                <div className="flex items-center justify-center py-12 text-slate font-sans text-sm">
                    Chargement de la fiche élève…
                </div>
            </PageContainer>
        );
    }

    if (!student) {
        return (
            <PageContainer>
                <PageHeader
                    title="Fiche élève"
                    actions={
                        <Button variant="secondary" onClick={() => navigate("/students")}>
                            ← Retour à la liste
                        </Button>
                    }
                />
                <p className="text-sm text-slate font-sans">Élève introuvable.</p>
            </PageContainer>
        );
    }

    const initials = `${student.first_name.charAt(0)}${student.last_name.charAt(0)}`.toUpperCase();

    return (
        <PageContainer>
            <PageHeader
                title="Fiche élève"
                actions={
                    <div className="flex items-center gap-3">
                        <Button variant="secondary" onClick={() => navigate("/students")}>
                            ← Retour à la liste
                        </Button>
                        <Button variant="secondary" onClick={() => setIsEditModalOpen(true)}>
                            Modifier
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() => navigate(`/finance/student/${student.id}`)}
                        >
                            Fiche financière
                        </Button>
                    </div>
                }
            />

            <div className="grid grid-cols-3 gap-6">
                {/* Colonne gauche : Photo & identité */}
                <div className="col-span-1 bg-white border border-line rounded p-6 flex flex-col items-center gap-4">
                    {student.photo_filename ? (
                        <img
                            src={`fanion-photo://${student.photo_filename}`}
                            alt={`${student.first_name} ${student.last_name}`}
                            className="w-32 h-32 rounded-full object-cover border-2 border-line shadow-sm"
                        />
                    ) : (
                        <div className="w-32 h-32 rounded-full bg-paper-dark text-slate flex items-center justify-center text-3xl font-bold font-sans border-2 border-line shadow-sm">
                            {initials}
                        </div>
                    )}

                    <div className="text-center">
                        <h2 className="text-xl font-display font-semibold text-ink">
                            <span className="uppercase">{student.last_name}</span>{" "}
                            {student.first_name}
                        </h2>
                        <p className="text-sm font-mono-data text-slate mt-1">
                            {student.matricule}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Badge variant={student.status === "active" ? "green" : "red"}>
                            {student.status === "active" ? "Actif" : "Inactif"}
                        </Badge>
                        {student.is_repeating === 1 && (
                            <Badge variant="gold">Redoublant</Badge>
                        )}
                    </div>

                    <p className="text-sm font-sans text-ink font-medium">
                        {student.class_name || "Non affecté"}
                    </p>
                </div>

                {/* Colonne droite : Informations détaillées */}
                <div className="col-span-2 bg-white border border-line rounded p-6">
                    <h3 className="font-display text-lg font-semibold text-ink mb-5 border-b border-line pb-3">
                        Informations administratives
                    </h3>

                    <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                        <InfoField label="Nom de famille" value={student.last_name} />
                        <InfoField label="Prénom" value={student.first_name} />
                        <InfoField label="Date de naissance" value={formatDate(student.birth_date)} />
                        <InfoField label="Lieu de naissance" value={student.birth_place || "—"} />
                        <InfoField label="Genre" value={student.gender === "M" ? "Masculin" : "Féminin"} />
                        <InfoField label="Nationalité" value={student.nationality || "—"} />
                        <InfoField label="Matricule" value={student.matricule} mono />
                        <InfoField label="Classe" value={student.class_name || "Non affecté"} />
                        <InfoField
                            label="Statut redoublant"
                            value={student.is_repeating === 1 ? "Oui" : "Non"}
                        />
                        <InfoField
                            label="Statut"
                            value={student.status === "active" ? "Actif" : "Inactif"}
                        />
                    </div>

                    <h3 className="font-display text-lg font-semibold text-ink mt-8 mb-5 border-b border-line pb-3">
                        Tuteur / Responsable légal
                    </h3>

                    <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                        <InfoField label="Nom du tuteur" value={student.guardian_name} />
                        <InfoField label="Téléphone" value={student.guardian_phone} mono />
                    </div>
                </div>
            </div>

            {/* Modal d'édition */}
            <NewStudentModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSubmit={handleEditSubmit}
                student={student}
                classes={classes}
                pickPhoto={handlePickPhoto}
            />
        </PageContainer>
    );
}

/** Composant utilitaire pour afficher un champ label/valeur */
function InfoField({
    label,
    value,
    mono = false
}: {
    label: string;
    value: string;
    mono?: boolean;
}) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs font-sans font-semibold text-slate uppercase tracking-wider">
                {label}
            </span>
            <span className={`text-sm text-ink ${mono ? "font-mono-data" : "font-sans"}`}>
                {value}
            </span>
        </div>
    );
}
