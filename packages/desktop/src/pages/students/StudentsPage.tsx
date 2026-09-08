import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  listStudents,
  listClasses,
  deactivateStudent,
  getStudentPhotoUrl,
  StudentRecord,
  ClassRecord,
  useSelectionPersistence,
  getStudentsSuppliesSummaryMap,
  StudentSupplySummary,
} from "@fanion/shared";
import StudentFilters from "./components/StudentFilters";
import NewStudentModal from "./components/NewStudentModal";
import { StudentSuppliesModal } from "./components/StudentSuppliesModal";
import { PackageIcon } from "../../components/ui/Icons";

export default function StudentsPage({ userRole }: { userRole?: string }) {
  const navigate = useNavigate();

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [classNameMap, setClassNameMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fournitures summary map: studentId -> StudentSupplySummary
  const [suppliesMap, setSuppliesMap] = useState<Record<string, StudentSupplySummary>>({});

  // Filters
  const [classIdFilter, setClassIdFilter] = useSelectionPersistence("classId", "all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);

  // Fournitures Modal
  const [suppliesModalStudent, setSuppliesModalStudent] = useState<StudentRecord | null>(null);

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

  const fetchSuppliesSummary = useCallback(
    async (studentList: StudentRecord[], classList: ClassRecord[]) => {
      if (!isWriteAuthorized || studentList.length === 0 || classList.length === 0) return;
      try {
        const studentIds = studentList.map((s) => s.id);
        const map = await getStudentsSuppliesSummaryMap(studentIds, classList);
        setSuppliesMap(map);
      } catch (err) {
        console.warn("Erreur chargement résumé fournitures:", err);
      }
    },
    [isWriteAuthorized]
  );

  const fetchStudentsList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listStudents({
        classId: classIdFilter,
        search: searchQuery,
      });
      setStudents(data);
      if (classes.length > 0) {
        fetchSuppliesSummary(data, classes);
      }
    } catch (err: any) {
      console.error("Erreur chargement élèves:", err);
      setError("Impossible de charger la liste des élèves.");
    } finally {
      setLoading(false);
    }
  }, [classIdFilter, searchQuery, classes, fetchSuppliesSummary]);

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

  const handleOpenSuppliesModal = (student: StudentRecord) => {
    setSuppliesModalStudent(student);
  };

  const handleDeleteStudent = async (student: StudentRecord) => {
    const confirmed = window.confirm(
      `Désactiver l'élève ${student.first_name.toUpperCase()} ${student.last_name.toUpperCase()} ?`
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

  const selectedClass = suppliesModalStudent
    ? classes.find((c) => c.id === suppliesModalStudent.class_id) || null
    : null;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header aligné sur le Web */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-ink">Élèves</h1>
          <p className="text-sm text-slate">
            Effectif, inscription et suivi des fournitures des élèves
          </p>
        </div>
        {isWriteAuthorized && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => navigate("/settings?tab=supplies")}
              className="px-3.5 py-2 bg-paper-dark hover:bg-slate/10 text-slate-700 border border-line rounded text-sm font-medium transition flex items-center gap-1.5 cursor-pointer"
              title="Configurer la liste des fournitures demandées"
            >
              <PackageIcon className="w-4 h-4 text-indigo-600" />
              <span>Fournitures</span>
            </button>
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 bg-ink text-white rounded text-sm font-semibold hover:bg-opacity-90 transition cursor-pointer"
            >
              + Inscrire un élève
            </button>
          </div>
        )}
      </div>

      <StudentFilters
        classes={classes}
        classIdFilter={classIdFilter}
        setClassIdFilter={setClassIdFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {error && (
        <div className="p-4 mb-4 bg-rose-50 border border-rose-200 text-rose-700 rounded text-sm font-medium">
          {error}
        </div>
      )}

      {loading && students.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-slate font-sans text-sm">
          Chargement des élèves en cours...
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white p-8 rounded border border-line text-center shadow-sm">
          <p className="text-slate font-medium text-sm">
            {hasFilters
              ? "Aucun élève ne correspond aux critères."
              : "Aucun élève inscrit dans l'établissement."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded border border-line overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-line bg-paper-dark/50 text-slate uppercase text-[11px] font-semibold tracking-wider">
                  <th className="py-3 px-4 w-12"></th>
                  <th className="py-3 px-4">Matricule</th>
                  <th className="py-3 px-4">Nom complet</th>
                  <th className="py-3 px-4">Classe</th>
                  <th className="py-3 px-4">Tuteur</th>
                  <th className="py-3 px-4 text-center">Genre</th>
                  <th className="py-3 px-4">Statut</th>
                  {isWriteAuthorized && <th className="py-3 px-4 text-center">Fournitures</th>}
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {students.map((student) => (
                  <StudentRowDesktop
                    key={student.id}
                    student={student}
                    classNameMap={classNameMap}
                    isWriteAuthorized={isWriteAuthorized}
                    supplySummary={suppliesMap[student.id]}
                    onEdit={handleOpenEditModal}
                    onDelete={handleDeleteStudent}
                    onOpenSupplies={handleOpenSuppliesModal}
                    onViewDetails={(s) => navigate(`/students/${s.id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {students.map((student) => (
              <StudentCardMobile
                key={student.id}
                student={student}
                classNameMap={classNameMap}
                isWriteAuthorized={isWriteAuthorized}
                supplySummary={suppliesMap[student.id]}
                onEdit={handleOpenEditModal}
                onDelete={handleDeleteStudent}
                onOpenSupplies={handleOpenSuppliesModal}
                onViewDetails={(s) => navigate(`/students/${s.id}`)}
              />
            ))}
          </div>
        </>
      )}

      <NewStudentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={fetchStudentsList}
        editingStudent={editingStudent}
        classes={classes}
      />

      <StudentSuppliesModal
        isOpen={!!suppliesModalStudent}
        onClose={() => setSuppliesModalStudent(null)}
        student={suppliesModalStudent}
        studentClass={selectedClass}
        onUpdateSummary={() => fetchSuppliesSummary(students, classes)}
      />
    </div>
  );
}

function StudentRowDesktop({
  student,
  classNameMap,
  isWriteAuthorized,
  supplySummary,
  onEdit,
  onDelete,
  onOpenSupplies,
  onViewDetails,
}: {
  student: StudentRecord;
  classNameMap: Record<string, string>;
  isWriteAuthorized: boolean;
  supplySummary?: StudentSupplySummary;
  onEdit: (s: StudentRecord) => void;
  onDelete: (s: StudentRecord) => void;
  onOpenSupplies: (s: StudentRecord) => void;
  onViewDetails: (s: StudentRecord) => void;
}) {
  const navigate = useNavigate();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (student.photo_path) {
      getStudentPhotoUrl(student.photo_path).then(setPhotoUrl);
    }
  }, [student.photo_path]);

  const initials =
    `${student.first_name.charAt(0)}${student.last_name.charAt(0)}`.toUpperCase();

  const totalReq = supplySummary?.total_required ?? 0;
  const givenCount = supplySummary?.given_count ?? 0;

  return (
    <tr className="hover:bg-paper/50 transition">
      <td className="py-3 px-4">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt="Avatar"
            className="w-8 h-8 rounded-full object-cover border border-line"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-paper-dark text-slate flex items-center justify-center text-xs font-bold border border-line">
            {initials}
          </div>
        )}
      </td>
      <td className="py-3 px-4 font-mono font-semibold text-slate">
        {student.matricule}
      </td>
      <td className="py-3 px-4 font-medium text-ink">
        <span className="uppercase">{student.last_name}</span>{" "}
        {student.first_name}
      </td>
      <td className="py-3 px-4">{classNameMap[student.class_id] || "—"}</td>
      <td className="py-3 px-4">
        <div className="flex flex-col text-xs">
          <span className="text-ink font-medium">{student.guardian_name}</span>
          <span className="text-slate font-mono">{student.guardian_phone}</span>
        </div>
      </td>
      <td className="py-3 px-4 text-center">
        {student.gender === "M" ? "M" : "F"}
      </td>
      <td className="py-3 px-4">
        {student.status === "active" ? (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Actif / Inscrit
          </span>
        ) : student.status === "pending_registration" ? (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            En attente
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate/10 text-slate border border-slate/20">
            Inactif
          </span>
        )}
      </td>
      {isWriteAuthorized && (
        <td className="py-3 px-4 text-center">
          {totalReq === 0 ? (
            <span className="text-xs text-slate-400 font-mono">—</span>
          ) : (
            <button
              onClick={() => onOpenSupplies(student)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition cursor-pointer hover:shadow-xs ${
                givenCount === totalReq
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  : givenCount > 0
                  ? "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                  : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
              }`}
              title="Cliquer pour pointer les fournitures"
            >
              <PackageIcon className="w-3.5 h-3.5" />
              <span>
                {givenCount}/{totalReq}
              </span>
            </button>
          )}
        </td>
      )}
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-2 text-xs">
          <button
            onClick={() => onViewDetails(student)}
            className="text-emerald-700 font-semibold hover:underline cursor-pointer"
          >
            Détails
          </button>
          {isWriteAuthorized && (
            <>
              <button
                onClick={() => navigate(`/finance/payments?studentId=${student.id}&classId=${student.class_id}`)}
                className="text-amber-800 font-semibold hover:underline cursor-pointer"
              >
                Payer
              </button>
              <button
                onClick={() => onEdit(student)}
                className="text-ink font-medium hover:underline cursor-pointer"
              >
                Modifier
              </button>
              {student.status !== "inactive" && (
                <button
                  onClick={() => onDelete(student)}
                  className="text-rose-600 font-medium hover:underline cursor-pointer"
                >
                  Désactiver
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function StudentCardMobile({
  student,
  classNameMap,
  isWriteAuthorized,
  supplySummary,
  onEdit,
  onDelete,
  onOpenSupplies,
  onViewDetails,
}: {
  student: StudentRecord;
  classNameMap: Record<string, string>;
  isWriteAuthorized: boolean;
  supplySummary?: StudentSupplySummary;
  onEdit: (s: StudentRecord) => void;
  onDelete: (s: StudentRecord) => void;
  onOpenSupplies: (s: StudentRecord) => void;
  onViewDetails: (s: StudentRecord) => void;
}) {
  const navigate = useNavigate();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (student.photo_path) {
      getStudentPhotoUrl(student.photo_path).then(setPhotoUrl);
    }
  }, [student.photo_path]);

  const initials =
    `${student.first_name.charAt(0)}${student.last_name.charAt(0)}`.toUpperCase();

  const totalReq = supplySummary?.total_required ?? 0;
  const givenCount = supplySummary?.given_count ?? 0;

  return (
    <div className="bg-white border border-line rounded p-4 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center gap-3">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt="Avatar"
            className="w-12 h-12 rounded-full object-cover border border-line"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-paper-dark text-slate flex items-center justify-center text-sm font-bold border border-line">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-ink truncate">
            <span className="uppercase">{student.last_name}</span>{" "}
            {student.first_name}
          </h3>
          <p className="text-xs font-mono text-slate">{student.matricule}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {student.status === "active" ? (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Actif / Inscrit
            </span>
          ) : student.status === "pending_registration" ? (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
              En attente
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate/10 text-slate border border-slate/20">
              Inactif
            </span>
          )}

          {isWriteAuthorized && totalReq > 0 && (
            <button
              onClick={() => onOpenSupplies(student)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition cursor-pointer ${
                givenCount === totalReq
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : givenCount > 0
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              <PackageIcon className="w-3 h-3" />
              <span>{givenCount}/{totalReq} fournies</span>
            </button>
          )}
        </div>
      </div>

      <div className="text-xs text-slate border-t border-b border-line py-2 flex flex-col gap-1">
        <div>
          <strong className="text-ink font-medium">Classe : </strong>
          {classNameMap[student.class_id] || "—"}
        </div>
        <div>
          <strong className="text-ink font-medium">Tuteur : </strong>
          {student.guardian_name} ({student.guardian_phone})
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 text-xs">
        <button
          onClick={() => onViewDetails(student)}
          className="text-emerald-700 font-semibold hover:underline cursor-pointer"
        >
          Détails
        </button>
        {isWriteAuthorized && (
          <>
            <button
              onClick={() => navigate(`/finance/payments?studentId=${student.id}&classId=${student.class_id}`)}
              className="text-amber-800 font-semibold hover:underline cursor-pointer"
            >
              Payer
            </button>
            <button
              onClick={() => onEdit(student)}
              className="text-ink font-medium hover:underline cursor-pointer"
            >
              Modifier
            </button>
            {student.status !== "inactive" && (
              <button
                onClick={() => onDelete(student)}
                className="text-rose-600 font-medium hover:underline cursor-pointer"
              >
                Désactiver
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
