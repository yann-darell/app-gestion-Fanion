import React from "react";

export const Header: React.FC = () => {
    return (
        <header className="h-16 border-b border-line bg-white px-6 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
                <span className="font-sans text-sm font-semibold text-ink">
                    Le Fanion — Système de Gestion Administrative
                </span>
            </div>
            <div className="flex items-center gap-4">
                {/* Database connection status indicator */}
                <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#1E7A4C]/5 border border-[#1E7A4C]/15 text-xs text-fanion-green font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-fanion-green" />
                    Base locale active
                </div>
            </div>
        </header>
    );
};

export default Header;
