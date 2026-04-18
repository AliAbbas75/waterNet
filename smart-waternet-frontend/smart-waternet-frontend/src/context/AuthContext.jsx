import { createContext, useContext, useMemo, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const login = async (formData) => {
    await new Promise((resolve) => setTimeout(resolve, 650));
    setUser({
      email: formData.email,
      role: formData.role,
      stage: 'pending-2fa',
    });
    return { ok: true };
  };

  const signup = async (formData) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    setUser({
      email: formData.email,
      role: formData.role,
      stage: 'pending-2fa',
      name: formData.fullName,
    });
    return { ok: true };
  };

  const verify2FA = async (code) => {
    await new Promise((resolve) => setTimeout(resolve, 550));
    if (code !== '123456') {
      return { ok: false, message: 'Invalid verification code. Use 123456 for demo.' };
    }
    setUser((current) =>
      current
        ? {
            ...current,
            stage: 'authenticated',
          }
        : current
    );
    return { ok: true };
  };

  const logout = () => setUser(null);

  const value = useMemo(
    () => ({
      user,
      login,
      signup,
      verify2FA,
      logout,
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
