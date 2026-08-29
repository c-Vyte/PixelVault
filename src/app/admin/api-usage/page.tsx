"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiUsageStats, ProviderStats, DayStats, ApiUsageEntry } from "@/lib/apiUsage";
import { useToast } from "@/components/admin/Toast";

const PROVIDER_COLORS: Record<string, string> = {
  groq: "bg-orange-500",
  gemini: "bg-blue-500",
  mistral: "bg-amber-500",
  zai: "bg-emerald-500",
  nvidia: "bg-lime-600",
};

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent: string }) {
  return (
    <div className="bg-[#111827] rounded-xl p-4 border border-blue-900/30 flex items-center gap-3">
      <div className={`w-9 h-9 shrink-0 ${accent} rounded-lg flex items-center justify-center`}>
        <span className="h-2 w-2 rounded-full bg-white/70" />
      </div>
      <div>
        <p className="text-xl font-bold text-white leading-tight">{value}</p>
        <p className="text-blue-300/60 text-xs mt-0.5">{label}{sub ? ` · ${sub}` : ""}</p>
      </div>
    </div>
  );
}

export default function ApiUsagePage() {
  const { toast } = useToast();
  const [stats, setStats] = useState<ApiUsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/usage", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStats(await res.json());
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load usage stats.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const maxDayCalls = stats ? Math.max(1, ...stats.byDay.map((d) => d.calls)) : 1;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">API Usage &amp; Stats</h1>
          <p className="text-blue-300/50 text-sm">
            Outbound API calls made by the server (AI enrichment providers).
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); load(); }}
          className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          Refresh
        </button>
      </div>

      {loading && !stats ? (
        <div className="bg-[#111827] rounded-xl p-8 border border-blue-900/30 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-blue-300/60 text-sm">Loading stats...</p>
        </div>
      ) : !stats || stats.totals.calls === 0 ? (
        <div className="bg-[#111827] rounded-xl p-8 border border-blue-900/30 text-center">
          <p className="text-white font-bold mb-1">No API calls recorded yet</p>
          <p className="text-blue-300/50 text-sm">
            Usage appears here automatically once the AI Fetch feature or enrichment scripts run.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard label="Total calls" value={stats.totals.calls.toLocaleString()} accent="bg-indigo-600" />
            <StatCard label="Success rate" value={`${stats.totals.successRatePct}%`} sub={`${stats.totals.failed} failed`} accent={stats.totals.successRatePct >= 90 ? "bg-emerald-600" : stats.totals.successRatePct >= 70 ? "bg-amber-600" : "bg-red-600"} />
            <StatCard label="Last 24 hours" value={stats.totals.last24h.toLocaleString()} accent="bg-cyan-600" />
            <StatCard label="Avg latency" value={`${(stats.totals.avgLatencyMs / 1000).toFixed(1)}s`} accent="bg-violet-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="bg-[#111827] rounded-xl p-6 border border-blue-900/30">
              <h2 className="text-lg font-semibold text-white mb-4">By Provider</h2>
              <div className="space-y-3">
                {stats.byProvider.map((p: ProviderStats) => {
                  const pct = Math.round((p.ok / p.calls) * 100);
                  return (
                    <div key={p.provider}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-white font-bold capitalize">{p.provider}</span>
                        <span className="text-blue-300/50">
                          {p.calls.toLocaleString()} calls · {pct}% ok · {(p.avgLatencyMs / 1000).toFixed(1)}s avg
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-blue-950 overflow-hidden flex">
                        <div className={`h-full ${(PROVIDER_COLORS[p.provider] || "bg-indigo-500").replace("bg-", "bg-")}`} style={{ width: `${pct}%` }} />
                        <div className="h-full bg-red-900" style={{ width: `${100 - pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-[#111827] rounded-xl p-6 border border-blue-900/30">
              <h2 className="text-lg font-semibold text-white mb-4">Calls · Last 14 Days</h2>
              <div className="flex items-end gap-1.5 h-40">
                {stats.byDay.map((d: DayStats) => {
                  const h = Math.max(4, Math.round((d.calls / maxDayCalls) * 100));
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group" title={`${d.date}: ${d.calls} calls (${d.failed} failed)`}>
                      <span className="text-[9px] text-blue-300/70 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">{d.calls}</span>
                      <div className={`w-full rounded-t ${d.failed > d.ok && d.calls > 0 ? "bg-red-800" : "bg-emerald-700"}`} style={{ height: `${h}%` }} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {stats.recentErrors.length > 0 && (
            <div className="bg-[#111827] rounded-xl p-6 border border-blue-900/30">
              <h2 className="text-lg font-semibold text-white mb-3">Recent Errors</h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {stats.recentErrors.map((e: ApiUsageEntry, i: number) => (
                  <div key={i} className="flex items-start gap-3 text-xs py-1.5 border-b border-blue-900/20 last:border-0">
                    <span className="text-red-400 font-bold shrink-0 uppercase">{e.provider}</span>
                    <span className="text-blue-200/70 break-all">{e.error}</span>
                    <span className="ml-auto shrink-0 text-blue-300/40">{new Date(e.ts).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
