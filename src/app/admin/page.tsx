"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { softwareData as staticData, categories, type Software, saveSoftwareList } from "@/lib/data";
import { getDownloadStats } from "@/lib/data";

export default function AdminDashboard() {
  const [softwareList, setSoftwareList] = useState<Software[]>(staticData);
  const [downloadStats, setDownloadStats] = useState<{ date: string; count: number }[]>([]);

  useEffect(() => {
    const loadSoftware = () => {
      const stored = localStorage.getItem("softwareData");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSoftwareList(parsed);
          }
        } catch {}
      }
    };
    loadSoftware();
    const refresh = async () => setDownloadStats(await getDownloadStats());
    refresh();
    window.addEventListener("download-stats-changed", refresh);
    window.addEventListener("software-data-changed", loadSoftware);
    window.addEventListener("storage", () => {
      loadSoftware();
      refresh();
    });
    return () => {
      window.removeEventListener("download-stats-changed", refresh);
      window.removeEventListener("software-data-changed", loadSoftware);
      window.removeEventListener("storage", loadSoftware);
    };
  }, []);

  const totalSoftware = softwareList.length;
  const totalDownloads = softwareList.reduce((sum, s) => sum + s.downloads, 0);

  const today = new Date().toISOString().split("T")[0];
  const downloadsToday = downloadStats.find((d) => d.date === today)?.count || 0;
  const downloadsThisWeek = downloadStats
    .slice(-7)
    .reduce((sum, d) => sum + d.count, 0);
  const maxDailyDownloads = Math.max(1, ...downloadStats.map((d) => d.count));

  const platformStats = {
    windows: softwareList.filter((s) => s.platform === "windows").length,
    mac: softwareList.filter((s) => s.platform === "mac").length,
    android: softwareList.filter((s) => s.platform === "android").length,
    cross: softwareList.filter((s) => s.platform === "cross-platform").length,
  };

  const categoryStats = categories.map((cat) => ({
    ...cat,
    count: softwareList.filter((s) => s.category === cat.id).length,
  }));

  const topDownloaded = [...softwareList]
    .sort((a, b) => b.downloads - a.downloads)
    .slice(0, 5);

  const topRated = [...softwareList]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 5);

  const stats = [
    { label: "Total Software", value: totalSoftware, color: "bg-blue-600" },
    { label: "Total Downloads", value: `${(totalDownloads / 1000000).toFixed(1)}M`, color: "bg-emerald-600" },
    { label: "Downloads Today", value: downloadsToday.toLocaleString(), color: "bg-amber-600" },
    { label: "This Week", value: downloadsThisWeek.toLocaleString(), color: "bg-purple-600" },
  ];

  const allLinks = softwareList.flatMap((s) => s.downloadLinks);
  const aliveLinks = allLinks.filter((l) => l.status === "alive").length;
  const deadLinks = allLinks.filter((l) => l.status === "dead").length;
  const unknownLinks = allLinks.filter((l) => l.status !== "alive" && l.status !== "dead").length;
  const missingLinksCount = softwareList.filter((s) => {
    const usable = (s.downloadLinks || []).filter((l) => l.url && l.url.trim());
    return usable.length === 0;
  }).length;

  const missingLinksItems = softwareList.filter((s) => {
    const usable = (s.downloadLinks || []).filter((l) => l.url && l.url.trim());
    return usable.length === 0;
  });

  const [keepMode, setKeepMode] = useState(true);

  const persistSoftware = async (next: Software[]) => {
    setSoftwareList(next);
    await saveSoftwareList(next);
    window.dispatchEvent(new Event("download-stats-changed"));
  };

  const deleteMissingAll = async () => {
    const next = softwareList.filter((s) => s.downloadLinks?.some((l) => l.url && l.url.trim()));
    await persistSoftware(next);
  };

  const deleteMissingOne = async (id: string) => {
    await persistSoftware(softwareList.filter((s) => s.id !== id));
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-1">Dashboard</h1>
        <p className="text-blue-300/60">Welcome back! Here&apos;s what&apos;s happening with your site.</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Link href="/admin/external-data" className="bg-[#111827] rounded-xl p-4 border border-blue-900/30 hover:border-blue-500/50 transition-colors flex items-center gap-3">
          <div className="w-9 h-9 shrink-0 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm">External Data</p>
            <p className="text-blue-300/50 text-xs">XZY & ElAmigos</p>
          </div>
        </Link>
        <Link href="/admin/import" className="bg-[#111827] rounded-xl p-4 border border-blue-900/30 hover:border-blue-500/50 transition-colors flex items-center gap-3">
          <div className="w-9 h-9 shrink-0 bg-emerald-600 rounded-lg flex items-center justify-center">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm">Import</p>
            <p className="text-blue-300/50 text-xs">From URL</p>
          </div>
        </Link>
        <Link href="/admin/software" className="bg-[#111827] rounded-xl p-4 border border-blue-900/30 hover:border-blue-500/50 transition-colors flex items-center gap-3">
          <div className="w-9 h-9 shrink-0 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm">Software</p>
            <p className="text-blue-300/50 text-xs">Manage library</p>
          </div>
        </Link>
        <Link href="/admin/ai-fetch" className="bg-[#111827] rounded-xl p-4 border border-blue-900/30 hover:border-blue-500/50 transition-colors flex items-center gap-3">
          <div className="w-9 h-9 shrink-0 bg-violet-600 rounded-lg flex items-center justify-center">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm">AI Fetch</p>
            <p className="text-blue-300/50 text-xs">Generate metadata</p>
          </div>
        </Link>
        <Link href="/admin/themes" className="bg-[#111827] rounded-xl p-4 border border-blue-900/30 hover:border-blue-500/50 transition-colors flex items-center gap-3">
          <div className="w-9 h-9 shrink-0 bg-pink-600 rounded-lg flex items-center justify-center">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm">Themes</p>
            <p className="text-blue-300/50 text-xs">Site colors</p>
          </div>
        </Link>
        <Link href="/admin/api-usage" className="bg-[#111827] rounded-xl p-4 border border-blue-900/30 hover:border-blue-500/50 transition-colors flex items-center gap-3">
          <div className="w-9 h-9 shrink-0 bg-cyan-600 rounded-lg flex items-center justify-center">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm">API Usage</p>
            <p className="text-blue-300/50 text-xs">Calls &amp; stats</p>
          </div>
        </Link>
        <Link href="/admin/sync" className="bg-[#111827] rounded-xl p-4 border border-blue-900/30 hover:border-blue-500/50 transition-colors flex items-center gap-3">
          <div className="w-9 h-9 shrink-0 bg-emerald-600 rounded-lg flex items-center justify-center">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm">Sync</p>
            <p className="text-blue-300/50 text-xs">One-click import</p>
          </div>
        </Link>
        <Link href="/admin/bulk-import" className="bg-[#111827] rounded-xl p-4 border border-blue-900/30 hover:border-blue-500/50 transition-colors flex items-center gap-3">
          <div className="w-9 h-9 shrink-0 bg-emerald-600 rounded-lg flex items-center justify-center">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm">Bulk Import</p>
            <p className="text-blue-300/50 text-xs">To client</p>
          </div>
        </Link>
        <Link href="/admin/settings" className="bg-[#111827] rounded-xl p-4 border border-blue-900/30 hover:border-blue-500/50 transition-colors flex items-center gap-3">
          <div className="w-9 h-9 shrink-0 bg-gray-600 rounded-lg flex items-center justify-center">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm">Settings</p>
            <p className="text-blue-300/50 text-xs">Configuration</p>
          </div>
        </Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-[#111827] rounded-xl p-4 border border-blue-900/30 hover:border-blue-500/30 transition-colors flex items-center gap-3"
          >
            <div className={`w-9 h-9 shrink-0 ${stat.color} rounded-lg flex items-center justify-center`}>
              <span className="h-2 w-2 rounded-full bg-white/70" />
            </div>
            <div>
              <p className="text-xl font-bold text-white leading-tight">{stat.value}</p>
              <p className="text-blue-300/60 text-xs mt-0.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Downloads per day */}
        <div className="bg-[#111827] rounded-xl p-6 border border-blue-900/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Downloads · Last 14 Days</h2>
            <span className="text-blue-300/60 text-sm">{downloadsThisWeek.toLocaleString()} this week</span>
          </div>
          <p className="text-blue-300/40 text-xs mb-3">Estimated from library totals · new download clicks add on top</p>
          <div className="flex items-end gap-1.5 h-40">
              {downloadStats.map((d) => {
                const h = Math.max(4, Math.round((d.count / maxDailyDownloads) * 100));
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group" title={`${d.date}: ${d.count} downloads`}>
                    <span className="text-[9px] text-blue-300/70 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">{d.count}</span>
                    <div
                      className={`w-full rounded-t ${d.date === today ? "bg-amber-500" : "bg-blue-600 hover:bg-blue-500"} transition-colors`}
                      style={{ height: `${h}%` }}
                    />
                    <span className="text-[9px] text-blue-300/40 mt-1 truncate w-full text-center">{d.date.slice(5)}</span>
                  </div>
                );
              })}
            </div>
        </div>

        {/* Per-entry downloads vs rating */}
        <div className="bg-[#111827] rounded-xl p-6 border border-blue-900/30">
          <h2 className="text-lg font-semibold text-white mb-4">Top Downloads vs Rating</h2>
          <div className="space-y-3">
            {[...softwareList]
              .sort((a, b) => b.downloads - a.downloads)
              .slice(0, 8)
              .map((sw) => {
                const pct = totalDownloads > 0 ? Math.round((sw.downloads / totalDownloads) * 100) : 0;
                return (
                  <div key={sw.id}>
                    <div className="flex items-center justify-between mb-1">
                      <Link href={`/admin/software/edit?id=${sw.id}`} className="text-blue-300/80 hover:text-white text-sm font-medium truncate flex-1 min-w-0 mr-3">{sw.title}</Link>
                      <span className="text-amber-300 text-xs font-bold whitespace-nowrap">★ {sw.rating}</span>
                      <span className="text-white text-xs font-bold ml-3 whitespace-nowrap">{sw.downloads.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-blue-900/30 rounded-full h-1.5">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-blue-500 h-1.5 rounded-full"
                        style={{ width: `${Math.max(pct, 1)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Platform Breakdown */}
        <div className="bg-[#111827] rounded-xl p-6 border border-blue-900/30">
          <h2 className="text-lg font-semibold text-white mb-4">Platforms</h2>
          <div className="space-y-4">
            {[
              { label: "Windows", value: platformStats.windows, color: "bg-blue-500" },
              { label: "Mac", value: platformStats.mac, color: "bg-purple-500" },
              { label: "Android", value: platformStats.android, color: "bg-green-500" },
              { label: "Cross-Platform", value: platformStats.cross, color: "bg-yellow-500" },
            ].map((p) => (
              <div key={p.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-blue-300/60 text-sm">{p.label}</span>
                  <span className="text-white text-sm font-medium">{p.value} <span className="text-blue-400/40">({totalSoftware > 0 ? Math.round((p.value / totalSoftware) * 100) : 0}%)</span></span>
                </div>
                <div className="w-full bg-blue-900/30 rounded-full h-2">
                  <div
                    className={`${p.color} h-2 rounded-full`}
                    style={{ width: `${totalSoftware > 0 ? (p.value / totalSoftware) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-[#111827] rounded-xl p-6 border border-blue-900/30">
          <h2 className="text-lg font-semibold text-white mb-4">Categories</h2>
          <div className="space-y-3">
            {categoryStats.map((cat) => (
              <div key={cat.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-blue-300/60 text-sm">{cat.name}</span>
                  <span className="text-white text-sm font-medium">{cat.count}</span>
                </div>
                <div className="w-full bg-blue-900/30 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full"
                    style={{ width: `${totalSoftware > 0 ? (cat.count / totalSoftware) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-[#111827] rounded-xl p-6 border border-blue-900/30">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Info</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-blue-900/20 rounded-lg">
              <span className="text-blue-300/60 text-sm">Games</span>
              <span className="text-white font-bold">{softwareList.filter(s => s.category === "pc-games").length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-900/20 rounded-lg">
              <span className="text-blue-300/60 text-sm">Windows Software</span>
              <span className="text-white font-bold">{softwareList.filter(s => s.category === "windows").length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-900/20 rounded-lg">
              <span className="text-blue-300/60 text-sm">Android Apps</span>
              <span className="text-white font-bold">{softwareList.filter(s => s.category === "android").length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-900/20 rounded-lg">
              <span className="text-blue-300/60 text-sm">Ebooks</span>
              <span className="text-white font-bold">{softwareList.filter(s => s.category === "ebooks").length}</span>
            </div>
          </div>

          <h3 className="text-lg font-semibold text-white mt-6 mb-3">Link Health</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-green-600/10 rounded-lg border border-green-600/20">
              <span className="flex items-center gap-2 text-sm text-green-300"><span className="w-2 h-2 rounded-full bg-green-500" /> Alive</span>
              <span className="text-white font-bold">{aliveLinks}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-600/10 rounded-lg border border-red-600/20">
              <span className="flex items-center gap-2 text-sm text-red-300"><span className="w-2 h-2 rounded-full bg-red-500" /> Dead</span>
              <span className="text-white font-bold">{deadLinks}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-yellow-600/10 rounded-lg border border-yellow-600/20">
              <span className="flex items-center gap-2 text-sm text-yellow-300"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Untested</span>
              <span className="text-white font-bold">{unknownLinks}</span>
            </div>
            {missingLinksCount > 0 && (
              <Link href="/admin/software" className="flex items-center justify-between p-3 bg-red-600/10 rounded-lg border border-red-600/20 hover:bg-red-600/20 transition-colors">
                <span className="flex items-center gap-2 text-sm text-red-300"><span className="w-2 h-2 rounded-full bg-red-500" /> Missing links</span>
                <span className="text-white font-bold">{missingLinksCount}</span>
              </Link>
            )}
            <Link href="/admin/software" className="block text-center mt-3 text-blue-400 hover:text-blue-300 text-sm">
              Run link check in Software
            </Link>
          </div>
        </div>
      </div>

      {/* Apps Without Download Links */}
      {missingLinksItems.length > 0 && (
        <div className="bg-[#111827] rounded-xl p-6 border border-red-900/30 mb-6">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold text-white">Apps Without Download Links</h2>
              <p className="text-blue-300/50 text-sm mt-1">
                {missingLinksItems.length} {missingLinksItems.length === 1 ? "app has" : "apps have"} no usable download links.
              </p>
            </div>
            {keepMode ? (
              <button
                onClick={() => setKeepMode(false)}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-500"
              >
                Delete All
              </button>
            ) : (
              <button
                onClick={() => setKeepMode(true)}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500"
              >
                Keep All
              </button>
            )}
          </div>

          {keepMode ? (
            <p className="text-blue-300/60 text-sm">Keeping all {missingLinksItems.length} apps without links. They won&apos;t appear in the store until links are added.</p>
          ) : (
            <div>
              <p className="text-red-300/80 text-sm mb-3">The following apps will be removed. You can delete them all now or cancel to keep them.</p>
              <div className="border border-red-900/30 rounded-lg divide-y divide-red-900/20 overflow-hidden mb-4 max-h-72 overflow-y-auto">
                {missingLinksItems.map((sw) => (
                  <div key={sw.id} className="flex items-center gap-3 p-3 bg-red-950/10 hover:bg-red-900/10">
                    <div className="w-9 h-9 rounded bg-blue-900/30 overflow-hidden flex-shrink-0">
                      <img src={sw.icon} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{sw.title}</p>
                      <p className="text-blue-300/50 text-sm capitalize">{sw.category.replace(/-/g, " ")}</p>
                    </div>
                    <button
                      onClick={() => deleteMissingOne(sw.id)}
                      className="text-red-400 hover:text-red-300 text-xs font-semibold whitespace-nowrap"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={deleteMissingAll}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-500"
                >
                  Delete All ({missingLinksItems.length})
                </button>
                <button
                  onClick={() => setKeepMode(true)}
                  className="px-4 py-2 rounded-lg border border-blue-900/50 text-blue-300 text-sm font-semibold hover:bg-blue-900/20"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Downloaded */}
        <div className="bg-[#111827] rounded-xl border border-blue-900/30 overflow-hidden">
          <div className="p-4 border-b border-blue-900/30">
            <h2 className="text-lg font-semibold text-white">Top Downloaded</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-blue-300/60 text-xs bg-blue-900/20">
                  <th className="p-3 pl-4">#</th>
                  <th className="p-3">Title</th>
                  <th className="p-3">Platform</th>
                  <th className="p-3 text-right pr-4">Downloads</th>
                </tr>
              </thead>
              <tbody>
                {topDownloaded.map((sw, i) => (
                  <tr
                    key={sw.id}
                    className="border-t border-blue-900/30 hover:bg-blue-900/20"
                  >
                    <td className="p-3 pl-4 text-blue-400/40 text-sm">{i + 1}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-blue-900/30 overflow-hidden flex-shrink-0">
                          <img src={sw.icon} alt="" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-white text-sm font-medium">{sw.title}</span>
                      </div>
                    </td>
                    <td className="p-3 text-blue-300/60 text-sm capitalize">{sw.platform}</td>
                    <td className="p-3 text-right pr-4 text-white text-sm font-medium">{sw.downloads.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Rated */}
        <div className="bg-[#111827] rounded-xl border border-blue-900/30 overflow-hidden">
          <div className="p-4 border-b border-blue-900/30">
            <h2 className="text-lg font-semibold text-white">Top Rated</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-blue-300/60 text-xs bg-blue-900/20">
                  <th className="p-3 pl-4">#</th>
                  <th className="p-3">Title</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right pr-4">Rating</th>
                </tr>
              </thead>
              <tbody>
                {topRated.map((sw, i) => (
                  <tr
                    key={sw.id}
                    className="border-t border-blue-900/30 hover:bg-blue-900/20"
                  >
                    <td className="p-3 pl-4 text-blue-400/40 text-sm">{i + 1}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-blue-900/30 overflow-hidden flex-shrink-0">
                          <img src={sw.icon} alt="" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-white text-sm font-medium">{sw.title}</span>
                      </div>
                    </td>
                    <td className="p-3 text-blue-300/60 text-sm capitalize">{sw.category.replace(/-/g, " ")}</td>
                    <td className="p-3 text-right pr-4">
                      <span className="text-amber-300 text-sm font-medium">Rating {sw.rating}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
