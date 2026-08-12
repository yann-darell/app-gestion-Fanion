import React from "react";
import { Class } from "../../../../electron/types/students";
import Input from "../../../components/ui/Input";

interface StudentFiltersProps {
    classes: Class[];
    classIdFilter: number | undefined;
    setClassIdFilter: (id: number | undefined) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
}

export const StudentFilters: React.FC<StudentFiltersProps> = ({
    classes,
    classIdFilter,
    setClassIdFilter,
    searchQuery,
    setSearchQuery
}) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-white p-4 rounded border border-line mb-6">
            <div className="md:col-span-2">
                <Input
                    label="Rechercher un élève"
                    placeholder="Nom, prénom ou matricule..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            <div className="flex flex-col gap-1.5 w-full">
                <label className="font-sans text-xs font-semibold text-slate uppercase tracking-wider">
                    Filtrer par classe
                </label>
                <select
                    className="w-full px-3 py-2 border border-line rounded font-sans transition-colors duration-150 focus:outline-none focus:border-2 focus:border-ink h-10 bg-white text-sm"
                    value={classIdFilter || ""}
                    onChange={(e) =>
                        setClassIdFilter(
                            e.target.value ? Number(e.target.value) : undefined
                        )
                    }
                >
                    <option value="">Toutes les classes</option>
                    {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                            {cls.name} ({cls.level})
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
};

export default StudentFilters;
