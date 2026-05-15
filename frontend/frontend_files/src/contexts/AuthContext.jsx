import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { clearBackendToken, getBackendToken, setBackendToken } from "../lib/tokenStore.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(getBackendToken() ? "loading" : "anonymous");

  const refresh = useCallback(async () => {
    if (!getBackendToken()) {
      setUser(null);
      setStatus("anonymous");
      return null;
    }
    try {
      const data = await api.get("/api/auth/me");
      setUser(data.user);
      setStatus("authenticated");
      return data.user;
    } catch {
      clearBackendToken();
      setUser(null);
      setStatus("anonymous");
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const devLogin = useCallback(async ({ email, walletAddress }) => {
    const data = await api.post("/api/auth/dev-login", { email, walletAddress }, { auth: false });
    if (data?.token) setBackendToken(data.token);
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const thirdwebLogin = useCallback(async ({ token, walletAddress, clientId }) => {
    const headers = clientId ? { "x-client-id": clientId } : {};
    const data = await api.post(
      "/api/auth/login",
      { token, walletAddress },
      { auth: false, headers }
    );
    if (data?.token) setBackendToken(data.token);
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout", undefined);
    } catch {
      /* ignore */
    }
    clearBackendToken();
    setUser(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo(
    () => ({ user, status, refresh, devLogin, thirdwebLogin, logout }),
    [user, status, refresh, devLogin, thirdwebLogin, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function hasRole(user, ...roles) {
  if (!user) return false;
  const hierarchy = { PUBLIC: 0, MAINTAINER: 1, ADMIN: 2, SUPER_ADMIN: 3 };
  const userLevel = hierarchy[user.role] ?? -1;
  return roles.some((r) => userLevel >= (hierarchy[r] ?? 99));
}

export function homeRouteForRole(role) {
  if (role === "ADMIN" || role === "SUPER_ADMIN") return "/admin";
  if (role === "MAINTAINER") return "/m";
  if (role === "PUBLIC") return "/app";
  return "/login";
}
