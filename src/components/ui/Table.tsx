import React from "react";

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({ className = "", children, ...props }) => (
    <div className="w-full overflow-x-auto border border-line rounded">
        <table className={`w-full border-collapse text-left ${className}`} {...props}>
            {children}
        </table>
    </div>
);

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className = "", children, ...props }) => (
    <thead className={`bg-paper-dark text-ink border-b border-line sticky top-0 z-10 ${className}`} {...props}>
        {children}
    </thead>
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className = "", children, ...props }) => (
    <tbody className={`divide-y divide-line bg-white ${className}`} {...props}>
        {children}
    </tbody>
);

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ className = "", children, ...props }) => (
    <tr className={`hover:bg-paper/50 transition-colors duration-100 ${className}`} {...props}>
        {children}
    </tr>
);

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ className = "", children, ...props }) => (
    <th className={`font-sans font-semibold text-xs text-slate uppercase tracking-wider px-4 py-2.5 h-10 align-middle ${className}`} {...props}>
        {children}
    </th>
);

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
    fontMono?: boolean;
    alignRight?: boolean;
}

export const TableCell: React.FC<TableCellProps> = ({
    className = "",
    children,
    fontMono = false,
    alignRight = false,
    ...props
}) => (
    <td
        className={`px-4 py-2.5 text-sm text-ink h-10 align-middle ${fontMono ? "font-mono-data" : "font-sans"} ${alignRight ? "text-right" : ""} ${className}`}
        {...props}
    >
        {children}
    </td>
);

export default Table;
