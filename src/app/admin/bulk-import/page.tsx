"use client";

import { useEffect, useMemo, useState } from "react";
import { getSoftwareList, saveSoftwareList, type Software } from "@/lib/data";
import { useToast } from "@/components/admin/Toast";

interface IndexItem { title: string; category: string; genre: string; size: string; poster: string; hasLinks: boolean; }

const SOURCES = [
  { key: "fitgirl" as const, label: "FitGirl", url: "/data/fitgirl-index.json", fullUrl: "/data/fitgirl-games.json" },
  { key: "xzy" as const, label: "XZY", url: "/data/xzy-index.json", fullUrl: null },
  { key: "elamigos" as const, label: "ElAmigos", url: "/data/elamigos-index.json", fullUrl: "/data/elamigos-games.json" },
];

function slugify(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80); }
function clean(s: any) { return typeof s === "string" ? s.replace(/\[object Object\],?/g, "").trim() : ""; }

function toSoftware(item: any, source: string): Software {
  const cat = item.category === "movies" ? "movies" : item.category === "software" || item.category === "windows" ? "windows" : "pc-games";
  let links: Software["downloadLinks"] = [];
  if (Array.isArray(item.downloads)) {
    links = item.downloads.slice(0, 20).map((l: any) => ({ name: clean(l.name || l.hoster) || "Download", url: l.url, type: (l.type === "torrent" ? "torrent" : "direct") as any, hoster: l.hoster, part: l.part, partTotal: l.partTotal }));
  } else if (Array.isArray(item.downloadLinks)) links = item.downloadLinks.slice(0, 20);
  return {
    id: `bulk-${source}-${slugify(item.title || "unknown")}`,
    title: clean(item.title) || "Unknown",
    description: clean(item.description || item.originalDescription || ""),
    category: cat,
    subcategory: clean(item.subcategory) || "",
    platform: "windows" as Software["platform"],
    version: clean(item.version),
    size: clean(item.size || item.repackSize),
    downloads: 0,
    rating: 4,
    icon: clean(item.banner || item.poster || item.icon),
    poster: clean(item.banner || item.poster || item.icon),
    screenshots: Array.isArray(item.screenshots) ? item.screenshots.slice(0, 5) : [],
    downloadLinks: links.length ? links : [{ name: "Download", url: "", type: "direct" as const }],
    downloadsByHoster: (item as any).downloadsByHoster,
    password: clean(item.password),
    systemRequirements: clean(item.systemRequirements) || "Windows 10/11 64-bit, 4 GB RAM, 500 MB disk",
    features: Array.isArray(item.features) ? item.features.filter((f: any) => typeof f === "string").slice(0, 8) : [],
    videoUrl: clean(item.videoUrl),
    createdAt: new Date().toISOString().split("T")[0],
    updatedAt: new Date().toISOString().split("T")[0],
  };
}

export default function BulkImportPage() {
  const { toast } = useToast();
  const [indexes, setIndexes] = useState<Record<string, IndexItem[]>>({ fitgirl: [], xzy: [], elamigos: [] });
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<"fitgirl" | "xzy" | "elamigos" | "upload">("fitgirl");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [publishDirect, setPublishDirect] = useState(true);
  const [libraryCount, setLibraryCount] = useState(0);
  const [uploadedItems, setUploadedItems] = useState<any[]>([]);

  useEffect(() => {
    Promise.all(SOURCES.map((s) => fetch(s.url).then((r) => r.json()).catch(() => []))).then(([fg, xz, el]) => {
      setIndexes({ fitgirl: fg, xzy: xz, elamigos: el });
      setLoading(false);
    });
    getSoftwareList().then((l) => setLibraryCount(l.length));
  }, []);

  const currentList: any[] = active === "upload" ? uploadedItems : indexes[active] || [];
  const filtered = useMemo(() => {
    if (!search) return currentList;
    const q = search.toLowerCase();
    return currentList.filter((i: any) => i.title?.toLowerCase().includes(q));
  }, [currentList, search]);

  const selectAll = () => setSelected(new Set(filtered.map((_: any, i: number) => i)));
  const clearSel = () => setSelected(new Set());

  async function doBulkImport() {
    const count = active === "upload" ? uploadedItems.length : selected.size;
    if (count === 0) { toast("Select items or upload a file first.", "error"); return; }
    setImporting(true);
    setProgress("Loading library...");
    try {
      const existing = await getSoftwareList();
      const existingTitles = new Set(existing.map((s) => s.title.toLowerCase().trim()));
      let toAdd: Software[] = [];
      let skipped = 0;

      if (active === "upload") {
        for (const raw of uploadedItems) {
          const sw = toSoftware(raw, "upload");
          const hasLinks = sw.downloadLinks.some((l) => l.url && l.url.startsWith("http"));
          if (!hasLinks) { skipped++; continue; }
          if (existingTitles.has(sw.title.toLowerCase())) { skipped++; continue; }
          if (!publishDirect) (sw as any).status = "pending";
          toAdd.push(sw);
          existingTitles.add(sw.title.toLowerCase());
        }
      } else {
        const src = SOURCES.find((s) => s.key === active)!;
        const idxs = Array.from(selected);
        setProgress(`Fetching ${idxs.length} full records...`);
        let fullMap = new Map<string, any>();
        if (active === "xzy") {
          const chunks = new Set(idxs.map((i) => Math.floor(i / 500)));
          for (const c of chunks) {
            try { const chunk = await fetch(`/data/xzy-chunks/${c}.json`).then((r) => r.json()); for (const it of chunk) fullMap.set(it.title, it); } catch {}
          }
        } else if (src.fullUrl) {
          try { const data = await fetch(src.fullUrl).then((r) => r.json()); for (const it of data) fullMap.set(it.title, it); } catch {}
        }
        for (const idx of idxs) {
          const item = filtered[idx];
          if (!item) continue;
          const raw = fullMap.get(item.title) || item;
          const sw = toSoftware(raw, active);
          const hasLinks = sw.downloadLinks.some((l) => l.url && l.url.startsWith("http"));
          if (!hasLinks) { skipped++; continue; }
          if (existingTitles.has(sw.title.toLowerCase())) { skipped++; continue; }
          if (!publishDirect) (sw as any).status = "pending";
          toAdd.push(sw);
          existingTitles.add(sw.title.toLowerCase());
        }
      }

      if (toAdd.length === 0) { toast(`All ${skipped} selected are already in library.`, "error"); return; }
      setProgress(`Saving ${toAdd.length} items to client...`);
      const ok = await saveSoftwareList([...existing, ...toAdd]);
      if (!ok) { toast("Save failed — storage full.", "error"); return; }
      window.dispatchEvent(new Event("software-data-changed"));
      setLibraryCount(existing.length + toAdd.length);
      setSelected(new Set());
      if (active === "upload") setUploadedItems([]);
      toast(`Bulk imported ${toAdd.length} items ${publishDirect ? "to client (published)" : "as pending"}${skipped ? `, ${skipped} dupes skipped` : ""}.`, "success");
    } catch (e: any) { toast(e.message || "Bulk import failed", "error"); }
    finally { setImporting(false); setProgress(""); }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const arr = Array.isArray(data) ? data : data.items || [];
        if (!Array.isArray(arr) || arr.length === 0) throw new Error("No array found");
        setUploadedItems(arr.slice(0, 5000));
        toast(`Loaded ${arr.length} items from file.`, "success");
      } catch (err: any) { toast(err.message || "Invalid JSON", "error"); }
    };
    reader.readAsText(f);
    e.target.value = "";
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh] text-blue-400">Loading indexes...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-wider">Bulk Import to Client</h1>
          <p className="text-blue-400/60 text-sm mt-1">Select hundreds at once and publish directly to the client — no pending queue unless you toggle it.</p>
        </div>
        <label className="flex items-center gap-2 bg-[#111827] border border-blue-900/30 rounded-lg px-3 py-2 cursor-pointer hover:border-blue-500/50">
          <input type="checkbox" checked={publishDirect} onChange={(e) => setPublishDirect(e.target.checked)} className="accent-emerald-500" />
          <span className="text-xs font-bold text-white">Publish directly</span>
        </label>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "In library", value: libraryCount, color: "text-white" },
          { label: "Selected", value: active === "upload" ? uploadedItems.length : selected.size, color: "text-indigo-400" },
          { label: "Available", value: active === "upload" ? uploadedItems.length : filtered.length, color: "text-emerald-400" },
        ].map((s) => (
          <div key={s.label} className="bg-[#111827] border border-blue-900/30 rounded-xl p-4">
            <div className={`text-2xl font-black ${s.color}`}>{s.value.toLocaleString()}</div>
            <div className="text-blue-400/50 text-xs uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {SOURCES.map((s) => (
          <button key={s.key} onClick={() => { setActive(s.key); setSelected(new Set()); setSearch(""); }} className={`px-4 py-2 rounded-lg text-sm font-bold uppercase ${active === s.key ? "bg-indigo-600 text-white" : "bg-[#111827] border border-blue-900/30 text-blue-300/60"}`}>
            {s.label} ({(indexes[s.key] || []).length.toLocaleString()})
          </button>
        ))}
        <button onClick={() => setActive("upload")} className={`px-4 py-2 rounded-lg text-sm font-bold uppercase ${active === "upload" ? "bg-violet-600 text-white" : "bg-[#111827] border border-blue-900/30 text-blue-300/60"}`}>Upload JSON</button>
      </div>

      {active === "upload" ? (
        <div className="bg-[#111827] border border-blue-900/30 rounded-xl p-6">
          <label className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-blue-900/30 rounded-xl p-8 cursor-pointer hover:border-violet-500/50 bg-[#0c1222]">
            <span className="text-violet-400 font-bold text-sm">Drop JSON file or click to select</span>
            <span className="text-blue-300/40 text-xs">Array of {"{ title, description, downloadLinks }"} — up to 5k</span>
            <input type="file" accept=".json" className="hidden" onChange={handleFile} />
          </label>
          {uploadedItems.length > 0 && <p className="text-emerald-400 text-xs mt-3">{uploadedItems.length} items ready — will import as {publishDirect ? "published" : "pending"}.</p>}
        </div>
      ) : (
        <>
          <div className="flex gap-3">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search titles..." className="flex-1 bg-[#111827] border border-blue-900/30 rounded-lg px-4 py-2.5 text-white placeholder-blue-400/40 text-sm" />
            <button onClick={selectAll} className="px-4 py-2 bg-[#111827] border border-blue-900/30 rounded-lg text-blue-300 text-sm">Select All ({filtered.length})</button>
            <button onClick={clearSel} className="px-4 py-2 bg-[#111827] border border-blue-900/30 rounded-lg text-blue-300 text-sm">Clear</button>
          </div>
          <div className="bg-[#111827] border border-blue-900/30 rounded-xl p-3 max-h-72 overflow-auto space-y-1">
            {filtered.slice(0, 200).map((it: any, i: number) => (
              <label key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer ${selected.has(i) ? "bg-indigo-600/20 border border-indigo-500/30" : "hover:bg-white/5"}`}>
                <input type="checkbox" checked={selected.has(i)} onChange={() => setSelected((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; })} className="accent-indigo-500" />
                <span className="text-white text-sm truncate flex-1">{it.title}</span>
                <span className="text-blue-400/40 text-xs">{it.size || ""}</span>
              </label>
            ))}
            {filtered.length > 200 && <p className="text-blue-300/40 text-xs text-center py-2">Showing first 200 of {filtered.length} — use Select All to include all.</p>}
            {filtered.length === 0 && <p className="text-blue-300/40 text-sm text-center py-6">No items match.</p>}
          </div>
        </>
      )}

      <button onClick={doBulkImport} disabled={importing} className={`w-full py-3 rounded-xl font-black uppercase tracking-wider text-white ${importing ? "bg-gray-700" : "bg-emerald-600 hover:bg-emerald-500"}`}>
        {importing ? (progress || "Importing...") : `Bulk Import ${active === "upload" ? uploadedItems.length : selected.size} → Client ${publishDirect ? "(Published)" : "(Pending)"}`}
      </button>
      {progress && <p className="text-blue-300/50 text-xs text-center">{progress}</p>}
    </div>
  );
}
