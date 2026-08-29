"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_SITE_THEME, getStoredSiteTheme, isValidTheme } from "@/lib/themes";

type Theme = "dark" | "light";

const ThemeContext = createContext<{
  theme: Theme;
  toggleTheme: () => void;
}>({
  theme: "dark",
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function applyStoredSiteTheme() {
  const stored = localStorage.getItem("siteTheme");
  document.documentElement.dataset.siteTheme = isValidTheme(stored) ? stored! : DEFAULT_SITE_THEME;
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    applyStoredSiteTheme();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "siteTheme") applyStoredSiteTheme();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("site-theme-changed", applyStoredSiteTheme);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("site-theme-changed", applyStoredSiteTheme);
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") {
      setTheme(saved);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
