import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import clsx from "clsx";
import { Droplet, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { Avatar } from "../ui/Avatar.jsx";

/**
 * Shared shell for Admin + Maintainer dashboards.
 * Public layout uses its own mobile-first chrome (see PublicLayout).
 */
export function AppShell({ title, navItems }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:w-64 lg:w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
        <SidebarBrand title={title} />
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </nav>
        <SidebarFooter user={user} onLogout={onLogout} />
      </aside>

      {/* Mobile drawer */}
      <div
        className={clsx(
          "md:hidden fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity",
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setMobileOpen(false)}
      />
      <aside
        className={clsx(
          "md:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white border-r border-slate-200 flex flex-col transition-transform",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarBrand title={title} onClose={() => setMobileOpen(false)} />
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <SidebarLink key={item.to} item={item} onClick={() => setMobileOpen(false)} />
          ))}
        </nav>
        <SidebarFooter user={user} onLogout={onLogout} />
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-3 py-3 flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
          >
            <Menu size={20} />
          </button>
          <Droplet className="text-brand-600" size={20} />
          <div className="font-semibold text-slate-900">WaterNet</div>
          <div className="ml-auto">
            <Avatar name={user?.display_name || user?.email} size={28} />
          </div>
        </header>
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-5 sm:py-8 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarBrand({ title, onClose }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
      <div className="grid place-items-center h-9 w-9 rounded-lg bg-brand-600 text-white">
        <Droplet size={18} />
      </div>
      <div className="min-w-0">
        <div className="font-semibold text-slate-900 leading-tight">WaterNet</div>
        <div className="text-xs text-slate-500">{title}</div>
      </div>
      {onClose ? (
        <button onClick={onClose} className="ml-auto p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <X size={18} />
        </button>
      ) : null}
    </div>
  );
}

function SidebarLink({ item, onClick }) {
  const { to, label, icon: Icon, end } = item;
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        clsx(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
          isActive
            ? "bg-brand-50 text-brand-800"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        )
      }
    >
      {Icon ? <Icon size={18} /> : null}
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

function SidebarFooter({ user, onLogout }) {
  return (
    <div className="border-t border-slate-100 p-3">
      <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
        <Avatar name={user?.display_name || user?.email} size={32} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-slate-900 truncate">
            {user?.display_name || user?.email || "User"}
          </div>
          <div className="text-xs text-slate-500 truncate">{user?.role}</div>
        </div>
        <button
          onClick={onLogout}
          title="Logout"
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
}
