"use client";
import { useState } from "react";

export default function Setup2FA() {
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState("");
  const [setupToken, setSetupToken] = useState("");

  const load = async () => {
    setMsg("");
    const qs = setupToken ? `?setupToken=${encodeURIComponent(setupToken)}` : "";
    const res = await fetch(`/api/admin/totp${qs}`);
    const data = await res.json();
    if (!res.ok) { setMsg(data.error || "Failed"); return; }
    setQr(data.qrDataUrl); setSecret(data.secret); setOtpauthUrl(data.otpauthUrl);
  };
  const verify = async () => {
    const qs = setupToken ? `?setupToken=${encodeURIComponent(setupToken)}` : "";
    const res = await fetch(`/api/admin/totp${qs}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, setupToken: setupToken || undefined }) });
    const data = await res.json();
    setMsg(res.ok ? "✓ Code valid — save TOTP_SECRET in .env" : (data.error || "Invalid code"));
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#111827] rounded-xl border border-blue-900/30 p-6">
        <h1 className="text-white font-bold text-lg mb-1">Setup Authenticator (TOTP)</h1>
        <p className="text-blue-300/50 text-xs mb-4">Scan QR with Google Authenticator / Authy. Requires ADMIN_PASSWORD as setupToken on first run.</p>
        <input value={setupToken} onChange={(e) => setSetupToken(e.target.value)} placeholder="ADMIN_PASSWORD (one-time bootstrap)" type="password" className="w-full bg-[#0c1222] border border-blue-900/30 rounded-lg px-3 py-2 text-sm text-white mb-3" />
        <button onClick={load} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-sm font-bold mb-4">Generate QR</button>
        {qr && (
          <div className="bg-white p-4 rounded-lg flex flex-col items-center gap-3 mb-4">
            <img src={qr} alt="QR" className="w-64 h-64" />
            <p className="text-xs font-mono break-all text-slate-800">{otpauthUrl}</p>
            <p className="text-xs font-mono text-slate-600">Secret: {secret}</p>
          </div>
        )}
        <div className="flex gap-2">
          <input value={token} onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0,6))} placeholder="123456" maxLength={6} className="flex-1 bg-[#0c1222] border border-blue-900/30 rounded-lg px-3 py-2 text-sm text-white font-mono tracking-widest text-center" />
          <button onClick={verify} className="px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold">Verify</button>
        </div>
        {msg && <p className={`text-sm mt-3 px-3 py-2 rounded-lg ${msg.startsWith("✓") ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>{msg}</p>}
        <p className="text-blue-300/30 text-xs mt-4">After verify, set TOTP_SECRET={secret || "••••"} in .env and restart. Then login will require the 6-digit code.</p>
      </div>
    </div>
  );
}
