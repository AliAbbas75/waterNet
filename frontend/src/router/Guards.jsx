import { Navigate, useLocation } from "react-router-dom";
import { hasRole, homeRouteForRole, useAuth } from "../contexts/AuthContext.jsx";
import { Spinner } from "../components/ui/Spinner.jsx";

export function RequireAuth({ children }) {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === "loading") return <FullPageLoader />;
  if (status !== "authenticated" || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

export function RequireRole({ role, children }) {
  const { status, user } = useAuth();
  if (status === "loading") return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!hasRole(user, role)) return <Navigate to={homeRouteForRole(user.role)} replace />;
  return children;
}

function FullPageLoader() {
  return (
    <div className="min-h-screen grid place-items-center">
      <Spinner label="Loading…" />
    </div>
  );
}
