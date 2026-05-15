import {
  AlertTriangle,
  BarChart3,
  Building2,
  Cpu,
  LayoutDashboard,
  MessagesSquare,
  Package,
  SlidersHorizontal,
  Users,
  Wrench
} from "lucide-react";
import { AppShell } from "./AppShell.jsx";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/plants", label: "Plants", icon: Building2 },
  { to: "/admin/devices", label: "Devices", icon: Cpu },
  { to: "/admin/maintenance", label: "Maintenance", icon: Wrench },
  { to: "/admin/inventory", label: "Inventory", icon: Package },
  { to: "/admin/alerts", label: "Alerts", icon: AlertTriangle },
  { to: "/admin/thresholds", label: "Thresholds", icon: SlidersHorizontal },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/issue-reports", label: "Citizen Reports", icon: MessagesSquare },
  { to: "/admin/users", label: "Users", icon: Users }
];

export function AdminLayout() {
  return <AppShell title="Admin console" navItems={NAV} />;
}
