import { Navigate } from "react-router-dom";
import { homeRouteForRole, useAuth } from "../contexts/AuthContext.jsx";
import { Spinner } from "../components/ui/Spinner.jsx";

export default function RoleRedirect() {
  const { user, status } = useAuth();
  if (status === "loading") {
    return (
      <div className="min-h-screen grid place-items-center">
        <Spinner label="Loading…" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={homeRouteForRole(user.role)} replace />;
}
