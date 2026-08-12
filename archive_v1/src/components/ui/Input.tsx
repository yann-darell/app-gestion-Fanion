import React, { useId } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
    fontMono?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, fontMono = false, className = "", ...props }, ref) => {
        const id = useId();
        const baseInputStyles = "w-full px-3 py-2 border rounded font-sans transition-colors duration-150 focus:outline-none focus:border-2 h-10";
        const borderStyles = error
            ? "border-signal-red focus:border-signal-red"
            : "border-line focus:border-ink";
        const fontStyles = fontMono ? "font-mono-data" : "font-sans";

        return (
            <div className="w-full flex flex-col gap-1.5">
                <label
                    htmlFor={id}
                    className="font-sans text-xs font-semibold text-slate uppercase tracking-wider"
                >
                    {label}
                </label>
                <input
                    id={id}
                    ref={ref}
                    className={`${baseInputStyles} ${borderStyles} ${fontStyles} ${className}`}
                    {...props}
                />
                {error && (
                    <span className="font-sans text-xs text-signal-red font-medium">
                        {error}
                    </span>
                )}
            </div>
        );
    }
);

Input.displayName = "Input";

export default Input;
