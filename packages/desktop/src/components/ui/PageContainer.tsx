import React from "react";

export interface PageContainerProps {
    children: React.ReactNode;
    className?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({
    children,
    className = "",
}) => {
    return (
        <div className={`p-6 md:p-8 max-w-7xl mx-auto w-full flex flex-col min-h-0 ${className}`}>
            {children}
        </div>
    );
};

export default PageContainer;
