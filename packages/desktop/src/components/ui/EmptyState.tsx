import React from "react";
import Button from "./Button";

export interface EmptyStateProps {
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    title,
    description,
    actionLabel,
    onAction,
}) => {
    return (
        <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-line rounded bg-white my-4">
            <h4 className="font-sans text-base font-semibold text-ink mb-1">
                {title}
            </h4>
            <p className="font-sans text-sm text-slate mb-4 max-w-sm">
                {description}
            </p>
            {actionLabel && onAction && (
                <Button variant="primary" onClick={onAction}>
                    {actionLabel}
                </Button>
            )}
        </div>
    );
};

export default EmptyState;
