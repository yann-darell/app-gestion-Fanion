import { IpcResponse } from "./students";

// --- Modèles de données ---

export interface Installment {
    name: string;
    amount: number;
    due_date: string; // YYYY-MM-DD
}

export interface FeeSchedule {
    id: number;
    class_id: number;
    school_year_id: number;
    registration_fee: number;
    total_amount: number;
    installments_json: string; // JSON stringifié de Installment[]
    created_at: string;
    // Champs joints
    class_name?: string;
    school_year_label?: string;
}

export interface StudentFeeOverride {
    id: number;
    student_id: number;
    school_year_id: number;
    total_amount_override: number;
    reason: string | null;
    created_at: string;
}

export interface Payment {
    id: number;
    student_id: number;
    school_year_id: number;
    amount: number;
    payment_date: string;
    method: string; // 'cash' | 'mobile_money' | 'bank'
    receipt_number: string;
    created_at: string;
    // Champ joint optionnel
    has_receipt?: boolean;
}

export interface Receipt {
    id: number;
    payment_id: number;
    pdf_path: string;
    generated_at: string;
}

// --- Résultats calculés ---

export type FinancialStatus = "paid" | "partial" | "unpaid";

export interface StudentBalance {
    student_id: number;
    student_name: string;
    matricule: string;
    class_name: string;
    registration_fee: number;
    tuition_amount: number; // total_amount effectif (standard ou overridé)
    has_override: boolean;
    total_due: number; // registration_fee + tuition_amount
    total_paid: number;
    balance: number; // total_due - total_paid (positif = reste dû)
    status: FinancialStatus;
}

export interface ClassFinanceSummary {
    class_id: number;
    class_name: string;
    level: string;
    student_count: number;
    total_expected: number; // somme des montants dus de tous les élèves
    total_collected: number; // somme de tous les paiements
    paid_count: number;
    partial_count: number;
    unpaid_count: number;
}

// --- Inputs IPC ---

export interface SetFeeScheduleInput {
    class_id: number;
    school_year_id: number;
    registration_fee: number;
    total_amount: number;
    installments: Installment[];
}

export interface SetStudentOverrideInput {
    student_id: number;
    school_year_id: number;
    total_amount_override: number;
    reason: string;
}

export interface RecordPaymentInput {
    student_id: number;
    school_year_id: number;
    amount: number;
    payment_date: string;
    method: "cash" | "mobile_money" | "bank" | "cheque";
}

// Ré-export de IpcResponse pour commodité
export type { IpcResponse };
