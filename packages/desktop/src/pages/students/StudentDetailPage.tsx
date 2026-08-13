import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getStudent,
  listClasses,
  getStudentPhotoUrl,
  StudentRecord,
  ClassRecord,
} from "@fanion/shared";
import { PageHeader } from "../../components/ui/PageHeader";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import NewStudentModal from "./components/NewStudentModal";

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "—";
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

export default function StudentDetailPage({ userRole }: { userRole?: string }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [classNameMap, setClassNameMap] = useState<Record<string, string>>({});
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const isWriteAuthorized =
    userRole === "principal" || userRole === "directeur_etudes";

  const loadStudentData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [stData, clsData] = await Promise.all([
        getStudent(id),
        listClasses(),
      ]);
      setStudent(stData);
      setClasses(clsData);

      const map: Record<string, string> = {};
      clsData.forEach((c) => {
        map[c.id] = `${c.name} (${c.level})`;
      });
      setClassNameMap(map);

      if (stData.photo_path) {
        const url = await getStudentPhotoUrl(stData.photo_path);
        setPhotoUrl(url);
      } else {
        setPhotoUrl(null);
      }
    } catch (err) {
      console.error("Erreur chargement élève:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadStudentData();
  }, [loadStudentData]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12 text-slate font-sans text-sm">
          Chargement de la fiche élève…
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-6">
        <PageHeader
          title="Fiche élève"
          actions={
            <Button variant="secondary" onClick={() => navigate("/students")}>
              ← Retour à la liste
            </Button>
          }
        />
        <p className="text-sm text-slate font-sans mt-4">Élève introuvable.</p>
      </div>
    );
  }

  const initials =
    `${student.first_name.charAt(0)}${student.last_name.charAt(0)}`.toUpperCase();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Fiche élève"
        actions={
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => navigate("/students")}>
              ← Retour à la liste
            </Button>
            {isWriteAuthorized && (
              <Button
                variant="secondary"
                onClick={() => setIsEditModalOpen(true)}
              >
                Modifier
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        {/* Left Column: Avatar & Summary */}
        <div className="col-span-1 bg-white border border-line rounded p-6 flex flex-col items-center gap-4">
          {photoUrl ? (
            <img
              src={photoUrl}
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
            {student.is_repeating && <Badge variant="gold">Redoublant</Badge>}
          </div>

          <p className="text-sm font-sans text-ink font-medium">
            {classNameMap[student.class_id] || "Non affecté"}
          </p>
        </div>

        {/* Right Column: Detailed Info */}
        <div className="col-span-2 bg-white border border-line rounded p-6">
          <h3 className="font-display text-lg font-semibold text-ink mb-5 border-b border-line pb-3">
            Informations administratives
          </h3>

          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            <InfoField label="Nom de famille" value={student.last_name} />
            <InfoField label="Prénom" value={student.first_name} />
            <InfoField
              label="Date de naissance"
              value={formatDate(student.birth_date)}
            />
            <InfoField
              label="Lieu de naissance"
              value={student.birth_place || "—"}
            />
            <InfoField
              label="Genre"
              value={student.gender === "M" ? "Masculin" : "Féminin"}
            />
            <InfoField
              label="Nationalité"
              value={student.nationality || "—"}
            />
            <InfoField label="Matricule" value={student.matricule} mono />
            <InfoField
              label="Classe"
              value={classNameMap[student.class_id] || "Non affecté"}
            />
            <InfoField
              label="Statut redoublant"
              value={student.is_repeating ? "Oui" : "Non"}
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
            <InfoField
              label="Téléphone"
              value={student.guardian_phone}
              mono
            />
          </div>
        </div>
      </div>

      <NewStudentModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={loadStudentData}
        editingStudent={student}
        classes={classes}
      />
    </div>
  );
}

function InfoField({
  label,
  value,
  mono = false,
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
      <span
        className={`text-sm text-ink ${mono ? "font-mono-data" : "font-sans"}`}
      >
        {value}
      </span>
    </div>
  );
}
