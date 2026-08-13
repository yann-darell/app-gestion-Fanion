import React from "react";
import { NavLink } from "react-router-dom";

interface SidebarProps {
  isOpenOnMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpenOnMobile, onCloseMobile }) => {
  const navItems = [
    {
      to: "/students",
      label: "Élèves",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    },
    {
      to: "/classes",
      label: "Classes",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    },
    {
      to: "/grades",
      label: "Bulletins & Notes",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      to: "/finance",
      label: "Finance & Scolarité",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      to: "/settings",
      label: "Paramètres",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    }
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#150A5E] text-[#FAF9F5] border-r border-[#FAF9F5]/10">
      {/* Header / Logo section */}
      <div className="p-6 flex items-center gap-3 border-b border-[#FAF9F5]/10">
        <svg width="24" height="28" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
          <path d="M 0,2 Q 12,7 24,2 L 12,26 Z" fill="#C99A3B" />
        </svg>
        <div className="flex flex-col">
          <span className="font-display font-bold text-lg leading-none tracking-wide text-[#FAF9F5]">LE FANION</span>
          <span className="font-sans text-[10px] text-[#FAF9F5]/60 uppercase tracking-wider mt-1">Gestion Scolaire</span>
        </div>
      </div>

      {/* Navigation links */}
      <nav className="flex-grow px-4 py-6 flex flex-col gap-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onCloseMobile}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded text-sm font-medium transition-all duration-150 relative ${
                isActive
                  ? "bg-white/10 text-white font-semibold"
                  : "text-[#FAF9F5]/70 hover:text-white hover:bg-white/5"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center pl-1 text-[#C99A3B]">
                    <svg width="6" height="8" viewBox="0 0 6 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M0,0.5 L6,4 L0,7.5 Z" fill="currentColor" />
                    </svg>
                  </span>
                )}
                <span className={isActive ? "text-[#C99A3B] pl-1.5" : "pl-1.5"}>{item.icon}</span>
                <span className="pl-0.5">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[#FAF9F5]/10 text-center">
        <span className="font-mono text-[10px] text-[#FAF9F5]/60">v0.1.0 (Lot B Web)</span>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:flex-shrink-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (Sidebar) */}
      {isOpenOnMobile && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 transition-opacity duration-300"
            onClick={onCloseMobile}
          />

          {/* Drawer Content */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#150A5E] focus:outline-none transition transform duration-300 ease-in-out">
            {/* Close button inside drawer */}
            <div className="absolute top-2 right-2 p-1">
              <button
                onClick={onCloseMobile}
                className="flex items-center justify-center w-8 h-8 rounded-full text-[#FAF9F5]/60 hover:text-white focus:outline-none hover:bg-white/10"
                aria-label="Fermer le menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {sidebarContent}
          </div>
          
          {/* Dummy spacing so slide-in matches viewport width bounds */}
          <div className="flex-shrink-0 w-14" aria-hidden="true" />
        </div>
      )}
    </>
  );
};

export default Sidebar;
