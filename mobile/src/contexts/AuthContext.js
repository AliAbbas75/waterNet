import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { clearToken, getToken, loadToken, setToken } from "../lib/tokenStore.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading"); // 'loading' | 'anonymous' | 'authenticated'

  const refresh = useCallback(async () => {
    if (!getToken()) {
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
      await clearToken();
      setUser(null);
      setStatus("anonymous");
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadToken();
      if (cancelled) return;
      await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  /**
   * Create a PUBLIC account and send its first code.
   *
   * The backend generates the wallet and registers it on chain, so there is
   * nothing for a citizen to set up beyond an email — which is the point: the
   * people this is for are reporting a smell or a colour from a standpipe, not
   * managing keys.
   */
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

    if (data?.token) await setToken(data.token);
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
    await clearToken();
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

// Mirrors backend/src/middleware/roleGuard.js and the web app's AuthContext.
// An unknown role scores -1, i.e. below PUBLIC — so a role missing from this
// map does not merely lose privileges, it drops out of every branch that tests
// for one. MANAGER was missing here and landed managers in the public app.
const ROLE_LEVEL = { PUBLIC: 0, MAINTAINER: 1, MANAGER: 2, ADMIN: 3, SUPER_ADMIN: 4 };

export function hasRole(user, minRole) {
  if (!user) return false;
  return (ROLE_LEVEL[user.role] ?? -1) >= (ROLE_LEVEL[minRole] ?? 99);
}

export function isMaintainerOrAdmin(user) {
  return hasRole(user, "MAINTAINER");
}
