import React from "react";
import { Student } from "../../../../electron/types/students";
import { TableRow, TableCell } from "../../../components/ui/Table";
import Badge from "../../../components/ui/Badge";

interface StudentRowProps {
    student: Student;
    onEdit: (student: Student) => void;
    onDelete: (student: Student) => void;
    onViewDetails: (student: Student) => void;
}

export const StudentRow: React.FC<StudentRowProps> = ({
    student,
    onEdit,
    onDelete,
    onViewDetails
}) => {
    // Calculer les initiales pour le placeholder d'avatar
    const initials =
        `${student.first_name.charAt(0)}${student.last_name.charAt(0)}`.toUpperCase();

    return (
        <TableRow>
            {/* Photo / Profil */}
            <TableCell className="w-12">
                {student.photo_filename ? (
                    <img
                        src={`fanion-photo://${student.photo_filename}`}
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
            <TableCell>{student.class_name || "Non affecté"}</TableCell>

            {/* Tuteur & Contact */}
            <TableCell>
                <div className="flex flex-col">
                    <span className="text-xs text-ink">
                        {student.guardian_name}
                    </span>
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
            <TableCell className="w-28">
                <Badge variant="green">Inscrit</Badge>
            </TableCell>

            {/* Actions */}
            <TableCell className="w-48 text-right">
                <div className="flex items-center justify-end gap-2">
                    <button
                        onClick={() => onViewDetails(student)}
                        className="text-xs font-semibold text-fanion-green hover:text-fanion-green/80 transition-colors duration-150 px-2 py-1 rounded hover:bg-fanion-green/5"
                    >
                        Détails
                    </button>
                    <button
                        onClick={() => onEdit(student)}
                        className="text-xs font-semibold text-ink hover:text-fanion-gold transition-colors duration-150 px-2 py-1 rounded hover:bg-paper"
                    >
                        Modifier
                    </button>
                    <button
                        onClick={() => onDelete(student)}
                        className="text-xs font-semibold text-signal-red hover:text-signal-red/80 transition-colors duration-150 px-2 py-1 rounded hover:bg-signal-red/5"
                    >
                        Désactiver
                    </button>
                </div>
            </TableCell>
        </TableRow>
    );
};

export default StudentRow;
