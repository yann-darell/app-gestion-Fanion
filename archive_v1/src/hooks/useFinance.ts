import { useState, useCallback } from "react";
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

export function useFinance() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getActiveSchoolYearId = useCallback(async (): Promise<number | null> => {
        const res = await window.api.finance.getActiveSchoolYearId();
        return res.ok ? res.data : null;
    }, []);

    const getOverview = useCallback(async (schoolYearId: number): Promise<ClassFinanceSummary[]> => {
        setLoading(true);
        setError(null);
        try {
            const res = await window.api.finance.getOverview(schoolYearId);
            if (res.ok) return res.data;
            setError(res.error);
            return [];
        } catch (err: any) {
            setError(err.message);
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const getStudentBalances = useCallback(async (
        classId: number,
        schoolYearId: number
    ): Promise<StudentBalance[]> => {
        setLoading(true);
        setError(null);
        try {
            const res = await window.api.finance.getStudentBalances(classId, schoolYearId);
            if (res.ok) return res.data;
            setError(res.error);
            return [];
        } catch (err: any) {
            setError(err.message);
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const getBalance = useCallback(async (
        studentId: number,
        schoolYearId: number
    ): Promise<StudentBalance | null> => {
        try {
            const res = await window.api.finance.getBalance(studentId, schoolYearId);
            if (res.ok) return res.data;
            return null;
        } catch {
            return null;
        }
    }, []);

    const getPaymentHistory = useCallback(async (
        studentId: number,
        schoolYearId: number
    ): Promise<Payment[]> => {
        try {
            const res = await window.api.finance.getPaymentHistory(studentId, schoolYearId);
            if (res.ok) return res.data;
            return [];
        } catch {
            return [];
        }
    }, []);

    const getFeeSchedule = useCallback(async (
        classId: number,
        schoolYearId: number
    ): Promise<FeeSchedule | null> => {
        try {
            const res = await window.api.finance.getFeeSchedule(classId, schoolYearId);
            if (res.ok) return res.data;
            return null;
        } catch {
            return null;
        }
    }, []);

    const recordPayment = async (
        input: RecordPaymentInput
    ): Promise<{ ok: boolean; pdfError?: string | null; error?: string }> => {
        try {
            const res = await window.api.finance.recordPayment(input);
            if (res.ok) {
                return { ok: true, pdfError: res.data.pdfError };
            }
            return { ok: false, error: res.error };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    };

    const setFeeSchedule = async (
        input: SetFeeScheduleInput
    ): Promise<{ ok: boolean; error?: string }> => {
        try {
            const res = await window.api.finance.setFeeSchedule(input);
            return res.ok ? { ok: true } : { ok: false, error: res.error };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    };

    const setStudentOverride = async (
        input: SetStudentOverrideInput
    ): Promise<{ ok: boolean; error?: string }> => {
        try {
            const res = await window.api.finance.setStudentOverride(input);
            return res.ok ? { ok: true } : { ok: false, error: res.error };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    };

    const openReceipt = async (paymentId: number): Promise<{ ok: boolean; error?: string }> => {
        try {
            const res = await window.api.finance.openReceipt(paymentId);
            return res.ok ? { ok: true } : { ok: false, error: res.error };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    };

    const generateReceipt = async (paymentId: number): Promise<{ ok: boolean; error?: string }> => {
        try {
            const res = await window.api.finance.generateReceipt(paymentId);
            return res.ok ? { ok: true } : { ok: false, error: res.error };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    };

    const getAllPayments = useCallback(async (
        schoolYearId: number
    ): Promise<Array<Payment & { student_name: string; class_name: string }>> => {
        setLoading(true);
        setError(null);
        try {
            const res = await window.api.finance.getAllPayments(schoolYearId);
            if (res.ok) return res.data;
            setError(res.error);
            return [];
        } catch (err: any) {
            setError(err.message);
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const getStudentFeeOverride = useCallback(async (
        studentId: number,
        schoolYearId: number
    ): Promise<StudentFeeOverride | null> => {
        try {
            const res = await window.api.finance.getStudentFeeOverride(studentId, schoolYearId);
            if (res.ok) return res.data;
            return null;
        } catch {
            return null;
        }
    }, []);

    const updatePayment = async (
        id: number,
        amount: number,
        paymentDate: string,
        method: string
    ): Promise<{ ok: boolean; pdfError?: string | null; error?: string }> => {
        try {
            const res = await window.api.finance.updatePayment(id, amount, paymentDate, method);
            if (res.ok) {
                return { ok: true, pdfError: res.data.pdfError };
            }
            return { ok: false, error: res.error };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    };

    const deletePayment = async (
        id: number
    ): Promise<{ ok: boolean; error?: string }> => {
        try {
            const res = await window.api.finance.deletePayment(id);
            return res.ok ? { ok: true } : { ok: false, error: res.error };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    };

    return {
        loading,
        error,
        getActiveSchoolYearId,
        getOverview,
        getStudentBalances,
        getBalance,
        getPaymentHistory,
        getFeeSchedule,
        recordPayment,
        updatePayment,
        deletePayment,
        setFeeSchedule,
        setStudentOverride,
        openReceipt,
        generateReceipt,
        getAllPayments,
        getStudentFeeOverride
    };
}

export default useFinance;
