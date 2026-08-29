"use client";

import { useRef, useState } from "react";
import { categories, getSoftwareList, type Software } from "@/lib/data";
import { parseListingPage, parseDetailPage, isGenericLinkName, extractNameFromUrl, type ParsedEntry as ParsedEntryType, type ParsedDetail } from "@/lib/importParser";

// Verified reachable sources that parse cleanly with the current import parser.
// oceanofgames / downloadpirate are excluded: their detail links are JS-rendered
// or category-structured and yield no download links.
const SOURCE_PRESETS: { id: string; label: string; url: string; note: string }[] = [
  { id: "repack-games", label: "Repack-games · Games", url: "https://repack-games.com/", note: "Direct file-host links (filekeeper, datanodes, gofile, buzzheavier) — works with site or page mode." },
  { id: "skidrowreloaded", label: "SkidrowReloaded · Games", url: "https://www.skidrowreloaded.com/", note: "Game repacks with direct links (1fichier, gofile, multiup, buzzheavier)." },
];

const pasteHtmlSamples = `Paste a listing HTML here, e.g.:

  <article>
    <h2><a href="https://lightdload.xyz/movies/interstellar-2014-movie/">Interstellar (2014) Movie</a></h2>
    <div class="thumbnail"><img src="https://lightdload.xyz/wp-content/.../poster.jpg"></div>
  </article>

Or a detail page HTML (single item) — the parser will pick up the title,
banner image, description, download links and archive password.`;

interface ParsedEntry {
  title: string;
  url: string;
}

interface ParsedLink {
  name: string;
  url: string;
  type: "official" | "repack" | "direct" | "cracked" | "torrent";
  part?: number;
  partTotal?: number;
}

interface DetailData {
  title: string;
  image: string;
  description: string;
  screenshots: string[];
  links: ParsedLink[];
  password?: string;
  contentType?: "game" | "software" | "movie" | "korean" | "tutorial";
}

interface ImportItem {
  entry: ParsedEntry;
  detail: DetailData | null;
  loading: boolean;
  error?: string;
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function guessCategory(title: string, contentType?: DetailData["contentType"], entryUrl?: string): string {
  if (contentType === "movie") return "movies";
  if (contentType === "korean") return "korean";
  if (contentType === "tutorial") return "tutorials";
  const t = title.toLowerCase();
  if (/game|repack|torrent|edition|\bpc\b/i.test(t)) return "pc-games";
  if (/\bandroid\b|apk/.test(t)) return "android";
  if (/\bmac\b|macos/.test(t)) return "mac";
  return "windows";
}

function guessContentTypeLabel(url: string, detail: { contentType?: string }): string {
  if (detail.contentType === "movie") return "Movie";
  if (detail.contentType === "korean") return "Korean series";
  if (detail.contentType === "tutorial") return "Tutorial / Udemy course";
  if (detail.contentType === "game") return "Game";
  const t = (url + " " + (detail.contentType || "")).toLowerCase();
  if (t.includes("movie") || t.includes("film") || t.includes("1080p") || t.includes("720p")) return "Movie";
  if (t.includes("korean") || t.includes("kdrama")) return "Korean series";
  if (t.includes("udemy") || t.includes("tutorial") || t.includes("course")) return "Tutorial / Udemy course";
  if (t.includes("game")) return "Game";
  return "Software";
}

function isLikelyNonGame(title: string): boolean {
  const t = title.toLowerCase();
  if (/\b(ebook|ebooks|book|books|pdf|manual|guide|course|tutorial)\b/.test(t)) return true;
  if (/\b(studio|editor|browser|antivirus|firewall|driver|office|suite|codec|utility|toolkit|toolbox|manager)\b/.test(t)) return true;
  return false;
}

function isBoilerplateTitle(title: string): boolean {
  const t = (title || "").trim().toLowerCase();
  if (!t) return false;
  const phrases = [
    "contact", "about us", "about", "privacy", "terms", "terms of service",
    "faq", "help", "how to", "how-to", "support", "home", "homepage", "main page",
    "legal", "disclaimer", "cookie", "dmca", "take down", "request", "blog",
    "forum", "donate", "advertise", "login", "register", "sign in", "sign up",
    "sitemap", "newsletter", "categories", "popular", "recent", "search results",
    "not found", "404", "error", "page", "menu", "navigation",
  ];
  return phrases.some((p) => t.startsWith(p) || t.includes(p));
}

function isSentenceLike(title: string): boolean {
  const t = (title || "").trim();
  if (!t) return false;
  const words = t.split(/\s+/).length;
  const lower = t.toLowerCase();
  const sentencey = /\b(the|and|with|for|download|free|full|crack|version|watch|play|game)\b/.test(lower);
  return words > 8 && words <= 60 && sentencey;
}

function linkHealth(links: { url?: string; status?: string }[]): number {
  const usable = links.filter((l) => l.url && l.url.trim());
  if (usable.length === 0) return 0;
  let score = usable.length * 0.5;
  for (const l of usable) {
    if (l.status === "alive") score += 2;
    else if (l.status === "dead") score -= 2;
    else score += 1;
  }
  return score;
}

export default function AdminImport() {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"site" | "page" | "paste">("site");
  const [source, setSource] = useState("");
  const [pasteHtml, setPasteHtml] = useState("");
  const [entries, setEntries] = useState<ParsedEntry[]>([]);
  const [items, setItems] = useState<ImportItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [imported, setImported] = useState(0);
  const [updated, setUpdated] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("flat");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const cancelledRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const [nameFilter, setNameFilter] = useState("");
  const [nonGamePrompt, setNonGamePrompt] = useState<number[] | null>(null);
  const [sentencePrompt, setSentencePrompt] = useState<number[] | null>(null);
  const [noLinksPrompt, setNoLinksPrompt] = useState<{ indices: number[]; action: "import" | "skip" | null } | null>(null);
  const [nameSuggestionPrompt, setNameSuggestionPrompt] = useState<{ itemIndex: number; links: { index: number; currentName: string; suggestedName: string }[]; resolved: Set<number> } | null>(null);

  const fetchList = async () => {
    setError("");
    setLoadingList(true);
    setItems([]);
    setSelected(new Set());
    setImported(0);
    setUpdated(0);
    setSkipped(0);
    setProgress({ done: 0, total: 0 });
    try {
      if (mode === "paste") {
        if (!pasteHtml.trim()) {
          setError("Paste the HTML source of a listing page or detail page first.");
          return;
        }
        const sourceHint = url.trim() || "https://lightdload.xyz/";
        const lower = pasteHtml.toLowerCase();
        const isDetail = /<\s*(?:h1|h2)[^>]*>[\s\S]{0,600}?(download|password|free download)/i.test(pasteHtml) || /class=["'][^"']*(?:post-content|entry-content|single|post)[^"']*["']/.test(lower);
        if (isDetail) {
          const parsed: ParsedDetail = parseDetailPage(pasteHtml, sourceHint);
          const entry = { title: parsed.title || "Untitled", url: sourceHint };
          setSource(guessContentTypeLabel(sourceHint, parsed) + " (pasted detail page)");
          setEntries([entry]);
          setItems([{ entry, detail: { ...parsed, contentType: parsed.contentType }, loading: false }]);
        } else {
          const entries = parseListingPage(pasteHtml, sourceHint);
          if (entries.length === 0) {
            setError("No entries found in the pasted HTML. Make sure you copied the full page source (Ctrl+A then Ctrl+C).");
            return;
          }
          setSource(`${new URL(sourceHint).hostname} (pasted listing, ${entries.length} entries)`);
          setEntries(entries);
          const newItems: ImportItem[] = entries.map((e: ParsedEntry) => ({ entry: e, detail: null, loading: false }));
          setItems(newItems);
          const sentencey: number[] = [];
          newItems.forEach((it, i) => {
            if (isSentenceLike(it.entry.title) || isBoilerplateTitle(it.entry.title)) sentencey.push(i);
          });
          if (sentencey.length > 0) {
            setSentencePrompt(sentencey);
          }
        }
        return;
      }
      if (!url.trim()) {
        setError("Enter a URL first.");
        return;
      }
      const endpoint = mode === "site" ? "/api/import/site" : "/api/import/list";
      const res = await fetch(`${endpoint}?url=${encodeURIComponent(url.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        if (data.blocked) {
          setError(
            (data.error || "This site is protected and blocked automated access.") +
            " → Switch to 'Paste HTML' mode above."
          );
        } else {
          setError(data.error || "Failed to fetch the page. Check the URL and try again.");
        }
        return;
      }
      setSource(data.source);
      const newItems: ImportItem[] = data.entries.map((e: ParsedEntry) => ({ entry: e, detail: null, loading: false }));
      setEntries(data.entries);
      setItems(newItems);
      const sentencey: number[] = [];
      newItems.forEach((it, i) => {
        if (isSentenceLike(it.entry.title) || isBoilerplateTitle(it.entry.title)) sentencey.push(i);
      });
      if (sentencey.length > 0) {
        setSentencePrompt(sentencey);
      }
    } catch {
      setError("Could not reach the import API.");
    } finally {
      setLoadingList(false);
    }
  };

  const toggleAll = (checked: boolean) => {
    if (!checked) {
      setSelected(new Set<number>());
      return;
    }
    const nonGames: number[] = [];
    items.forEach((it, i) => {
      if (isLikelyNonGame(it.entry.title)) nonGames.push(i);
    });
    if (nonGames.length > 0) {
      setNonGamePrompt(nonGames);
      return;
    }
    const next = new Set<number>();
    items.forEach((_, i) => next.add(i));
    setSelected(next);
  };

  const confirmKeepNonGames = () => {
    const next = new Set<number>();
    items.forEach((_, i) => next.add(i));
    setSelected(next);
    setNonGamePrompt(null);
  };

  const confirmRemoveNonGames = () => {
    const next = new Set<number>();
    items.forEach((_, i) => {
      if (!nonGamePrompt?.includes(i)) next.add(i);
    });
    setSelected(next);
    setNonGamePrompt(null);
  };

  const confirmRemoveSentences = () => {
    const keep: ImportItem[] = [];
    items.forEach((it, i) => {
      if (!sentencePrompt?.includes(i)) keep.push(it);
    });
    setItems(keep);
    setEntries(keep.map((it) => it.entry));
    setSelected(new Set<number>());
    setSentencePrompt(null);
  };

  const toggleOne = (index: number) => {
    const next = new Set(selected);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelected(next);
  };

  const fetchDetails = async () => {
    if (selected.size === 0) return;
    setError("");
    setLoadingDetails(true);
    cancelledRef.current = false;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const queue = items.map((it, i) => ({ it, i })).filter(({ i }) => selected.has(i));
    setProgress({ done: 0, total: queue.length });
    for (let q = 0; q < queue.length; q++) {
      if (cancelledRef.current) break;
      const { it, i } = queue[q];
      setItems((prev) => {
        const copy = [...prev];
        copy[i] = { ...copy[i], loading: true, error: undefined };
        return copy;
      });
      if (it.detail) {
        if (cancelledRef.current) break;
        setProgress({ done: q + 1, total: queue.length });
        continue;
      }
      try {
        const res = await fetch(`/api/import/detail?url=${encodeURIComponent(it.entry.url)}`, { signal: controller.signal });
        const data = await res.json();
        if (cancelledRef.current) { setLoadingDetails(false); return; }
        setItems((prev) => {
          const copy = [...prev];
          if (res.ok) {
            copy[i] = { ...copy[i], detail: data, loading: false };
          } else {
            const errMsg = data.blocked
              ? "Blocked (Cloudflare) — use Paste HTML mode"
              : data.error || "Failed to fetch";
            copy[i] = { ...copy[i], error: errMsg, loading: false };
          }
          return copy;
        });
      } catch (err) {
        if (cancelledRef.current || (err instanceof DOMException && err.name === "AbortError")) {
          setLoadingDetails(false);
          return;
        }
        setItems((prev) => {
          const copy = [...prev];
          copy[i] = { ...copy[i], error: "Request failed", loading: false };
          return copy;
        });
      }
      setProgress({ done: q + 1, total: queue.length });
    }
    abortRef.current = null;
    setLoadingDetails(false);
    // Check for generic link names and suggest better ones
    checkAndPromptNameSuggestions();
  };

  const checkAndPromptNameSuggestions = () => {
    for (let i = 0; i < items.length; i++) {
      if (!selected.has(i)) continue;
      const it = items[i];
      if (!it.detail || !it.detail.links) continue;
      
      const suggestions = it.detail.links
        .map((link, linkIndex) => {
          const currentName = link.name.toLowerCase().trim();
          if (!isGenericLinkName(currentName)) return null;
          
          // Use shared extractNameFromUrl for consistent name extraction
          const suggested = extractNameFromUrl(link.url);
          
          if (suggested && suggested.toLowerCase() !== link.name.toLowerCase()) {
            return { index: linkIndex, currentName: link.name, suggestedName: suggested };
          }
          return null;
        })
        .filter(Boolean) as { index: number; currentName: string; suggestedName: string }[];
      
      if (suggestions.length > 0) {
        setNameSuggestionPrompt({ itemIndex: i, links: suggestions, resolved: new Set() });
        return; // Show one at a time
      }
    }
  };

  const resolveNameSuggestion = (action: "use-suggested" | "keep-current" | "skip", linkIndices?: number[]) => {
    if (!nameSuggestionPrompt) return;
    
    const { itemIndex, links, resolved } = nameSuggestionPrompt;
    const newResolved = new Set(resolved);
    
    if (action === "use-suggested" && linkIndices) {
      // Apply suggested names for selected links
      setItems((prev) => {
        const copy = [...prev];
        const detail = copy[itemIndex].detail;
        if (detail) {
          const newLinks = [...detail.links];
          linkIndices.forEach(idx => {
            const suggestion = links.find(l => l.index === idx);
            if (suggestion) {
              newLinks[idx] = { ...newLinks[idx], name: suggestion.suggestedName };
            }
          });
          copy[itemIndex] = { ...copy[itemIndex], detail: { ...detail, links: newLinks } };
        }
        return copy;
      });
    } else if (action === "keep-current" && linkIndices) {
      // Mark as resolved without changing
      linkIndices.forEach(idx => newResolved.add(idx));
    } else if (action === "skip") {
      // Resolve all remaining
      links.forEach(l => newResolved.add(l.index));
    }
    
    if (newResolved.size >= links.length) {
      setNameSuggestionPrompt(null);
    } else {
      setNameSuggestionPrompt({ ...nameSuggestionPrompt, resolved: newResolved });
    }
  };

  const updatePassword = (itemIndex: number, value: string) => {
    setItems((prev) => {
      const copy = [...prev];
      const detail = copy[itemIndex].detail;
      if (detail) {
        copy[itemIndex] = { ...copy[itemIndex], detail: { ...detail, password: value } };
      }
      return copy;
    });
  };

  const updateLinkField = (
    itemIndex: number,
    linkIndex: number,
    field: "name" | "url" | "type",
    value: string
  ) => {
    setItems((prev) => {
      const copy = [...prev];
      const detail = copy[itemIndex].detail;
      if (detail) {
        const links = [...detail.links];
        links[linkIndex] = { ...links[linkIndex], [field]: value } as ParsedLink;
        copy[itemIndex] = { ...copy[itemIndex], detail: { ...detail, links } };
      }
      return copy;
    });
  };

  const removeLink = (itemIndex: number, linkIndex: number) => {
    setItems((prev) => {
      const copy = [...prev];
      const detail = copy[itemIndex].detail;
      if (detail) {
        const links = detail.links.filter((_, i) => i !== linkIndex);
        copy[itemIndex] = { ...copy[itemIndex], detail: { ...detail, links } };
      }
      return copy;
    });
  };

  const addLink = (itemIndex: number) => {
    setItems((prev) => {
      const copy = [...prev];
      const detail = copy[itemIndex].detail;
      if (detail) {
        const links = [...detail.links, { name: "Download", url: "", type: "direct" as const }];
        copy[itemIndex] = { ...copy[itemIndex], detail: { ...detail, links } };
      }
      return copy;
    });
  };

  const doImport = () => {
    try {
      // Check if any selected items have no download links
      const noLinkIndices = items
        .map((it, i) => ({ it, i }))
        .filter(({ i, it }) => selected.has(i) && (!it.detail || !it.detail.links || it.detail.links.filter(l => l.url && l.url.trim()).length === 0))
        .map(({ i }) => i);

      if (noLinkIndices.length > 0) {
        setNoLinksPrompt({ indices: noLinkIndices, action: null });
        return;
      }

      performImport();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    }
  };

  const confirmNoLinksAction = (action: "import" | "skip") => {
    if (!noLinksPrompt) return;
    if (action === "skip") {
      const nextSelected = new Set(selected);
      noLinksPrompt.indices.forEach(i => nextSelected.delete(i));
      setSelected(nextSelected);
    }
    setNoLinksPrompt(null);
    performImport();
  };

  const performImport = async () => {
      try {
        const existing = await getSoftwareList();
      const byTitle = new Map<string, number>();
      existing.forEach((s, idx) => {
        const key = s.title.toLowerCase().trim();
        if (!byTitle.has(key)) byTitle.set(key, idx);
      });

      const added: Software[] = [];
      let newCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < items.length; i++) {
        if (!selected.has(i)) continue;
        const it = items[i];
        const title = (it.detail?.title || it.entry.title || "").trim();
        if (!title) {
          skippedCount++;
          continue;
        }
        const titleKey = title.toLowerCase().trim();
        const rawLinks = (it.detail?.links || []).filter((l) => l.url && l.url.trim());
        const links = (() => {
          const out: { name: string; url: string; type: "official" | "repack" | "direct" | "cracked" | "torrent"; parts?: number; partLinks?: { part: number; url: string }[] }[] = [];
          const groups = new Map<string, { url: string; part: number; partTotal?: number; name: string; type: string }[]>();
          for (const l of rawLinks) {
            if (l.part) {
              const host = (() => { try { return new URL(l.url).hostname; } catch { return l.url; } })();
              const key = `${l.type || "direct"}|${host}`;
              const arr = groups.get(key) || [];
              arr.push({ url: l.url, part: l.part, partTotal: l.partTotal, name: l.name || "Download", type: l.type || "direct" });
              groups.set(key, arr);
            }
          }
          for (const [, arr] of groups) {
            const sorted = arr.sort((a, b) => a.part - b.part);
            const first = sorted[0];
            out.push({
              name: first.name.replace(/\s*\(Part.*$/, ""),
              url: first.url,
              type: (first.type as "official" | "repack" | "direct" | "cracked" | "torrent") || "direct",
              parts: first.partTotal || sorted.length,
              partLinks: sorted.map((s) => ({ part: s.part, url: s.url })),
            });
          }
          for (const l of rawLinks) {
            if (l.part) continue;
            out.push({
              name: l.name || "Download",
              url: l.url,
              type: l.type || ("direct" as const),
            });
          }
          return out;
        })();

      const incomingHealth = linkHealth(links);
      const existingIdx = byTitle.get(titleKey);

      if (existingIdx !== undefined && existingIdx >= existing.length) {
        skippedCount++;
        continue;
      }

      if (existingIdx !== undefined) {
        const cur = existing[existingIdx];
        const curHealth = linkHealth(cur.downloadLinks || []);
        if (incomingHealth > curHealth) {
          const mergedLinks = [
            ...(cur.downloadLinks || []).filter((l) => l.status === "alive" || l.status === "unknown"),
            ...links,
          ];
          const seen = new Set<string>();
          const dedup = mergedLinks.filter((l) => {
            const k = (l.url || "").trim().toLowerCase();
            if (!k || seen.has(k)) return false;
            seen.add(k);
            return true;
          });
          existing[existingIdx] = {
            ...cur,
            title: cur.title || title,
            description: it.detail?.description || cur.description,
            icon: it.detail?.image || cur.icon,
            poster: it.detail?.image || cur.poster,
            screenshots: (it.detail?.screenshots?.length ? it.detail.screenshots : cur.screenshots) || [],
            password: it.detail?.password || cur.password,
            downloadLinks: dedup,
            updatedAt: new Date().toISOString(),
          };
          updatedCount++;
        } else {
          skippedCount++;
        }
        continue;
      }

      byTitle.set(titleKey, existing.length + added.length);
      added.push({
        id: slugify(title) || `imported-${Date.now()}-${i}`,
        title,
        description: it.detail?.description || "",
        category: guessCategory(title, it.detail?.contentType),
        subcategory: "",
        platform: "windows",
        version: "",
        size: "",
        downloads: 0,
        rating: 4.5,
        icon: it.detail?.image || "https://placehold.co/616x352/3b82f6/ffffff?text=Banner",
        poster: it.detail?.image || "https://placehold.co/600x900/3b82f6/ffffff?text=Poster",
        screenshots: it.detail?.screenshots?.length ? it.detail.screenshots : it.detail?.image ? [it.detail.image] : [],
        password: it.detail?.password || "",
        downloadLinks: links,
        systemRequirements: "",
        features: [],
        createdAt: new Date().toISOString(),
        status: "pending" as const,
      });
      newCount++;
    }

    if (added.length > 0) {
      localStorage.setItem("softwareData", JSON.stringify([...existing, ...added]));
    } else if (updatedCount > 0) {
      localStorage.setItem("softwareData", JSON.stringify(existing));
    }
    setImported(newCount);
    setUpdated(updatedCount);
    setSkipped(skippedCount);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Import failed");
  }
  };

  const selectedCount = selected.size;

  const groupedItems = (() => {
    const out: { itemIndex: number; host: string; links: { detail: DetailData; linkIndex: number; link: ParsedLink }[] }[] = [];
    items.forEach((it, i) => {
      if (!selected.has(i) || !it.detail || it.detail.links.length === 0) return;
      const groups = new Map<string, { detail: DetailData; linkIndex: number; link: ParsedLink }[]>();
      it.detail.links.forEach((link, li) => {
        let host = "other";
        if (link.url.startsWith("magnet:")) host = "magnet";
        else {
          try { host = new URL(link.url).hostname.replace(/^www\./, ""); } catch {}
        }
        const arr = groups.get(host) || [];
        arr.push({ detail: it.detail!, linkIndex: li, link });
        groups.set(host, arr);
      });
      const groupHosts = Object.keys(groups);
      for (let h = 0; h < groupHosts.length; h++) {
        const host = groupHosts[h];
        const links = groups.get(host);
        if (links) {
          out.push({ itemIndex: i, host, links });
        }
      }
    });
    return out;
  })();

  const filteredItems = nameFilter.trim()
    ? items
        .map((it, i) => ({ it, i }))
        .filter(({ it }) => (it.detail?.title || it.entry.title || "").toLowerCase().includes(nameFilter.toLowerCase()))
        .map(({ i }) => i)
    : [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-1">Import from Link</h1>
      <p className="text-blue-300/50 mb-8">Pull apps and their download links from a listing page or an entire site. Existing games are never deleted — duplicates keep the healthier links.</p>

      {/* Step 1: URL */}
      <div className="bg-[#111827] rounded-xl p-6 border border-blue-900/30 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-sm font-semibold text-blue-300/80">1 · Mode</span>
          <div className="flex rounded-lg overflow-hidden border border-blue-900/50">
            <button
              onClick={() => setMode("site")}
              className={`px-4 py-1.5 text-sm font-semibold ${mode === "site" ? "bg-blue-600 text-white" : "bg-[#0a0f1a] text-blue-300/60 hover:text-white"}`}
            >
              Entire site
            </button>
            <button
              onClick={() => setMode("page")}
              className={`px-4 py-1.5 text-sm font-semibold ${mode === "page" ? "bg-blue-600 text-white" : "bg-[#0a0f1a] text-blue-300/60 hover:text-white"}`}
            >
              One listing page
            </button>
            <button
              onClick={() => setMode("paste")}
              className={`px-4 py-1.5 text-sm font-semibold ${mode === "paste" ? "bg-blue-600 text-white" : "bg-[#0a0f1a] text-blue-300/60 hover:text-white"}`}
            >
              Paste HTML
            </button>
          </div>
        </div>
        {mode === "paste" ? (
          <>
            <label className="block text-sm font-semibold text-blue-300/80 mb-2">
              Source page URL (optional, just for recognition)
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchList()}
              placeholder="https://lightdload.xyz/movies/"
              className="w-full bg-[#0a0f1a] border border-blue-900/50 rounded-lg px-4 py-2.5 text-white placeholder-blue-300/30 focus:outline-none focus:border-blue-500 mb-4"
            />
            <label className="block text-sm font-semibold text-blue-300/80 mb-2">
              Page HTML source <span className="text-blue-300/40 font-normal">(open the page in your browser, press Ctrl+A then Ctrl+C to copy, paste here)</span>
            </label>
            <textarea
              value={pasteHtml}
              onChange={(e) => setPasteHtml(e.target.value)}
              placeholder={pasteHtmlSamples}
              rows={12}
              className="w-full bg-[#0a0f1a] border border-blue-900/50 rounded-lg px-4 py-2.5 text-white placeholder-blue-300/30 focus:outline-none focus:border-blue-500 font-mono text-xs mb-4 whitespace-pre"
            />
            <div className="flex gap-2">
              <button
                onClick={fetchList}
                disabled={loadingList || !pasteHtml.trim()}
                className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingList ? "Parsing…" : "Parse HTML"}
              </button>
              <button
                onClick={() => { setPasteHtml(""); setItems([]); setEntries([]); setSource(""); setError(""); }}
                className="px-4 py-2.5 rounded-lg bg-[#0a0f1a] border border-blue-900/50 text-blue-300/70 hover:text-white"
              >
                Clear
              </button>
            </div>
          </>
        ) : (
          <>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-sm font-semibold text-blue-300/60">Presets:</span>
          {SOURCE_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => { setUrl(p.url); setSource(""); setItems([]); setEntries([]); setError(""); }}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                url === p.url
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-[#0a0f1a] border-blue-900/50 text-blue-300/70 hover:text-white hover:border-blue-500"
              }`}
              title={p.note}
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="block text-sm font-semibold text-blue-300/80 mb-2">
          {mode === "site" ? "Site URL" : "Listing page URL"}
        </label>
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchList()}
            placeholder={mode === "site" ? "https://re-packs.com" : "https://example.com/software/"}
            className="flex-1 bg-[#0a0f1a] border border-blue-900/50 rounded-lg px-4 py-2.5 text-white placeholder-blue-300/30 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={fetchList}
            disabled={loadingList || !url.trim()}
            className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingList ? "Discovering…" : "Discover Apps"}
          </button>
        </div>
          </>
        )}
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
        {source && (
          <p className="text-emerald-400/80 text-sm mt-3">
            Found {entries.length} {mode === "site" ? "games across the site" : "entries"} on {source}
          </p>
        )}
      </div>

      {items.length > 0 && (
        <div className="bg-[#111827] rounded-xl p-6 border border-blue-900/30 mb-6">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h2 className="text-lg font-semibold text-white">2 · Review entries</h2>
            <div className="flex items-center gap-3">
              <input
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder="Filter by name…"
                className="bg-[#0a0f1a] border border-blue-900/50 rounded-lg px-3 py-1.5 text-white text-sm placeholder-blue-300/30 focus:outline-none focus:border-blue-500"
              />
              <button onClick={() => toggleAll(selectedCount !== items.length)} className="text-blue-400 hover:text-white text-sm font-semibold">
                {selectedCount === items.length ? "Deselect all" : "Select all"}
              </button>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto border border-blue-900/30 rounded-lg divide-y divide-blue-900/20">
            {items.map((it, i) => {
              const show = nameFilter.trim() ? filteredItems.includes(i) : true;
              if (!show) return null;
              return (
                <label key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-900/20 cursor-pointer">
                  <input type="checkbox" checked={selected.has(i)} onChange={() => toggleOne(i)} className="accent-blue-600" />
                  <span className="text-white text-sm truncate">{it.entry.title}</span>
                  <span className="text-blue-300/40 data-xs truncate ml-auto">{it.entry.url}</span>
                </label>
              );
            })}
          </div>
          {loadingDetails && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-blue-300/60 text-sm">Fetching download links…</span>
                <span className="text-blue-300/60 text-sm">{progress.done}/{progress.total}</span>
              </div>
              <div className="w-full bg-blue-900/30 rounded-full h-2">
                <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
              </div>
              <button onClick={() => { cancelledRef.current = true; abortRef.current?.abort(); }} className="mt-2 text-red-400 hover:text-red-300 text-xs font-semibold">
                Cancel
              </button>
            </div>
          )}
          <button
            onClick={fetchDetails}
            disabled={selectedCount === 0 || loadingDetails}
            className="mt-4 px-5 py-2.5 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingDetails
              ? "Fetching download links…"
              : `Fetch download links for ${selectedCount} selected`}
          </button>
        </div>
      )}

      {items.some((it) => it.detail || it.error || it.loading) && (
        <div className="bg-[#111827] rounded-xl p-6 border border-blue-900/30 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">3 · Download links</h2>
            <div className="flex rounded-lg overflow-hidden border border-blue-900/50">
              <button
                onClick={() => setViewMode("flat")}
                className={`px-3 py-1.5 text-xs font-semibold ${viewMode === "flat" ? "bg-blue-600 text-white" : "bg-[#0a0f1a] text-blue-300/60 hover:text-white"}`}
              >
                Flat
              </button>
              <button
                onClick={() => setViewMode("grouped")}
                className={`px-3 py-1.5 text-xs font-semibold ${viewMode === "grouped" ? "bg-blue-600 text-white" : "bg-[#0a0f1a] text-blue-300/60 hover:text-white"}`}
              >
                Grouped by host
              </button>
            </div>
          </div>

          {viewMode === "grouped" ? (
            <div className="space-y-4">
              {groupedItems.map((g, gi) => {
                const detail = g.links[0]?.detail;
                const it = items[g.itemIndex];
                return (
                  <div key={gi} className="border border-blue-900/30 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <p className="text-white font-semibold">{detail?.title || it.entry.title}</p>
                        <p className="text-blue-300/40 data-xs">{g.host} · {g.links.length} link{g.links.length === 1 ? "" : "s"}{detail?.password ? ` · 🔑 ${detail.password}` : ""}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {g.links.map(({ linkIndex, link }) => (
                        <div key={linkIndex} className="flex items-center gap-2">
                          <select
                            value={link.type}
                            onChange={(e) => updateLinkField(g.itemIndex, linkIndex, "type", e.target.value)}
                            className="bg-[#0a0f1a] border border-blue-900/50 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500"
                          >
                            <option value="torrent">Torrent</option>
                            <option value="repack">Repack</option>
                            <option value="direct">Direct</option>
                            <option value="official">Official</option>
                            <option value="cracked">Cracked</option>
                          </select>
                          <input
                            value={link.name}
                            onChange={(e) => updateLinkField(g.itemIndex, linkIndex, "name", e.target.value)}
                            className="w-36 bg-[#0a0f1a] border border-blue-900/50 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"
                          />
                          <input
                            value={link.url}
                            onChange={(e) => updateLinkField(g.itemIndex, linkIndex, "url", e.target.value)}
                            className="flex-1 bg-[#0a0f1a] border border-blue-900/50 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"
                          />
                          <button onClick={() => removeLink(g.itemIndex, linkIndex)} className="text-red-400 hover:text-red-300 data-xs px-2">✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {groupedItems.length === 0 && <p className="text-blue-300/40 data-xs">No links found for selected entries.</p>}
            </div>
          ) : (
            <div className="space-y-6">
              {items.map((it, i) => {
                if (!selected.has(i)) return null;
                if (it.error)
                  return <div key={i} className="text-red-400 data-xs">Failed: {it.entry.title} — {it.error}</div>;
                if (it.loading || !it.detail)
                  return <div key={i} className="text-blue-300/50 data-xs">Loading {it.entry.title}…</div>;
                const detail = it.detail;
                return (
                  <div key={i} className="border border-blue-900/30 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <p className="text-white font-semibold">{detail.title || it.entry.title}</p>
                        <p className="text-blue-300/40 data-xs break-all">{it.entry.url}</p>
                      </div>
                      <span className="text-blue-300/50 data-xs whitespace-nowrap">{detail.links.length} link{detail.links.length === 1 ? "" : "s"}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <label className="text-blue-300/50 data-xs whitespace-nowrap">Password</label>
                      <input
                        value={detail.password || ""}
                        onChange={(e) => updatePassword(i, e.target.value)}
                        placeholder="Archive password (optional)"
                        className="flex-1 bg-[#0a0f1a] border border-blue-900/50 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      {detail.links.map((link, li) => (
                        <div key={li} className="flex items-center gap-2">
                          <select
                            value={link.type}
                            onChange={(e) => updateLinkField(i, li, "type", e.target.value)}
                            className="bg-[#0a0f1a] border border-blue-900/50 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500"
                          >
                            <option value="torrent">Torrent</option>
                            <option value="repack">Repack</option>
                            <option value="direct">Direct</option>
                            <option value="official">Official</option>
                            <option value="cracked">Cracked</option>
                          </select>
                          <input
                            value={link.name}
                            onChange={(e) => updateLinkField(i, li, "name", e.target.value)}
                            className="w-36 bg-[#0a0f1a] border border-blue-900/50 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"
                          />
                          <input
                            value={link.url}
                            onChange={(e) => updateLinkField(i, li, "url", e.target.value)}
                            className="flex-1 bg-[#0a0f1a] border border-blue-900/50 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"
                          />
                          <button onClick={() => removeLink(i, li)} className="text-red-400 hover:text-red-300 data-xs px-2">✕</button>
                        </div>
                      ))}
                      {detail.links.length === 0 && <p className="text-blue-300/40 data-xs">No download links detected — imported without links, add them later in the software editor.</p>}
                      <button onClick={() => addLink(i)} className="text-blue-300/50 data-xs font-semibold">+ Add link</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={doImport}
            disabled={selectedCount === 0 || loadingDetails}
            className="mt-6 px-6 py-3 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Import {selectedCount} into Library
          </button>
          {(imported > 0 || updated > 0 || skipped > 0) && (
            <div className="mt-3 space-y-1">
              {imported > 0 && <p className="text-emerald-400 data-xs">✓ {imported} new app{imported === 1 ? "" : "s"} imported as PENDING — approve in Software to publish.</p>}
              {updated > 0 && <p className="text-amber-400 data-sm">↻ {updated} existing app{updated === 1 ? "" : "s"} updated with healthier links (existing games preserved).</p>}
              {skipped > 0 && <p className="text-blue-300/60 data-sm">− {skipped} skipped (existing game already had equal or healthier links).</p>}
            </div>
          )}
        </div>
      )}

      {nonGamePrompt && nonGamePrompt.length > 0 && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-zxl z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] rounded-2xl border border-blue-900/30 p-8 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-white mb-3">Non-game entries detected</h2>
            <p className="text-gray-300 text-sm mb-4">
              {nonGamePrompt.length} of {items.length} entries don&apos;t look like games:
            </p>
            <div className="max-h-40 overflow-y-auto border border-blue-900/30 rounded-lg divide-y divide-blue-900/20 mb-5">
              {nonGamePrompt.map((idx) => (
                <div key={idx} className="px-3 py-2 text-sm text-gray-300">
                  {items[idx].entry.title}
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={confirmRemoveNonGames}
                className="flex-1 px-4 py-2.5 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-500"
              >
                Remove & select games only
              </button>
              <button
                onClick={confirmKeepNonGames}
                className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500"
              >
                Keep & select all
              </button>
            </div>
            <button
              onClick={() => setNonGamePrompt(null)}
              className="mt-3 w-full text-center text-blue-300/60 hover:text-blue-300 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {sentencePrompt && sentencePrompt.length > 0 && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-zxl z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] rounded-2xl border border-blue-900/30 p-8 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-white mb-3">Suspicious entries detected</h2>
            <p className="text-gray-300 text-sm mb-4">
              {sentencePrompt.length} entry{sentencePrompt.length === 1 ? "" : "s"} don&apos;t look like real apps — they read like sentences, long descriptions, or site boilerplate (contact, how to, terms, privacy…):
            </p>
            <div className="max-h-40 overflow-y-auto border border-blue-900/30 rounded-lg divide-y divide-blue-900/20 mb-5">
              {sentencePrompt.map((idx) => (
                <div key={idx} className="px-3 py-2 text-sm text-gray-300">
                  {items[idx].entry.title}
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={confirmRemoveSentences}
                className="flex-1 px-4 py-2.5 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-500"
              >
                Remove them
              </button>
              <button
                onClick={() => setSentencePrompt(null)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500"
              >
                Keep them anyway
              </button>
            </div>
            <button
              onClick={() => setSentencePrompt(null)}
              className="mt-3 w-full text-center text-blue-300/60 hover:text-blue-300 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* No download links prompt */}
      {noLinksPrompt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-zxl z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] rounded-2xl border border-blue-900/30 p-8 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-white mb-3">No download links detected</h2>
            <p className="text-gray-300 text-sm mb-4">
              {noLinksPrompt.indices.length} of {selected.size} selected entries have no download links:
            </p>
            <div className="max-h-40 overflow-y-auto border border-blue-900/30 rounded-lg divide-y divide-blue-900/20 mb-5">
              {noLinksPrompt.indices.map((idx) => (
                <div key={idx} className="px-3 py-2 text-sm text-gray-300">
                  {items[idx].entry.title}
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => confirmNoLinksAction("skip")}
                className="flex-1 px-4 py-2.5 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-500"
              >
                Skip these ({noLinksPrompt.indices.length})
              </button>
              <button
                onClick={() => confirmNoLinksAction("import")}
                className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500"
              >
                Import anyway
              </button>
            </div>
            <button
              onClick={() => setNoLinksPrompt(null)}
              className="mt-3 w-full text-center text-blue-300/60 hover:text-blue-300 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Name suggestion prompt */}
      {nameSuggestionPrompt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-zxl z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] rounded-2xl border border-blue-900/30 p-8 max-w-2xl w-full mx-4">
            <h2 className="text-xl font-bold text-white mb-2">Generic link names detected</h2>
            <p className="text-gray-300 text-sm mb-4">
              The following links for <strong>{items[nameSuggestionPrompt.itemIndex].detail?.title || items[nameSuggestionPrompt.itemIndex].entry.title}</strong> have generic names. Better names were extracted from the URLs:
            </p>
            <div className="max-h-60 overflow-y-auto border border-blue-900/30 rounded-lg divide-y divide-blue-900/20 mb-5">
              {nameSuggestionPrompt.links
                .filter(l => !nameSuggestionPrompt.resolved.has(l.index))
                .map((link) => (
                  <div key={link.index} className="px-3 py-3 bg-[#0a0f1a] rounded-lg border border-blue-900/30">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-blue-300/60 text-xs">Link {link.index + 1}</span>
                      <span className="text-emerald-400 text-xs font-medium">Suggested</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-[#071014] rounded px-2 py-1.5 text-gray-400">
                        Current: <span className="text-white ml-1">{link.currentName}</span>
                      </div>
                      <div className="bg-[#071014] rounded px-2 py-1.5 text-emerald-400">
                        Suggested: <span className="text-white ml-1">{link.suggestedName}</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => resolveNameSuggestion("use-suggested", nameSuggestionPrompt.links.filter(l => !nameSuggestionPrompt.resolved.has(l.index)).map(l => l.index))}
                className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500"
              >
                Use Suggested Names
              </button>
              <button
                onClick={() => resolveNameSuggestion("keep-current", nameSuggestionPrompt.links.filter(l => !nameSuggestionPrompt.resolved.has(l.index)).map(l => l.index))}
                className="flex-1 px-4 py-2.5 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-500"
              >
                Keep Current Names
              </button>
              <button
                onClick={() => resolveNameSuggestion("skip")}
                className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500"
              >
                Skip All
              </button>
            </div>
            <button
              onClick={() => setNameSuggestionPrompt(null)}
              className="mt-3 w-full text-center text-blue-300/60 hover:text-blue-300 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {/* Floating scroll up/down - move up and down rather than scrolling */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center transition-all hover:scale-110" title="Move up">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
        </button>
        <button onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })} className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center transition-all hover:scale-110" title="Move down">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
      </div>
    </div>
  );
}