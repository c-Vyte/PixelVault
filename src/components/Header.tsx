"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import BrandLogo from "@/components/BrandLogo";
import { defaultSiteContent, readSiteContent, type SiteContent } from "@/lib/siteContent";

export default function Header() {
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [content, setContent] = useState<SiteContent>(defaultSiteContent);

  useEffect(() => {
    const loadContent = () => setContent(readSiteContent());
    loadContent();
    window.addEventListener("site-content-changed", loadContent);
    return () => window.removeEventListener("site-content-changed", loadContent);
  }, []);

  const navLinks = [
    { label: content.navigation.games, href: "/category/pc-games" },
    { label: content.navigation.software, href: "/category/windows" },
    { label: content.navigation.ebooks, href: "/category/ebooks" },
    { label: content.navigation.pcCheck, href: "/pc-check" },
    { label: content.navigation.faq, href: "/faq" },
    { label: content.navigation.contact, href: "/contact" },
    { label: "Speedtest", href: "/speedtest" },
  ];

  return (
    <header className="reference-header sticky top-0 z-50 backdrop-blur-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <BrandLogo href="/" className="group transition-transform hover:-translate-y-0.5" />

          <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary navigation">
            {navLinks.slice(0, 4).map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500 transition-colors hover:text-amber-400"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <Link
              href="/pc-check"
              className="hidden rounded-lg border border-amber-500/30 px-3 py-2 text-xs font-bold uppercase tracking-wider text-amber-400 transition-colors hover:bg-amber-500/10 md:block"
            >
              {content.navigation.pcCheckCta}
            </Link>
            {/* Search - desktop */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (searchQuery.trim()) {
                  window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
                }
              }}
              className="hidden md:flex items-center bg-gray-900 rounded-lg border border-gray-800 focus-within:border-amber-500 transition-colors"
            >
              <input
                type="text"
                placeholder={content.navigation.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-white text-xs px-4 py-2 w-44 focus:outline-none placeholder-gray-600 font-mono"
              />
              <button
                type="submit"
                className="px-3 py-2 text-gray-500 hover:text-amber-500 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </form>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-500 hover:text-white rounded-lg hover:bg-gray-900 transition-colors"
            >
              {theme === "dark" ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Hamburger - mobile */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden text-gray-400 hover:text-white p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-gray-950 border-t border-gray-800">
          <div className="px-4 py-4 space-y-3">
            {/* Mobile search */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (searchQuery.trim()) {
                  setMobileMenuOpen(false);
                  window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
                }
              }}
              className="flex items-center bg-gray-900 rounded-lg"
            >
              <input
                type="text"
                placeholder="Search software..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-white text-sm px-4 py-3 flex-1 focus:outline-none placeholder-gray-600"
              />
              <button type="submit" className="px-4 py-3 text-gray-500 hover:text-red-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </form>
            {/* Mobile nav links */}
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="block text-gray-400 hover:text-white py-2 text-sm font-bold uppercase tracking-[0.15em]"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
