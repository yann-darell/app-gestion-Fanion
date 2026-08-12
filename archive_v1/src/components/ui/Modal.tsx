import React, { useEffect, useRef } from "react";

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    size?: "sm" | "lg";
    children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    size = "sm",
    children,
}) => {
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };

        if (isOpen) {
            document.body.style.overflow = "hidden";
            window.addEventListener("keydown", handleEscape);
        }

        return () => {
            document.body.style.overflow = "unset";
            window.removeEventListener("keydown", handleEscape);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const sizeClass = size === "sm" ? "max-w-[480px]" : "max-w-[720px]";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-ink/40 transition-opacity duration-200"
                onClick={onClose}
            />

            {/* Modal Box */}
            <div
                ref={modalRef}
                className={`relative bg-white w-full ${sizeClass} rounded shadow-lg border border-line flex flex-col z-10 transition-all duration-200 transform`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-line">
                    <h3 id="modal-title" className="text-lg font-semibold font-sans text-ink">
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-slate hover:text-ink transition-colors duration-150 p-1 rounded hover:bg-paper"
                        aria-label="Fermer la boîte de dialogue"
                    >
                        <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="px-5 py-4 overflow-y-auto max-h-[calc(100vh-10rem)]">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;
