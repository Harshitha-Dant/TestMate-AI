import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { NotFoundPage } from "./pages/NotFoundPage";

// Pages are split into their own chunks (AppShell shows a loading state while one downloads), so heavy
// dependencies such as the chart library only load with the pages that use them.
const DashboardPage = lazy(() => import("./pages/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const ProjectsPage = lazy(() => import("./pages/projects/ProjectsPage").then((m) => ({ default: m.ProjectsPage })));
const ChatbotLabPage = lazy(() => import("./pages/chatbot/ChatbotLabPage").then((m) => ({ default: m.ChatbotLabPage })));
const MemoryLabPage = lazy(() => import("./pages/memory/MemoryLabPage").then((m) => ({ default: m.MemoryLabPage })));
const MultilingualLabPage = lazy(() => import("./pages/multilingual/MultilingualLabPage").then((m) => ({ default: m.MultilingualLabPage })));
const ApiStudioPage = lazy(() => import("./pages/api/ApiStudioPage").then((m) => ({ default: m.ApiStudioPage })));
const RegressionPage = lazy(() => import("./pages/regression/RegressionPage").then((m) => ({ default: m.RegressionPage })));
const BugsPage = lazy(() => import("./pages/bugs/BugsPage").then((m) => ({ default: m.BugsPage })));
const ReportsPage = lazy(() => import("./pages/reports/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const HistoryPage = lazy(() => import("./pages/history/HistoryPage").then((m) => ({ default: m.HistoryPage })));
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="chatbot" element={<ChatbotLabPage />} />
        <Route path="memory" element={<MemoryLabPage />} />
        <Route path="multilingual" element={<MultilingualLabPage />} />
        <Route path="api-studio" element={<ApiStudioPage />} />
        <Route path="regression" element={<RegressionPage />} />
        <Route path="bugs" element={<BugsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
