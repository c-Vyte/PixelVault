"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AuthContextType {
  isLoggedIn: boolean;
  login: (password: string, opts?: { totp?: string; idToken?: string }) => Promise<{ ok: boolean; needTotp?: boolean; needGoogle?: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  login: async () => ({ ok: false }),
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const session = sessionStorage.getItem("admin_auth");
    if (session === "true") {
      setIsLoggedIn(true);
    }
    setMounted(true);
  }, []);

  const login = async (password: string, opts?: { totp?: string; idToken?: string }): Promise<{ ok: boolean; needTotp?: boolean; needGoogle?: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, totp: opts?.totp || undefined, idToken: opts?.idToken || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, needTotp: (data as { needTotp?: boolean }).needTotp, needGoogle: (data as { needGoogle?: boolean }).needGoogle, error: (data as { error?: string }).error };
      setIsLoggedIn(true);
      sessionStorage.setItem("admin_auth", "true");
      return { ok: true };
    } catch {
      return { ok: false };
    }
  };

  const logout = async () => {
    try { await fetch("/api/admin/login", { method: "DELETE" }); } catch {}
    setIsLoggedIn(false);
    sessionStorage.removeItem("admin_auth");
  };

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <AuthContext.Provider value={{ isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
