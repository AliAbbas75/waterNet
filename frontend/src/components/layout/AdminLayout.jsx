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
  Wrench,
  ScrollText
} from "lucide-react";
import { AppShell } from "./AppShell.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";

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
  { to: "/admin/audit", label: "Audit log", icon: ScrollText }
];

// Account administration is SUPER_ADMIN only. An ADMIN runs operations —
// plants, devices, task assignment, citizen reports — but cannot grant roles
// or invite users, which would let them escalate their own privileges.
const SUPER_ADMIN_NAV = [{ to: "/admin/users", label: "Users", icon: Users }];

export function AdminLayout() {
  const { user } = useAuth();
  const navItems = user?.role === "SUPER_ADMIN" ? [...NAV, ...SUPER_ADMIN_NAV] : NAV;
  return <AppShell title="Admin console" navItems={navItems} />;
}
