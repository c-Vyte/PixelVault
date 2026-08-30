"use client";

import { useAuth } from "@/components/admin/AuthProvider";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTopBar from "@/components/admin/AdminTopBar";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isLoggedIn && pathname !== "/admin/login") {
      router.push("/admin/login");
    }
  }, [isLoggedIn, pathname, router]);

  if (!isLoggedIn && pathname !== "/admin/login") {
    return (
      <div className="admin-console min-h-screen flex items-center justify-center bg-[#0a0f1a]">
        <div className="text-blue-300/60 text-sm">Redirecting to login…</div>
      </div>
    );
  }

  if (pathname === "/admin/login") {
    return <div className="admin-console min-h-screen bg-[#0a0f1a]">{children}</div>;
  }

  return (
    <div className="admin-console flex min-h-screen bg-[#0a0f1a]">
      {/* Desktop sidebar — fixed on md and up */}
      <div className="hidden md:block shrink-0">
        <AdminSidebar />
      </div>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden
          />
          <div className="relative z-10 h-full animate-[slidein_0.18s_ease-out]">
            <AdminSidebar onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <AdminTopBar onMenu={() => setMobileNavOpen(true)} />
        <main className="flex-1 min-w-0 p-4 sm:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
