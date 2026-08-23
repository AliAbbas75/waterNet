import { AlertTriangle, ClipboardList, Package } from "lucide-react";
import { AppShell } from "./AppShell.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";

const NAV = [
  { to: "/m", label: "My Tasks", icon: ClipboardList, end: true },
  { to: "/m/alerts", label: "Alerts", icon: AlertTriangle }
];

// A manager's work orders are about stock, so they get the shelf they are
// chasing. Read-only — deciding what the stock levels should be is an admin's.
const MANAGER_NAV = [{ to: "/m/inventory", label: "Inventory", icon: Package }];

export function MaintainerLayout() {
  const { user } = useAuth();
  const isManager = user?.role === "MANAGER";
  return (
    <AppShell
      title={isManager ? "Manager" : "Maintainer"}
      navItems={isManager ? [...NAV, ...MANAGER_NAV] : NAV}
    />
  );
}
