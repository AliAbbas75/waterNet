import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { clearBackendToken, getBackendToken, setBackendToken } from "../lib/tokenStore.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(getBackendToken() ? "loading" : "anonymous");
  const refreshSeq = useRef(0);

  const refresh = useCallback(async () => {
    const seq = ++refreshSeq.current;
    const tokenAtStart = getBackendToken();
    if (!tokenAtStart) {
      setUser(null);
      setStatus("anonymous");
      return null;
    }
    try {
      const data = await api.get("/api/auth/me");
      if (seq !== refreshSeq.current || tokenAtStart !== getBackendToken()) return null;
      setUser(data.user);
      setStatus("authenticated");
      return data.user;
    } catch {
      if (seq !== refreshSeq.current || tokenAtStart !== getBackendToken()) return null;
      clearBackendToken();
      setUser(null);
      setStatus("anonymous");
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const register = useCallback(async (email, displayName) => {
    await api.post(
      "/api/auth/register",
      { email, ...(displayName ? { displayName } : {}) },
      { auth: false }
    );
  }, []);

  const sendOtp = useCallback(async (email) => {
    await api.post("/api/auth/send-otp", { email }, { auth: false });
  }, []);

  const blockchainLogin = useCallback(async ({ email, code }) => {
    refreshSeq.current += 1;
    const preAuth = await api.post("/api/auth/verify-otp", { email, code }, { auth: false });
    const preAuthToken = preAuth?.preAuthToken;
    if (!preAuthToken) throw new Error("Missing pre-auth token");

    const challenge = await api.get("/api/auth/challenge", {
      auth: false,
      headers: { Authorization: `Bearer ${preAuthToken}` }
    });

    const data = await api.post(
      "/api/auth/verify-challenge",
      { challengeId: challenge?.challengeId },
      { auth: false }
    );
    if (data?.token) setBackendToken(data.token);
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    refreshSeq.current += 1;
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
    () => ({ user, status, refresh, register, sendOtp, blockchainLogin, logout }),
    [user, status, refresh, register, sendOtp, blockchainLogin, logout]
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
