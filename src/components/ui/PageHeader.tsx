import React from "react";

export interface PageHeaderProps {
    title: string;
    actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, actions }) => {
    return (
        <div className="flex flex-col gap-4 pb-4 border-b border-line mb-6">
            <div className="flex items-center justify-between min-h-[40px]">
                <h1 className="font-display text-2xl font-semibold text-ink leading-tight">
                    {title}
                </h1>
                {actions && <div className="flex items-center gap-3">{actions}</div>}
            </div>
        </div>
    );
};

export default PageHeader;
