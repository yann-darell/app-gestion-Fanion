import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getStudent,
  listClasses,
  getStudentPhotoUrl,
  StudentRecord,
  ClassRecord,
} from "@fanion/shared";
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
      <div className="p-4 md:p-6">
        <div className="flex items-center justify-center py-12 text-slate font-sans text-sm">
          Chargement de la fiche élève…
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-4 md:p-6">
        <button
          onClick={() => navigate("/students")}
          className="text-sm font-semibold text-slate hover:text-ink transition mb-4"
        >
          ← Retour à la liste
        </button>
        <p className="text-sm text-slate font-sans">Élève introuvable.</p>
      </div>
    );
  }

  const initials =
    `${student.first_name.charAt(0)}${student.last_name.charAt(0)}`.toUpperCase();

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <button
            onClick={() => navigate("/students")}
            className="text-xs font-semibold text-slate hover:text-ink transition mb-1 inline-block"
          >
            ← Retour à la liste
          </button>
          <h1 className="text-2xl font-bold font-display text-ink">Fiche élève</h1>
        </div>
        {isWriteAuthorized && (
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="px-4 py-2 bg-ink text-white rounded text-sm font-semibold hover:bg-opacity-90 transition self-start sm:self-auto"
          >
            Modifier
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Avatar Card */}
        <div className="col-span-1 bg-white border border-line rounded p-6 flex flex-col items-center gap-4 text-center shadow-sm">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={`${student.first_name} ${student.last_name}`}
              className="w-28 h-28 rounded-full object-cover border-2 border-line shadow-sm"
            />
          ) : (
            <div className="w-28 h-28 rounded-full bg-paper-dark text-slate flex items-center justify-center text-3xl font-bold border-2 border-line shadow-sm">
              {initials}
            </div>
          )}

          <div>
            <h2 className="text-xl font-display font-bold text-ink">
              <span className="uppercase">{student.last_name}</span>{" "}
              {student.first_name}
            </h2>
            <p className="text-sm font-mono text-slate mt-1">{student.matricule}</p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                student.status === "active"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-rose-100 text-rose-800"
              }`}
            >
              {student.status === "active" ? "Actif" : "Inactif"}
            </span>
            {student.is_repeating && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                Redoublant
              </span>
            )}
          </div>

          <p className="text-sm font-medium text-ink">
            {classNameMap[student.class_id] || "Non affecté"}
          </p>
        </div>

        {/* Right Info Section */}
        <div className="col-span-2 bg-white border border-line rounded p-6 shadow-sm">
          <h3 className="font-display text-lg font-bold text-ink mb-4 border-b border-line pb-2">
            Informations administratives
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            <InfoField label="Nom de famille" value={student.last_name} />
            <InfoField label="Prénom" value={student.first_name} />
            <InfoField label="Date de naissance" value={formatDate(student.birth_date)} />
            <InfoField label="Lieu de naissance" value={student.birth_place || "—"} />
            <InfoField label="Genre" value={student.gender === "M" ? "Masculin" : "Féminin"} />
            <InfoField label="Nationalité" value={student.nationality || "—"} />
            <InfoField label="Matricule" value={student.matricule || "—"} mono />
            <InfoField label="Classe" value={classNameMap[student.class_id] || "Non affecté"} />
            <InfoField label="Statut redoublant" value={student.is_repeating ? "Oui" : "Non"} />
            <InfoField label="Statut" value={student.status === "active" ? "Actif" : "Inactif"} />
          </div>

          <h3 className="font-display text-lg font-bold text-ink mt-8 mb-4 border-b border-line pb-2">
            Tuteur / Responsable légal
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            <InfoField label="Nom du tuteur" value={student.guardian_name} />
            <InfoField label="Téléphone" value={student.guardian_phone} mono />
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
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-sans font-semibold text-slate uppercase tracking-wider">
        {label}
      </span>
      <span className={`text-sm text-ink ${mono ? "font-mono" : "font-sans"}`}>
        {value}
      </span>
    </div>
  );
}
