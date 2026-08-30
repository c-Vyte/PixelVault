"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowUpRightIcon } from "./icons";

export function Footer({ hideScrollTop = false }: { hideScrollTop?: boolean } = {}) {
  const [cookieConsent, setCookieConsent] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem("pixelvault_cookie_consent");
    if (!accepted) {
      setCookieConsent(false);
    }

    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const acceptCookies = () => {
    localStorage.setItem("pixelvault_cookie_consent", "accepted");
    setCookieConsent(true);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <footer className="site-footer mt-20 border-t relative z-10">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            {/* Col 1: Brand & Identity */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="site-primary-bg w-8 h-8 rounded-lg flex items-center justify-center font-display font-extrabold text-lg">
                  P
                </div>
                <span className="site-text font-display font-bold text-xl">
                  PIXEL<span className="site-primary-text">VAULT</span>
                </span>
              </div>
              <p className="site-muted text-sm max-w-md leading-relaxed">
                High-velocity client-side gaming & software portal engineered with
                100% browser-persisted IndexedDB storage, multi-tab broadcast
                synchronization, and verified multi-part mirrors.
              </p>
            </div>

            {/* Col 2: Category Portals */}
            <div>
              <h4 className="site-text font-display font-bold text-xs uppercase tracking-widest mb-3">
                VAULT CATEGORIES
              </h4>
              <ul className="footer-links site-muted space-y-2 text-sm">
                <li>
                  <Link href="/pc-games" className="hover:text-cyan-400 transition-colors">
                    PC Games & Repacks
                  </Link>
                </li>
                <li>
                  <Link href="/windows" className="hover:text-cyan-400 transition-colors">
                    Windows Pro Applications
                  </Link>
                </li>
                <li>
                  <Link href="/movies" className="hover:text-cyan-400 transition-colors">
                    4K HDR Cinema REMUXes
                  </Link>
                </li>
                <li>
                  <Link href="/ebooks" className="hover:text-cyan-400 transition-colors">
                    Ebooks & Binary Codex
                  </Link>
                </li>
                <li>
                  <Link href="/tutorials" className="hover:text-cyan-400 transition-colors">
                    Unreal & Blender Tutorials
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 3: System & Administration */}
            <div>
              <h4 className="site-text font-display font-bold text-xs uppercase tracking-widest mb-3">
                SYSTEM & TOOLS
              </h4>
              <ul className="footer-links site-muted space-y-2 text-sm">
                <li>
                  <Link href="/admin" className="hover:text-cyan-400 transition-colors flex items-center gap-1">
                    Admin Command Deck <ArrowUpRightIcon className="w-3.5 h-3.5" />
                  </Link>
                </li>
                <li>
                  <Link href="/admin/themes" className="hover:text-cyan-400 transition-colors">
                    Theme Engine (8 Presets)
                  </Link>
                </li>
                <li>
                  <Link href="/admin/external-data" className="hover:text-cyan-400 transition-colors">
                    JSON Chunk Feed Browser
                  </Link>
                </li>
                <li>
                  <a href="/sitemap.xml" target="_blank" className="hover:text-cyan-400 transition-colors">
                    XML Sitemap
                  </a>
                </li>
                <li>
                  <a href="/robots.txt" target="_blank" className="hover:text-cyan-400 transition-colors">
                    Robots.txt
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="site-card-border site-muted pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <p>
              © {new Date().getFullYear()} PixelVault Digital Archive. Client-side
              IndexedDB architecture — Zero server database dependencies.
            </p>
            <p className="font-mono">
              DEFAULT ARCHIVE PASS: <span className="site-primary-text font-bold">pixelvault</span>
            </p>
          </div>
        </div>
      </footer>

      {/* Floating Back-to-Top Button */}
      {showScrollTop && !hideScrollTop && (
        <button
          onClick={scrollToTop}
          className="site-card site-primary-border site-primary-text fixed bottom-20 right-5 z-40 w-11 h-11 rounded-xl border shadow-xl transition-all flex items-center justify-center cursor-pointer hover:opacity-80"
          title="Back to Top"
        >
          ↑
        </button>
      )}

      {/* Cookie Consent Banner */}
      {!cookieConsent && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-md z-50 vault-card p-4 border-cyan-500/40 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                CLIENT VAULT LOCAL STORAGE
              </p>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                PixelVault stores download telemetry, your chosen theme preset, and
                offline software library directly in your browser&apos;s IndexedDB and
                localStorage.
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              onClick={acceptCookies}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold vault-button-primary cursor-pointer"
            >
              Acknowledge & Continue
            </button>
          </div>
        </div>
      )}
    </>
  );
}
