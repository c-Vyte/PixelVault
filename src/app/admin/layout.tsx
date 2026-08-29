import AdminGuard from "@/components/admin/AdminGuard";
import { AuthProvider } from "@/components/admin/AuthProvider";
import { ToastProvider } from "@/components/admin/Toast";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <ToastProvider>
        <AdminGuard>
          <div className="min-h-screen bg-[#0a0f1a]">
            {children}
          </div>
        </AdminGuard>
      </ToastProvider>
    </AuthProvider>
  );
}
