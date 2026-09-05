"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { categories, type Software, clearSoftwareStorage, getStorageInfo, updateSoftwareStatus, getSoftwareList, saveSoftwareList } from "@/lib/data";

export default function AdminSoftware() {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [sortBy, setSortBy] = useState("title");
  const [viewMode, setViewMode] = useState<"table" | "grid">("grid");
  const [softwareList, setSoftwareList] = useState<Software[]>([]);

  useEffect(() => {
    getSoftwareList().then((list) => {
      setSoftwareList(list.map((sw) => ({
        ...sw,
        description: typeof sw.description === "string" ? sw.description.replace(/\[object Object\],?/g, "").trim() : "",
        features: Array.isArray(sw.features) ? sw.features.filter((f: any) => typeof f === "string" && !f.includes("[object Object]")) : [],
        downloadLinks: Array.isArray(sw.downloadLinks) ? sw.downloadLinks.map((l: any) => ({
          ...l,
          name: typeof l.name === "string" ? l.name.replace(/\[object Object\],?/g, "").trim() : l.name || "Download",
          url: typeof l.url === "string" ? l.url : "",
        })) : [],
      })));
    });
  }, []);
  const [checking, setChecking] = useState(false);
  const [checkProgress, setCheckProgress] = useState(0);
  const [checkTotal, setCheckTotal] = useState(0);
  const [showMissingLinks, setShowMissingLinks] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "published" | "archived">("all");

  const persistSoftware = (list: Software[]) => {
    setSoftwareList(list);
    // Save to IndexedDB/localStorage asynchronously; UI updates immediately
    import("@/lib/data").then(({ saveSoftwareList }) => saveSoftwareList(list));
    window.dispatchEvent(new Event("software-data-changed"));
  };

  const cleanObjectObject = async () => {
    const clean = (val: any): string => {
      if (typeof val === "string") return val.replace(/\[object Object\],?/g, "").trim();
      return "";
    };
    const updated = softwareList.map((sw) => ({
      ...sw,
      title: clean(sw.title) || sw.title,
      description: clean(sw.description),
      version: clean(sw.version),
      size: clean(sw.size),
      password: clean(sw.password),
      systemRequirements: clean(sw.systemRequirements),
      features: (sw.features || []).filter((f) => typeof f === "string" && !f.includes("[object Object]")),
      downloadLinks: (sw.downloadLinks || []).map((l) => ({
        ...l,
        name: clean(l.name) || l.name,
        url: l.url && typeof l.url === "string" ? l.url : "",
      })),
    }));
    await persistSoftware(updated);
    alert(`Cleaned [object Object] from ${updated.length} entries.`);
  };

  const PAGE_SIZE = 12;

  const checkAllLinks = async () => {
    const allUrls: { swIndex: number; linkIndex: number; url: string }[] = [];
    softwareList.forEach((sw, swIndex) => {
      sw.downloadLinks.forEach((link, linkIndex) => {
        if (link.url && !link.url.startsWith("magnet:")) {
          allUrls.push({ swIndex, linkIndex, url: link.url });
        }
      });
    });
    if (allUrls.length === 0) return;
    setChecking(true);
    setCheckProgress(0);
    setCheckTotal(allUrls.length);

    const BATCH_SIZE = 10;
    const updated = JSON.parse(JSON.stringify(softwareList)) as Software[];
    for (let i = 0; i < allUrls.length; i += BATCH_SIZE) {
      const batch = allUrls.slice(i, i + BATCH_SIZE);
      try {
        const res = await fetch("/api/check-links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls: batch.map((b) => b.url) }),
        });
        if (res.ok) {
          const data = await res.json();
          data.results.forEach((result: { url: string; status: string }) => {
            const match = batch.find((b) => b.url === result.url);
            if (match && updated[match.swIndex]?.downloadLinks[match.linkIndex]) {
              updated[match.swIndex].downloadLinks[match.linkIndex].status = result.status as "alive" | "dead" | "unknown";
              updated[match.swIndex].downloadLinks[match.linkIndex].lastChecked = new Date().toISOString();
            }
          });
        }
      } catch {}
      setCheckProgress(Math.min(i + BATCH_SIZE, allUrls.length));
      setSoftwareList(JSON.parse(JSON.stringify(updated)));
    }
    await persistSoftware(updated);
    setChecking(false);
  };

  const getLinkHealth = (sw: Software) => {
    const links = sw.downloadLinks.filter((l) => l.url);
    if (links.length === 0) return null;
    const alive = links.filter((l) => l.status === "alive").length;
    const dead = links.filter((l) => l.status === "dead").length;
    return { total: links.length, alive, dead };
  };

  const missingLinks = softwareList.filter((sw) => {
    const usable = (sw.downloadLinks || []).filter((l) => l.url && l.url.trim());
    return usable.length === 0;
  });

  const filtered = softwareList
    .filter((sw) => {
      const matchesSearch = sw.title.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = filterCategory === "all" || sw.category === filterCategory;
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "pending"
            ? sw.status === "pending"
            : statusFilter === "published"
              ? !sw.status || sw.status === "published"
              : sw.status === "archived";
      return matchesSearch && matchesCategory && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "downloads") return b.downloads - a.downloads;
      if (sortBy === "rating") return b.rating - a.rating;
      if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return 0;
    });

  const duplicateTitles = new Set<string>();
  const titleCount: Record<string, number> = {};
  softwareList.forEach((sw) => {
    const key = sw.title.toLowerCase().trim();
    titleCount[key] = (titleCount[key] || 0) + 1;
  });
  softwareList.forEach((sw) => {
    if (titleCount[sw.title.toLowerCase().trim()] > 1) duplicateTitles.add(sw.id);
  });

  // Status counts for the tab bar
  const statusCounts = {
    all: softwareList.length,
    pending: softwareList.filter((s) => s.status === "pending").length,
    published: softwareList.filter((s) => !s.status || s.status === "published").length,
    archived: softwareList.filter((s) => s.status === "archived").length,
  };

  const [showSimilar, setShowSimilar] = useState(false);
  const normalizeSimilar = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\b(free download|download|repack|fitgirl|dodi|elamigos|steamrip|pc game|latest|version|build|v\d+[\.\d]*|update|dlc|full game|preinstalled|directly download)\b/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
  const similarGroups = (() => {
    const m = new Map<string, Software[]>();
    for (const sw of softwareList) {
      const k = normalizeSimilar(sw.title);
      if (!k) continue;
      const arr = m.get(k) || [];
      arr.push(sw);
      m.set(k, arr);
    }
    return Array.from(m.entries()).filter(([, arr]) => arr.length > 1).map(([k, arr]) => ({ key: k, items: arr }));
  })();

  const mergeGroup = async (group: Software[]) => {
    if (group.length < 2) return;
    if (!confirm(`Merge ${group.length} similar entries "${group[0].title}"? Keeps healthiest as base.`)) return;
    const byHealth = [...group].sort((a,b) => {
      const ha = getLinkHealth(a); const hb = getLinkHealth(b);
      return (hb?.alive||0) - (ha?.alive||0) || b.downloadLinks.length - a.downloadLinks.length;
    });
    const base = byHealth[0];
    const others = byHealth.slice(1);
    const urlSet = new Set(base.downloadLinks.map(l=>l.url));
    const mergedLinks = [...base.downloadLinks];
    for (const other of others) {
      for (const l of other.downloadLinks) if (l.url && !urlSet.has(l.url)) { urlSet.add(l.url); mergedLinks.push(l); }
    }
    const merged: Software = {
      ...base,
      description: [base.description, ...others.map(s=>s.description)].filter(Boolean).sort((a,b)=>b.length-a.length)[0] || base.description,
      screenshots: Array.from(new Set([base.poster, ...base.screenshots, ...others.flatMap(s=>s.screenshots)].filter(Boolean))).slice(0,8),
      features: Array.from(new Set([...base.features, ...others.flatMap(s=>s.features)])).slice(0,12),
      downloadLinks: mergedLinks.slice(0,20),
    };
    const keepId = base.id;
    const otherIds = new Set(others.map(s=>s.id));
    const final = softwareList.filter(sw => !otherIds.has(sw.id)).map(sw=> sw.id===keepId ? merged : sw);
    await persistSoftware(final);
  };

  const deleteUnhealthyInGroup = async (group: Software[]) => {
    const unhealthy = group.filter(sw => {
      const h = getLinkHealth(sw);
      return !h || h.alive===0;
    });
    if (unhealthy.length===0) { alert("No unhealthy entries in this group."); return; }
    if (!confirm(`Delete ${unhealthy.length} unhealthy entr${unhealthy.length===1?"y":"ies"} from similar group "${group[0].title}"?`)) return;
    const ids = new Set(unhealthy.map(s=>s.id));
    await persistSoftware(softwareList.filter(sw=> !ids.has(sw.id)));
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginated.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(paginated.map((sw) => sw.id)));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Delete ${selectedIds.size} selected software entr${selectedIds.size === 1 ? "y" : "ies"}? This cannot be undone.`)) {
      const updated = softwareList.filter((sw) => !selectedIds.has(sw.id));
      await persistSoftware(updated);
      setSelectedIds(new Set());
      setCurrentPage(1);
    }
  };

  const handleBulkPublish = async () => {
    const ids = Array.from(selectedIds);
    const pendingIds = ids.filter((id) => softwareList.find((s) => s.id === id)?.status === "pending");
    if (pendingIds.length === 0) { alert("No pending selected to publish."); return; }
    await updateSoftwareStatus(pendingIds, "published");
    const updated = await getSoftwareList();
    setSoftwareList(updated);
    setSelectedIds(new Set());
    window.dispatchEvent(new Event("software-data-changed"));
  };

  const handlePublishAllPending = async () => {
    const pendingIds = softwareList.filter((s) => s.status === "pending").map((s) => s.id);
    if (pendingIds.length === 0) { alert("No pending games."); return; }
    if (!confirm(`Publish ${pendingIds.length} pending games to client?`)) return;
    await updateSoftwareStatus(pendingIds, "published");
    const updated = await getSoftwareList();
    setSoftwareList(updated);
    window.dispatchEvent(new Event("software-data-changed"));
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this software?")) {
      await persistSoftware(softwareList.filter((sw) => sw.id !== id));
    }
  };

  const removeRepacksEntries = async () => {
    const targets = softwareList.filter((sw) =>
      (sw.downloadLinks || []).some((l) => l.url && l.url.includes("repacks-games.com"))
    );
    if (targets.length === 0) {
      alert("No entries with repacks-games.com links found.");
      return;
    }
    if (confirm(`Remove ${targets.length} entr${targets.length === 1 ? "y" : "ies"} from repacks-games.com?`)) {
      await persistSoftware(softwareList.filter((sw) => !targets.includes(sw)));
      setSelectedIds(new Set());
    }
  };

  const removeNoLinksEntries = async () => {
    const noLinks = softwareList.filter((sw) =>
      !sw.downloadLinks || sw.downloadLinks.length === 0 ||
      sw.downloadLinks.every((l) => !l.url || l.url.trim() === "")
    );
    if (noLinks.length === 0) {
      alert("All entries have download links.");
      return;
    }
    if (confirm(`Remove ${noLinks.length} entries with no download links? This cannot be undone.`)) {
      const idsToRemove = new Set(noLinks.map((sw) => sw.id));
      await persistSoftware(softwareList.filter((sw) => !idsToRemove.has(sw.id)));
      setSelectedIds(new Set());
    }
  };

  const getCategoryBadge = (category: string) => {
    const cat = categories.find((c) => c.id === category);
    return cat?.name || category;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Software</h1>
          <p className="text-blue-300/60 text-sm mt-1">{softwareList.length} total entries</p>
        </div>
        <div className="flex gap-1.5 items-center flex-wrap">
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={handleBulkPublish}
                title={`Publish ${selectedIds.size} selected to client`}
                className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                <span className="text-xs font-bold">Publish ({selectedIds.size})</span>
              </button>
              <button
                onClick={handleBulkDelete}
                title={`Delete ${selectedIds.size} selected`}
                className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                <span className="text-xs font-bold">Delete ({selectedIds.size})</span>
              </button>
            </>
          )}
          <button
            onClick={checkAllLinks}
            disabled={checking}
            title={checking ? "Checking..." : "Check All Links"}
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white transition-colors"
          >
            <svg className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            <span className="text-xs font-bold">{checking ? "Checking..." : "Check Links"}</span>
          </button>
          <button
            onClick={removeRepacksEntries}
            title="Remove repacks-games.com"
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            <span className="text-xs font-bold">Remove repacks</span>
          </button>
          <button
            onClick={removeNoLinksEntries}
            title={`Remove No-Link Entries (${softwareList.filter((sw) => !sw.downloadLinks || sw.downloadLinks.length === 0 || sw.downloadLinks.every((l) => !l.url || l.url.trim() === "")).length})`}
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg bg-orange-600/20 hover:bg-orange-600/40 text-orange-400 border border-orange-500/30 transition-colors relative"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
            <span className="text-xs font-bold">No-Link Cleanup</span>
          </button>
          <button
            onClick={cleanObjectObject}
            title="Clean [object Object]"
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-400 border border-yellow-500/30 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            <span className="text-xs font-bold">Clean Corrupt</span>
          </button>
          <button
            onClick={() => {
              const info = getStorageInfo();
              if (!confirm(`Storage: ${info.approxSizeKB}KB in ${info.totalKeys} keys (${info.chunkCount} chunks). Clear all softwareData keys?`)) return;
              clearSoftwareStorage();
              setSoftwareList([]);
              alert("Cleared old keys. Reloading default data.");
              location.reload();
            }}
            title="Clear old keys"
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg bg-gray-700 hover:bg-red-600 text-gray-300 hover:text-white border border-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            <span className="text-xs font-bold">Clear Storage</span>
          </button>
          <button
            onClick={async () => {
              const appCats = ["windows","mac","android","ebooks","tutorials"];
              const apps = softwareList.filter(s => appCats.includes(s.category));
              if (apps.length === 0) { alert("No applications found."); return; }
              if (!confirm(`Delete ${apps.length} application entries (windows/mac/android/ebooks/tutorials)? This will keep pc-games/movies.`)) return;
              await persistSoftware(softwareList.filter(s => !appCats.includes(s.category)));
            }}
            title="Clear all applications"
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg bg-red-800 hover:bg-red-700 text-red-200 border border-red-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
            <span className="text-xs font-bold">Clear Apps</span>
          </button>
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(softwareList, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `software-backup-${new Date().toISOString().split("T")[0]}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            title="Export"
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            <span className="text-xs font-bold">Export</span>
          </button>
          <label title="Import" className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors cursor-pointer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            <span className="text-xs font-bold">Import</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  try {
                    const imported = JSON.parse(ev.target?.result as string);
                    if (!Array.isArray(imported)) throw new Error("Invalid format");
                    localStorage.setItem("softwareData", JSON.stringify(imported));
                    setSoftwareList(imported);
                    alert(`Imported ${imported.length} entries!`);
                  } catch {
                    alert("Invalid backup file. Must be a JSON array of software entries.");
                  }
                };
                reader.readAsText(file);
                e.target.value = "";
              }}
            />
          </label>
          <Link
            href="/admin/software/edit"
            title="Add Software"
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            <span className="text-xs font-bold">Add Software</span>
          </Link>
        </div>
      </div>

      {/* Link check progress */}
      {checking && (
        <div className="mb-6 bg-[#111827] rounded-xl border border-blue-900/30 p-4">
          <div className="flex items-center justify-between text-sm text-blue-300/60 mb-2">
            <span>Checking links...</span>
            <span>{checkProgress}/{checkTotal}</span>
          </div>
          <div className="w-full bg-blue-900/30 rounded-full h-2">
            <div className="bg-yellow-500 h-2 rounded-full transition-all" style={{ width: `${checkTotal > 0 ? (checkProgress / checkTotal) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {/* Missing links section */}
      {missingLinks.length > 0 && (
        <div className="mb-6 bg-[#111827] rounded-xl border border-red-500/30 overflow-hidden">
          <button
            onClick={() => setShowMissingLinks(!showMissingLinks)}
            className="w-full flex items-center justify-between p-4 hover:bg-red-500/5 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h2 className="text-white font-semibold text-sm">Missing Download Links</h2>
                <p className="text-red-300/70 text-xs mt-0.5">
                  {missingLinks.length} {missingLinks.length === 1 ? "entry has" : "entries have"} no usable download links — visitors cannot download these.
                </p>
              </div>
            </div>
            <svg className={`w-5 h-5 text-red-300/50 transition-transform ${showMissingLinks ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showMissingLinks && (
            <div className="border-t border-red-500/20">
              {missingLinks.map((sw) => (
                <div key={sw.id} className="flex items-center gap-3 px-4 py-3 border-b border-red-500/10 last:border-b-0 hover:bg-red-500/5 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-blue-900/30 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {sw.icon || sw.poster ? (
                      <img src={sw.icon || sw.poster} alt={sw.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-blue-900/50 text-[10px]">—</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{sw.title}</p>
                    <p className="text-blue-300/40 text-xs truncate">
                      {getCategoryBadge(sw.category)} • {sw.platform} • {(sw.downloadLinks || []).length} link{(sw.downloadLinks || []).length === 1 ? "" : "s"} defined
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-red-500/20 text-red-400 border border-red-500/30">
                      No links
                    </span>
                    <Link
                      href={`/admin/software/edit?id=${sw.id}`}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    >
                      Add Links
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Similar / duplicate groups */}
      {similarGroups.length > 0 && (
        <div className="mb-6 bg-[#111827] rounded-xl border border-amber-500/30 overflow-hidden">
          <button onClick={() => setShowSimilar(!showSimilar)} className="w-full flex items-center justify-between p-4 hover:bg-amber-500/5 transition-colors text-left">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              </div>
              <div>
                <h2 className="text-white font-semibold text-sm">Similar Games Found</h2>
                <p className="text-amber-300/70 text-xs mt-0.5">{similarGroups.length} group{similarGroups.length===1?"":"s"} look similar — merge or delete unhealthy links</p>
              </div>
            </div>
            <svg className={`w-5 h-5 text-amber-300/50 transition-transform ${showSimilar ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {showSimilar && (
            <div className="border-t border-amber-500/20 divide-y divide-amber-500/10">
              {similarGroups.slice(0,20).map((g) => (
                <div key={g.key} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-white text-sm font-medium truncate">~ {g.items[0].title} <span className="text-amber-400/60 text-xs">({g.items.length})</span></p>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => mergeGroup(g.items)} className="px-3 py-1 text-xs font-bold rounded bg-amber-600 hover:bg-amber-500 text-white">Merge</button>
                      <button onClick={() => deleteUnhealthyInGroup(g.items)} className="px-3 py-1 text-xs font-bold rounded bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30">Delete unhealthy</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {g.items.map((sw) => {
                      const h = getLinkHealth(sw);
                      return (
                        <div key={sw.id} className="flex items-center gap-3 p-2 rounded-lg bg-[#0c1222] border border-blue-900/20">
                          <div className="w-10 h-10 rounded bg-blue-900/30 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {sw.icon || sw.poster ? <img src={sw.icon || sw.poster} alt={sw.title} className="w-full h-full object-cover" /> : <span className="text-[10px] text-blue-900/50">—</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-xs truncate">{sw.title}</p>
                            <p className="text-blue-300/50 text-[11px]">{h ? `${h.alive}/${h.total} alive${h.dead?` • ${h.dead} dead`:""}` : "No links"} • {sw.category}</p>
                          </div>
                          <Link href={`/admin/software/edit?id=${sw.id}`} className="text-blue-400 hover:text-white text-xs px-2 py-1">Edit</Link>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {similarGroups.length > 20 && <p className="text-center text-amber-300/50 text-xs py-3">Showing 20 of {similarGroups.length} groups</p>}
            </div>
          )}
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex gap-2 mb-4">
        {([
          { key: "all" as const, label: "All", count: statusCounts.all, color: "text-white" },
          { key: "pending" as const, label: "Pending", count: statusCounts.pending, color: "text-amber-400" },
          { key: "published" as const, label: "Published", count: statusCounts.published, color: "text-green-400" },
          { key: "archived" as const, label: "Archived", count: statusCounts.archived, color: "text-gray-400" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setStatusFilter(tab.key); setCurrentPage(1); setSelectedIds(new Set()); }}
            className={`px-4 py-2 rounded-lg font-bold uppercase tracking-wider text-sm transition-all ${
              statusFilter === tab.key
                ? tab.key === "pending"
                  ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20"
                  : tab.key === "published"
                    ? "bg-green-600 text-white shadow-lg shadow-green-600/20"
                    : tab.key === "archived"
                      ? "bg-gray-600 text-white shadow-lg shadow-gray-600/20"
                      : "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : "bg-[#111827] text-blue-300/60 hover:text-white border border-blue-900/30"
            }`}
          >
            {tab.label} ({tab.count.toLocaleString()})
          </button>
        ))}
        {statusFilter === "pending" && selectedIds.size > 0 && (
          <>
            <button
              onClick={async () => {
                const ids = Array.from(selectedIds);
                await updateSoftwareStatus(ids, "published");
                // Refresh local state
                setSoftwareList((prev) =>
                  prev.map((sw) =>
                    selectedIds.has(sw.id)
                      ? { ...sw, status: "published" as const, updatedAt: new Date().toISOString() }
                      : sw
                  )
                );
                setSelectedIds(new Set());
                window.dispatchEvent(new Event("software-data-changed"));
              }}
              className="ml-auto px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold uppercase tracking-wider text-sm transition-colors"
            >
              Publish Selected ({selectedIds.size})
            </button>
            <button
              onClick={async () => {
                if (!confirm(`Archive ${selectedIds.size} selected items? They will be hidden from the public site.`)) return;
                const ids = Array.from(selectedIds);
                await updateSoftwareStatus(ids, "archived");
                setSoftwareList((prev) =>
                  prev.map((sw) =>
                    selectedIds.has(sw.id)
                      ? { ...sw, status: "archived" as const, updatedAt: new Date().toISOString() }
                      : sw
                  )
                );
                setSelectedIds(new Set());
                window.dispatchEvent(new Event("software-data-changed"));
              }}
              className="px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 font-bold uppercase tracking-wider text-sm transition-colors"
            >
              Archive Selected
            </button>
          </>
        )}
        {statusFilter === "pending" && statusCounts.pending > 0 && selectedIds.size === 0 && (
          <button
            onClick={handlePublishAllPending}
            className="ml-auto px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider text-sm transition-colors"
          >
            Publish All Pending ({statusCounts.pending.toLocaleString()})
          </button>
        )}
        {statusFilter === "archived" && selectedIds.size > 0 && (
          <button
            onClick={async () => {
              const ids = Array.from(selectedIds);
              await updateSoftwareStatus(ids, "published");
              setSoftwareList((prev) =>
                prev.map((sw) =>
                  selectedIds.has(sw.id)
                    ? { ...sw, status: "published" as const, updatedAt: new Date().toISOString() }
                    : sw
                )
              );
              setSelectedIds(new Set());
              window.dispatchEvent(new Event("software-data-changed"));
            }}
            className="ml-auto px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold uppercase tracking-wider text-sm transition-colors"
          >
            Restore Selected ({selectedIds.size})
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-[#111827] rounded-xl border border-blue-900/30 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search software..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full bg-[#0c1222] text-white text-sm rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-blue-300/40 border border-blue-900/30"
            />
            <svg className="absolute left-3 top-3 w-4 h-4 text-blue-300/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <select
            value={filterCategory}
            onChange={(e) => { setFilterCategory(e.target.value); setCurrentPage(1); }}
            className="bg-[#0c1222] text-white text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
            className="bg-[#0c1222] text-white text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30"
          >
            <option value="title">Sort by Title</option>
            <option value="downloads">Sort by Downloads</option>
            <option value="rating">Sort by Rating</option>
            <option value="newest">Sort by Newest</option>
          </select>

          {/* View toggle */}
          <div className="flex bg-[#0c1222] rounded-lg border border-blue-900/30 overflow-hidden">
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-2 text-sm ${viewMode === "table" ? "bg-blue-600 text-white" : "text-blue-300/60 hover:text-white"}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`px-3 py-2 text-sm ${viewMode === "grid" ? "bg-blue-600 text-white" : "text-blue-300/60 hover:text-white"}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Table View */}
      {viewMode === "table" && (
        <div className="bg-[#111827] rounded-xl border border-blue-900/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-blue-300/60 text-xs bg-blue-900/20">
                  <th className="p-4 pl-6">
                    <input
                      type="checkbox"
                      checked={paginated.length > 0 && selectedIds.size === paginated.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 accent-blue-600 cursor-pointer"
                    />
                  </th>
                  <th className="p-4">Software</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Platform</th>
                  <th className="p-4">Size</th>
                  <th className="p-4">Downloads</th>
                  <th className="p-4">Rating</th>
                  <th className="p-4 text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((sw) => (
                  <tr key={sw.id} className={`border-t border-blue-900/30 hover:bg-blue-900/20 transition-colors ${selectedIds.has(sw.id) ? "bg-blue-900/30" : ""}`}>
                    <td className="p-4 pl-6">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(sw.id)}
                        onChange={() => toggleSelect(sw.id)}
                        className="w-4 h-4 accent-blue-600 cursor-pointer"
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-blue-900/30 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {sw.icon || sw.poster ? (
                            <img src={sw.icon || sw.poster} alt={sw.title} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-blue-900/50 text-xs">—</span>
                          )}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium flex items-center gap-2">
                            {sw.title}
                            {sw.status === "pending" && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                Pending
                              </span>
                            )}
                            {sw.status === "archived" && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-gray-500/20 text-gray-400 border border-gray-500/30">
                                Archived
                              </span>
                            )}
                            {duplicateTitles.has(sw.id) && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-amber-500/20 text-amber-400 border border-amber-500/30" title="Another entry uses the same title">
                                Duplicate
                              </span>
                            )}
                          </p>
                          <p className="text-blue-300/40 text-xs">v{sw.version} • {sw.createdAt}</p>
                          {(() => {
                            const health = getLinkHealth(sw);
                            if (!health) return (
                              <p className="text-xs mt-0.5 font-medium text-red-400 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> No download links
                              </p>
                            );
                            const color = health.dead > 0 ? "text-red-400" : health.alive === health.total ? "text-green-400" : "text-yellow-400";
                            return (
                              <p className={`text-xs mt-0.5 font-medium ${color}`}>
                                {health.alive} alive / {health.dead} dead / {health.total - health.alive - health.dead} untested
                              </p>
                            );
                          })()}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 text-xs rounded-full capitalize font-medium ${
                        sw.status === "pending" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                        sw.status === "archived" ? "bg-gray-500/20 text-gray-400 border border-gray-500/30" :
                        "bg-green-500/20 text-green-400 border border-green-500/30"
                      }`}>
                        {sw.status || "published"}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 bg-blue-900/30 text-blue-300 text-xs rounded-full capitalize">
                        {getCategoryBadge(sw.category)}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 text-xs rounded-full capitalize ${
                        sw.platform === "windows" ? "bg-blue-600/20 text-blue-400" :
                        sw.platform === "mac" ? "bg-purple-600/20 text-purple-400" :
                        sw.platform === "android" ? "bg-green-600/20 text-green-400" :
                        "bg-yellow-600/20 text-yellow-400"
                      }`}>
                        {sw.platform}
                      </span>
                    </td>
                    <td className="p-4 text-blue-300/60 text-sm">{sw.size}</td>
                    <td className="p-4 text-white text-sm font-medium">{sw.downloads.toLocaleString()}</td>
                    <td className="p-4"><span className="text-amber-300 text-sm">Rating {sw.rating}</span></td>
                    <td className="p-4 pr-6">
                      <div className="flex items-center justify-end gap-3">
                        {sw.status === "pending" && (
                          <>
                            <button
                              onClick={async () => {
                                await updateSoftwareStatus([sw.id], "published");
                                setSoftwareList((prev) =>
                                  prev.map((s) => s.id === sw.id ? { ...s, status: "published" as const, updatedAt: new Date().toISOString() } : s)
                                );
                                window.dispatchEvent(new Event("software-data-changed"));
                              }}
                              className="text-green-400 hover:text-green-300 transition-colors" title="Publish"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            </button>
                            <button
                              onClick={async () => {
                                await updateSoftwareStatus([sw.id], "archived");
                                setSoftwareList((prev) =>
                                  prev.map((s) => s.id === sw.id ? { ...s, status: "archived" as const, updatedAt: new Date().toISOString() } : s)
                                );
                                window.dispatchEvent(new Event("software-data-changed"));
                              }}
                              className="text-red-400 hover:text-red-300 transition-colors" title="Archive"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </>
                        )}
                        {sw.status === "archived" && (
                          <button
                            onClick={async () => {
                              await updateSoftwareStatus([sw.id], "published");
                              setSoftwareList((prev) =>
                                prev.map((s) => s.id === sw.id ? { ...s, status: "published" as const, updatedAt: new Date().toISOString() } : s)
                              );
                              window.dispatchEvent(new Event("software-data-changed"));
                            }}
                            className="text-green-400 hover:text-green-300 transition-colors" title="Restore to Published"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                          </button>
                        )}
                        <Link href={`/software/${sw.id}`} target="_blank" className="text-blue-300/60 hover:text-white transition-colors" title="View">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        </Link>
                        <Link href={`/admin/software/edit?id=${sw.id}`} className="text-blue-400 hover:text-blue-300 transition-colors" title="Edit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </Link>
                        <button onClick={() => handleDelete(sw.id)} className="text-red-400 hover:text-red-300 transition-colors" title="Delete">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
          {paginated.map((sw) => (
            <Link
              key={sw.id}
              href={`/admin/software/edit?id=${sw.id}`}
              className={`bg-[#111827] rounded-xl border border-blue-900/30 overflow-hidden group cursor-pointer hover:border-blue-500/50 transition-all ${selectedIds.has(sw.id) ? "ring-2 ring-blue-500" : ""}`}
            >
              <div className="relative h-24 bg-[#0c1222] overflow-hidden">
                {sw.icon ? (
                  <img src={sw.icon} alt={sw.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                ) : sw.poster ? (
                  <img src={sw.poster} alt={sw.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#0c1222] text-blue-900/40 text-xs font-bold uppercase tracking-wider">No Image</div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c1222]/90 to-transparent" />
                <div className="absolute top-1.5 right-1.5">
                  <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded uppercase ${
                    sw.platform === "windows" ? "bg-blue-600 text-white" :
                    sw.platform === "mac" ? "bg-purple-600 text-white" :
                    sw.platform === "android" ? "bg-green-600 text-white" :
                    "bg-yellow-600 text-white"
                  }`}>
                    {sw.platform}
                  </span>
                </div>
                <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(sw.id)}
                    onChange={(e) => { e.preventDefault(); e.stopPropagation(); toggleSelect(sw.id); }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                    title="Select for bulk action"
                  />
                  {sw.status === "pending" && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-amber-500 text-black">Pending</span>
                  )}
                  {sw.status === "archived" && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-gray-500 text-white">Archived</span>
                  )}
                  <span className="text-amber-300 text-[10px] font-bold bg-black/60 px-1.5 py-0.5 rounded">Rating {sw.rating}</span>
                  {duplicateTitles.has(sw.id) && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-amber-500/20 text-amber-400 border border-amber-500/30" title="Another entry uses the same title">Duplicate</span>
                  )}
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <p className="text-white font-bold text-xs line-clamp-1 uppercase">{sw.title}</p>
                  <p className="text-blue-300/60 text-[10px]">{getCategoryBadge(sw.category)}</p>
                </div>
              </div>
              <div className="p-2">
                <div className="flex items-center justify-between text-[10px] text-blue-300/40 mb-1.5">
                  <span>{sw.size}</span>
                  <span>{sw.downloads.toLocaleString()} dl</span>
                </div>
                {(() => {
                  const health = getLinkHealth(sw);
                  if (!health) return (
                    <div className="flex items-center gap-1.5 text-[10px] mb-2 text-red-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      No links
                    </div>
                  );
                  const dotClass = health.dead > 0 ? "bg-red-500" : health.alive === health.total ? "bg-green-500" : "bg-yellow-500";
                  const textClass = health.dead > 0 ? "text-red-400" : health.alive === health.total ? "text-green-400" : "text-yellow-400";
                  return (
                    <div className={`flex items-center gap-1.5 text-[10px] mb-2 ${textClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                      {health.alive}/{health.total} ok{health.dead > 0 ? ` · ${health.dead} dead` : ""}
                    </div>
                  );
                })()}
                <div className="flex items-center gap-1.5">
                  {sw.status === "pending" && (
                    <>
                      <button
                        onClick={async (e) => {
                          e.preventDefault(); e.stopPropagation();
                          await updateSoftwareStatus([sw.id], "published");
                          setSoftwareList((prev) => prev.map((s) => s.id === sw.id ? { ...s, status: "published" as const } : s));
                          window.dispatchEvent(new Event("software-data-changed"));
                        }}
                        className="bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors"
                        title="Publish"
                      >
                        ✓
                      </button>
                      <button
                        onClick={async (e) => {
                          e.preventDefault(); e.stopPropagation();
                          await updateSoftwareStatus([sw.id], "archived");
                          setSoftwareList((prev) => prev.map((s) => s.id === sw.id ? { ...s, status: "archived" as const } : s));
                          window.dispatchEvent(new Event("software-data-changed"));
                        }}
                        className="bg-red-600/20 hover:bg-red-600/40 text-red-400 px-2 py-1 rounded-lg text-[10px] transition-colors"
                        title="Archive"
                      >
                        ✕
                      </button>
                    </>
                  )}
                  {sw.status === "archived" && (
                    <button
                      onClick={async (e) => {
                        e.preventDefault(); e.stopPropagation();
                        await updateSoftwareStatus([sw.id], "published");
                        setSoftwareList((prev) => prev.map((s) => s.id === sw.id ? { ...s, status: "published" as const } : s));
                        window.dispatchEvent(new Event("software-data-changed"));
                      }}
                      className="bg-green-600/20 hover:bg-green-600/40 text-green-400 px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors"
                      title="Restore"
                    >
                      ↺
                    </button>
                  )}
                  <span className="flex-1 text-center bg-blue-600/20 text-blue-400 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    Edit
                  </span>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(sw.id); }}
                    className="bg-red-600/20 hover:bg-red-600/40 text-red-400 px-2 py-1 rounded-lg text-[10px] transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="bg-[#111827] rounded-xl border border-blue-900/30 p-12 text-center">
          <p className="text-blue-300/40">No software found matching your criteria.</p>
        </div>
      )}

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between gap-3 flex-wrap text-sm text-blue-300/40">
        <p>Showing {paginated.length} of {filtered.length} entries (page {safePage} of {totalPages})</p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
              disabled={safePage <= 1}
              className="px-3 py-1.5 rounded-lg bg-[#0c1222] border border-blue-900/30 text-blue-300/70 hover:text-white hover:border-blue-500/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Prev
            </button>
            {(() => {
              const pages: (number | "...")[] = [];
              const maxVisible = 5;
              if (totalPages <= maxVisible) {
                for (let p = 1; p <= totalPages; p++) pages.push(p);
              } else {
                const start = Math.max(2, safePage - 1);
                const end = Math.min(totalPages - 1, safePage + 1);
                pages.push(1);
                if (start > 2) pages.push("...");
                for (let p = start; p <= end; p++) pages.push(p);
                if (end < totalPages - 1) pages.push("...");
                pages.push(totalPages);
              }
              return pages.map((p, idx) =>
                p === "..." ? (
                  <span key={`e${idx}`} className="px-1 text-blue-300/40">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                      p === safePage
                        ? "bg-blue-600 text-white"
                        : "bg-[#0c1222] border border-blue-900/30 text-blue-300/70 hover:text-white hover:border-blue-500/50"
                    }`}
                  >
                    {p}
                  </button>
                )
              );
            })()}
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
              disabled={safePage >= totalPages}
              className="px-3 py-1.5 rounded-lg bg-[#0c1222] border border-blue-900/30 text-blue-300/70 hover:text-white hover:border-blue-500/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
