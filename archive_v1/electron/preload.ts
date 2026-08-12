import { contextBridge, ipcRenderer } from "electron";
import { CreateStudentInput, UpdateStudentInput, CreateClassInput } from "./types/students";
import { RecordPaymentInput, SetFeeScheduleInput, SetStudentOverrideInput } from "./types/finance";

contextBridge.exposeInMainWorld("api", {
    ping: () => "pong",
    students: {
        list: (filters?: { classId?: number; search?: string }) =>
            ipcRenderer.invoke("students:list", filters),
        get: (id: number) =>
            ipcRenderer.invoke("students:get", id),
        create: (input: CreateStudentInput) =>
            ipcRenderer.invoke("students:create", input),
        update: (id: number, input: UpdateStudentInput) =>
            ipcRenderer.invoke("students:update", { id, input }),
        delete: (id: number) =>
            ipcRenderer.invoke("students:delete", id),
        pickPhoto: () =>
            ipcRenderer.invoke("students:pickPhoto"),
    },
    classes: {
        list: () =>
            ipcRenderer.invoke("classes:list"),
        create: (input: CreateClassInput) =>
            ipcRenderer.invoke("classes:create", input),
    },
    finance: {
        getBalance: (studentId: number, schoolYearId: number) =>
            ipcRenderer.invoke("finance:getBalance", { studentId, schoolYearId }),
        getOverview: (schoolYearId: number) =>
            ipcRenderer.invoke("finance:getOverview", { schoolYearId }),
        getStudentBalances: (classId: number, schoolYearId: number) =>
            ipcRenderer.invoke("finance:getStudentBalances", { classId, schoolYearId }),
        recordPayment: (input: RecordPaymentInput) =>
            ipcRenderer.invoke("finance:recordPayment", input),
        getPaymentHistory: (studentId: number, schoolYearId: number) =>
            ipcRenderer.invoke("finance:getPaymentHistory", { studentId, schoolYearId }),
        setFeeSchedule: (input: SetFeeScheduleInput) =>
            ipcRenderer.invoke("finance:setFeeSchedule", input),
        setStudentOverride: (input: SetStudentOverrideInput) =>
            ipcRenderer.invoke("finance:setStudentOverride", input),
        getFeeSchedule: (classId: number, schoolYearId: number) =>
            ipcRenderer.invoke("finance:getFeeSchedule", { classId, schoolYearId }),
        generateReceipt: (paymentId: number) =>
            ipcRenderer.invoke("finance:generateReceipt", { paymentId }),
        openReceipt: (paymentId: number) =>
            ipcRenderer.invoke("finance:openReceipt", { paymentId }),
        getActiveSchoolYearId: () =>
            ipcRenderer.invoke("finance:getActiveSchoolYearId"),
        getAllPayments: (schoolYearId: number) =>
            ipcRenderer.invoke("finance:getAllPayments", { schoolYearId }),
        getStudentFeeOverride: (studentId: number, schoolYearId: number) =>
            ipcRenderer.invoke("finance:getStudentFeeOverride", { studentId, schoolYearId }),
        updatePayment: (id: number, amount: number, paymentDate: string, method: string) =>
            ipcRenderer.invoke("finance:updatePayment", { id, amount, paymentDate, method }),
        deletePayment: (id: number) =>
            ipcRenderer.invoke("finance:deletePayment", id),
    }
});