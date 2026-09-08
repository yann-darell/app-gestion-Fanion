import React from "react";
import { NavLink } from "react-router-dom";

interface BottomNavProps {
  userRole?: string;
}

export const BottomNav: React.FC<BottomNavProps> = ({ userRole }) => {
  // Uniquement visible et actif pour le rôle enseignant sur mobile (< md)
  if (userRole !== "enseignant") return null;

  return (
    <nav 
      aria-label="Navigation mobile enseignant"
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#E4E0D6] shadow-[0_-4px_12px_rgba(0,0,0,0.06)] flex items-center justify-around h-16 px-2 safe-area-bottom"
    >
      <NavLink
        to="/teacher/grades"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center flex-1 py-1 rounded transition-colors ${
            isActive
              ? "text-[#150A5E] font-bold"
              : "text-[#5B6B82] hover:text-[#150A5E] font-medium"
          }`
        }
      >
        {({ isActive }) => (
          <>
            <div className={`p-1 rounded-md transition-colors ${isActive ? "bg-[#150A5E]/10" : ""}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? "2.5" : "2"} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <span className="text-[11px] mt-0.5 tracking-tight">Saisir notes</span>
            {isActive && (
              <span className="w-4 h-0.5 bg-[#C99A3B] rounded-full mt-0.5" />
            )}
          </>
        )}
      </NavLink>

      <NavLink
        to="/teacher/evolution"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center flex-1 py-1 rounded transition-colors ${
            isActive
              ? "text-[#150A5E] font-bold"
              : "text-[#5B6B82] hover:text-[#150A5E] font-medium"
          }`
        }
      >
        {({ isActive }) => (
          <>
            <div className={`p-1 rounded-md transition-colors ${isActive ? "bg-[#150A5E]/10" : ""}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? "2.5" : "2"} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="text-[11px] mt-0.5 tracking-tight">Évolution &amp; Bordereau</span>
            {isActive && (
              <span className="w-4 h-0.5 bg-[#C99A3B] rounded-full mt-0.5" />
            )}
          </>
        )}
      </NavLink>
    </nav>
  );
};

export default BottomNav;
