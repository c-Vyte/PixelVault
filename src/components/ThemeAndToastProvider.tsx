"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { CheckCircleIcon, WarningExclamationIcon } from "./icons";

export interface ThemePreset {
  id: string;
  name: string;
  tagline: string;
  mode: "DARK" | "LIGHT";
  bg: string;
  card: string;
  primary: string;
  accent: string;
  border: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "cyber-vault",
    name: "Cyber-Vault Obsidian",
    tagline: "High-contrast electric cyan & cyber violet on deep obsidian void",
    mode: "DARK",
    bg: "#090B0E",
    card: "#12161E",
    primary: "#00F0FF",
    accent: "#8B5CF6",
    border: "#1E293B",
  },
  {
    id: "neon-arcade",
    name: "Neon Arcade Synthwave",
    tagline: "Vibrant hot magenta & laser violet on deep purple nebula",
    mode: "DARK",
    bg: "#0D061A",
    card: "#170C2D",
    primary: "#FF2A85",
    accent: "#9D4EDD",
    border: "#3B1E6B",
  },
  {
    id: "matrix-terminal",
    name: "Matrix Netrunner",
    tagline: "Phosphor terminal emerald green on pure cyber carbon",
    mode: "DARK",
    bg: "#050B08",
    card: "#0A1610",
    primary: "#00FF66",
    accent: "#00B4D8",
    border: "#163826",
  },
  {
    id: "solar-flare",
    name: "Solar Flare Amber",
    tagline: "Plasma orange & high-voltage amber on dark basalt slate",
    mode: "DARK",
    bg: "#0D0A08",
    card: "#1A130E",
    primary: "#FF6B00",
    accent: "#FACC15",
    border: "#3A2619",
  },
  {
    id: "nordic-frost",
    name: "Nordic Arctic Ice",
    tagline: "Glacial sky blue & aurora indigo on midnight steel",
    mode: "DARK",
    bg: "#080D14",
    card: "#101926",
    primary: "#38BDF8",
    accent: "#818CF8",
    border: "#1E3A5F",
  },
  {
    id: "crimson-core",
    name: "Crimson Core Gunmetal",
    tagline: "Ruby pulse & molten copper on dark obsidian iron",
    mode: "DARK",
    bg: "#0E0708",
    card: "#1A0E10",
    primary: "#EF4444",
    accent: "#F97316",
    border: "#451A20",
  },
  {
    id: "vaporwave-day",
    name: "Vaporwave Daylight",
    tagline: "Crisp electric teal & royal amethyst on soft pearl slate",
    mode: "LIGHT",
    bg: "#F4F6FB",
    card: "#FFFFFF",
    primary: "#0284C7",
    accent: "#7C3AED",
    border: "#CBD5E1",
  },
  {
    id: "clean-studio",
    name: "Clean Studio Daylight",
    tagline: "Precision sapphire blue & indigo on crisp studio white",
    mode: "LIGHT",
    bg: "#FAFBFD",
    card: "#FFFFFF",
    primary: "#2563EB",
    accent: "#4F46E5",
    border: "#E5E7EB",
  },
];

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  description?: string;
}

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  isDestructive?: boolean;
  onConfirm?: () => void;
}

interface ThemeContextType {
  themeId: string;
  setThemeId: (id: string) => void;
  showToast: (toast: Omit<ToastMessage, "id">) => void;
  confirmAction: (options: {
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  themeId: "cyber-vault",
  setThemeId: () => {},
  showToast: () => {},
  confirmAction: () => {},
});

export function useThemeAndToast() {
  return useContext(ThemeContext);
}

const THEME_STORAGE_KEY = "pixelvault_theme";

export function ThemeAndToastProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<string>("cyber-vault");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: "",
    message: "",
  });

  const applyTheme = useCallback((requestedId: string) => {
    if (typeof document === "undefined") return;
    const preset =
      THEME_PRESETS.find((item) => item.id === requestedId) || THEME_PRESETS[0];
    const root = document.documentElement;
    root.setAttribute("data-site-theme", preset.id);
    root.setAttribute("data-site-mode", preset.mode.toLowerCase());
    root.style.colorScheme = preset.mode.toLowerCase();
  }, []);

  const setThemeId = useCallback(
    (requestedId: string) => {
      const preset =
        THEME_PRESETS.find((item) => item.id === requestedId) || THEME_PRESETS[0];
      setThemeIdState(preset.id);
      applyTheme(preset.id);
      if (typeof window !== "undefined") {
        localStorage.setItem(THEME_STORAGE_KEY, preset.id);
        window.dispatchEvent(
          new CustomEvent("pixelvault-theme-changed", { detail: preset.id })
        );
        if (typeof BroadcastChannel !== "undefined") {
          const channel = new BroadcastChannel("pixelvault_theme_channel");
          channel.postMessage({ themeId: preset.id });
          channel.close();
        }
      }
    },
    [applyTheme]
  );

  useEffect(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    const initialTheme =
      saved && THEME_PRESETS.some((t) => t.id === saved) ? saved : "cyber-vault";
    setThemeIdState(initialTheme);
    applyTheme(initialTheme);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && e.newValue) {
        setThemeIdState(e.newValue);
        applyTheme(e.newValue);
      }
    };

    const handleCustomThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setThemeIdState(customEvent.detail);
        applyTheme(customEvent.detail);
      }
    };

    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("pixelvault_theme_channel")
        : null;
    const handleBroadcast = (event: MessageEvent<{ themeId?: string }>) => {
      if (event.data?.themeId) {
        setThemeIdState(event.data.themeId);
        applyTheme(event.data.themeId);
      }
    };
    if (channel) channel.addEventListener("message", handleBroadcast);

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("pixelvault-theme-changed", handleCustomThemeChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("pixelvault-theme-changed", handleCustomThemeChange);
      if (channel) {
        channel.removeEventListener("message", handleBroadcast);
        channel.close();
      }
    };
  }, [applyTheme]);

  const showToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const confirmAction = useCallback(
    ({
      title,
      message,
      confirmLabel = "Confirm Action",
      isDestructive = true,
      onConfirm,
    }: {
      title: string;
      message: string;
      confirmLabel?: string;
      isDestructive?: boolean;
      onConfirm: () => void;
    }) => {
      setConfirmDialog({
        isOpen: true,
        title,
        message,
        confirmLabel,
        isDestructive,
        onConfirm,
      });
    },
    []
  );

  return (
    <ThemeContext.Provider value={{ themeId, setThemeId, showToast, confirmAction }}>
      {children}

      {/* Floating Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl shadow-2xl transition-all duration-300 ${
              toast.type === "success"
                ? "bg-slate-900/95 border-emerald-500/60 text-emerald-100"
                : toast.type === "error"
                ? "bg-slate-900/95 border-red-500/60 text-red-100"
                : toast.type === "warning"
                ? "bg-slate-900/95 border-amber-500/60 text-amber-100"
                : "bg-slate-900/95 border-cyan-500/60 text-cyan-100"
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === "success" ? (
                <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
              ) : (
                <WarningExclamationIcon
                  className={`w-5 h-5 ${
                    toast.type === "error"
                      ? "text-red-400"
                      : toast.type === "warning"
                      ? "text-amber-400"
                      : "text-cyan-400"
                  }`}
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold tracking-wide">{toast.title}</p>
              {toast.description && (
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {toast.description}
                </p>
              )}
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-xs text-slate-400 hover:text-white px-1 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Confirmation Modal for Destructive Actions */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-md vault-card p-6 border-red-500/40 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
                <WarningExclamationIcon className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-mono tracking-widest text-red-400 uppercase">
                  SECURITY CONFIRMATION
                </span>
                <h3 className="font-display text-lg font-bold text-white">
                  {confirmDialog.title}
                </h3>
              </div>
            </div>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() =>
                  setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
                }
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const cb = confirmDialog.onConfirm;
                  setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                  if (cb) cb();
                }}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                  confirmDialog.isDestructive
                    ? "bg-red-600 hover:bg-red-500 text-white"
                    : "vault-button-primary"
                }`}
              >
                {confirmDialog.confirmLabel || "Confirm Action"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ThemeContext.Provider>
  );
}
