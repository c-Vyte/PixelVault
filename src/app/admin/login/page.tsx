"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/admin/AuthProvider";
import BrandLogo from "@/components/BrandLogo";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needTotp, setNeedTotp] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/admin/config").then((r) => r.json()).then((d) => {
      if (d.needTotp) setNeedTotp(true);
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await login(password, { totp: totp || undefined });
    if (res.ok) {
      router.push("/admin");
    } else {
      if (res.needTotp) setNeedTotp(true);
      setError(res.error || "Invalid credentials. Try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0f1a] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <BrandLogo showName={false} className="justify-center mb-4" />
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="text-blue-300/60 text-sm mt-2">Password + Authenticator</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#111827] rounded-xl border border-blue-900/30 p-6 space-y-4">
          <div>
            <label className="block text-blue-300/60 text-sm mb-2">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter admin password" autoFocus className="w-full bg-[#0c1222] text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30 text-sm" />
          </div>

          {needTotp && (
            <div>
              <label className="block text-blue-300/60 text-sm mb-2">Authenticator code (6 digits)</label>
              <input inputMode="numeric" pattern="\d{6}" maxLength={6} value={totp} onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))} placeholder="123456" className="w-full bg-[#0c1222] text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30 text-sm tracking-[0.3em] text-center font-mono" />
              <p className="text-blue-300/40 text-xs mt-1 text-center">Google Authenticator / Authy</p>
            </div>
          )}

          {error && <p className="text-red-400 text-sm bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}

          <button type="submit" disabled={loading || !password || (needTotp && totp.length !== 6)} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
            {loading ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Verifying...</> : "Sign In"}
          </button>

          <p className="text-blue-300/40 text-xs text-center">Set ADMIN_PASSWORD + TOTP_SECRET in .env. <a href="/admin/setup-2fa" className="text-blue-400 hover:text-blue-300 underline">Setup 2FA</a></p>
        </form>
      </div>
    </div>
  );
}
