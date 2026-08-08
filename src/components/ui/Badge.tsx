import React from "react";

export interface BadgeProps {
    variant?: "green" | "gold" | "red" | "gray";
    children: React.ReactNode;
    className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
    variant = "gray",
    children,
    className = "",
}) => {
    // Classes for the text container
    const variantStyles = {
        green: "bg-[#1E7A4C]/10 text-fanion-green border border-[#1E7A4C]/25",
        gold: "bg-[#C99A3B]/10 text-fanion-gold border border-[#C99A3B]/25",
        red: "bg-[#B3432E]/5 text-signal-red border border-[#B3432E]/20",
        gray: "bg-[#5B6B82]/5 text-slate border border-[#5B6B82]/20",
    };

    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold font-sans uppercase tracking-wider ${variantStyles[variant]} ${className}`}
        >
            {/* The Pennant Flag SVG */}
            <svg
                width="10"
                height="12"
                viewBox="0 0 10 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="flex-shrink-0"
            >
                {variant === "green" && (
                    <path
                        d="M 0,1 Q 5,3.5 10,1 L 5,11 Z"
                        fill="#1E7A4C"
                    />
                )}
                {variant === "gold" && (
                    <path
                        d="M 0,1 Q 5,3.5 10,1 L 5,11 Z"
                        fill="#C99A3B"
                    />
                )}
                {variant === "red" && (
                    <path
                        d="M 1,2.5 Q 5,4.5 9,2.5 L 5,10.5 Z"
                        stroke="#B3432E"
                        strokeWidth="1.5"
                        fill="none"
                    />
                )}
                {variant === "gray" && (
                    <path
                        d="M 1,2.5 Q 5,4.5 9,2.5 L 5,10.5 Z"
                        stroke="#5B6B82"
                        strokeWidth="1.5"
                        fill="none"
                    />
                )}
            </svg>
            {children}
        </span>
    );
};

export default Badge;
