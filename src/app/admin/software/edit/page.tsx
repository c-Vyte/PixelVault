"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { categories, getSoftwareByIdLive, type Software } from "@/lib/data";
import { parseGameDetails, type ParsedGameData } from "@/lib/parseGameDetails";
import { groupLinks } from "@/lib/partGroups";

const DRAFT_KEY = "editFormDraft";

function getYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0] || null;
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const parts = u.pathname.split("/");
    const embedIdx = parts.indexOf("embed");
    if (embedIdx !== -1) return parts[embedIdx + 1] || null;
    const vIdx = parts.indexOf("v");
    if (vIdx !== -1) return parts[vIdx + 1] || null;
  } catch {}
  return null;
}

function EditSoftwareForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const [loadingExisting, setLoadingExisting] = useState(!!editId);

  const [form, setForm] = useState(() => {
    if (typeof window !== "undefined" && !editId) {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        try {
          return JSON.parse(draft);
        } catch {}
      }
    }
    return {
      title: "",
      description: "",
      category: "pc-games",
      subcategory: "",
      platform: "windows",
      version: "",
      size: "",
      rating: 4.5,
      icon: "https://placehold.co/616x352/3b82f6/ffffff?text=Banner",
      poster: "https://placehold.co/600x900/3b82f6/ffffff?text=Poster",
      systemRequirements: "",
      features: "",
      videoUrl: "",
      password: "",
      downloadLinks: [{ name: "Download", url: "", type: "official" as const }],
      screenshots: [] as string[],
    };
  });

  useEffect(() => {
    if (!editId) return;
    getSoftwareByIdLive(editId).then((existing) => {
      if (existing) {
        let links = existing.downloadLinks || [];
        const byHoster = (existing as any).downloadsByHoster as Record<string, any[]> | undefined;
        if ((!links || links.length === 0 || links.length === 1 && !links[0]?.url) && byHoster) {
          const flat: any[] = [];
          for (const [host, arr] of Object.entries(byHoster)) for (const l of arr) flat.push({ ...l, hoster: l.hoster || host, name: l.name || host });
          if (flat.length) links = flat;
        }
        // Ensure every link has hoster field for grouping
        links = links.map((l: any) => ({ ...l, hoster: l.hoster || l.name || "Other" }));
        setForm({
          title: existing.title || "",
          description: existing.description || "",
          category: existing.category || "pc-games",
          subcategory: existing.subcategory || "",
          platform: existing.platform || "windows",
          version: existing.version || "",
          size: existing.size || "",
          rating: existing.rating || 4.5,
          icon: existing.icon || "https://placehold.co/616x352/3b82f6/ffffff?text=Banner",
          poster: existing.poster || "https://placehold.co/600x900/3b82f6/ffffff?text=Poster",
          systemRequirements: existing.systemRequirements || "",
          features: existing.features?.join("\n") || "",
          videoUrl: existing.videoUrl || "",
          password: existing.password || "",
          downloadLinks: links.length ? links : [{ name: "Download", url: "", type: "official" as const }],
          screenshots: existing.screenshots || [],
        });
      }
      setLoadingExisting(false);
    });
  }, [editId]);

  const [pasteText, setPasteText] = useState("");
  const [parsedData, setParsedData] = useState<ParsedGameData | null>(null);
  const [showAutoFill, setShowAutoFill] = useState(false);
  const [showUrlFetch, setShowUrlFetch] = useState(false);
  const [urlFetchInput, setUrlFetchInput] = useState("");
  const [urlFetchLoading, setUrlFetchLoading] = useState(false);
  const [urlFetchData, setUrlFetchData] = useState<{
    title: string;
    description: string;
    image: string;
    screenshots: string[];
    password?: string;
    links: { name: string; url: string; type: string; part?: number; partTotal?: number }[];
  } | null>(null);
  const [urlFetchError, setUrlFetchError] = useState("");
  const [bulkUrls, setBulkUrls] = useState("");
  const [fetchingIndex, setFetchingIndex] = useState<number | null>(null);

  function classifyDomain(url: string): string {
    try {
      const domain = new URL(url).hostname.toLowerCase();
      if (/fitgirl|dodi|steamrip|repack|corepack/.test(domain)) return "repack";
      if (/steam|epicgames|gog\.com|store\.playstation|microsoft\.com/.test(domain)) return "official";
      if (/mega\.nz|mediafire|gofile|buzzheavier|1fichier|work\.upload|rapidgator/.test(domain)) return "direct";
      if (/crack|skidrow|codex|plaza/.test(domain)) return "cracked";
      if (/torrent|magnet|piratebay|1337|rarbg|nyaa/.test(domain)) return "torrent";
      return "direct";
    } catch {
      return "direct";
    }
  }

  function domainLabel(url: string): string {
    if (url.trim().startsWith("magnet:")) return "Magnet / Torrent";
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      const known: Record<string, string> = {
        "fitgirl-repacks.site": "FitGirl Repack",
        "store.steampowered.com": "Steam",
        "store.epicgames.com": "Epic Games",
        "www.gog.com": "GOG",
        "mega.nz": "MEGA",
        "www.mediafire.com": "MediaFire",
        "www.microsoft.com": "Microsoft Store",
      };
      return known[host] || host.split(".").slice(0, -1).join(".") || host;
    } catch {
      return "Download";
    }
  }

  const autoClassifyLink = (index: number) => {
    const link = form.downloadLinks[index];
    if (!link || !link.url.trim()) return;
    const updated = [...form.downloadLinks];
    const updatedLink = { ...updated[index] };
    updatedLink.type = classifyDomain(link.url) as typeof updatedLink.type;
    if (!updatedLink.name.trim()) {
      updatedLink.name = domainLabel(link.url);
    }
    updated[index] = updatedLink;
    setForm({ ...form, downloadLinks: updated });
  };

  // Auto-save draft every 3 seconds (only for new entries)
  useEffect(() => {
    if (!editId && form.title) {
      const timer = setTimeout(() => {
        try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)); } catch {}
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [form, editId]);

  // Clear draft on successful save
  const clearDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
  };

  // Auto-set platform based on category
  const handleCategoryChange = (cat: string) => {
    const platformMap: Record<string, string> = {
      "pc-games": "windows",
      "windows": "windows",
      "mac": "mac",
      "android": "android",
      "ebooks": "cross-platform",
    };
    setForm({
      ...form,
      category: cat,
      subcategory: "",
      platform: (platformMap[cat] || form.platform) as typeof form.platform,
    });
  };

  const handleParse = () => {
    if (!pasteText.trim()) return;
    const parsed = parseGameDetails(pasteText);
    setParsedData(parsed);
  };

  const handleApplyParsed = () => {
    if (!parsedData) return;
    setForm((prev: typeof form) => ({
      ...prev,
      title: parsedData.title || prev.title,
      description: parsedData.description || prev.description,
      systemRequirements: parsedData.systemRequirements || prev.systemRequirements,
      features: parsedData.features.length > 0 ? parsedData.features.join("\n") : prev.features,
      platform: (parsedData.platform || prev.platform) as typeof prev.platform,
      version: parsedData.version || prev.version,
      size: parsedData.size || prev.size,
      rating: parsedData.rating || prev.rating,
      downloadLinks: parsedData.downloadLinks.length > 0
        ? parsedData.downloadLinks.map((l) => ({
            name: l.name,
            url: l.url,
            type: l.type as "official" | "repack" | "direct" | "cracked",
            ...(l.type === "repack" ? { parts: 1 } : {}),
          }))
        : prev.downloadLinks,
    }));
    setShowAutoFill(false);
    setPasteText("");
    setParsedData(null);
  };

  const [saveError, setSaveError] = useState("");

  const handleFetchFromUrl = async () => {
    if (!urlFetchInput.trim()) return;
    setUrlFetchLoading(true);
    setUrlFetchError("");
    setUrlFetchData(null);
    try {
      const res = await fetch(`/api/import/detail?url=${encodeURIComponent(urlFetchInput.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setUrlFetchError(data.error || "Failed to fetch");
        return;
      }
      setUrlFetchData(data);
    } catch {
      setUrlFetchError("Could not reach the import API.");
    } finally {
      setUrlFetchLoading(false);
    }
  };

  const handleApplyUrlFetch = () => {
    if (!urlFetchData) return;
    const typeMap: Record<string, "official" | "repack" | "direct" | "cracked" | "torrent"> = {
      official: "official",
      repack: "repack",
      direct: "direct",
      cracked: "cracked",
      torrent: "torrent",
    };
    const rawLinks = (urlFetchData.links || []).filter((l: { url?: string }) => l.url && l.url.trim());
    const links = groupLinks(
      rawLinks.map((l: { url: string; name?: string; type?: string }) => ({
        url: l.url,
        name: l.name || "Download",
        type: (typeMap[l.type || ""] || classifyDomain(l.url)) as string,
      })),
      (u) => classifyDomain(u) as "official" | "repack" | "direct" | "cracked" | "torrent"
    ) as typeof form.downloadLinks;
    setForm((prev: typeof form) => ({
      ...prev,
      title: urlFetchData.title || prev.title,
      description: urlFetchData.description || prev.description,
      icon: urlFetchData.image || prev.icon,
      password: urlFetchData.password || prev.password,
      screenshots: urlFetchData.screenshots?.length ? urlFetchData.screenshots : prev.screenshots,
      downloadLinks: links.length > 0 ? links : prev.downloadLinks,
    }));
    setShowUrlFetch(false);
    setUrlFetchInput("");
    setUrlFetchData(null);
  };

  const handleFileUpload = (field: "icon" | "poster", file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxW = field === "icon" ? 616 : 600;
        const maxH = field === "icon" ? 352 : 900;
        let w = img.width;
        let h = img.height;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL("image/jpeg", 0.7);
          setForm((prev: typeof form) => ({ ...prev, [field]: compressed }));
        } else {
          setForm((prev: typeof form) => ({ ...prev, [field]: e.target?.result as string }));
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const selectedCategory = categories.find((c) => c.id === form.category);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Load existing data from localStorage
    let allSoftware: Software[] = [];
    const stored = localStorage.getItem("softwareData");
    if (stored) {
      try {
        allSoftware = JSON.parse(stored);
      } catch {}
    }
    if (allSoftware.length === 0) {
      // Import static data as fallback
      allSoftware = [...categories].length > 0 ? (() => {
        const mod = require("@/lib/data");
        return mod.softwareData;
      })() : [];
    }

    const newId = editId || form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const duplicate = allSoftware.find(
      (s) => s.id === newId && s.id !== editId
    );
    if (duplicate) {
      setSaveError(
        `Duplicate detected: "${duplicate.title}" already uses the slug "${newId}". Give this entry a different title or edit the existing one instead. Your changes were NOT saved.`
      );
      return;
    }

    const newSoftware: Software = {
      id: newId,
      title: form.title,
      description: form.description,
      category: form.category,
      subcategory: form.subcategory,
      platform: form.platform,
      version: form.version,
      size: form.size,
      downloads: 0,
      rating: form.rating,
      icon: form.icon,
      poster: form.poster,
      screenshots: form.screenshots || [],
      downloadLinks: form.downloadLinks,
      downloadsByHoster: (() => {
        const g: Record<string, any[]> = {};
        for (const l of form.downloadLinks as any[]) {
          if (l.type === "torrent" || !l.url) continue;
          const host = l.hoster || l.name || "Other";
          if (!g[host]) g[host] = [];
          g[host].push(l);
        }
        return Object.keys(g).length ? g : undefined;
      })(),
      systemRequirements: form.systemRequirements,
      features: form.features.split("\n").filter((f: string) => f.trim()),
      videoUrl: form.videoUrl || undefined,
      password: form.password || undefined,
      createdAt: new Date().toISOString().split("T")[0],
      updatedAt: new Date().toISOString().split("T")[0],
    };

    if (editId) {
      allSoftware = allSoftware.map((s) => (s.id === editId ? newSoftware : s));
    } else {
      allSoftware.push(newSoftware);
    }

    try {
      localStorage.setItem("softwareData", JSON.stringify(allSoftware));
      clearDraft();
      setSaveError("");
      alert(editId ? "Software updated!" : "Software added!");
      router.push("/admin/software");
    } catch (err) {
      if (err instanceof DOMException && err.name === "QuotaExceededError") {
        setSaveError("Storage full! Try using smaller images or removing some entries. Your changes were NOT saved.");
      } else {
        setSaveError("Failed to save: " + (err instanceof Error ? err.message : "Unknown error"));
      }
    }
  };

  const addDownloadLink = () => {
    setForm({
      ...form,
      downloadLinks: [...form.downloadLinks, { name: "", url: "", type: "official", parts: 1, partLinks: [], status: "unknown" as const }],
    });
  };

  const removeDownloadLink = (index: number) => {
    setForm({
      ...form,
      downloadLinks: form.downloadLinks.filter((_: { name: string; url: string; type: string; parts?: number }, i: number) => i !== index),
    });
  };

  const updateDownloadLink = (index: number, field: string, value: string | number) => {
    const updated = form.downloadLinks.map((link: { name: string; url: string; type: string; parts?: number; partLinks?: { part: number; url: string }[] }, i: number) => {
      if (i !== index) return link;
      const updatedLink = { ...link, [field]: value };
      if (field === "type") {
        if (value === "repack") {
          updatedLink.parts = updatedLink.parts || 1;
          updatedLink.partLinks = updatedLink.partLinks || [];
        }
      }
      if (field === "parts" && link.type === "repack") {
        const numParts = Number(value) || 1;
        const existing = updatedLink.partLinks || [];
        updatedLink.partLinks = Array.from({ length: numParts }, (_, i) => ({
          part: i + 1,
          url: existing[i]?.url || "",
        }));
      }
      return updatedLink;
    });
    setForm({ ...form, downloadLinks: updated });
  };

  const updatePartLink = (linkIndex: number, partIndex: number, url: string) => {
    const updated = form.downloadLinks.map((link: { name: string; url: string; type: string; parts?: number; partLinks?: { part: number; url: string }[] }, i: number) => {
      if (i !== linkIndex) return link;
      const partLinks = [...(link.partLinks || [])];
      partLinks[partIndex] = { part: partIndex + 1, url };
      return { ...link, partLinks };
    });
    setForm({ ...form, downloadLinks: updated });
  };

  const handleFetchUrl = async (index: number) => {
    const url = form.downloadLinks[index]?.url;
    if (!url) return;
    setFetchingIndex(index);
    try {
      const res = await fetch(`/api/fetch-url?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      const updated = [...form.downloadLinks];
      const link = { ...updated[index] };
      if (data.title) link.name = link.name || data.title;
      if (data.domain) link.type = classifyDomain(url) as typeof link.type;
      link.archivedTitle = data.title || "";
      link.archivedDescription = data.description || "";
      updated[index] = link;
      setForm({ ...form, downloadLinks: updated });
    } catch {
      alert("Could not fetch metadata from this URL.");
    } finally {
      setFetchingIndex(null);
    }
  };

  const handleBulkPaste = () => {
    const lines = bulkUrls
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("http"));
    if (lines.length === 0) return;
    // Group multi-part archives (part1.rar … partN.rar on the same host) into
    // single repack entries; name each link by its host for quick scanning.
    const grouped = groupLinks(
      lines.map((url) => ({ url, name: domainLabel(url), type: classifyDomain(url) })),
      (u) => classifyDomain(u) as "official" | "repack" | "direct" | "cracked" | "torrent"
    );
    const existing = new Set(form.downloadLinks.map((l: { url: string }) => l.url.trim().toLowerCase()));
    const fresh = (grouped as typeof form.downloadLinks).filter((l: { url: string }) => !existing.has(l.url.trim().toLowerCase()));
    setForm({ ...form, downloadLinks: [...form.downloadLinks, ...fresh] });
    setBulkUrls("");
  };

  const urlCounts: Record<string, number> = {};
  for (const link of form.downloadLinks) {
    const u = link.url.trim().toLowerCase();
    if (u) urlCounts[u] = (urlCounts[u] || 0) + 1;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">
          {editId ? "Edit Software" : "Add Software"}
          {!editId && typeof window !== "undefined" && localStorage.getItem(DRAFT_KEY) && (
            <span className="ml-3 text-sm font-normal text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">Draft restored</span>
          )}
        </h1>
        <button
          onClick={() => router.back()}
          className="text-blue-300/60 hover:text-white text-sm"
        >
          ← Back
        </button>
      </div>

      <div className="max-w-3xl mb-6">
        <button
          type="button"
          onClick={() => setShowAutoFill(!showAutoFill)}
          className="w-full flex items-center justify-between bg-[#111827] rounded-xl border border-blue-900/30 p-4 hover:border-blue-500/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-white">Paste & Auto-Fill</h3>
              <p className="text-xs text-blue-300/50">Paste game details from Steam, Epic, GOG, etc. and auto-fill fields</p>
            </div>
          </div>
          <svg className={`w-5 h-5 text-blue-300/50 transition-transform ${showAutoFill ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showAutoFill && (
          <div className="mt-3 bg-[#111827] rounded-xl border border-blue-900/30 p-6">
            {!parsedData ? (
              <>
                <label className="block text-blue-300/60 text-sm mb-2">
                  Paste game/software details below
                </label>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={12}
                  placeholder={`Paste content from Steam, Epic Games, GOG, or any game page...\n\nExample:\nTitle: Cyberpunk 2077\nDescription: An open-world action-adventure RPG...\nMinimum: Windows 10, Intel Core i5-3570K, 8 GB RAM, GTX 780\nRecommended: Intel Core i7-4790, 16 GB RAM, GTX 1060\nFeatures: Open world, Story-rich, Cyberpunk setting`}
                  className="w-full bg-[#0c1222] text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500 border border-blue-900/30 resize-y text-sm font-mono"
                />
                <div className="flex gap-3 mt-3">
                  <button
                    type="button"
                    onClick={handleParse}
                    disabled={!pasteText.trim()}
                    className="bg-amber-600 hover:bg-amber-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Parse & Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPasteText(""); setParsedData(null); }}
                    className="bg-[#0c1222] hover:bg-blue-900/30 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </>
            ) : (
              <>
                <h4 className="text-sm font-semibold text-amber-400 mb-3">Parsed Results — Review & Apply</h4>
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                  {[
                    { label: "Title", value: parsedData.title, key: "title" },
                    { label: "Platform", value: parsedData.platform, key: "platform" },
                    { label: "Version", value: parsedData.version, key: "version" },
                    { label: "Size", value: parsedData.size, key: "size" },
                    { label: "Rating", value: String(parsedData.rating), key: "rating" },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center gap-3">
                      <span className="text-blue-300/60 text-xs w-24 flex-shrink-0">{item.label}</span>
                      <span className={`text-sm ${item.value ? "text-white" : "text-red-400/60"}`}>
                        {item.value || "(not detected)"}
                      </span>
                    </div>
                  ))}
                  {parsedData.description && (
                    <div>
                      <span className="text-blue-300/60 text-xs block mb-1">Description</span>
                      <p className="text-white text-sm bg-[#0c1222] rounded-lg p-3 max-h-32 overflow-y-auto">
                        {parsedData.description.slice(0, 500)}{parsedData.description.length > 500 ? "..." : ""}
                      </p>
                    </div>
                  )}
                  {parsedData.systemRequirements && (
                    <div>
                      <span className="text-blue-300/60 text-xs block mb-1">System Requirements</span>
                      <p className="text-white text-sm bg-[#0c1222] rounded-lg p-3 max-h-32 overflow-y-auto font-mono whitespace-pre-wrap">
                        {parsedData.systemRequirements.slice(0, 800)}{parsedData.systemRequirements.length > 800 ? "..." : ""}
                      </p>
                    </div>
                  )}
                  {parsedData.features.length > 0 && (
                    <div>
                      <span className="text-blue-300/60 text-xs block mb-1">Features ({parsedData.features.length})</span>
                      <ul className="text-white text-sm bg-[#0c1222] rounded-lg p-3 max-h-32 overflow-y-auto">
                        {parsedData.features.map((f, i) => (
                          <li key={i} className="py-0.5">• {f}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {parsedData.downloadLinks.length > 0 && (
                    <div>
                      <span className="text-blue-300/60 text-xs block mb-1">Download Links ({parsedData.downloadLinks.length})</span>
                      <div className="space-y-2 bg-[#0c1222] rounded-lg p-3 max-h-40 overflow-y-auto">
                        {parsedData.downloadLinks.map((link, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              link.type === "official" ? "bg-green-500/20 text-green-400" :
                              link.type === "repack" ? "bg-amber-500/20 text-amber-400" :
                              link.type === "cracked" ? "bg-red-500/20 text-red-400" :
                              "bg-blue-500/20 text-blue-400"
                            }`}>
                              {link.type}
                            </span>
                            <span className="text-white font-medium">{link.name}</span>
                            <span className="text-gray-500 truncate text-xs flex-1">{link.url}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={handleApplyParsed}
                    className="bg-green-600 hover:bg-green-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Apply to Form
                  </button>
                  <button
                    type="button"
                    onClick={() => setParsedData(null)}
                    className="bg-[#0c1222] hover:bg-blue-900/30 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Re-Paste
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="max-w-3xl mb-6">
        <button
          type="button"
          onClick={() => setShowUrlFetch(!showUrlFetch)}
          className="w-full flex items-center justify-between bg-[#111827] rounded-xl border border-blue-900/30 p-4 hover:border-blue-500/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-white">Fetch from URL</h3>
              <p className="text-xs text-blue-300/50">Pull title, description, images, and download links from a page (FitGirl, re-packs, etc.)</p>
            </div>
          </div>
          <svg className={`w-5 h-5 text-blue-300/50 transition-transform ${showUrlFetch ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showUrlFetch && (
          <div className="mt-3 bg-[#111827] rounded-xl border border-blue-900/30 p-6">
            {!urlFetchData ? (
              <>
                <label className="block text-blue-300/60 text-sm mb-2">Detail page URL</label>
                <div className="flex gap-3">
                  <input
                    type="url"
                    value={urlFetchInput}
                    onChange={(e) => setUrlFetchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleFetchFromUrl()}
                    placeholder="https://fitgirl-repacks.site/game/"
                    className="flex-1 bg-[#0c1222] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30"
                  />
                  <button
                    type="button"
                    onClick={handleFetchFromUrl}
                    disabled={!urlFetchInput.trim() || urlFetchLoading}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 flex items-center gap-2"
                  >
                    {urlFetchLoading ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    ) : (
                      <span>Fetch</span>
                    )}
                  </button>
                </div>
                {urlFetchError && <p className="text-red-400 text-sm mt-3">{urlFetchError}</p>}
              </>
            ) : (
              <>
                <h4 className="text-sm font-semibold text-blue-400 mb-3">Fetched — Review & Apply</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-blue-300/60 text-xs w-24 flex-shrink-0">Title</span>
                    <span className="text-white text-sm truncate">{urlFetchData.title || "(not detected)"}</span>
                  </div>
                  {urlFetchData.password && (
                    <div className="flex items-center gap-3">
                      <span className="text-blue-300/60 text-xs w-24 flex-shrink-0">Password</span>
                      <span className="text-white text-sm font-mono">{urlFetchData.password}</span>
                    </div>
                  )}
                  {urlFetchData.image && (
                    <div className="flex items-center gap-3">
                      <span className="text-blue-300/60 text-xs w-24 flex-shrink-0">Image</span>
                      <img src={urlFetchData.image} alt="preview" className="h-10 rounded object-cover" />
                    </div>
                  )}
                  {urlFetchData.description && (
                    <div>
                      <span className="text-blue-300/60 text-xs block mb-1">Description</span>
                      <p className="text-white text-sm bg-[#0c1222] rounded-lg p-3 max-h-32 overflow-y-auto">
                        {urlFetchData.description.slice(0, 500)}{urlFetchData.description.length > 500 ? "..." : ""}
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-blue-300/60 text-xs block mb-1">Download Links ({urlFetchData.links.length})</span>
                    <div className="space-y-2 bg-[#0c1222] rounded-lg p-3 max-h-40 overflow-y-auto">
                      {urlFetchData.links.length === 0 && <p className="text-blue-300/40 text-xs">None detected — apply anyway and add links manually.</p>}
                      {urlFetchData.links.map((link, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            link.type === "official" ? "bg-green-500/20 text-green-400" :
                            link.type === "repack" ? "bg-amber-500/20 text-amber-400" :
                            link.type === "torrent" ? "bg-purple-500/20 text-purple-400" :
                            link.type === "cracked" ? "bg-red-500/20 text-red-400" :
                            "bg-blue-500/20 text-blue-400"
                          }`}>
                            {link.type}
                          </span>
                          <span className="text-white font-medium">{link.name}</span>
                          <span className="text-gray-500 truncate text-xs flex-1">{link.url}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={handleApplyUrlFetch}
                    className="bg-green-600 hover:bg-green-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Apply to Form
                  </button>
                  <button
                    type="button"
                    onClick={() => setUrlFetchData(null)}
                    className="bg-[#0c1222] hover:bg-blue-900/30 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Re-Fetch
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl">
        <div className="bg-[#111827] rounded-xl border border-blue-900/30 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Basic Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-blue-300/60 text-sm mb-2">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full bg-[#0c1222] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30"
                required
              />
            </div>

            <div>
              <label className="block text-blue-300/60 text-sm mb-2">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={8}
                className="w-full bg-[#0c1222] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30 resize-y"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-blue-300/60 text-sm mb-2">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full bg-[#0c1222] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-blue-300/60 text-sm mb-2">
                  Subcategory
                </label>
                <select
                  value={form.subcategory}
                  onChange={(e) =>
                    setForm({ ...form, subcategory: e.target.value })
                  }
                  className="w-full bg-[#0c1222] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30"
                >
                  <option value="">Select subcategory</option>
                  {selectedCategory?.subcategories.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-blue-300/60 text-sm mb-2">
                  Platform
                </label>
                <select
                  value={form.platform}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      platform: e.target.value as typeof form.platform,
                    })
                  }
                  className="w-full bg-[#0c1222] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30"
                >
                  <option value="windows">Windows</option>
                  <option value="mac">Mac</option>
                  <option value="android">Android</option>
                  <option value="ios">iOS</option>
                  <option value="cross-platform">Cross-Platform</option>
                </select>
              </div>

              <div>
                <label className="block text-blue-300/60 text-sm mb-2">
                  Version
                </label>
                <input
                  type="text"
                  value={form.version}
                  onChange={(e) =>
                    setForm({ ...form, version: e.target.value })
                  }
                  placeholder="e.g. 1.0.0 (optional)"
                  className="w-full bg-[#0c1222] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-blue-300/60 text-sm mb-2">Size</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.size}
                    onChange={(e) => setForm({ ...form, size: e.target.value })}
                    placeholder="e.g. 1.5"
                    className="flex-1 bg-[#0c1222] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30"
                    required
                  />
                  <select
                    value={form.size.includes("MB") ? "MB" : form.size.includes("TB") ? "TB" : "GB"}
                    onChange={(e) => {
                      const num = form.size.replace(/[^\d.]/g, "");
                      setForm({ ...form, size: num ? `${num} ${e.target.value}` : "" });
                    }}
                    className="bg-[#0c1222] text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30 text-sm"
                  >
                    <option value="GB">GB</option>
                    <option value="MB">MB</option>
                    <option value="TB">TB</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-blue-300/60 text-sm mb-2">
                  Rating
                </label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={form.rating}
                  onChange={(e) =>
                    setForm({ ...form, rating: parseFloat(e.target.value) })
                  }
                  className="w-full bg-[#0c1222] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-blue-300/60 text-sm mb-2">
                Banner Image (616x352)
              </label>
              <div className="flex gap-3">
                <label className="flex-1 flex items-center justify-center gap-2 bg-[#0c1222] border-2 border-dashed border-blue-900/30 rounded-lg px-4 py-3 cursor-pointer hover:border-blue-500 transition-colors">
                  <svg className="w-5 h-5 text-blue-300/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-blue-300/60 text-sm">Upload from device</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload("icon", file);
                    }}
                  />
                </label>
                <input
                  type="text"
                  value={form.icon.startsWith("data:") ? "" : form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  placeholder="Or paste image URL"
                  className="flex-1 bg-[#0c1222] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30 text-sm"
                />
              </div>
              {form.icon && (
                <div className="mt-2 w-full h-32 rounded-lg overflow-hidden bg-[#0c1222] border border-blue-900/30 relative group">
                  <img src={form.icon} alt="Banner preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, icon: "" })}
                    className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-blue-300/60 text-sm mb-2">
                Poster Image (600x900)
              </label>
              <div className="flex gap-3">
                <label className="flex items-center justify-center gap-2 bg-[#0c1222] border-2 border-dashed border-blue-900/30 rounded-lg px-4 py-3 cursor-pointer hover:border-blue-500 transition-colors">
                  <svg className="w-5 h-5 text-blue-300/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-blue-300/60 text-sm">Upload</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload("poster", file);
                    }}
                  />
                </label>
                <input
                  type="text"
                  value={form.poster.startsWith("data:") ? "" : form.poster}
                  onChange={(e) => setForm({ ...form, poster: e.target.value })}
                  placeholder="Or paste image URL"
                  className="flex-1 bg-[#0c1222] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30 text-sm"
                />
              </div>
              {form.poster && (
                <div className="mt-2 w-24 h-36 rounded-lg overflow-hidden bg-[#0c1222] border border-blue-900/30 relative group">
                  <img src={form.poster} alt="Poster preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, poster: "" })}
                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-[#111827] rounded-xl border border-blue-900/30 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Screenshots</h2>
          <div className="space-y-3">
            {(form.screenshots || []).map((url: string, idx: number) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => {
                    const updated = [...form.screenshots];
                    updated[idx] = e.target.value;
                    setForm({ ...form, screenshots: updated });
                  }}
                  placeholder="https://...screenshot-url"
                  className="flex-1 bg-[#0c1222] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30 text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    const updated = form.screenshots.filter((_: string, i: number) => i !== idx);
                    setForm({ ...form, screenshots: updated });
                  }}
                  className="text-red-400 hover:text-red-300 px-3"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setForm({ ...form, screenshots: [...(form.screenshots || []), ""] })}
            className="mt-3 text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Screenshot
          </button>
        </div>

        <div className="bg-[#111827] rounded-xl border border-blue-900/30 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Download Links
            </h2>
            <button
              type="button"
              onClick={addDownloadLink}
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              + Add Link
            </button>
          </div>

          {/* Archive Password */}
          <div className="mb-4 p-4 bg-[#0c1222] rounded-lg border border-blue-900/20">
            <label className="block text-blue-300/60 text-xs mb-2">
              Archive / Extraction Password <span className="text-blue-300/30">(shown to visitors for LightDL, repacks, etc.)</span>
            </label>
            <input
              type="text"
              value={form.password || ""}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="e.g. www.lightdload.xyz  or  12345"
              className="w-full bg-[#0c1222] text-white text-sm rounded-lg px-4 py-2 border border-blue-900/30 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-blue-300/30"
            />
          </div>

          {/* Bulk Paste */}
          <div className="mb-4 p-4 bg-[#0c1222] rounded-lg border border-blue-900/20">
            <label className="block text-blue-300/60 text-xs mb-2">Bulk Paste — one URL per line</label>
            <textarea
              value={bulkUrls}
              onChange={(e) => setBulkUrls(e.target.value)}
              placeholder={"https://fitgirl-repacks.example.com/game\nhttps://mega.nz/file/abc123\nhttps://store.steampowered.com/app/123"}
              rows={3}
              className="w-full bg-[#0c1222] text-white text-sm rounded-lg px-4 py-2 border border-blue-900/30 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-blue-300/30"
            />
            <button
              type="button"
              onClick={handleBulkPaste}
              disabled={!bulkUrls.trim()}
              className="mt-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              Parse Links ({bulkUrls.split("\n").filter((l) => l.trim().startsWith("http")).length} detected)
            </button>
          </div>

          <div className="space-y-3">
            {form.downloadLinks.map((link: any, index: number) => (
              <div key={index} className="border border-blue-900/20 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  {/* Health dot */}
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    link.status === "alive" ? "bg-green-500" :
                    link.status === "dead" ? "bg-red-500" :
                    "bg-yellow-500"
                  }`} title={link.status || "unknown"} />
                  {(link as any).hoster && <span className="text-[10px] px-2 py-0.5 rounded bg-purple-900/30 text-purple-300 font-bold shrink-0">{(link as any).hoster}{(link as any).part ? ` P${(link as any).part}${(link as any).partTotal ? `/${(link as any).partTotal}` : ""}` : ""}</span>}

                  <input
                    type="text"
                    value={link.name}
                    onChange={(e) => updateDownloadLink(index, "name", e.target.value)}
                    placeholder="Link name"
                    className="w-32 bg-[#0c1222] text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30 text-sm"
                  />
                  <input
                    type="url"
                    value={link.url}
                    onChange={(e) => updateDownloadLink(index, "url", e.target.value)}
                    onBlur={() => autoClassifyLink(index)}
                    placeholder={link.type === "torrent" ? "magnet:?xt=urn:btih:..." : "https://..."}
                    className="flex-1 bg-[#0c1222] text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => handleFetchUrl(index)}
                    disabled={!link.url || fetchingIndex === index}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white p-2 rounded-lg text-sm transition-colors flex-shrink-0"
                    title="Fetch metadata from URL"
                  >
                    {fetchingIndex === index ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    )}
                  </button>
                  <select
                    value={link.type}
                    onChange={(e) => updateDownloadLink(index, "type", e.target.value)}
                    className="bg-[#0c1222] text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30 text-sm"
                  >
                    <option value="official">Official Store</option>
                    <option value="repack">Repack</option>
                    <option value="direct">Direct</option>
                    <option value="cracked">Cracked</option>
                    <option value="torrent">Torrent</option>
                  </select>
                  {form.downloadLinks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDownloadLink(index)}
                      className="text-red-400 hover:text-red-300 p-2"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Duplicate URL warning */}
                {link.url.trim() && urlCounts[link.url.trim().toLowerCase()] > 1 && (
                  <div className="mt-2 flex items-center gap-2 text-amber-400/90 text-xs">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span>Duplicate URL used {urlCounts[link.url.trim().toLowerCase()]} times — visitors may see the same link twice.</span>
                  </div>
                )}

                {/* Repack per-part URLs */}
                {link.type === "repack" && (
                  <div className="mt-3 pl-4 border-l-2 border-amber-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-blue-300/60 text-xs whitespace-nowrap">Parts:</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={link.parts || 1}
                        onChange={(e) => updateDownloadLink(index, "parts", parseInt(e.target.value) || 1)}
                        className="w-16 bg-[#0c1222] text-white rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30 text-sm text-center"
                      />
                      <span className="text-blue-300/40 text-xs">Enter a separate URL for each part below (or leave empty to use main URL)</span>
                    </div>
                    <div className="space-y-1.5">
                      {Array.from({ length: link.parts || 1 }, (_, i) => i + 1).map((partNum) => (
                        <div key={partNum} className="flex items-center gap-2">
                          <span className="text-amber-400/60 text-xs w-14 flex-shrink-0">Part {partNum}</span>
                          <input
                            type="url"
                            value={link.partLinks?.[partNum - 1]?.url || ""}
                            onChange={(e) => updatePartLink(index, partNum - 1, e.target.value)}
                            placeholder={link.url || "https://..."}
                            className="flex-1 bg-[#0c1222] text-white rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30 text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
           </div>
         </div>

        <div className="bg-[#111827] rounded-xl border border-blue-900/30 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            System Requirements
          </h2>
          <textarea
            value={form.systemRequirements}
            onChange={(e) =>
              setForm({ ...form, systemRequirements: e.target.value })
            }
            rows={6}
            className="w-full bg-[#0c1222] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30 resize-y"
            required
          />
        </div>

        <div className="bg-[#111827] rounded-xl border border-blue-900/30 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Features (one per line)
          </h2>
          <textarea
            value={form.features}
            onChange={(e) => setForm({ ...form, features: e.target.value })}
            rows={8}
            className="w-full bg-[#0c1222] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30 resize-y"
          />
        </div>

        <div className="bg-[#111827] rounded-xl border border-blue-900/30 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Video (optional)
          </h2>
          <div>
            <label className="block text-blue-300/60 text-sm mb-2">
              YouTube Video URL
            </label>
            <input
              type="url"
              value={form.videoUrl}
              onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full bg-[#0c1222] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30 text-sm"
            />
            <p className="text-blue-300/40 text-xs mt-2">
              Paste a YouTube URL. A gameplay video embed will appear on the detail page.
            </p>
            {form.videoUrl && (
              <div className="mt-3 rounded-lg overflow-hidden border border-blue-900/30 bg-[#0c1222]" style={{ paddingBottom: "56.25%", position: "relative" }}>
                <iframe
                  src={`https://www.youtube.com/embed/${getYoutubeId(form.videoUrl) || ""}`}
                  title="Video preview"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              </div>
            )}
          </div>
        </div>

        {saveError && (
          <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-3">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span>{saveError}</span>
          </div>
        )}

        <div className="flex gap-4 items-center">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            {editId ? "Update Software" : "Add Software"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="bg-[#0c1222] hover:bg-blue-900/30 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          {!editId && typeof window !== "undefined" && localStorage.getItem(DRAFT_KEY) && (
            <button
              type="button"
              onClick={() => {
                if (confirm("Discard saved draft?")) {
                  clearDraft();
                  window.location.reload();
                }
              }}
              className="text-red-400 hover:text-red-300 text-sm ml-2"
            >
              Discard Draft
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default function EditSoftware() {
  return (
    <Suspense fallback={<div className="text-blue-300/60">Loading...</div>}>
      <EditSoftwareForm />
    </Suspense>
  );
}
