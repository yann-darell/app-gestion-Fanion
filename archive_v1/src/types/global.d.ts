import {
    Student,
    CreateStudentInput,
    UpdateStudentInput,
    Class,
    CreateClassInput,
    IpcResponse
} from "../../electron/types/students";
import {
    StudentBalance,
    ClassFinanceSummary,
    Payment,
    FeeSchedule,
    RecordPaymentInput,
    SetFeeScheduleInput,
    SetStudentOverrideInput,
    StudentFeeOverride
} from "../../electron/types/finance";

declare global {
    interface Window {
        api: {
            ping: () => string;
            students: {
                list: (filters?: {
                    classId?: number;
                    search?: string;
                }) => Promise<IpcResponse<Student[]>>;
                get: (id: number) => Promise<IpcResponse<Student>>;
                create: (
                    input: CreateStudentInput
                ) => Promise<IpcResponse<Student>>;
                update: (
                    id: number,
                    input: UpdateStudentInput
                ) => Promise<IpcResponse<Student>>;
                delete: (id: number) => Promise<IpcResponse<void>>;
                pickPhoto: () => Promise<IpcResponse<{ path: string; base64: string } | null>>;
            };
            classes: {
                list: () => Promise<IpcResponse<Class[]>>;
                create: (
                    input: CreateClassInput
                ) => Promise<IpcResponse<number>>;
            };
            finance: {
                getBalance: (studentId: number, schoolYearId: number) => Promise<IpcResponse<StudentBalance>>;
                getOverview: (schoolYearId: number) => Promise<IpcResponse<ClassFinanceSummary[]>>;
                getStudentBalances: (classId: number, schoolYearId: number) => Promise<IpcResponse<StudentBalance[]>>;
                recordPayment: (input: RecordPaymentInput) => Promise<IpcResponse<{ payment: Payment; receiptPath: string | null; pdfError: string | null }>>;
                getPaymentHistory: (studentId: number, schoolYearId: number) => Promise<IpcResponse<Payment[]>>;
                setFeeSchedule: (input: SetFeeScheduleInput) => Promise<IpcResponse<void>>;
                setStudentOverride: (input: SetStudentOverrideInput) => Promise<IpcResponse<void>>;
                getFeeSchedule: (classId: number, schoolYearId: number) => Promise<IpcResponse<FeeSchedule | null>>;
                generateReceipt: (paymentId: number) => Promise<IpcResponse<string>>;
                openReceipt: (paymentId: number) => Promise<IpcResponse<void>>;
                getActiveSchoolYearId: () => Promise<IpcResponse<number | null>>;
                getAllPayments: (schoolYearId: number) => Promise<IpcResponse<Array<Payment & { student_name: string; class_name: string }>>>;
                getStudentFeeOverride: (studentId: number, schoolYearId: number) => Promise<IpcResponse<StudentFeeOverride | null>>;
                updatePayment: (id: number, amount: number, paymentDate: string, method: string) => Promise<IpcResponse<{ ok: boolean; pdfError: string | null }>>;
                deletePayment: (id: number) => Promise<IpcResponse<{ ok: boolean }>>;
            };
        };
    }
}
export {};
