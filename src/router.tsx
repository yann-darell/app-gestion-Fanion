import React from "react";
import { HashRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";
import StudentsPage from "./pages/students/StudentsPage";
import GradesPage from "./pages/grades/GradesPage";
import FinancePage from "./pages/finance/FinancePage";
import SettingsPage from "./pages/settings/SettingsPage";

const Layout: React.FC = () => {
    return (
        <div className="flex h-screen w-screen overflow-hidden bg-paper text-ink">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header />
                <main className="flex-1 overflow-y-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export const AppRouter: React.FC = () => {
    return (
        <HashRouter>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Navigate to="/students" replace />} />
                    <Route path="students" element={<StudentsPage />} />
                    <Route path="grades" element={<GradesPage />} />
                    <Route path="finance" element={<FinancePage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="*" element={<Navigate to="/students" replace />} />
                </Route>
            </Routes>
        </HashRouter>
    );
};

export default AppRouter;
