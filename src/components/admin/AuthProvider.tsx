"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AuthContextType {
  isLoggedIn: boolean;
  login: (password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  login: () => false,
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const ADMIN_PASSWORD = "admin123";

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

  const login = (password: string): boolean => {
    if (password === ADMIN_PASSWORD) {
      setIsLoggedIn(true);
      sessionStorage.setItem("admin_auth", "true");
      return true;
    }
    return false;
  };

  const logout = () => {
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
