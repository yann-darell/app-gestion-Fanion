import fs from "fs";
import { getDb } from "../db/connection";
import { financeRepository } from "./finance.repository";
import { receiptService } from "./receipt.service";
import {
    StudentBalance,
    ClassFinanceSummary,
    FinancialStatus,
    RecordPaymentInput,
    SetFeeScheduleInput,
    SetStudentOverrideInput,
    Payment,
    StudentFeeOverride
} from "../types/finance";

function deriveStatus(totalDue: number, balance: number): FinancialStatus {
    if (totalDue <= 0) return "paid";
    if (balance <= 0) return "paid";
    if (balance >= totalDue) return "unpaid";
    return "partial";
}

export const financeService = {
    /**
     * Fonction centralisée UNIQUE de calcul du solde d'un élève.
     * montant_dû = registration_fee + (override || total_amount)
     * solde = montant_dû − somme des paiements
     */
    calculateBalance(studentId: number, schoolYearId: number): StudentBalance {
        // Récupérer les infos de l'élève
        const db = getDb();
        const student = db.prepare(`
            SELECT s.id, s.matricule, s.first_name, s.last_name, s.class_id,
                   c.name as class_name
            FROM students s
            JOIN classes c ON s.class_id = c.id
            WHERE s.id = ?
        `).get(studentId) as {
            id: number;
            matricule: string;
            first_name: string;
            last_name: string;
            class_id: number;
            class_name: string;
        } | undefined;

        if (!student) {
            throw new Error(`Élève introuvable (id: ${studentId}).`);
        }

        // Récupérer le barème de la classe
        const schedule = financeRepository.getFeeSchedule(student.class_id, schoolYearId);
        const registrationFee = schedule ? schedule.registration_fee : 0;
        const standardTuition = schedule ? schedule.total_amount : 0;

        // Vérifier s'il existe un override pour cet élève
        const override = financeRepository.getStudentFeeOverride(studentId, schoolYearId);
        const tuitionAmount = override ? override.total_amount_override : standardTuition;

        const totalDue = registrationFee + tuitionAmount;
        const totalPaid = financeRepository.getTotalPaid(studentId, schoolYearId);
        const balance = totalDue - totalPaid;
        const status = deriveStatus(totalDue, balance);

        return {
            student_id: studentId,
            student_name: `${student.last_name} ${student.first_name}`,
            matricule: student.matricule,
            class_name: student.class_name,
            registration_fee: registrationFee,
            tuition_amount: tuitionAmount,
            has_override: !!override,
            total_due: totalDue,
            total_paid: totalPaid,
            balance: Math.max(0, balance),
            status
        };
    },

    /**
     * Enregistre un paiement.
     * 1. Transaction SQL : insertion paiement + incrément compteur reçu.
     * 2. Après commit : tentative de génération PDF (jamais de rollback du paiement si le PDF échoue).
     */
    async recordPayment(input: RecordPaymentInput): Promise<{
        payment: Payment;
        receiptPath: string | null;
        pdfError: string | null;
    }> {
        // Validation
        if (!input.amount || input.amount <= 0) {
            throw new Error("Le montant du paiement doit être positif.");
        }
        if (!input.payment_date) {
            throw new Error("La date de paiement est obligatoire.");
        }
        if (!["cash", "mobile_money", "bank", "cheque"].includes(input.method)) {
            throw new Error("Le mode de paiement est invalide.");
        }

        const db = getDb();

        // Transaction SQL : paiement + compteur de reçu
        let paymentId: number;
        let receiptNumber: string;

        const insertPaymentTx = db.transaction(() => {
            // Incrémenter le compteur de reçu de manière atomique
            const counter = financeRepository.getNextReceiptNumber();
            receiptNumber = counter.formatted;

            // Insérer le paiement
            paymentId = financeRepository.addPayment(
                input.student_id,
                input.school_year_id,
                input.amount,
                input.payment_date,
                input.method,
                receiptNumber
            );
        });

        insertPaymentTx();

        // Récupérer le paiement inséré
        const payments = financeRepository.getStudentPayments(input.student_id, input.school_year_id);
        const payment = payments.find((p) => p.id === paymentId!);
        if (!payment) {
            throw new Error("Erreur interne : paiement créé mais introuvable.");
        }

        // Tentative de génération du PDF — indépendante de la transaction SQL
        let receiptPath: string | null = null;
        let pdfError: string | null = null;

        try {
            const balance = this.calculateBalance(input.student_id, input.school_year_id);

            // Récupérer le label de l'année scolaire
            const yearRow = db.prepare(
                "SELECT label FROM school_years WHERE id = ?"
            ).get(input.school_year_id) as { label: string } | undefined;

            receiptPath = await receiptService.generateReceipt({
                receiptNumber: receiptNumber!,
                paymentDate: input.payment_date,
                studentName: balance.student_name,
                matricule: balance.matricule,
                className: balance.class_name,
                schoolYearLabel: yearRow?.label || "",
                amount: input.amount,
                method: input.method,
                totalDue: balance.total_due,
                totalPaidAfter: balance.total_paid,
                balanceAfter: balance.balance
            });

            // Enregistrer le reçu en base
            financeRepository.addReceipt(paymentId!, receiptPath);
        } catch (err: any) {
            pdfError = err.message || "Erreur lors de la génération du reçu PDF.";
            console.error("Erreur de génération PDF (paiement conservé) :", err);
        }

        return { payment, receiptPath, pdfError };
    },

    /**
     * Régénère le reçu PDF pour un paiement existant.
     */
    async regenerateReceipt(paymentId: number): Promise<string> {
        const db = getDb();

        // Récupérer le paiement
        const paymentRow = db.prepare("SELECT * FROM payments WHERE id = ?").get(paymentId) as Payment | undefined;
        if (!paymentRow) {
            throw new Error(`Paiement introuvable (id: ${paymentId}).`);
        }

        const balance = this.calculateBalance(paymentRow.student_id, paymentRow.school_year_id);

        const yearRow = db.prepare(
            "SELECT label FROM school_years WHERE id = ?"
        ).get(paymentRow.school_year_id) as { label: string } | undefined;

        const pdfPath = await receiptService.generateReceipt({
            receiptNumber: paymentRow.receipt_number,
            paymentDate: paymentRow.payment_date,
            studentName: balance.student_name,
            matricule: balance.matricule,
            className: balance.class_name,
            schoolYearLabel: yearRow?.label || "",
            amount: paymentRow.amount,
            method: paymentRow.method,
            totalDue: balance.total_due,
            totalPaidAfter: balance.total_paid,
            balanceAfter: balance.balance
        });

        // Mettre à jour ou insérer le reçu en base
        const existingReceipt = financeRepository.getReceiptByPaymentId(paymentId);
        if (existingReceipt) {
            db.prepare("UPDATE receipts SET pdf_path = ?, generated_at = datetime('now') WHERE id = ?")
                .run(pdfPath, existingReceipt.id);
        } else {
            financeRepository.addReceipt(paymentId, pdfPath);
        }

        return pdfPath;
    },

    /**
     * Configure les frais de scolarité d'une classe.
     */
    setFeeSchedule(input: SetFeeScheduleInput): void {
        if (input.registration_fee < 0) throw new Error("Les frais d'inscription ne peuvent pas être négatifs.");
        if (input.total_amount < 0) throw new Error("Le montant de la scolarité ne peut pas être négatif.");

        // Valider que la somme des installments correspond au total_amount
        const installmentsSum = input.installments.reduce((sum, inst) => sum + inst.amount, 0);
        if (installmentsSum !== input.total_amount) {
            throw new Error(
                `La somme des tranches (${installmentsSum}) ne correspond pas au montant total de la scolarité (${input.total_amount}).`
            );
        }

        const db = getDb();
        const tx = db.transaction(() => {
            financeRepository.setFeeSchedule(
                input.class_id,
                input.school_year_id,
                input.registration_fee,
                input.total_amount,
                JSON.stringify(input.installments)
            );
        });
        tx();
    },

    /**
     * Définit ou met à jour un override de scolarité pour un élève.
     */
    setStudentOverride(input: SetStudentOverrideInput): void {
        if (input.total_amount_override < 0) {
            throw new Error("Le montant de la réduction ne peut pas être négatif.");
        }
        if (!input.reason || !input.reason.trim()) {
            throw new Error("La raison de la bourse/réduction est obligatoire.");
        }

        const db = getDb();
        const tx = db.transaction(() => {
            financeRepository.setStudentFeeOverride(
                input.student_id,
                input.school_year_id,
                input.total_amount_override,
                input.reason.trim()
            );
        });
        tx();
    },

    /**
     * Récupère l'historique des paiements d'un élève.
     */
    getPaymentHistory(studentId: number, schoolYearId: number): Payment[] {
        return financeRepository.getStudentPayments(studentId, schoolYearId);
    },

    /**
     * Vue d'ensemble financière par classe pour une année scolaire.
     */
    getOverview(schoolYearId: number): ClassFinanceSummary[] {
        const classes = financeRepository.getClassesForSchoolYear(schoolYearId);
        const summaries: ClassFinanceSummary[] = [];

        for (const cls of classes) {
            const students = financeRepository.getActiveStudentsByClass(cls.id);
            let totalExpected = 0;
            let totalCollected = 0;
            let paidCount = 0;
            let partialCount = 0;
            let unpaidCount = 0;

            for (const student of students) {
                const balance = this.calculateBalance(student.id, schoolYearId);
                totalExpected += balance.total_due;
                totalCollected += balance.total_paid;

                if (balance.status === "paid") paidCount++;
                else if (balance.status === "partial") partialCount++;
                else unpaidCount++;
            }

            summaries.push({
                class_id: cls.id,
                class_name: cls.name,
                level: cls.level,
                student_count: students.length,
                total_expected: totalExpected,
                total_collected: totalCollected,
                paid_count: paidCount,
                partial_count: partialCount,
                unpaid_count: unpaidCount
            });
        }

        return summaries;
    },

    /**
     * Récupère les soldes individuels de tous les élèves actifs d'une classe.
     */
    getStudentBalancesForClass(classId: number, schoolYearId: number): StudentBalance[] {
        const students = financeRepository.getActiveStudentsByClass(classId);
        return students.map((s) => this.calculateBalance(s.id, schoolYearId));
    },

    /**
     * Récupère tous les paiements de l'école pour le journal des paiements.
     */
    getAllPayments(schoolYearId: number): Array<Payment & { student_name: string; class_name: string }> {
        return financeRepository.getAllPayments(schoolYearId);
    },

    /**
     * Récupère l'override individuel d'un élève.
     */
    getStudentFeeOverride(studentId: number, schoolYearId: number): StudentFeeOverride | null {
        return financeRepository.getStudentFeeOverride(studentId, schoolYearId);
    },

    /**
     * Met à jour un paiement et régénère son reçu PDF si existant.
     */
    async updatePayment(id: number, amount: number, paymentDate: string, method: string): Promise<{ ok: boolean; pdfError: string | null }> {
        if (amount <= 0) throw new Error("Le montant du paiement doit être supérieur à 0.");
        if (!["cash", "mobile_money", "bank", "cheque"].includes(method)) {
            throw new Error("Le mode de paiement est invalide.");
        }

        const db = getDb();
        
        // Transaction SQL
        const updateTx = db.transaction(() => {
            financeRepository.updatePayment(id, amount, paymentDate, method);
        });
        updateTx();

        // Régénérer le reçu
        let pdfError: string | null = null;
        try {
            await this.regenerateReceipt(id);
        } catch (err: any) {
            pdfError = err.message || "Erreur de régénération du reçu PDF.";
            console.error("Erreur PDF lors de la modification :", err);
        }

        return { ok: true, pdfError };
    },

    /**
     * Supprime un paiement, d'abord le fichier PDF physique puis les lignes DB.
     */
    async deletePayment(id: number): Promise<{ ok: boolean }> {
        const db = getDb();

        // 1. Récupérer le reçu pour trouver le chemin du fichier PDF
        const receipt = financeRepository.getReceiptByPaymentId(id);

        // 2. Supprimer le fichier PDF physique s'il existe
        if (receipt && receipt.pdf_path) {
            if (fs.existsSync(receipt.pdf_path)) {
                try {
                    fs.unlinkSync(receipt.pdf_path);
                } catch (err: any) {
                    throw new Error(
                        `Impossible de supprimer le fichier PDF physique : ${err.message}. La suppression du paiement a été annulée.`
                    );
                }
            }
        }

        // 3. Lancer la transaction SQL pour supprimer les lignes de reçus et de paiements
        const deleteTx = db.transaction(() => {
            financeRepository.deleteReceiptByPaymentId(id);
            financeRepository.deletePayment(id);
        });
        deleteTx();

        return { ok: true };
    }
};

export default financeService;
