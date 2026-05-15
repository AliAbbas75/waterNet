import { Route, Routes, Navigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import RoleRedirect from "./pages/RoleRedirect.jsx";
import { RequireAuth, RequireRole } from "./router/Guards.jsx";
import { AdminLayout } from "./components/layout/AdminLayout.jsx";
import { MaintainerLayout } from "./components/layout/MaintainerLayout.jsx";
import { PublicLayout } from "./components/layout/PublicLayout.jsx";

import AdminDashboard from "./pages/admin/DashboardPage.jsx";
import AdminPlants from "./pages/admin/PlantsPage.jsx";
import AdminPlantDetail from "./pages/admin/PlantDetailPage.jsx";
import AdminDevices from "./pages/admin/DevicesPage.jsx";
import AdminDeviceDetail from "./pages/admin/DeviceDetailPage.jsx";
import AdminMaintenance from "./pages/admin/MaintenancePage.jsx";
import AdminMaintenanceDetail from "./pages/admin/MaintenanceDetailPage.jsx";
import AdminInventory from "./pages/admin/InventoryPage.jsx";
import AdminAlerts from "./pages/admin/AlertsPage.jsx";
import AdminThresholds from "./pages/admin/ThresholdsPage.jsx";
import AdminReports from "./pages/admin/ReportsPage.jsx";
import AdminUsers from "./pages/admin/UsersPage.jsx";
import AdminIssueReports from "./pages/admin/IssueReportsPage.jsx";

import MyTasks from "./pages/maintainer/MyTasksPage.jsx";
import TaskDetail from "./pages/maintainer/TaskDetailPage.jsx";
import MaintainerAlerts from "./pages/maintainer/AlertsPage.jsx";

import PublicNearby from "./pages/public/NearbyPage.jsx";
import PublicPlantDetail from "./pages/public/PlantDetailPage.jsx";
import PublicReportForm from "./pages/public/ReportFormPage.jsx";
import PublicMyReports from "./pages/public/MyReportsPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/admin"
        element={
          <RequireAuth>
            <RequireRole role="ADMIN">
              <AdminLayout />
            </RequireRole>
          </RequireAuth>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="plants" element={<AdminPlants />} />
        <Route path="plants/:id" element={<AdminPlantDetail />} />
        <Route path="devices" element={<AdminDevices />} />
        <Route path="devices/:id" element={<AdminDeviceDetail />} />
        <Route path="maintenance" element={<AdminMaintenance />} />
        <Route path="maintenance/:id" element={<AdminMaintenanceDetail />} />
        <Route path="inventory" element={<AdminInventory />} />
        <Route path="alerts" element={<AdminAlerts />} />
        <Route path="thresholds" element={<AdminThresholds />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="issue-reports" element={<AdminIssueReports />} />
        <Route path="users" element={<AdminUsers />} />
      </Route>

      <Route
        path="/m"
        element={
          <RequireAuth>
            <RequireRole role="MAINTAINER">
              <MaintainerLayout />
            </RequireRole>
          </RequireAuth>
        }
      >
        <Route index element={<MyTasks />} />
        <Route path="tasks/:id" element={<TaskDetail />} />
        <Route path="alerts" element={<MaintainerAlerts />} />
      </Route>

      <Route path="/app" element={<PublicLayout />}>
        <Route index element={<PublicNearby />} />
        <Route path="plants/:id" element={<PublicPlantDetail />} />
        <Route
          path="report"
          element={
            <RequireAuth>
              <PublicReportForm />
            </RequireAuth>
          }
        />
        <Route
          path="my-reports"
          element={
            <RequireAuth>
              <PublicMyReports />
            </RequireAuth>
          }
        />
      </Route>

      <Route path="/" element={<RoleRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
