import { Payment } from "../../../../electron/types/finance";
import {
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell
} from "../../../components/ui/Table";
import Button from "../../../components/ui/Button";

interface PaymentHistoryTableProps {
    payments: Payment[];
    onOpenReceipt: (paymentId: number) => void;
    onRegenerateReceipt: (paymentId: number) => void;
    onEditPayment?: (payment: Payment) => void;
    onDeletePayment?: (payment: Payment) => void;
}

function formatCurrency(amount: number): string {
    return amount.toLocaleString("fr-FR") + " FCFA";
}

function formatDate(dateStr: string): string {
    const parts = dateStr.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
}

function translateMethod(method: string): string {
    switch (method) {
        case "cash": return "Espèces";
        case "mobile_money": return "Mobile Money";
        case "bank": return "Virement";
        case "cheque": return "Chèque";
        default: return method;
    }
}

export default function PaymentHistoryTable({
    payments,
    onOpenReceipt,
    onRegenerateReceipt,
    onEditPayment,
    onDeletePayment
}: PaymentHistoryTableProps) {
    if (payments.length === 0) {
        return (
            <p className="text-sm text-slate font-sans py-4">
                Aucun paiement enregistré pour le moment.
            </p>
        );
    }

    return (
        <Table>
            <TableHeader>
                <TableHead>Date</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>N° Reçu</TableHead>
                <TableHead className="text-right">Actions</TableHead>
            </TableHeader>
            <TableBody>
                {payments.map((p) => (
                    <TableRow key={p.id}>
                        <TableCell>{formatDate(p.payment_date)}</TableCell>
                        <TableCell fontMono>{formatCurrency(p.amount)}</TableCell>
                        <TableCell>{translateMethod(p.method)}</TableCell>
                        <TableCell fontMono>{p.receipt_number}</TableCell>
                        <TableCell alignRight>
                            <div className="flex items-center justify-end gap-2">
                                {p.has_receipt ? (
                                    <Button
                                        variant="secondary"
                                        onClick={() => onOpenReceipt(p.id)}
                                        className="h-7 py-0 px-2 text-xs"
                                    >
                                        Ouvrir
                                    </Button>
                                ) : (
                                    <Button
                                        variant="secondary"
                                        onClick={() => onRegenerateReceipt(p.id)}
                                        className="h-7 py-0 px-2 text-xs"
                                    >
                                        Générer
                                    </Button>
                                )}
                                {onEditPayment && (
                                    <Button
                                        variant="secondary"
                                        onClick={() => onEditPayment(p)}
                                        className="h-7 py-0 px-2 text-xs"
                                    >
                                        Modifier
                                    </Button>
                                )}
                                {onDeletePayment && (
                                    <Button
                                        variant="secondary"
                                        onClick={() => onDeletePayment(p)}
                                        className="h-7 py-0 px-2 text-xs text-signal-red border-signal-red/30 hover:bg-signal-red/5"
                                    >
                                        Supprimer
                                    </Button>
                                )}
                            </div>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
