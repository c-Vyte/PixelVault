"use client";

import { usePathname } from "next/navigation";

export default function AdminTopBar() {
  const pathname = usePathname();

  const getPageTitle = () => {
    if (pathname === "/admin") return "Dashboard";
    if (pathname.startsWith("/admin/software")) return "Software Management";
    if (pathname.startsWith("/admin/categories")) return "Categories";
    if (pathname.startsWith("/admin/settings")) return "Settings";
    return "Admin";
  };

  return (
    <header className="h-16 bg-[#0c1222] border-b border-blue-900/50 flex items-center justify-between px-6">
      <div>
        <h2 className="text-lg font-semibold text-white">{getPageTitle()}</h2>
      </div>

      <div className="flex items-center gap-4">
        {/* Admin badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 border border-blue-500/30 rounded-lg">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-blue-300 text-xs font-medium uppercase tracking-wider">Admin</span>
        </div>

        {/* User */}
        <div className="flex items-center gap-3 pl-4 border-l border-blue-900/50">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">A</span>
          </div>
          <div className="hidden md:block">
            <p className="text-white text-sm font-medium">Admin</p>
            <p className="text-blue-400/60 text-xs">admin@pixelvault.com</p>
          </div>
        </div>
      </div>
    </header>
  );
}
