import { CreditCardIcon, EyeIcon, DownloadIcon, FileTextIcon, CloseIcon, PackageIcon } from "../../components/ui/Icons";
import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  supabase,
  getStudent,
  listClasses,
  getStudentPhotoUrl,
  getStudentPaymentsWithReceipts,
  getReceiptSignedUrl,
  getStudentsSuppliesSummaryMap,
  StudentRecord,
  ClassRecord,
  PaymentWithReceipt,
  StudentSupplySummary,
} from "@fanion/shared";
import NewStudentModal from "./components/NewStudentModal";
import { StudentSuppliesModal } from "./components/StudentSuppliesModal";

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
  const [isSuppliesModalOpen, setIsSuppliesModalOpen] = useState(false);
  const [supplySummary, setSupplySummary] = useState<StudentSupplySummary | null>(null);

  const [effectiveRole, setEffectiveRole] = useState<string | undefined>(userRole);

  useEffect(() => {
    if (userRole) {
      setEffectiveRole(userRole);
    } else {
      supabase.from("profiles").select("role").eq("id", (supabase.auth.getUser() as any)?.data?.user?.id).single().then(({ data }) => {
        if (data?.role) setEffectiveRole(data.role);
      });
    }
  }, [userRole]);

  const isWriteAuthorized =
    effectiveRole === "principal" || effectiveRole === "directeur_etudes";

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

      // Charger le résumé des fournitures
      try {
        const summaryMap = await getStudentsSuppliesSummaryMap([stData.id], clsData);
        setSupplySummary(summaryMap[stData.id] || null);
      } catch (e) {
        console.warn("Erreur chargement résumé fournitures élève:", e);
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
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => navigate(`/finance/payments?studentId=${student.id}&classId=${student.class_id}`)}
              className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded text-sm font-semibold transition shadow-sm"
            >
              <span className="inline-flex items-center gap-1.5"><CreditCardIcon className="w-4 h-4" /> Enregistrer un paiement</span>
            </button>
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="px-4 py-2 bg-ink text-white rounded text-sm font-semibold hover:bg-opacity-90 transition"
            >
              Modifier
            </button>
          </div>
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
            {student.status === "active" ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Actif / Inscrit
              </span>
            ) : student.status === "pending_registration" ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                En attente d'inscription
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate/10 text-slate border border-slate/20">
                Inactif
              </span>
            )}
            {student.is_repeating && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                Redoublant
              </span>
            )}
          </div>

          <p className="text-sm font-medium text-ink">
            {classNameMap[student.class_id] || "Non affecté"}
          </p>

          {/* Bloc Fournitures Scolaires */}
          {isWriteAuthorized && (
            <div className="w-full mt-2 pt-4 border-t border-line flex flex-col items-center gap-2">
              <span className="text-xs uppercase font-semibold text-slate tracking-wider">
                Fournitures Scolaires
              </span>
              {supplySummary && supplySummary.total_required > 0 ? (
                <div className="w-full flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-600">État :</span>
                    <span className={supplySummary.given_count === supplySummary.total_required ? "text-emerald-700" : "text-amber-800"}>
                      {supplySummary.given_count} / {supplySummary.total_required} apportées
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        supplySummary.given_count === supplySummary.total_required
                          ? "bg-emerald-500"
                          : supplySummary.given_count > 0
                          ? "bg-amber-500"
                          : "bg-slate-300"
                      }`}
                      style={{
                        width: `${Math.round(
                          (supplySummary.given_count / supplySummary.total_required) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <button
                    onClick={() => setIsSuppliesModalOpen(true)}
                    className="mt-2 w-full py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-semibold border border-indigo-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <PackageIcon className="w-3.5 h-3.5" />
                    <span>Pointer les fournitures</span>
                  </button>
                </div>
              ) : (
                <div className="w-full text-center">
                  <p className="text-xs text-slate-400 italic">Aucune exigence configurée</p>
                  <button
                    onClick={() => setIsSuppliesModalOpen(true)}
                    className="mt-2 w-full py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded text-xs font-medium border border-line transition cursor-pointer"
                  >
                    Vérifier les fournitures
                  </button>
                </div>
              )}
            </div>
          )}
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
            <InfoField
              label="Statut"
              value={
                student.status === "active"
                  ? "Actif / Inscrit"
                  : student.status === "pending_registration"
                  ? "En attente d'inscription"
                  : "Inactif"
              }
            />
          </div>

          <h3 className="font-display text-lg font-bold text-ink mt-8 mb-4 border-b border-line pb-2">
            Tuteur / Responsable légal
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            <InfoField label="Nom du tuteur" value={student.guardian_name} />
            <InfoField label="Téléphone" value={student.guardian_phone} mono />
          </div>

          {/* Section Historique des paiements & Reçus (Réservée exclusivement au Principal et Directeur des Études - SECURITE.md §3.2) */}
          {isWriteAuthorized && (
            <StudentPaymentsHistorySection studentId={student.id} studentName={`${student.last_name} ${student.first_name}`} />
          )}
        </div>
      </div>

      <NewStudentModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={loadStudentData}
        editingStudent={student}
        classes={classes}
      />

      <StudentSuppliesModal
        isOpen={isSuppliesModalOpen}
        onClose={() => setIsSuppliesModalOpen(false)}
        student={student}
        studentClass={classes.find((c) => c.id === student.class_id) || null}
        onUpdateSummary={loadStudentData}
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

function StudentPaymentsHistorySection({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const [payments, setPayments] = useState<PaymentWithReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadPayments() {
      try {
        setLoading(true);
        const data = await getStudentPaymentsWithReceipts(studentId);
        setPayments(data || []);
      } catch (e) {
        console.error("Erreur chargement paiements élève:", e);
        setPayments([]);
      } finally {
        setLoading(false);
      }
    }
    loadPayments();
  }, [studentId]);

  const formatAmount = (amt: number) =>
    Math.round(amt || 0)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  if (loading) {
    return (
      <div className="mt-8 pt-4 border-t border-line text-xs text-slate italic">
        Chargement de l'historique des paiements…
      </div>
    );
  }

  const hasPayments = Array.isArray(payments) && payments.length > 0;

  return (
    <div className="mt-8 pt-4 border-t border-line space-y-3">
      <h3 className="font-display text-lg font-bold text-ink border-b border-line pb-2 flex items-center justify-between">
        <span>Historique des paiements & Reçus</span>
        <span className="text-xs font-normal text-slate font-sans">
          {hasPayments ? payments.length : 0} versement(s)
        </span>
      </h3>

      {!hasPayments ? (
        <p className="text-xs text-slate italic py-2">
          Aucun paiement enregistré pour cet élève.
        </p>
      ) : (
        <div className="space-y-2">
          {payments.map((p) => {
            const pdfPath = p.receipt_pdf_path;
            return (
              <div
                key={p.id}
                className="p-3 border border-line rounded bg-paper text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <div className="font-bold text-ink flex items-center gap-2">
                    <span>Reçu N° {p.student_receipt_seq || p.receipt_number}</span>
                    <span className="text-[10px] text-slate font-mono font-normal">
                      (Réf global : N° {p.receipt_number})
                    </span>
                    <span className="text-emerald-800 font-bold ml-1">
                      {formatAmount(Number(p.amount))} FCFA
                    </span>
                  </div>
                  <div className="text-slate text-[11px]">
                    Date : {p.payment_date} • Mode : <strong className="uppercase">{p.method}</strong> • Catégorie :{" "}
                    <strong>{p.payment_category === "registration" ? "Inscription" : "Scolarité"}</strong>
                  </div>
                  {p.tranche_ciblee && (
                    <div className="text-slate/80 text-[10px] italic">
                      {p.tranche_ciblee}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        if (pdfPath) {
                          const url = await getReceiptSignedUrl(pdfPath);
                          setPreviewPdfUrl(url);
                        } else {
                          alert("Aucun reçu PDF associé à ce paiement.");
                        }
                      } catch (err: any) {
                        alert("Erreur lors de la récupération du reçu: " + err?.message);
                      }
                    }}
                    className="px-2.5 py-1.5 bg-white border border-line hover:bg-paper text-ink font-bold rounded text-[11px] transition flex items-center gap-1"
                  >
                    <EyeIcon className="w-3.5 h-3.5" /> Voir
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        if (pdfPath) {
                          const url = await getReceiptSignedUrl(pdfPath);
                          const response = await fetch(url);
                          const blob = await response.blob();
                          const downloadUrl = window.URL.createObjectURL(blob);
                          const link = document.createElement("a");
                          link.href = downloadUrl;
                          link.download = `Recu_${studentName.replace(/\s+/g, "_")}_N${p.student_receipt_seq || p.receipt_number}.pdf`;
                          document.body.appendChild(link);
                          link.click();
                          link.remove();
                          window.URL.revokeObjectURL(downloadUrl);
                        } else {
                          alert("Aucun reçu PDF disponible au téléchargement.");
                        }
                      } catch (err: any) {
                        alert("Erreur lors du téléchargement: " + err?.message);
                      }
                    }}
                    className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded text-[11px] transition flex items-center gap-1"
                  >
                    <DownloadIcon className="w-3.5 h-3.5" /> Télécharger
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modale de prévisualisation PDF Iframe */}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden border border-line">
            <div className="p-4 bg-ink text-white flex items-center justify-between">
              <h3 className="font-display font-bold text-sm flex items-center gap-2">
                <FileTextIcon className="w-4 h-4" /> Aperçu du Reçu Officiel
              </h3>
              <button
                onClick={() => setPreviewPdfUrl(null)}
                className="w-8 h-8 rounded hover:bg-white/20 flex items-center justify-center text-lg font-bold transition"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-slate/10 p-2">
              <iframe
                src={previewPdfUrl}
                className="w-full h-full rounded border-0"
                title="Aperçu Reçu PDF"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
