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
        <AdminGuard>{children}</AdminGuard>
      </ToastProvider>
    </AuthProvider>
  );
}
