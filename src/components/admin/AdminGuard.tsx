"use client";

import { useAuth } from "@/components/admin/AuthProvider";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTopBar from "@/components/admin/AdminTopBar";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoggedIn && pathname !== "/admin/login") {
      router.push("/admin/login");
    }
  }, [isLoggedIn, pathname, router]);

  if (!isLoggedIn && pathname !== "/admin/login") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-gray-400 text-sm">Redirecting to login...</div>
      </div>
    );
  }

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1 flex flex-col">
        <AdminTopBar />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
