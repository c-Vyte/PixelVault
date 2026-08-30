"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SearchIcon, ShieldLockIcon, PaletteIcon } from "./icons";
import { getSoftwareList, Software } from "@/lib/data";
import { useThemeAndToast, THEME_PRESETS } from "./ThemeAndToastProvider";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { themeId, setThemeId } = useThemeAndToast();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Software[]>([]);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [allSoftware, setAllSoftware] = useState<Software[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = () =>
      getSoftwareList().then((list) =>
        setAllSoftware(list.filter((item) => item.status === "published"))
      );
    load();
    const handleDataChange = load;
    window.addEventListener("software-data-changed", handleDataChange);
    return () => window.removeEventListener("software-data-changed", handleDataChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setThemeMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [searchOpen]);

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setSearchResults(allSoftware.slice(0, 7));
      return;
    }
    setSearchResults(
      allSoftware
        .filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            item.subcategory.toLowerCase().includes(q) ||
            item.category.toLowerCase().includes(q) ||
            item.features.some((f) => f.toLowerCase().includes(q))
        )
        .slice(0, 9)
    );
  }, [searchQuery, allSoftware]);

  const navLinks = [
    { href: "/pc-games", label: "Games" },
    { href: "/windows", label: "Software" },
    { href: "/ebooks", label: "Ebooks" },
    { href: "/movies", label: "PC Check" },
  ];

  const currentTheme = THEME_PRESETS.find((t) => t.id === themeId) || THEME_PRESETS[0];

  return (
    <>
      <header className="site-header sticky top-0 z-40 w-full border-b backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-5">
            <Link href="/" className="group flex items-center gap-2 cursor-pointer">
              <div className="site-primary-bg flex h-7 w-7 items-center justify-center rounded-lg text-[13px] font-black transition-transform group-hover:scale-105">
                P
              </div>
              <span className="site-text font-mono text-[11px] font-black uppercase tracking-[0.24em]">
                PixelVault
              </span>
            </Link>

            <nav className="hidden items-center gap-5 md:flex">
              {navLinks.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`font-mono text-[10px] font-bold uppercase tracking-[0.22em] transition-colors ${
                      active ? "site-primary-text" : "site-nav site-muted"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="site-theme-button site-card-elevated site-primary-border site-text hidden rounded-md border px-3 py-1.5 font-mono text-[9px] font-black uppercase tracking-[0.16em] transition-colors sm:inline-flex"
            >
              Find my games
            </Link>

            <button
              onClick={() => setSearchOpen(true)}
              className="site-theme-control site-card-elevated site-card-border site-muted flex h-8 w-36 items-center justify-between rounded-md border px-2.5 font-mono text-[10px] transition-all sm:w-48 cursor-pointer"
            >
              <span className="truncate">Search...</span>
              <SearchIcon className="site-primary-text h-3.5 w-3.5" />
            </button>

            <div className="relative">
              <button
                onClick={() => setThemeMenuOpen((prev) => !prev)}
                className="site-theme-control site-card-elevated site-card-border site-primary-text flex h-8 w-8 items-center justify-center rounded-md border transition-colors cursor-pointer"
                title="Theme presets"
              >
                <PaletteIcon className="h-4 w-4" />
              </button>
              {themeMenuOpen && (
                <div className="site-card absolute right-0 mt-2 w-72 rounded-xl border p-3 shadow-2xl">
                  <div className="site-card-border mb-2 flex items-center justify-between border-b pb-2">
                    <span className="site-text font-mono text-[10px] font-black uppercase tracking-[0.18em]">
                      Theme presets
                    </span>
                    <span className="site-primary-text font-mono text-[9px]">{currentTheme.mode}</span>
                  </div>
                  <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                    {THEME_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => {
                          setThemeId(preset.id);
                          setThemeMenuOpen(false);
                        }}
                        className={`theme-preset-row flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors cursor-pointer ${
                          preset.id === themeId
                            ? "is-active site-primary-border site-card-elevated site-text border"
                            : "site-muted"
                        }`}
                      >
                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em]">
                          {preset.name}
                        </span>
                        <span className="flex gap-1">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: preset.primary }} />
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: preset.accent }} />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Link
              href="/admin"
              className="site-theme-control site-card-elevated site-card-border site-muted flex h-8 w-8 items-center justify-center rounded-md border transition-colors sm:hidden"
              title="Admin"
            >
              <ShieldLockIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-16 backdrop-blur-md sm:pt-24">
          <div className="site-card site-primary-border w-full max-w-2xl overflow-hidden rounded-2xl border shadow-2xl">
            <div className="site-card-elevated site-card-border flex items-center gap-3 border-b px-4 py-3.5">
              <SearchIcon className="site-primary-text h-5 w-5 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search games, apps, movies, ebooks..."
                className="site-text w-full bg-transparent text-sm placeholder:text-[var(--muted)] focus:outline-none"
              />
              <button
                onClick={() => setSearchOpen(false)}
                className="site-card-elevated site-muted rounded px-2 py-1 font-mono text-[10px] cursor-pointer"
              >
                ESC
              </button>
            </div>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto p-3">
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSearchOpen(false);
                    router.push(`/software/${item.id}`);
                  }}
                  className="site-card group flex w-full items-center justify-between gap-3 rounded-xl border p-2.5 text-left transition-all cursor-pointer"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <img src={item.icon} alt={item.title} className="h-11 w-11 shrink-0 rounded-lg border border-[#2f2850] object-cover" />
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-bold text-white group-hover:text-[#b19cff]">{item.title}</h4>
                      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">{item.category} / {item.size}</p>
                    </div>
                  </div>
                  <span className="site-primary-text font-mono text-[10px] font-bold uppercase">View</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
