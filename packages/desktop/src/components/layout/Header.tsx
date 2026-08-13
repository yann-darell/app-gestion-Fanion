import React from "react";

interface HeaderProps {
    userFullName?: string;
    userRole?: string;
    onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ userFullName, userRole, onLogout }) => {
    return (
        <header className="h-16 border-b border-line bg-white px-6 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
                <span className="font-sans text-sm font-semibold text-ink">
                    Le Fanion — Système de Gestion Administrative
                </span>
            </div>
            <div className="flex items-center gap-4">
                {userFullName && (
                    <div className="flex items-center gap-3 border-r border-line pr-4">
                        <div className="text-right">
                            <p className="text-xs font-semibold text-ink">{userFullName}</p>
                            <p className="text-[10px] text-slate uppercase tracking-wider capitalize font-medium">{userRole}</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-ink/10 text-ink flex items-center justify-center font-bold text-xs uppercase">
                            {userFullName.charAt(0)}
                        </div>
                    </div>
                )}
                
                <button
                    onClick={onLogout}
                    className="px-3 py-1.5 border border-signal-red text-signal-red hover:bg-red-50 rounded text-xs font-semibold transition duration-150"
                >
                    Déconnexion
                </button>
            </div>
        </header>
    );
};

export default Header;

