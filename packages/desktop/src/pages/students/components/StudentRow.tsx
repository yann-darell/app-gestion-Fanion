import React, { useEffect, useState } from "react";
import { StudentRecord, getStudentPhotoUrl } from "@fanion/shared";
import { TableRow, TableCell } from "../../../components/ui/Table";
import { Badge } from "../../../components/ui/Badge";

interface StudentRowProps {
  student: StudentRecord;
  classNameMap: Record<string, string>;
  isWriteAuthorized: boolean;
  onEdit: (student: StudentRecord) => void;
  onDelete: (student: StudentRecord) => void;
  onViewDetails: (student: StudentRecord) => void;
}

export const StudentRow: React.FC<StudentRowProps> = ({
  student,
  classNameMap,
  isWriteAuthorized,
  onEdit,
  onDelete,
  onViewDetails,
}) => {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (student.photo_path) {
      getStudentPhotoUrl(student.photo_path).then((url) => {
        if (mounted) setPhotoUrl(url);
      });
    } else {
      setPhotoUrl(null);
    }
    return () => {
      mounted = false;
    };
  }, [student.photo_path]);

  const initials =
    `${student.first_name.charAt(0)}${student.last_name.charAt(0)}`.toUpperCase();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="green">Inscrit</Badge>;
      case "inactive":
        return <Badge variant="red">Inactif</Badge>;
      case "pending_registration":
        return <Badge variant="gold">En attente</Badge>;
      default:
        return <Badge variant="green">Inscrit</Badge>;
    }
  };

  return (
    <TableRow>
      {/* Photo */}
      <TableCell className="w-12">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={`${student.first_name} ${student.last_name}`}
            className="w-8 h-8 rounded-full object-cover border border-line"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-paper-dark text-slate flex items-center justify-center text-xs font-semibold font-sans border border-line">
            {initials}
          </div>
        )}
      </TableCell>

      {/* Matricule */}
      <TableCell fontMono className="font-semibold text-slate">
        {student.matricule}
      </TableCell>

      {/* Nom & Prénom */}
      <TableCell className="font-medium text-ink">
        <span className="uppercase">{student.last_name}</span>{" "}
        {student.first_name}
      </TableCell>

      {/* Classe */}
      <TableCell>{classNameMap[student.class_id] || "Non affecté"}</TableCell>

      {/* Tuteur & Contact */}
      <TableCell>
        <div className="flex flex-col">
          <span className="text-xs text-ink">{student.guardian_name}</span>
          <span className="text-xs text-slate font-mono-data">
            {student.guardian_phone}
          </span>
        </div>
      </TableCell>

      {/* Genre */}
      <TableCell className="w-16 text-center">
        {student.gender === "M" ? "Masc." : "Fém."}
      </TableCell>

      {/* Statut Badge */}
      <TableCell className="w-28">{getStatusBadge(student.status)}</TableCell>

      {/* Actions */}
      <TableCell className="w-48 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onViewDetails(student)}
            className="text-xs font-semibold text-fanion-green hover:text-fanion-green/80 transition-colors duration-150 px-2 py-1 rounded hover:bg-fanion-green/5"
          >
            Détails
          </button>
          {isWriteAuthorized && (
            <>
              <button
                onClick={() => onEdit(student)}
                className="text-xs font-semibold text-ink hover:text-fanion-gold transition-colors duration-150 px-2 py-1 rounded hover:bg-paper"
              >
                Modifier
              </button>
              {student.status !== "inactive" && (
                <button
                  onClick={() => onDelete(student)}
                  className="text-xs font-semibold text-signal-red hover:text-signal-red/80 transition-colors duration-150 px-2 py-1 rounded hover:bg-signal-red/5"
                >
                  Désactiver
                </button>
              )}
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};

export default StudentRow;
