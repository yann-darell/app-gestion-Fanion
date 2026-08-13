import React from "react";
import { ClassRecord } from "@fanion/shared";

interface StudentFiltersProps {
  classes: ClassRecord[];
  classIdFilter: string;
  setClassIdFilter: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const StudentFilters: React.FC<StudentFiltersProps> = ({
  classes,
  classIdFilter,
  setClassIdFilter,
  searchQuery,
  setSearchQuery,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white p-3 md:p-4 rounded border border-line mb-4 md:mb-6 shadow-sm">
      <div className="md:col-span-2">
        <label className="block font-sans text-xs font-semibold text-slate uppercase tracking-wider mb-1">
          Rechercher un élève
        </label>
        <input
          type="text"
          placeholder="Nom, prénom ou matricule..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border border-line rounded font-sans text-sm transition duration-150 focus:outline-none focus:border-ink h-10 bg-white"
        />
      </div>
      <div className="flex flex-col gap-1 w-full">
        <label className="font-sans text-xs font-semibold text-slate uppercase tracking-wider">
          Filtrer par classe
        </label>
        <select
          className="w-full px-3 py-2 border border-line rounded font-sans text-sm transition duration-150 focus:outline-none focus:border-ink h-10 bg-white"
          value={classIdFilter}
          onChange={(e) => setClassIdFilter(e.target.value)}
        >
          <option value="all">Toutes les classes</option>
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
