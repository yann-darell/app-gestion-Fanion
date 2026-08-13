import React from "react";
import { NavLink } from "react-router-dom";

export const Sidebar: React.FC = () => {
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

    return (
        <aside className="w-64 bg-ink text-paper h-screen flex flex-col flex-shrink-0 border-r border-line/10">
            {/* Header / Logo section */}
            <div className="p-6 flex items-center gap-3 border-b border-line/10">
                {/* Brand Flag SVG */}
                <svg width="24" height="28" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                    <path d="M 0,2 Q 12,7 24,2 L 12,26 Z" fill="#C99A3B" />
                </svg>
                <div className="flex flex-col">
                    <span className="font-display font-bold text-lg leading-none tracking-wide text-paper">LE FANION</span>
                    <span className="font-sans text-[10px] text-slate uppercase tracking-wider mt-1">Gestion Scolaire</span>
                </div>
            </div>

            {/* Navigation links */}
            <nav className="flex-1 px-4 py-6 flex flex-col gap-1">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded text-sm font-medium transition-all duration-150 relative ${
                                isActive
                                    ? "bg-white/5 text-paper font-semibold animate-fade-in"
                                    : "text-slate hover:text-paper hover:bg-white/5"
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                {/* Active marker: triangle flag pointing right */}
                                {isActive && (
                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center pl-1 text-fanion-gold">
                                        <svg width="6" height="8" viewBox="0 0 6 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M0,0.5 L6,4 L0,7.5 Z" fill="currentColor" />
                                        </svg>
                                    </span>
                                )}
                                <span className={isActive ? "text-fanion-gold pl-1.5" : "pl-1.5"}>{item.icon}</span>
                                <span className="pl-0.5">{item.label}</span>
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-line/10 text-center">
                <span className="font-mono text-[10px] text-slate">v0.1.0 (Lot 0)</span>
            </div>
        </aside>
    );
};

export default Sidebar;
