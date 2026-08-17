import React from "react";

interface HeaderProps {
  userFullName?: string;
  userRole?: string;
  onLogout: () => void;
  onToggleMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  userFullName, 
  userRole, 
  onLogout, 
  onToggleMobileMenu 
}) => {
  return (
    <header className="h-16 border-b border-[#E4E0D6] bg-white px-4 md:px-6 flex items-center justify-between flex-shrink-0 sticky top-0 z-30">
      {/* Left side: hamburger menu on mobile, name on desktop */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="p-2 -ml-2 rounded-md text-slate hover:text-ink md:hidden focus:outline-none hover:bg-paper"
          aria-label="Ouvrir le menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <img src="/logo_fanion.webp" alt="Logo Le Fanion" className="w-7 h-7 object-contain" />
        <span className="font-sans text-sm font-semibold text-ink hidden sm:inline">
          Le Fanion — Portail Web de Gestion
        </span>
        <span className="font-sans text-sm font-semibold text-ink sm:hidden">
          Le Fanion
        </span>
      </div>

      {/* Right side: user profile & logout button */}
      <div className="flex items-center gap-2 md:gap-4">
        {userFullName && (
          <div className="flex items-center gap-2 md:gap-3 border-r border-line pr-2 md:pr-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-ink leading-tight">{userFullName}</p>
              <p className="text-[9px] text-slate uppercase tracking-wider capitalize font-medium">{userRole}</p>
            </div>
            <div 
              className="w-8 h-8 rounded-full bg-ink/10 text-ink flex items-center justify-center font-bold text-xs uppercase"
              title={`${userFullName} (${userRole})`}
            >
              {userFullName.charAt(0)}
            </div>
          </div>
        )}
        
        <button
          onClick={onLogout}
          className="px-2 py-1 md:px-3 md:py-1.5 border border-signal-red text-signal-red hover:bg-red-50 rounded text-xs font-semibold transition duration-150"
        >
          <span className="hidden sm:inline">Déconnexion</span>
          <span className="sm:hidden">Sortir</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
