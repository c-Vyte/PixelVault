"use client";

import { useState } from "react";
import { getSoftwareList, saveSoftwareList, type Software } from "@/lib/data";
import { useToast } from "@/components/admin/Toast";

const SOURCES = [
  { url: "/data/fitgirl-index.json", name: "FitGirl" },
  { url: "/data/xzy-index.json", name: "XZY" },
  { url: "/data/elamigos-index.json", name: "ElAmigos" },
];

function toSoftware(raw: any, fallbackCategory = "pc-games"): Software | null {
  if (!raw?.title) return null;
  const now = new Date().toISOString().split("T")[0];
  return {
    id: raw.id || `sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: raw.title,
    description: raw.description || "",
    category: raw.category || fallbackCategory,
    subcategory: raw.subcategory || "",
    platform: raw.platform || "windows",
    version: raw.version || "",
    size: raw.size || raw.repackSize || "",
    downloads: 0,
    rating: raw.rating || 4,
    icon: raw.icon || raw.poster || `https://placehold.co/616x352/7c3aed/ffffff?text=${encodeURIComponent(raw.title.slice(0, 20))}`,
    poster: raw.poster || raw.icon || `https://placehold.co/600x900/4c1d95/ffffff?text=${encodeURIComponent(raw.title.slice(0, 20))}`,
    screenshots: raw.screenshots || [],
    downloadLinks: raw.downloadLinks?.length ? raw.downloadLinks : raw.downloads?.length ? raw.downloads : raw.downloads_links?.length ? raw.downloads_links : [{ name: "Download", url: "", type: "official" as const }],
    downloadsByHoster: raw.downloadsByHoster || undefined,
    features: raw.features || [],
    systemRequirements: typeof raw.systemRequirements === "string" ? raw.systemRequirements : "",
    videoUrl: raw.videoUrl || undefined,
    password: raw.password || undefined,
    createdAt: raw.createdAt || now,
    updatedAt: now,
  };
}

export default function SyncPage() {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const sync = async () => {
    setSyncing(true);
    setLog([]);
    const add = (m: string) => setLog((p) => [...p, m]);

    try {
      const existing = await getSoftwareList();
      const existingTitles = new Set(existing.map((s) => s.title.toLowerCase().trim()));
      add(`Library has ${existing.length} items.`);

      let added = 0;
      let skipped = 0;
      let toAdd: Software[] = [];

      for (const src of SOURCES) {
        try {
          const res = await fetch(src.url, { cache: "no-store" });
          if (!res.ok) { add(`${src.name}: no data (${res.status})`); continue; }
          const data = await res.json();
          const items: any[] = Array.isArray(data) ? data : data.items || [];
          if (items.length === 0) { add(`${src.name}: 0 items`); continue; }
          add(`${src.name}: found ${items.length} items`);
          for (const raw of items) {
            const sw = toSoftware(raw);
            if (!sw) continue;
            const hasLinks = sw.downloadLinks.some((l) => l.url && l.url.startsWith("http"));
            if (!hasLinks) { skipped++; continue; }
            if (existingTitles.has(sw.title.toLowerCase().trim()) || toAdd.some((x) => x.title.toLowerCase() === sw.title.toLowerCase())) {
              skipped++;
            } else {
              toAdd.push(sw);
              existingTitles.add(sw.title.toLowerCase().trim());
            }
          }
        } catch (e) {
          add(`${src.name}: failed — ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      if (toAdd.length === 0) {
        add(`Nothing new to add (${skipped} duplicates skipped).`);
        toast("Already up to date — no new games to sync.", "success");
        return;
      }

      add(`Saving ${toAdd.length} new items...`);
      const merged = [...existing, ...toAdd];
      const ok = await saveSoftwareList(merged);
      if (!ok) {
        add("Save failed — storage full.");
        toast("Sync failed — storage full.", "error");
        return;
      }
      window.dispatchEvent(new Event("software-data-changed"));
      add(`Done! Added ${toAdd.length}, skipped ${skipped} duplicates. Total: ${merged.length}`);
      toast(`Synced ${toAdd.length} new games to library.`, "success");
    } catch (e) {
      add(`Error: ${e instanceof Error ? e.message : String(e)}`);
      toast("Sync failed.", "error");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">One-Click Sync</h1>
      <p className="text-blue-300/50 text-sm mb-6">Fetches all scraped games from <code className="text-blue-300">/public/data</code> and adds missing ones to the client library. No selection needed.</p>

      <div className="bg-[#111827] rounded-xl p-6 border border-blue-900/30 mb-4">
        <button
          onClick={sync}
          disabled={syncing}
          className={`w-full py-3 rounded-xl font-bold text-white transition-colors ${syncing ? "bg-gray-700 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-500"}`}
        >
          {syncing ? "Syncing..." : "Sync All Fetched Games → Library"}
        </button>
        <p className="text-blue-300/40 text-xs text-center mt-2">Deduplicates by title. Safe to run multiple times.</p>
      </div>

      {log.length > 0 && (
        <div className="bg-[#0b1120] rounded-xl p-4 border border-blue-900/30 font-mono text-xs text-blue-200/80 space-y-1 max-h-64 overflow-auto">
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
}
