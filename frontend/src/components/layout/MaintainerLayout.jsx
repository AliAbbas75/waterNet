import { AlertTriangle, ClipboardList } from "lucide-react";
import { AppShell } from "./AppShell.jsx";

const NAV = [
  { to: "/m", label: "My Tasks", icon: ClipboardList, end: true },
  { to: "/m/alerts", label: "Alerts", icon: AlertTriangle }
];

export function MaintainerLayout() {
  return <AppShell title="Maintainer" navItems={NAV} />;
}
