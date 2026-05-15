import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Droplet, FileText, LogOut, MapPin, MessageSquarePlus } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { Avatar } from "../ui/Avatar.jsx";

const TABS = [
  { to: "/app", label: "Nearby", icon: MapPin, end: true },
  { to: "/app/report", label: "Report", icon: MessageSquarePlus },
  { to: "/app/my-reports", label: "My reports", icon: FileText }
];

export function PublicLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <div className="grid place-items-center h-9 w-9 rounded-lg bg-brand-600 text-white">
          <Droplet size={18} />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-slate-900 leading-tight">WaterNet</div>
          <div className="text-xs text-slate-500 leading-tight">Public app</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Avatar name={user.display_name || user.email} size={32} />
              <button
                onClick={onLogout}
                title="Logout"
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 pb-24">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200 sm:hidden">
        <div className="max-w-screen-sm mx-auto grid grid-cols-3">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                clsx(
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium",
                  isActive ? "text-brand-700" : "text-slate-500"
                )
              }
            >
              <t.icon size={20} />
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <nav className="hidden sm:flex border-t border-slate-200 bg-white">
        <div className="max-w-screen-md mx-auto w-full grid grid-cols-3">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                clsx(
                  "flex items-center justify-center gap-2 py-3 text-sm font-medium",
                  isActive ? "text-brand-700 border-t-2 -mt-px border-brand-600" : "text-slate-500"
                )
              }
            >
              <t.icon size={18} />
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
