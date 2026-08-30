"use client";

import { usePathname } from "next/navigation";

export default function AdminTopBar({ onMenu }: { onMenu?: () => void }) {
  const pathname = usePathname();

  const getPageTitle = () => {
    if (pathname === "/admin") return "Dashboard";
    if (pathname.startsWith("/admin/software")) return "Software Management";
    if (pathname.startsWith("/admin/categories")) return "Categories";
    if (pathname.startsWith("/admin/import")) return "Import";
    if (pathname.startsWith("/admin/external-data")) return "External Data";
    if (pathname.startsWith("/admin/settings")) return "Settings";
    return "Admin";
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-[#0c1222]/95 backdrop-blur border-b border-blue-900/50 flex items-center justify-between gap-4 px-4 sm:px-6">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile menu toggle */}
        <button
          onClick={onMenu}
          aria-label="Open menu"
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg bg-[#0a0f1a] border border-blue-900/50 text-blue-300 hover:text-white shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h2 className="font-semibold text-white truncate">{getPageTitle()}</h2>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        {/* Admin badge */}
        <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 bg-blue-600/20 border border-blue-500/30 rounded-lg">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-blue-300 font-medium uppercase tracking-wider hidden sm:inline">Admin</span>
        </div>

        {/* User */}
        <div className="flex items-center gap-3 pl-3 sm:pl-4 border-l border-blue-900/50">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
            <span className="text-white font-medium">A</span>
          </div>
          <div className="hidden lg:block">
            <p className="text-white font-medium leading-tight">Admin</p>
            <p className="text-blue-400/60">admin@pixelvault.com</p>
          </div>
        </div>
      </div>
    </header>
  );
}
