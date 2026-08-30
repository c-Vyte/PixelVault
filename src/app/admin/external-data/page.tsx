"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { getSoftwareList, saveSoftwareList, type Software } from "@/lib/data";
import { useToast } from "@/components/admin/Toast";

interface ExternalItem {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory: string;
  platform: string;
  version: string;
  size: string;
  downloads: number | any[];
  rating: number;
  icon: string;
  poster: string;
  banner?: string;
  screenshots: string[];
  downloadLinks: { name: string; url: string; type: string }[];
  password?: string;
  systemRequirements?: string | { minimum?: string; recommended?: string };
  features: string[];
  videoUrl?: string;
  videoThumbnail?: string;
  createdAt: string;
  _source?: string;
  _xzyType?: string;
  _genre?: string;
  date?: string;
  href?: string;
  rawTitle?: string;
  hasHypervisor?: boolean;
  updates?: string[];
  detailUrl?: string;
  img?: string;
  // FitGirl-specific fields
  genres?: string[];
  companies?: string;
  languages?: string;
  originalSize?: string;
  repackSize?: string;
  downloads_links?: { name: string; url: string; type: string; hoster?: string }[];
  backwardsCompatibility?: string;
  // Steam enrichment fields
  _steamAppId?: string;
  _steamUrl?: string;
  originalDescription?: string;
  originalDescriptionFull?: string;
  steamGenres?: string[];
  developers?: string[];
  publishers?: string[];
  releaseDate?: string;
  steamScreenshots?: string[];
  metacriticScore?: number;
  contentRating?: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function guessCategory(item: ExternalItem): string {
  if (item.category === "pc-games" || item._xzyType === "game") return "pc-games";
  if (item.category === "movies") return "movies";
  if (item.category === "windows" || item._xzyType === "software") return "windows";
  if ((item as any).genres?.length > 0) return "pc-games";
  if ((item as any).repackSize) return "pc-games";
  // FitGirl fallback: detect by downloads array structure (paste links + direct parts)
  if (Array.isArray((item as any).downloads) && (item as any).downloads.some((d: any) => d.type !== "torrent")) return "pc-games";
  return "pc-games";
}

function toSoftware(item: any, source: string): Software {
  const cat = guessCategory(item);

  // Helper to clean string values
  const cleanStr = (val: any): string => {
    if (typeof val === "string") return val.replace(/\[object Object\],?/g, "").trim();
    if (typeof val === "object" && val !== null) return "";
    return String(val || "").replace(/\[object Object\],?/g, "").trim();
  };

  // Handle FitGirl format (downloads array with type/hoster fields) - group parts as repack
  let links: Software["downloadLinks"] = [];
  if (source === "fitgirl" && Array.isArray(item.downloads)) {
    const byHost = new Map<string, any[]>();
    for (const l of item.downloads) {
      const hostKey = (cleanStr(l.hoster) || (() => { try { return new URL(l.url).hostname.replace(/^www\./, ""); } catch { return "other"; } })()).toLowerCase();
      const arr = byHost.get(hostKey) || [];
      arr.push(l);
      byHost.set(hostKey, arr);
    }
    for (const [hostKey, group] of byHost) {
      const directGroup = group.filter((g: any) => g.type !== "torrent" && typeof g.url === "string" && g.url.startsWith("http"));
      const torrentGroup = group.filter((g: any) => g.type === "torrent");
      if (directGroup.length > 1) {
        // multiple parts -> single repack entry with parts
        const first = directGroup[0];
        const hostName = cleanStr(first.hoster) || hostKey.split(".")[0];
        // Limit parts to 20 to prevent storage issues
        const limitedParts = directGroup.slice(0, 20);
        links.push({
          name: hostName ? hostName.charAt(0).toUpperCase() + hostName.slice(1) : "Repack",
          url: typeof first.url === "string" ? first.url : "",
          type: "repack" as const,
          parts: limitedParts.length,
          partLinks: limitedParts.map((g: any, idx: number) => ({ part: idx + 1, url: g.url })),
        } as any);
      } else if (directGroup.length === 1) {
        const g = directGroup[0];
        links.push({
          name: cleanStr(g.name || g.hoster) || "Download",
          url: g.url,
          type: "direct" as const,
        });
      }
      for (const g of torrentGroup) {
        links.push({
          name: cleanStr(g.name || g.hoster) || "Torrent",
          url: g.url,
          type: "torrent" as const,
        });
      }
    }
    // fallback if grouping produced nothing (e.g., paste-only links)
    if (links.length === 0) {
      links = item.downloads.map((l: any) => ({
        name: cleanStr(l.name || l.hoster) || "Download",
        url: typeof l.url === "string" ? l.url : "",
        type: (l.type === "torrent" ? "torrent" : "direct") as Software["downloadLinks"][0]["type"],
      }));
    }
    // prioritize datanodes/fuckingfast over torrent
    if (links.length > 1) {
      const hasPreferred = links.some(l => /datanodes|fuckingfast|filekeeper|fileskeep|pixeldrain|gofile|buzzheavier|bzzhr|krakenfiles|1fichier|mediafire|mega\.|multiup/i.test(l.url) && l.type !== "torrent");
      if (hasPreferred) {
        // keep torrent as fallback but sort preferred first
        const score = (u: string) => {
          if (/datanodes/i.test(u)) return 100;
          if (/fuckingfast/i.test(u)) return 95;
          if (/filekeeper/i.test(u)) return 92;
          if (/fileskeep/i.test(u)) return 90;
          if (/pixeldrain/i.test(u)) return 88;
          if (/gofile/i.test(u)) return 85;
          if (/buzzheavier|bzzhr/i.test(u)) return 80;
          if (/krakenfiles/i.test(u)) return 75;
          if (/1fichier/i.test(u)) return 70;
          if (/mediafire/i.test(u)) return 60;
          if (/mega\.(nz|co\.nz|io)/i.test(u)) return 55;
          if (/multiup/i.test(u)) return 45;
          if (/^magnet:/i.test(u) || /torrent/i.test(u)) return 0;
          return 10;
        };
        links.sort((a, b) => score(b.url || b.name) - score(a.url || a.name));
        // Limit total links per game to prevent storage issues
        if (links.length > 15) links = links.slice(0, 15);
      }
    }
  } else if (source === "elamigos" && (Array.isArray(item.downloadLinks) || Array.isArray(item.downloads_links))) {
    // ElAmigos: one link-protector URL per mirror (DDownload/RapidGator/...).
    // They are pre-captcha container pages — stored as repack entries.
    const raw: { name?: unknown; url?: unknown; type?: unknown }[] =
      Array.isArray(item.downloadLinks) ? item.downloadLinks : item.downloads_links;
    links = raw
      .filter((l): l is { name: string; url: string; type?: string } =>
        !!l && typeof l.url === "string" && l.url.startsWith("http"))
      .map((l) => ({
        name: cleanStr(l.name) || "Download",
        url: l.url,
        type: ((l.type === "torrent" || l.url.startsWith("magnet:")) ? "torrent" : "repack") as Software["downloadLinks"][0]["type"],
      }));
  } else if (Array.isArray(item.downloads)) {
    links = item.downloadLinks.map((l: any) => ({
      name: cleanStr(l.name) || "Download",
      url: typeof l.url === "string" ? l.url : "",
      type: (l.type as Software["downloadLinks"][0]["type"]) || "direct",
    }));
  } else if (Array.isArray(item.downloadLinks)) {
    // Generic fallback for any other source shipping {name,url,type} links.
    links = (item.downloadLinks as { name?: unknown; url?: unknown; type?: unknown }[])
      .filter((l): l is { name?: string; url: string; type?: string } =>
        !!l && typeof l.url === "string")
      .map((l) => ({
        name: cleanStr(l.name) || "Download",
        url: l.url,
        type: ((l.type as Software["downloadLinks"][0]["type"]) || "direct"),
      }));
  } else if (Array.isArray(item._links)) {
    links = item._links.map((url: string, idx: number) => ({
      name: cleanStr(item._names?.[idx]) || "Download",
      url: typeof url === "string" ? url : "",
      type: "direct" as const,
    }));
  }

  // Handle FitGirl genres
  const genres = Array.isArray(item.genres) ? item.genres.filter((g: any) => typeof g === "string") : [];
  const genreStr = item._genre || genres.join(", ") || "";

  // Handle enriched system requirements (object or string)
  let sysReqs = "";
  if (item.systemRequirements) {
    if (typeof item.systemRequirements === "object") {
      const parts = [];
      if (item.systemRequirements.minimum) parts.push(`Minimum:\n${cleanStr(item.systemRequirements.minimum)}`);
      if (item.systemRequirements.recommended) parts.push(`Recommended:\n${cleanStr(item.systemRequirements.recommended)}`);
      sysReqs = parts.join("\n\n");
    } else {
      sysReqs = cleanStr(item.systemRequirements);
    }
  }

  // Standard system requirement fallback for software (not games)
  if (!sysReqs && cat !== "pc-games" && cat !== "movies" && cat !== "korean") {
    const plat = (cat === "mac" ? "mac" : cat === "android" ? "android" : "windows") as string;
    if (plat === "mac") sysReqs = "macOS 10.15+ (Intel/Apple Silicon)\n4 GB RAM\n1 GB free disk space";
    else if (plat === "android") sysReqs = "Android 6.0+\n2 GB RAM\n200 MB free storage";
    else sysReqs = "Windows 10/11 64-bit\nIntel Core i3 / AMD equivalent\n4 GB RAM\n500 MB free disk space\nDirectX 11 compatible";
  }

  // Build features list from FitGirl + Steam
  const rawFeatures = Array.isArray(item.features) ? item.features : [];
  const features = rawFeatures
    .filter((f: any): f is string => typeof f === "string" && f.length > 0 && !f.includes("[object Object]"));
  if (Array.isArray(item.developers) && item.developers.length) features.push(`Developer: ${item.developers.join(", ")}`);
  if (Array.isArray(item.publishers) && item.publishers.length) features.push(`Publisher: ${item.publishers.join(", ")}`);
  if (item.releaseDate) features.push(`Release: ${cleanStr(item.releaseDate)}`);
  if (item.metacriticScore) features.push(`Metacritic: ${item.metacriticScore}/100`);
  if (item.contentRating) features.push(`Rating: ${cleanStr(item.contentRating)}`);

  // Screenshots: combine FitGirl + Steam
  const allScreenshots = [
    ...(Array.isArray(item.screenshots) ? item.screenshots : []),
    ...(Array.isArray(item.steamScreenshots) ? item.steamScreenshots : []),
  ].filter((s: any) => typeof s === "string" && s.startsWith("http"));
  const screenshots = allScreenshots.slice(0, 10);

  return {
    id: `ext-${source}-${slugify(item.title || "unknown")}`,
    title: cleanStr(item.title) || "Unknown",
    description: cleanStr(item.originalDescriptionFull || item.originalDescription || item.description),
    category: cat,
    subcategory: cleanStr(item.subcategory) || genreStr.split(",")[0]?.trim() || "",
    platform: (cat === "movies" ? "cross-platform" : "windows") as Software["platform"],
    version: cleanStr(item.version),
    size: cleanStr(item.size || item.repackSize),
    downloads: typeof item.downloads === "number" ? item.downloads : (Array.isArray(item.downloads) ? item.downloads.length : 0),
    rating: item.metacriticScore || item.rating || 0,
    icon: cleanStr(item.banner || item.icon || item.poster),
    poster: cleanStr(item.banner || item.icon || item.poster),
    screenshots,
    downloadLinks: links,
    password: cleanStr(item.password),
    systemRequirements: sysReqs,
    features,
    videoUrl: cleanStr(item.videoUrl),
    createdAt: item.createdAt || new Date().toISOString(),
  };
}

interface IndexItem {
  title: string;
  category: string;
  genre: string;
  size: string;
  poster: string;
  banner?: string;
  hasLinks: boolean;
}

export default function ExternalDataPage() {
  const { toast } = useToast();
  const [xzyIndex, setXzyIndex] = useState<IndexItem[]>([]);
  const [elamIndex, setElamIndex] = useState<IndexItem[]>([]);
  const [fitgirlIndex, setFitgirlIndex] = useState<IndexItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"xzy" | "elamigos" | "fitgirl">("xzy");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [page, setPage] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [detailItem, setDetailItem] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [aiEnhancing, setAiEnhancing] = useState(false);
  // Pending bulk import whose selection contains torrent-only entries.
  const [torrentGate, setTorrentGate] = useState<{ count: number; selection: Set<number> } | null>(null);
  // Cache of full records keyed by title, so the torrent gate can inspect links.
  const fullDataCache = useRef(new Map<string, any>());

  /** True when an item's only download links are torrents/magnets. */
  function isTorrentOnly(item: any): boolean {
    const links: any[] = Array.isArray(item?.downloads)
      ? item.downloads
      : Array.isArray(item?.downloads_links)
        ? item.downloads_links
        : Array.isArray(item?.downloadLinks)
          ? item.downloadLinks
          : [];
    const usable = links.filter((l) => l && typeof l.url === "string" && l.url.trim());
    if (usable.length === 0) return false;
    const hasDirect = usable.some((l) => l.type !== "torrent" && !l.url.startsWith("magnet:"));
    const hasTorrent = usable.some((l) => l.type === "torrent" || l.url.startsWith("magnet:"));
    return !hasDirect && hasTorrent;
  }
  const PER_PAGE = 50;

  async function openDetail(item: IndexItem) {
    setDetailLoading(true);
    setDetailItem({ ...item, _loadingPlaceholder: true } as any);
    try {
      let full: any = null;
      if (activeTab === "xzy") {
        const idx = index.findIndex((i) => i.title === item.title);
        const chunkIdx = Math.floor(idx / 500);
        try {
          const chunk = await fetch(`/data/xzy-chunks/${chunkIdx}.json`).then((r) => r.json());
          full = chunk.find((x: any) => x.title === item.title) || item;
        } catch { full = item; }
      } else {
        const url = activeTab === "elamigos" ? "/data/elamigos-games.json" : "/data/fitgirl-games.json";
        try {
          const data = await fetch(url).then((r) => r.json());
          full = data.find((x: any) => x.title === item.title) || item;
        } catch { full = item; }
      }
      // Auto-enhance ElAmigos games with Grok AI
      if (activeTab === "elamigos" && full?.title) {
        try {
          setAiEnhancing(true);
          const res = await fetch("/api/ai/enrich", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: [{ title: full.title, description: full.description || "" }] }),
          });
          const data = await res.json();
          const meta = data.results?.[0]?.meta;
          if (meta && meta.found !== false) {
            full = {
              ...full,
              title: meta.title || full.title,
              description: meta.description || full.description,
              originalDescription: meta.description || full.description,
              features: meta.features?.length ? meta.features : full.features,
              genres: meta.tags?.length ? meta.tags : full.genres,
              category: meta.category || full.category,
              platform: meta.platform || full.platform,
              _aiEnhanced: true,
              _aiProvider: data.results[0].provider,
            };
          }
        } catch {}
        finally { setAiEnhancing(false); }
      }
      setDetailItem(full);
    } finally {
      setDetailLoading(false);
    }
  }

  async function enhanceWithGrok() {
    if (!detailItem?.title) return;
    setAiEnhancing(true);
    try {
      const res = await fetch("/api/ai/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ title: detailItem.title, description: detailItem.description || detailItem.originalDescription || "" }] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI failed");
      const meta = data.results?.[0]?.meta;
      if (!meta || meta.found === false) {
        toast("Grok could not identify this title.", "error");
        return;
      }
      setDetailItem((prev: any) => ({
        ...prev,
        title: meta.title || prev.title,
        description: meta.description || prev.description,
        originalDescription: meta.description || prev.description,
        features: meta.features?.length ? meta.features : prev.features,
        genres: meta.tags?.length ? meta.tags : prev.genres,
        category: meta.category || prev.category,
        platform: meta.platform || prev.platform,
        version: meta.version || prev.version,
        size: meta.size || prev.size,
        _aiEnhanced: true,
        _aiProvider: data.results[0].provider,
      }));
      toast(`Enhanced with Grok (${data.results[0].provider})`, "success");
    } catch (e: any) {
      toast(e.message || "AI enhance failed", "error");
    } finally {
      setAiEnhancing(false);
    }
  }

  useEffect(() => {
    Promise.all([
      fetch("/data/xzy-index.json").then((r) => r.json()).catch(() => []),
      fetch("/data/elamigos-index.json").then((r) => r.json()).catch(() => []),
      fetch("/data/fitgirl-index.json").then((r) => r.json()).catch(() => []),
    ]).then(([xzy, elam, fitgirl]) => {
      setXzyIndex(xzy);
      setElamIndex(elam);
      setFitgirlIndex(fitgirl);
      setLoading(false);
    });
  }, []);

  const index = activeTab === "xzy" ? xzyIndex : activeTab === "elamigos" ? elamIndex : fitgirlIndex;

  const filtered = useMemo(() => {
    let items = index;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (i) =>
          i.title?.toLowerCase().includes(q) ||
          i.genre?.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== "all") {
      items = items.filter((i) => {
        const cat = i.category === "game" || i.category === "pc-games" ? "pc-games" : i.category === "software" ? "windows" : i.category;
        return cat === categoryFilter;
      });
    }
    return items;
  }, [index, search, categoryFilter]);

  const paged = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  const stats = useMemo(() => {
    const s = { total: index.length, withLinks: 0, games: 0, software: 0 };
    for (const i of index) {
      if (i.hasLinks) s.withLinks++;
      const cat = i.category === "game" || i.category === "pc-games" ? "pc-games" : i.category === "software" ? "windows" : "pc-games";
      if (cat === "pc-games") s.games++;
      else s.software++;
    }
    return s;
  }, [index]);

  function toggleSelect(globalIdx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(globalIdx)) next.delete(globalIdx);
      else next.add(globalIdx);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(filtered.map((_, i) => i)));
  }

  async function doImportAll() {
    if (filtered.length === 0) {
      toast("No items to import.", "error");
      return;
    }
    // Select all filtered then reuse doImport logic
    const allSelected = new Set<number>(filtered.map((_, i) => i));
    setSelected(allSelected);
    // directly import without relying on state (state update is async)
    await doImportWithSelection(allSelected);
  }

  async function doImport() {
    await doImportWithSelection(selected);
  }

  async function doImportWithSelection(selection: Set<number>, skipTorrentGate = false) {
    if (selection.size === 0) {
      toast("No items selected. Click items to select them first.", "error");
      return;
    }

    // Torrent gate: warn when the selection includes entries whose only links
    // are torrents/magnets (no datanodes/fuckingfast/etc. file-hoster links).
    if (!skipTorrentGate) {
      // FitGirl/ElAmigos ship a single small full-data file; load it so the
      // gate can see links. XZY is chunked/heavy — skip the gate there (its
      // entries are indexed and rarely torrent-only).
      const gateSource = activeTab;
      if (gateSource !== "xzy" && fullDataCache.current.size === 0) {
        try {
          const url = gateSource === "elamigos" ? "/data/elamigos-games.json" : "/data/fitgirl-games.json";
          const full = await fetch(url).then((r) => r.json()).catch(() => [] as any[]);
          for (const it of full as any[]) {
            if (it?.title) fullDataCache.current.set(it.title, it);
          }
        } catch { /* non-fatal: skip gate when data can't be read */ }
      }
      const torrentOnlyTitles: string[] = [];
      for (const idx of selection) {
        const item = filtered[idx];
        if (!item) continue;
        const full = fullDataCache.current.get(item.title) || item;
        if (isTorrentOnly(full)) torrentOnlyTitles.push(item.title);
      }
      if (torrentOnlyTitles.length > 0) {
        setTorrentGate({ count: torrentOnlyTitles.length, selection });
        return;
      }
    }

    setImporting(true);

    try {
      const existing = await getSoftwareList();
      const existingTitles = new Set(existing.map((i) => i.title.toLowerCase()));
      let added = 0;
      let skipped = 0;

      const source = activeTab;

      // Fetch full data for selected items in chunks
      if (source === "xzy") {
        // Load XZY full data in chunks for selected indices
        const selectedIndices = Array.from(selection);
        const chunksNeeded = new Set(selectedIndices.map(i => Math.floor(i / 500)));

        const fullItems: any[] = [];
        for (const chunkIdx of chunksNeeded) {
          try {
            const chunk = await fetch(`/data/xzy-chunks/${chunkIdx}.json`).then(r => r.json());
            fullItems.push(...chunk);
          } catch {}
        }

        // Map selected titles to full items
        const titleToFull = new Map(fullItems.map((item: any) => [item.title, item]));
        for (const idx of selectedIndices) {
          const indexItem = filtered[idx];
          if (!indexItem) continue;
          const fullItem = titleToFull.get(indexItem.title);
          const item = fullItem || indexItem;
          const sw = toSoftware(item, source);
          if (!existingTitles.has(sw.title.toLowerCase())) {
            sw.description = sw.description?.substring(0, 500) || "";
            sw.screenshots = sw.screenshots?.slice(0, 3) || [];
            sw.features = sw.features?.slice(0, 8) || [];
            sw.systemRequirements = sw.systemRequirements?.substring(0, 300) || "";
            sw.status = "pending";
            existing.push(sw);
            existingTitles.add(sw.title.toLowerCase());
            added++;
            setImported(prev => new Set([...prev, `${source}-${indexItem.title}`]));
          } else {
            skipped++;
          }
        }
      } else {
        // ElAmigos and FitGirl: fetch full data files (they're small enough)
        const fullDataUrl = source === "elamigos" ? "/data/elamigos-games.json" : "/data/fitgirl-games.json";
        const fullData = await fetch(fullDataUrl).then(r => r.json()).catch(() => []);
        const titleToFull = new Map(fullData.map((item: any) => [item.title, item]));

        for (const idx of selection) {
          const indexItem = filtered[idx];
          if (!indexItem) continue;
          const fullItem = titleToFull.get(indexItem.title);
          const item = fullItem || indexItem;
          const sw = toSoftware(item, source);
          if (!existingTitles.has(sw.title.toLowerCase())) {
            sw.description = sw.description?.substring(0, 500) || "";
            sw.screenshots = sw.screenshots?.slice(0, 3) || [];
            sw.features = sw.features?.slice(0, 8) || [];
            sw.systemRequirements = sw.systemRequirements?.substring(0, 300) || "";
            sw.status = "pending";
            existing.push(sw);
            existingTitles.add(sw.title.toLowerCase());
            added++;
            setImported(prev => new Set([...prev, `${source}-${indexItem.title}`]));
          } else {
            skipped++;
          }
        }
      }

      const saved = await saveSoftwareList(existing);
      if (saved) {
        window.dispatchEvent(new Event("software-data-changed"));
        toast(`Imported ${added} items as PENDING${skipped > 0 ? ` (${skipped} duplicates skipped)` : ""} — approve in Software to publish`, "success");
      } else {
        toast(`Added ${added} items but localStorage is full. Data may not persist.`, "error");
      }
    } catch (err: any) {
      toast(`Import failed: ${err.message || "Unknown error"}`, "error");
    } finally {
      setImporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-blue-400 text-lg">Loading external data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-wider">External Data</h1>
          <p className="text-blue-400/60 text-sm mt-1">Browse and import games from XZY, ElAmigos, and FitGirl Repacks</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={doImportAll}
            disabled={importing || filtered.length === 0}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold uppercase tracking-wider rounded-lg text-sm transition-colors"
          >
            {importing ? "Importing..." : `Import All (${filtered.length.toLocaleString()})`}
          </button>
          <button
            onClick={doImport}
            disabled={selected.size === 0 || importing}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold uppercase tracking-wider rounded-lg text-sm transition-colors"
          >
            {importing ? "Importing..." : `Import Selected (${selected.size})`}
          </button>
        </div>
      </div>

      {/* Source Tabs */}
      <div className="flex gap-2">
        {[
          { key: "xzy" as const, label: "XZY", count: xzyIndex.length },
          { key: "elamigos" as const, label: "ElAmigos", count: elamIndex.length },
          { key: "fitgirl" as const, label: "FitGirl", count: fitgirlIndex.length },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => { setActiveTab(t.key); setSelected(new Set()); setPage(0); setSearch(""); }}
            className={`px-5 py-2.5 rounded-lg font-bold uppercase tracking-wider text-sm transition-all ${
              activeTab === t.key
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : "bg-[#111827] text-blue-300/60 hover:text-white border border-blue-900/30"
            }`}
          >
            {t.label} ({t.count.toLocaleString()})
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats.total, color: "text-white" },
          { label: "With Links", value: stats.withLinks, color: "text-green-400" },
          { label: "Games", value: stats.games, color: "text-blue-400" },
          { label: "Software", value: stats.software, color: "text-purple-400" },
        ].map((s) => (
          <div key={s.label} className="bg-[#111827] border border-blue-900/30 rounded-xl p-4">
            <div className={`text-2xl font-black ${s.color}`}>{s.value.toLocaleString()}</div>
            <div className="text-blue-400/60 text-xs uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search titles..."
          className="flex-1 bg-[#111827] border border-blue-900/30 rounded-lg px-4 py-2.5 text-white placeholder-blue-400/40 text-sm focus:outline-none focus:border-blue-500"
        />
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
          className="bg-[#111827] border border-blue-900/30 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Categories</option>
          <option value="pc-games">PC Games</option>
          <option value="windows">Software</option>
          <option value="movies">Movies</option>
        </select>
        <button onClick={selectAll} className="px-4 py-2.5 bg-[#111827] border border-blue-900/30 rounded-lg text-blue-300/60 hover:text-white text-sm transition-colors">
          Select All ({filtered.length.toLocaleString()})
        </button>
        <button onClick={() => setSelected(new Set())} className="px-4 py-2.5 bg-[#111827] border border-blue-900/30 rounded-lg text-blue-300/60 hover:text-white text-sm transition-colors">
          Clear
        </button>
      </div>

      {/* Items List */}
      <div className="space-y-2">
        {paged.map((item, localIdx) => {
          const globalIdx = page * PER_PAGE + localIdx;
          const isSelected = selected.has(globalIdx);
          const wasImported = imported.has(`${activeTab}-${item.title}`);
          return (
            <div
              key={`${activeTab}-${globalIdx}`}
              onClick={() => openDetail(item)}
              className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? "bg-blue-600/10 border-blue-500/50"
                  : "bg-[#111827] border-blue-900/30 hover:border-blue-700/50"
              } ${wasImported ? "opacity-50" : ""}`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onClick={(e) => e.stopPropagation()}
                onChange={() => toggleSelect(globalIdx)}
                className="w-4 h-4 accent-blue-500 shrink-0"
              />
              {item.poster && (
                <img
                  src={item.poster}
                  alt=""
                  className="w-12 h-12 rounded-lg object-cover bg-blue-900/30"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold text-sm truncate">{item.title}</div>
                <div className="flex gap-3 mt-1 flex-wrap">
                  <span className="text-blue-400/60 text-xs">{item.category}</span>
                  {item.genre && <span className="text-blue-400/40 text-xs">{item.genre}</span>}
                  {item.size && <span className="text-blue-400/40 text-xs">{item.size}</span>}
                  {item.hasLinks && <span className="text-green-400/60 text-xs">has links</span>}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); openDetail(item); }}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-[#0c1222] border border-blue-900/30 text-blue-300 text-xs hover:bg-blue-600 hover:text-white transition-colors"
              >
                View
              </button>
              {wasImported && <span className="text-green-400 text-xs font-bold">IMPORTED</span>}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-4 py-2 bg-[#111827] border border-blue-900/30 rounded-lg text-blue-300/60 hover:text-white disabled:opacity-30 text-sm"
          >
            Prev
          </button>
          <span className="text-blue-400/60 text-sm">
            Page {page + 1} / {totalPages} ({filtered.length.toLocaleString()} items)
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="px-4 py-2 bg-[#111827] border border-blue-900/30 rounded-lg text-blue-300/60 hover:text-white disabled:opacity-30 text-sm"
          >
            Next
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDetailItem(null)} />
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-auto bg-[#0f172a] rounded-2xl border border-blue-900/40 shadow-2xl">
            {detailLoading ? (
              <div className="p-10 flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-blue-300/60 text-sm">Loading full details...</p>
              </div>
            ) : (
              <>
                {(detailItem.banner || detailItem.poster || detailItem.icon) && (
                  <div className="h-48 w-full overflow-hidden rounded-t-2xl bg-black">
                    <img src={detailItem.banner || detailItem.poster || detailItem.icon} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                )}
                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="text-xl font-black text-white leading-tight">{detailItem.title}{detailItem._aiEnhanced && <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-violet-600 text-white">AI enhanced via {detailItem._aiProvider}</span>}</h2>
                    <button onClick={() => setDetailItem(null)} className="shrink-0 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">✕</button>
                  </div>
                  {(detailItem.genres || detailItem.category || detailItem.size) && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {detailItem.category && <span className="px-2 py-1 rounded-full bg-blue-900/30 text-blue-300 border border-blue-800/50">{detailItem.category}</span>}
                      {Array.isArray(detailItem.genres) && detailItem.genres.slice(0, 4).map((g: string) => <span key={g} className="px-2 py-1 rounded-full bg-purple-900/30 text-purple-300 border border-purple-800/50">{g}</span>)}
                      {detailItem.size && <span className="px-2 py-1 rounded-full bg-[#111827] text-blue-300/60 border border-blue-900/30">{detailItem.size}</span>}
                      {detailItem.repackSize && <span className="px-2 py-1 rounded-full bg-[#111827] text-blue-300/60 border border-blue-900/30">Repack {detailItem.repackSize}</span>}
                    </div>
                  )}
                  {(detailItem.description || detailItem.originalDescription) && (
                    <div className="bg-[#111827] rounded-xl p-4 border border-blue-900/30">
                      <h3 className="text-blue-300/50 text-xs uppercase tracking-wider mb-2">Description</h3>
                      <p className="text-blue-100/80 text-sm leading-relaxed whitespace-pre-wrap">{detailItem.description || detailItem.originalDescription}</p>
                    </div>
                  )}
                  {detailItem.screenshots?.length > 0 && (
                    <div>
                      <h3 className="text-blue-300/50 text-xs uppercase tracking-wider mb-2">Screenshots</h3>
                      <div className="flex gap-2 overflow-auto pb-1">
                        {detailItem.screenshots.slice(0, 6).map((s: string, i: number) => (
                          <img key={i} src={s} alt="" className="h-20 rounded-lg border border-white/10 object-cover shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ))}
                      </div>
                    </div>
                  )}
                  {detailItem.features?.length > 0 && (
                    <div className="bg-[#111827] rounded-xl p-4 border border-blue-900/30">
                      <h3 className="text-blue-300/50 text-xs uppercase tracking-wider mb-2">Features</h3>
                      <ul className="list-disc list-inside text-blue-200/70 text-xs space-y-1">
                        {detailItem.features.slice(0, 10).map((f: string, i: number) => <li key={i}>{f}</li>)}
                      </ul>
                    </div>
                  )}
                  {/* AI suggestions for missing banner */}
                  {!detailItem.banner && !detailItem.poster && !detailItem.icon && detailItem.screenshots?.length > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between gap-3">
                      <p className="text-amber-200/80 text-xs">No banner — AI suggests using first screenshot as banner.</p>
                      <button onClick={() => setDetailItem((p: any) => ({ ...p, banner: p.screenshots[0], poster: p.screenshots[0] }))} className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold">Use Screenshot</button>
                    </div>
                  )}
                  {!detailItem.banner && !detailItem.poster && !detailItem.icon && (!detailItem.screenshots || detailItem.screenshots.length === 0) && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between gap-3">
                      <p className="text-amber-200/80 text-xs">No banner or screenshots — let AI fetch a banner from the internet?</p>
                      <button
                        onClick={async () => {
                          const t = detailItem.title;
                          toast("AI searching for banner...", "success");
                          try {
                            const r = await fetch("/api/ai/fetch-banner", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: t }) });
                            const d = await r.json();
                            if (!r.ok) throw new Error(d.error || "not found");
                            setDetailItem((p: any) => ({ ...p, banner: d.banner, poster: d.banner }));
                            toast("Banner fetched from internet.", "success");
                          } catch (e: any) { toast(e.message || "Banner fetch failed", "error"); }
                        }}
                        className="shrink-0 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold"
                      >
                        Fetch Banner
                      </button>
                    </div>
                  )}
                  {/* AI suggestion for missing links */}
                  {(() => {
                    const all: any[] = Array.isArray(detailItem.downloads) ? detailItem.downloads : (detailItem.downloads_links as any[]) || [];
                    const hasDirect = all.some((l: any) => l.type !== "torrent" && typeof l.url === "string" && l.url.startsWith("http"));
                    const hasTorrent = all.some((l: any) => l.type === "torrent" || (typeof l.url === "string" && l.url.startsWith("magnet:")));
                    if (!hasDirect && hasTorrent) {
                      return (
                        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-3 flex items-center justify-between gap-3">
                          <p className="text-cyan-200/80 text-xs">No file hoster links — AI suggests using the torrent from the same site (listed below).</p>
                          <span className="text-cyan-300 text-xs font-bold">↓ Torrent available</span>
                        </div>
                      );
                    }
                    if (!hasDirect && !hasTorrent) {
                      return (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                          <p className="text-red-200/80 text-xs">No download links found on this page. The same site's torrent mirror (if any) would appear here — AI has checked this page and found none. Try re-scraping or use AI Enhance to generate placeholder metadata.</p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {(detailItem.downloads || detailItem.downloads_links) && (
                    <div className="bg-[#111827] rounded-xl p-4 border border-blue-900/30">
                      <h3 className="text-blue-300/50 text-xs uppercase tracking-wider mb-2">Links {Array.isArray(detailItem.downloads) ? `(${detailItem.downloads.length})` : Array.isArray(detailItem.downloads_links) ? `(${detailItem.downloads_links.length})` : ""}</h3>
                      <div className="space-y-1.5 max-h-48 overflow-auto">
                        {(Array.isArray(detailItem.downloads) ? detailItem.downloads : detailItem.downloads_links || []).slice(0, 30).map((l: any, i: number) => (
                          <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#0c1222] border border-blue-900/20 hover:border-indigo-500/50 transition-colors">
                            <span className="text-indigo-300 text-xs truncate">{l.hoster || l.name || new URL(l.url).hostname}</span>
                            <span className="text-blue-300/30 text-[10px] truncate max-w-[60%]">{l.url}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      onClick={enhanceWithGrok}
                      disabled={aiEnhancing}
                      className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 ${aiEnhancing ? "bg-gray-700 text-gray-400" : "bg-violet-600 hover:bg-violet-500 text-white"}`}
                    >
                      {aiEnhancing ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span>✦</span>}
                      {aiEnhancing ? "Enhancing..." : "Enhance with Grok AI"}
                    </button>
                    <button
                      onClick={async () => {
                        const sw = toSoftware(detailItem, activeTab);
                        const existing = await getSoftwareList();
                        if (existing.some((s) => s.title.toLowerCase() === sw.title.toLowerCase())) {
                          toast("Already in library.", "error");
                          return;
                        }
                        sw.status = "pending";
                        const ok = await saveSoftwareList([...existing, sw]);
                        if (ok) {
                          window.dispatchEvent(new Event("software-data-changed"));
                          toast(`Imported "${sw.title}" as pending.`, "success");
                          setDetailItem(null);
                        } else toast("Save failed — storage full.", "error");
                      }}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                    >
                      Import This
                    </button>
                    <button onClick={() => setDetailItem(null)} className="px-4 py-2 rounded-lg bg-[#0c1222] border border-blue-900/30 text-blue-300 text-xs">Close</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Torrent gate — confirm before importing torrent-only entries */}
      {torrentGate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] rounded-2xl border border-cyan-700/40 p-8 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-3">🧲 Torrent-only entries</h2>
            <p className="text-gray-300 text-sm mb-4">
              <strong className="text-cyan-300">{torrentGate.count}</strong>{" "}
              {torrentGate.count === 1 ? "entry has" : "entries have"} no working file-hoster links
              (DataNodes, FuckingFast, PixelDrain, GoFile…) — only a torrent/magnet mirror is available.
            </p>
            <p className="text-blue-300/60 text-xs mb-5">
              Torrents require a BitTorrent client. Accept to import them as torrent downloads,
              or cancel to revisit and pick direct-mirror entries instead.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setTorrentGate(null)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-700 text-white font-semibold hover:bg-red-600"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const sel = torrentGate.selection;
                  setTorrentGate(null);
                  doImportWithSelection(sel, true);
                }}
                className="flex-1 px-4 py-2.5 rounded-lg bg-cyan-700 text-white font-semibold hover:bg-cyan-600"
              >
                Import with torrents
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating scroll to top/bottom buttons */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center transition-all hover:scale-110"
          title="Scroll to top"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
        </button>
        <button
          onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}
          className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center transition-all hover:scale-110"
          title="Scroll to bottom"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
      </div>
    </div>
  );
}