import React, { useEffect, useState } from "react";
import { 
  listClasses, 
  ClassRecord, 
  SchoolYearRecord,
  supabase
} from "@fanion/shared";
import PageContainer from "../../components/ui/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/Table";
import { ClassModal } from "./components/ClassModal";

interface ClassesPageProps {
  userRole?: string;
}

export const ClassesPage: React.FC<ClassesPageProps> = ({ userRole }) => {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [schoolYears, setSchoolYears] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDivision, setFilterDivision] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRecord | null>(null);

  const isWriteAuthorized = userRole === "principal" || userRole === "directeur_etudes";

  const fetchClassesData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch classes list
      const data = await listClasses(filterDivision);
      setClasses(data);

      // 2. Fetch school years to map IDs to labels
      const { data: syData, error: syErr } = await supabase
        .from("school_years")
        .select("id, label");
        
      if (syErr) throw syErr;
      
      const syMap: Record<string, string> = {};
      syData?.forEach(sy => {
        syMap[sy.id] = sy.label;
      });
      setSchoolYears(syMap);
    } catch (err: any) {
      console.error("Erreur de chargement des classes:", err);
      setError("Impossible de charger la liste des classes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassesData();
  }, [filterDivision]);

  const handleEditClick = (cls: ClassRecord) => {
    setEditingClass(cls);
    setIsModalOpen(true);
  };

  const handleCreateClick = () => {
    setEditingClass(null);
    setIsModalOpen(true);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Gestion des Classes"
        actions={
          isWriteAuthorized && (
            <Button onClick={handleCreateClick} className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
              Créer une classe
            </Button>
          )
        }
      />

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-6 p-2 bg-paper rounded border border-line">
        <span className="text-xs font-semibold text-slate uppercase tracking-wider px-2">
          Division :
        </span>
        <button
          onClick={() => setFilterDivision("all")}
          className={`px-3 py-1.5 rounded text-xs font-medium transition duration-150 ${
            filterDivision === "all"
              ? "bg-[#150A5E] text-white"
              : "text-slate hover:bg-paper-dark"
          }`}
        >
          Toutes
        </button>
        <button
          onClick={() => setFilterDivision("college")}
          className={`px-3 py-1.5 rounded text-xs font-medium transition duration-150 ${
            filterDivision === "college"
              ? "bg-[#150A5E] text-white"
              : "text-slate hover:bg-paper-dark"
          }`}
        >
          Collège
        </button>
        <button
          onClick={() => setFilterDivision("primaire")}
          className={`px-3 py-1.5 rounded text-xs font-medium transition duration-150 ${
            filterDivision === "primaire"
              ? "bg-[#150A5E] text-white"
              : "text-slate hover:bg-paper-dark"
          }`}
        >
          Primaire
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-signal-red/10 border border-signal-red/20 rounded text-sm text-signal-red font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm font-medium text-slate">
          Chargement de la liste des classes...
        </div>
      ) : classes.length === 0 ? (
        <div className="py-12 border border-dashed border-line rounded bg-white text-center">
          <p className="text-sm text-slate font-medium">Aucune classe trouvée</p>
          {isWriteAuthorized && (
            <button
              onClick={handleCreateClick}
              className="mt-3 text-xs font-semibold text-[#150A5E] hover:underline"
            >
              Créer la toute première classe maintenant
            </button>
          )}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Niveau</TableHead>
              <TableHead>Division</TableHead>
              <TableHead>Année Scolaire</TableHead>
              <TableHead>Professeur Principal</TableHead>
              {isWriteAuthorized && <TableHead className="w-24 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.map((cls) => (
              <TableRow key={cls.id}>
                <TableCell className="font-semibold text-ink">{cls.name}</TableCell>
                <TableCell>{cls.level}</TableCell>
                <TableCell>
                  <Badge variant={cls.division_id === "college" ? "default" : "secondary"}>
                    {cls.division_id === "college" ? "Collège" : "Primaire"}
                  </Badge>
                </TableCell>
                <TableCell fontMono>{schoolYears[cls.school_year_id] || cls.school_year_id}</TableCell>
                <TableCell>
                  {cls.head_teacher_name ? (
                    <span className="text-ink font-medium">{cls.head_teacher_name}</span>
                  ) : (
                    <span className="text-slate italic text-xs">Non assigné</span>
                  )}
                </TableCell>
                {isWriteAuthorized && (
                  <TableCell className="text-right">
                    <button
                      onClick={() => handleEditClick(cls)}
                      className="p-1 text-slate hover:text-[#150A5E] hover:bg-paper rounded transition duration-150 inline-flex items-center justify-center"
                      title="Modifier la classe"
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

      <ClassModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={fetchClassesData}
        editingClass={editingClass}
      />
    </PageContainer>
  );
};

export default ClassesPage;
