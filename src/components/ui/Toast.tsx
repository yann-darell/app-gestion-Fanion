import React, { useEffect } from "react";

export interface ToastProps {
    message: string;
    type?: "success" | "error";
    isOpen: boolean;
    onClose: () => void;
    duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
    message,
    type = "success",
    isOpen,
    onClose,
    duration = 3000,
}) => {
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                onClose();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [isOpen, onClose, duration]);

    if (!isOpen) return null;

    const typeStyles = {
        success: "border-l-4 border-fanion-green bg-white text-ink",
        error: "border-l-4 border-signal-red bg-white text-ink",
    };

    return (
        <div className="fixed bottom-5 right-5 z-50 transition-all duration-300 transform translate-y-0">
            <div
                className={`flex items-center gap-3 px-4 py-3 rounded shadow-lg border border-line ${typeStyles[type]} min-w-[280px] max-w-[400px]`}
                role="alert"
            >
                {type === "success" ? (
                    <svg
                        className="w-5 h-5 text-fanion-green flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                ) : (
                    <svg
                        className="w-5 h-5 text-signal-red flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                )}
                <span className="font-sans text-sm font-medium leading-tight">
                    {message}
                </span>
                <button
                    onClick={onClose}
                    className="ml-auto text-slate hover:text-ink transition-colors p-1 rounded hover:bg-paper"
                    aria-label="Fermer la notification"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default Toast;
