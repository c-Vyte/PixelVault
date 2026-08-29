"use client";

import { useEffect, useState } from "react";
import { SITE_THEMES, DEFAULT_SITE_THEME, getStoredSiteTheme } from "@/lib/themes";
import { useToast } from "@/components/admin/Toast";

export default function ThemesAdminPage() {
  const { toast } = useToast();
  const [active, setActive] = useState(DEFAULT_SITE_THEME);

  useEffect(() => {
    setActive(getStoredSiteTheme());
  }, []);

  const applyTheme = (id: string, name: string) => {
    localStorage.setItem("siteTheme", id);
    document.documentElement.dataset.siteTheme = id;
    setActive(id);
    toast(`"${name}" theme applied site-wide.`, "success");
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Site Theme</h1>
        <p className="text-blue-300/50 text-sm">
          Pick a color theme for the public site. Applies instantly for all visitors who haven&apos;t
          overridden it locally.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SITE_THEMES.map((theme) => {
          const isActive = active === theme.id;
          return (
            <button
              key={theme.id}
              onClick={() => applyTheme(theme.id, theme.name)}
              className={`text-left rounded-xl p-4 border transition-all cursor-pointer ${
                isActive
                  ? "border-indigo-500 bg-indigo-950/40 ring-1 ring-indigo-500"
                  : "border-blue-900/30 bg-[#111827] hover:border-blue-500/50"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-bold text-sm">{theme.name}</span>
                <span
                  className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    theme.mode === "dark"
                      ? "bg-slate-800 text-slate-300"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {theme.mode}
                </span>
              </div>

              <div className="flex h-12 rounded-lg overflow-hidden border border-white/10 mb-3">
                {theme.swatch.map((color) => (
                  <div key={color} className="flex-1" style={{ backgroundColor: color }} />
                ))}
              </div>

              <p className="text-blue-300/50 text-xs leading-relaxed min-h-[2.5rem]">
                {theme.description}
              </p>

              <div className="mt-3 flex items-center justify-between">
                {isActive ? (
                  <span className="text-emerald-400 text-xs font-bold">✓ Active</span>
                ) : (
                  <span className="text-blue-300/40 text-xs">Click to apply</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 bg-[#111827] rounded-xl p-4 border border-blue-900/30">
        <p className="text-blue-300/40 text-xs">
          Currently active: <span className="text-white font-bold">{SITE_THEMES.find((t) => t.id === active)?.name}</span>.
          Reset to default by selecting Neon Violet.
        </p>
      </div>
    </div>
  );
}
