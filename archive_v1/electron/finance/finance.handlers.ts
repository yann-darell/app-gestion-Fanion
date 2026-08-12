import { ipcMain, shell } from "electron";
import { financeService } from "./finance.service";
import { financeRepository } from "./finance.repository";
import {
    IpcResponse,
    StudentBalance,
    ClassFinanceSummary,
    Payment,
    FeeSchedule,
    RecordPaymentInput,
    SetFeeScheduleInput,
    SetStudentOverrideInput
} from "../types/finance";

export function registerFinanceHandlers(): void {
    // finance:getBalance
    ipcMain.handle(
        "finance:getBalance",
        async (
            _event,
            { studentId, schoolYearId }: { studentId: number; schoolYearId: number }
        ): Promise<IpcResponse<StudentBalance>> => {
            try {
                const balance = financeService.calculateBalance(studentId, schoolYearId);
                return { ok: true, data: balance };
            } catch (error: any) {
                return { ok: false, error: error.message || "Erreur de calcul du solde." };
            }
        }
    );

    // finance:getOverview
    ipcMain.handle(
        "finance:getOverview",
        async (
            _event,
            { schoolYearId }: { schoolYearId: number }
        ): Promise<IpcResponse<ClassFinanceSummary[]>> => {
            try {
                const overview = financeService.getOverview(schoolYearId);
                return { ok: true, data: overview };
            } catch (error: any) {
                return { ok: false, error: error.message || "Erreur de chargement de la vue d'ensemble." };
            }
        }
    );

    // finance:getStudentBalances
    ipcMain.handle(
        "finance:getStudentBalances",
        async (
            _event,
            { classId, schoolYearId }: { classId: number; schoolYearId: number }
        ): Promise<IpcResponse<StudentBalance[]>> => {
            try {
                const balances = financeService.getStudentBalancesForClass(classId, schoolYearId);
                return { ok: true, data: balances };
            } catch (error: any) {
                return { ok: false, error: error.message || "Erreur de chargement des soldes." };
            }
        }
    );

    // finance:recordPayment
    ipcMain.handle(
        "finance:recordPayment",
        async (
            _event,
            input: RecordPaymentInput
        ): Promise<IpcResponse<{ payment: Payment; receiptPath: string | null; pdfError: string | null }>> => {
            try {
                const result = await financeService.recordPayment(input);
                return { ok: true, data: result };
            } catch (error: any) {
                return { ok: false, error: error.message || "Erreur lors de l'enregistrement du paiement." };
            }
        }
    );

    // finance:getPaymentHistory
    ipcMain.handle(
        "finance:getPaymentHistory",
        async (
            _event,
            { studentId, schoolYearId }: { studentId: number; schoolYearId: number }
        ): Promise<IpcResponse<Payment[]>> => {
            try {
                const payments = financeService.getPaymentHistory(studentId, schoolYearId);
                return { ok: true, data: payments };
            } catch (error: any) {
                return { ok: false, error: error.message || "Erreur de chargement de l'historique." };
            }
        }
    );

    // finance:setFeeSchedule
    ipcMain.handle(
        "finance:setFeeSchedule",
        async (
            _event,
            input: SetFeeScheduleInput
        ): Promise<IpcResponse<void>> => {
            try {
                financeService.setFeeSchedule(input);
                return { ok: true, data: undefined };
            } catch (error: any) {
                return { ok: false, error: error.message || "Erreur de configuration des frais." };
            }
        }
    );

    // finance:setStudentOverride
    ipcMain.handle(
        "finance:setStudentOverride",
        async (
            _event,
            input: SetStudentOverrideInput
        ): Promise<IpcResponse<void>> => {
            try {
                financeService.setStudentOverride(input);
                return { ok: true, data: undefined };
            } catch (error: any) {
                return { ok: false, error: error.message || "Erreur de configuration de la bourse." };
            }
        }
    );

    // finance:getFeeSchedule
    ipcMain.handle(
        "finance:getFeeSchedule",
        async (
            _event,
            { classId, schoolYearId }: { classId: number; schoolYearId: number }
        ): Promise<IpcResponse<FeeSchedule | null>> => {
            try {
                const schedule = financeRepository.getFeeSchedule(classId, schoolYearId);
                return { ok: true, data: schedule };
            } catch (error: any) {
                return { ok: false, error: error.message || "Erreur de chargement du barème." };
            }
        }
    );

    // finance:generateReceipt (régénération forcée)
    ipcMain.handle(
        "finance:generateReceipt",
        async (
            _event,
            { paymentId }: { paymentId: number }
        ): Promise<IpcResponse<string>> => {
            try {
                const pdfPath = await financeService.regenerateReceipt(paymentId);
                return { ok: true, data: pdfPath };
            } catch (error: any) {
                return { ok: false, error: error.message || "Erreur de régénération du reçu." };
            }
        }
    );

    // finance:openReceipt
    ipcMain.handle(
        "finance:openReceipt",
        async (
            _event,
            { paymentId }: { paymentId: number }
        ): Promise<IpcResponse<void>> => {
            try {
                const receipt = financeRepository.getReceiptByPaymentId(paymentId);
                if (!receipt) {
                    return { ok: false, error: "Aucun reçu trouvé pour ce paiement. Essayez de le régénérer." };
                }
                await shell.openPath(receipt.pdf_path);
                return { ok: true, data: undefined };
            } catch (error: any) {
                return { ok: false, error: error.message || "Erreur d'ouverture du reçu." };
            }
        }
    );

    // finance:getActiveSchoolYearId
    ipcMain.handle(
        "finance:getActiveSchoolYearId",
        async (): Promise<IpcResponse<number | null>> => {
            try {
                const id = financeRepository.getActiveSchoolYearId();
                return { ok: true, data: id };
            } catch (error: any) {
                return { ok: false, error: error.message || "Erreur." };
            }
        }
    );

    // finance:getAllPayments
    ipcMain.handle(
        "finance:getAllPayments",
        async (
            _event,
            { schoolYearId }: { schoolYearId: number }
        ): Promise<IpcResponse<Array<any>>> => {
            try {
                const payments = financeService.getAllPayments(schoolYearId);
                return { ok: true, data: payments };
            } catch (error: any) {
                return { ok: false, error: error.message || "Erreur de chargement du journal." };
            }
        }
    );

    // finance:getStudentFeeOverride
    ipcMain.handle(
        "finance:getStudentFeeOverride",
        async (
            _event,
            { studentId, schoolYearId }: { studentId: number; schoolYearId: number }
        ): Promise<IpcResponse<any | null>> => {
            try {
                const override = financeService.getStudentFeeOverride(studentId, schoolYearId);
                return { ok: true, data: override };
            } catch (error: any) {
                return { ok: false, error: error.message || "Erreur." };
            }
        }
    );

    // finance:updatePayment
    ipcMain.handle(
        "finance:updatePayment",
        async (
            _event,
            { id, amount, paymentDate, method }: { id: number; amount: number; paymentDate: string; method: string }
        ): Promise<IpcResponse<{ ok: boolean; pdfError: string | null }>> => {
            try {
                const res = await financeService.updatePayment(id, amount, paymentDate, method);
                return { ok: true, data: res };
            } catch (error: any) {
                return { ok: false, error: error.message || "Erreur lors de la mise à jour du paiement." };
            }
        }
    );

    // finance:deletePayment
    ipcMain.handle(
        "finance:deletePayment",
        async (
            _event,
            id: number
        ): Promise<IpcResponse<{ ok: boolean }>> => {
            try {
                const res = await financeService.deletePayment(id);
                return { ok: true, data: res };
            } catch (error: any) {
                return { ok: false, error: error.message || "Erreur lors de la suppression du paiement." };
            }
        }
    );
}
