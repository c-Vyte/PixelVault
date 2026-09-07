"use client";

import { useRef, useState, useEffect } from "react";
import { categories, getSoftwareList, saveSoftwareList, type Software } from "@/lib/data";
import { parseListingPage, parseDetailPage, isGenericLinkName, extractNameFromUrl, type ParsedEntry as ParsedEntryType, type ParsedDetail } from "@/lib/importParser";
import { TUNABLES } from "@/lib/config";
import { SOURCE_PRESETS } from "@/components/admin/import/presets";



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

type LinkResolveState = "idle" | "checking" | "alive" | "direct" | "dead" | "blocked";

interface ParsedLink {
  name: string;
  url: string;
  type: "official" | "repack" | "direct" | "cracked" | "torrent";
  part?: number;
  partTotal?: number;
  /** Hoster link-resolution state (datanodes/fuckingfast/...). */
  resolveState?: LinkResolveState;
  /** Real filename reported by the hoster. */
  resolveFileName?: string;
  /** Resolved direct download URL (session-scoped, admin convenience only). */
  directUrl?: string;
  resolveLabel?: string;
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
  if (entryUrl && /filecr\.com\/mac|\/macos\//i.test(entryUrl)) return "mac";
  if (contentType === "game") return "pc-games";
  const t = title.toLowerCase();
  if (/game|repack|torrent|edition|\bpc\b/i.test(t)) return "pc-games";
  if (/\bandroid\b|apk/.test(t)) return "android";
  if (/\bmac\b|macos/.test(t)) return "mac";
  return "windows";
}

function guessPlatform(title: string, entryUrl?: string, contentType?: DetailData["contentType"]): Software["platform"] {
  if (entryUrl && /filecr\.com\/mac|\/macos\//i.test(entryUrl)) return "mac";
  if (entryUrl && /\/macos\//i.test(entryUrl)) return "mac";
  const t = title.toLowerCase();
  if (/\bmac\b|macos/.test(t)) return "mac";
  if (/\bandroid\b|apk/.test(t)) return "android";
  if (contentType === "game") return "windows";
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
  /** Structured error so the banner can offer the right recovery action. */
  const [errorInfo, setErrorInfo] = useState<{ kind: "blocked" | "network" | "empty" | "info"; message: string } | null>(null);
  const discoverAbortRef = useRef<AbortController | null>(null);
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
  // Shown when hoster links (datanodes/fuckingfast/...) are dead/missing but
  // torrent/magnet mirrors exist — the admin picks accept vs skip.
  const [torrentPrompt, setTorrentPrompt] = useState<{ indices: number[]; action: "accept" | "skip" | null } | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveProgress, setResolveProgress] = useState({ done: 0, total: 0 });

  // ── J: Progressive resume — persist to sessionStorage so refresh doesn't lose progress ──
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("importResume");
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (Array.isArray(saved.items) && saved.items.length > 0) setItems(saved.items);
      if (Array.isArray(saved.entries) && saved.entries.length > 0) setEntries(saved.entries);
      if (Array.isArray(saved.selected)) setSelected(new Set(saved.selected));
      if (typeof saved.url === "string") setUrl(saved.url);
      if (typeof saved.mode === "string" && ["site", "page", "paste"].includes(saved.mode)) setMode(saved.mode);
      if (typeof saved.source === "string") setSource(saved.source);
      if (typeof saved.pasteHtml === "string") setPasteHtml(saved.pasteHtml);
      if (typeof saved.viewMode === "string") setViewMode(saved.viewMode);
      if (typeof saved.nameFilter === "string") setNameFilter(saved.nameFilter);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      const payload = JSON.stringify({
        url, mode, source, pasteHtml, entries: entries.slice(0, 200), items: items.slice(0, 500), selected: Array.from(selected).slice(0, 500), viewMode, nameFilter,
      });
      if (items.length > 0 || entries.length > 0) sessionStorage.setItem("importResume", payload);
    } catch {}
  }, [url, mode, source, pasteHtml, entries, items, selected, viewMode, nameFilter]);

  const fetchList = async () => {
    setError("");
    setErrorInfo(null);
    discoverAbortRef.current?.abort();
    const controller = new AbortController();
    discoverAbortRef.current = controller;
    setLoadingList(true);
    setItems([]);
    setSelected(new Set());
    setImported(0);
    setUpdated(0);
    setSkipped(0);
    setProgress({ done: 0, total: 0 });
    const fail = (kind: "blocked" | "network" | "empty" | "info", message: string) => {
      setError(message);
      setErrorInfo({ kind, message });
    };
    try {
      if (mode === "paste") {
        if (!pasteHtml.trim()) {
          fail("info", "Paste the HTML source of a listing page or detail page first.");
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
            fail("empty", "No entries found in the pasted HTML. Make sure you copied the full page source (Ctrl+A then Ctrl+C).");
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
        fail("info", "Enter a URL first.");
        return;
      }
      const endpoint = mode === "site" ? "/api/import/site" : "/api/import/list";
      const res = await fetch(`${endpoint}?url=${encodeURIComponent(url.trim())}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const data = await res.json();
      if (!res.ok) {
        if (data.blocked) {
          fail(
            "blocked",
            data.error || "This site is protected and blocked automated access."
          );
        } else if (res.status === 502 || res.status === 0 || /could not reach|fetch failed|timeout|network/i.test(data.error || "")) {
          fail("network", data.error || "Could not reach the site. Check the URL and your connection, or use Paste HTML mode.");
        } else if (data.entries && data.entries.length === 0) {
          fail("empty", data.error || "The site was reached but no downloadable entries were found. Try a listing-page URL or Paste HTML mode.");
        } else {
          fail("info", data.error || "Failed to fetch the page. Check the URL and try again.");
        }
        return;
      }
      if (!data.entries || data.entries.length === 0) {
        setSource(data.source || "");
        fail("empty", "Reached the site but found no game/app entries. Check the URL points to a listing, or use Paste HTML mode with the page source.");
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
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // user cancelled — leave whatever state is there
        return;
      }
      fail("network", "Could not reach the import API. Check the server is running.");
    } finally {
      if (discoverAbortRef.current === controller) discoverAbortRef.current = null;
      setLoadingList(false);
    }
  };

  const cancelDiscover = () => {
    discoverAbortRef.current?.abort();
    discoverAbortRef.current = null;
    setLoadingList(false);
  };

  /** Jump to paste mode keeping the entered URL as the source hint. */
  const switchToPaste = () => {
    setMode("paste");
    setError("");
    setErrorInfo(null);
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

  /**
   * Resolve file-hoster landing links (datanodes.to, fuckingfast.co, pixeldrain,
   * gofile, ...) for the selected+detailed items. The resolver follows the
   * hoster's download flow and reports per-link status: a green badge means a
   * real file was found, red means the hoster link is dead. Dead-hoster items
   * that only have torrents left trigger the torrent-accept prompt.
   */
  const resolveHosterLinks = async (itemIndices?: number[]) => {
    const targets = (itemIndices && itemIndices.length > 0
      ? itemIndices
      : items.map((_, i) => i).filter((i) => selected.has(i)))
      .filter((i) => items[i]?.detail && items[i].detail.links.some((l) => l.url && l.url.trim()));

    if (targets.length === 0) return;

    // Collect every http(s) link we can resolve.
    type Ref = { item: number; link: number; url: string };
    const refs: Ref[] = [];
    for (const i of targets) {
      items[i].detail!.links.forEach((l, li) => {
        if (l.url && /^https?:\/\//i.test(l.url) && l.type !== "official") refs.push({ item: i, link: li, url: l.url.trim() });
      });
    }
    if (refs.length === 0) return;

    setResolving(true);
    setError("");
    setResolveProgress({ done: 0, total: refs.length });

    // Mark all as checking
    setItems((prev) => {
      const copy = [...prev];
      for (const r of refs) {
        const links = copy[r.item].detail!.links;
        if (links[r.link]) links[r.link] = { ...links[r.link], resolveState: "checking" };
      }
      return copy;
    });

    const BATCH = TUNABLES.importResolveBatch;
    const stateByUrl = new Map<string, { state: LinkResolveState; directUrl?: string; fileName?: string; label?: string }>();

    try {
      for (let b = 0; b < refs.length; b += BATCH) {
        const slice = refs.slice(b, b + BATCH);
        let res: any;
        try {
          const r = await fetch("/api/resolve-links", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ urls: slice.map((s) => s.url) }),
          });
          res = await r.json();
          if (!r.ok) throw new Error(res.error || `HTTP ${r.status}`);
        } catch (err) {
          // Network/API failure — mark unknown rather than dead so the admin
          // isn't pushed toward torrents by a resolver outage.
          for (const s of slice) stateByUrl.set(s.url, { state: "idle", label: err instanceof Error ? err.message : "resolve failed" });
          setResolveProgress((p) => ({ done: p.done + slice.length, total: refs.length }));
          continue;
        }

        for (const rr of res.results || []) {
          // network/blocked → "blocked" (we couldn't tell; never call it dead),
          // genuine 404/file-missing → "dead".
          const state: LinkResolveState = rr.ok
            ? "direct"
            : rr.alive
              ? "alive"
              : rr.blocked || rr.network || rr.reason === "network"
                ? "blocked"
                : rr.reason === "torrent" || rr.reason === "not-a-hoster"
                  ? "idle"
                  : "dead";
          stateByUrl.set(rr.inputUrl, {
            state,
            directUrl: rr.directUrl || undefined,
            fileName: rr.fileName || undefined,
            label: rr.label,
          });
        }
        setResolveProgress((p) => ({ done: p.done + slice.length, total: refs.length }));
      }

      // Apply results back to items
      setItems((prev) => {
        const copy = [...prev];
        for (const r of refs) {
          const info = stateByUrl.get(r.url);
          if (!info) continue;
          const detail = copy[r.item].detail;
          if (!detail) continue;
          const links = [...detail.links];
          const cur = links[r.link];
          if (!cur) continue;
          links[r.link] = {
            ...cur,
            resolveState: info.state,
            directUrl: info.directUrl,
            resolveLabel: info.label,
            resolveFileName: info.fileName && isGenericLinkName(cur.name) ? info.fileName : cur.resolveFileName,
          };
          copy[r.item] = { ...copy[r.item], detail: { ...detail, links } };
        }
        return copy;
      });

      // After resolution: prompt for items whose hoster links are all dead but
      // which still have a torrent/magnet mirror.
      const torrentOnly: number[] = [];
      for (const i of targets) {
        const links = items[i].detail?.links || [];
        // re-read from stateByUrl view
        let hasLiveDirect = false;
        let hasDeadDirect = false;
        let hasTorrent = false;
        for (const l of links) {
          if (l.type === "torrent" || l.url.startsWith("magnet:")) { hasTorrent = true; continue; }
          if (!/^https?:/i.test(l.url)) continue;
          const info = stateByUrl.get(l.url.trim());
          if (!info) { hasLiveDirect = true; continue; } // unchecked = assume present
          if (info.state === "direct" || info.state === "alive" || info.state === "blocked" || info.state === "idle" || info.state === "checking") hasLiveDirect = true;
          else if (info.state === "dead") hasDeadDirect = true;
        }
        if (!hasLiveDirect && hasDeadDirect && hasTorrent) torrentOnly.push(i);
      }
      if (torrentOnly.length > 0) {
        setTorrentPrompt({ indices: torrentOnly, action: null });
      }
    } finally {
      setResolving(false);
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

      // Check for items whose file-hoster links are dead but a torrent/magnet
      // mirror exists — ask the admin before importing torrent-only entries.
      const torrentOnlyIndices = items
        .map((it, i) => ({ it, i }))
        .filter(({ i, it }) => {
          if (!selected.has(i) || !it.detail) return false;
          const links = it.detail.links.filter((l) => l.url && l.url.trim());
          const torrents = links.filter((l) => l.type === "torrent" || l.url.startsWith("magnet:"));
          const directs = links.filter((l) => l.type !== "torrent" && !l.url.startsWith("magnet:"));
          if (torrents.length === 0) return false;
          // Only prompt when every hoster/direct link has been confirmed dead.
          const deadDirects = directs.filter((l) => (l as ParsedLink).resolveState === "dead");
          return directs.length > 0 && deadDirects.length === directs.length;
        })
        .map(({ i }) => i);

      if (torrentOnlyIndices.length > 0) {
        setTorrentPrompt({ indices: torrentOnlyIndices, action: null });
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

  const confirmTorrentAction = (action: "accept" | "skip") => {
    if (!torrentPrompt) return;
    if (action === "skip") {
      // Drop the torrent-only items entirely.
      const nextSelected = new Set(selected);
      torrentPrompt.indices.forEach(i => nextSelected.delete(i));
      setSelected(nextSelected);
    }
    // "accept" keeps the selection as-is, so torrent links import normally.
    setTorrentPrompt(null);
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
          const groups = new Map<string, { url: string; part: number; partTotal?: number; name: string; type: string; directUrl?: string; resolveState?: LinkResolveState }[]>();
          const resolveFields = (l: ParsedLink) => ({
            ...(l.directUrl ? { directUrl: l.directUrl } : {}),
            ...(l.resolveState === "direct" || l.resolveState === "alive" || l.resolveState === "dead" || l.resolveState === "blocked"
              ? { resolveState: l.resolveState as "direct" | "alive" | "dead" | "blocked", resolvedAt: new Date().toISOString() }
              : {}),
          });
          const partBase = (url: string, name: string): string => {
            let file = name;
            try {
              const u = new URL(url);
              file = decodeURIComponent(u.hash.replace(/^#/, "") || u.pathname.split("/").pop() || name);
            } catch { file = name || url; }
            return file
              .replace(/[._-]part?0*\d+\s*(\.(rar|zip|7z|exe))?$/i, "$1")
              .replace(/\.\d{3}(\.|$)/i, "$1")
              .toLowerCase()
              .replace(/\.[a-z0-9]{2,5}$/i, "");
          };
          for (const l of rawLinks) {
            if (l.part) {
              const host = (() => { try { return new URL(l.url).hostname; } catch { return l.url; } })();
              // Key on host + archive base name so two different multi-part
              // files on the same hoster don't collapse into one entry.
              const key = `${l.type || "direct"}|${host}|${partBase(l.url, l.name)}`;
              const arr = groups.get(key) || [];
              arr.push({ url: l.url, part: l.part, partTotal: l.partTotal, name: l.name || "Download", type: l.type || "direct", directUrl: l.directUrl, resolveState: l.resolveState });
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
              ...(first.directUrl ? { directUrl: first.directUrl } : {}),
              ...(first.resolveState === "direct" || first.resolveState === "alive" || first.resolveState === "dead" || first.resolveState === "blocked"
                ? { resolveState: first.resolveState, resolvedAt: new Date().toISOString() }
                : {}),
            });
          }
          for (const l of rawLinks) {
            if (l.part) continue;
            out.push({
              name: l.name || "Download",
              url: l.url,
              type: l.type || ("direct" as const),
              ...resolveFields(l),
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
        category: guessCategory(title, it.detail?.contentType, it.entry.url),
        subcategory: "",
        platform: guessPlatform(title, it.entry.url, it.detail?.contentType),
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
      await saveSoftwareList([...existing, ...added]);
    } else if (updatedCount > 0) {
      await saveSoftwareList(existing);
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
      for (const [host, links] of groups) {
        out.push({ itemIndex: i, host, links });
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

  const renderResolveBadge = (link: ParsedLink) => {
    if (link.type === "torrent" || link.url.startsWith("magnet:")) return null;
    const st = link.resolveState;
    if (!st || st === "idle") return null;
    const map: Record<LinkResolveState, { text: string; cls: string; title?: string }> = {
      checking: { text: "⏳ verifying", cls: "bg-blue-900/60 text-blue-200", title: "Contacting the file hoster…" },
      direct: { text: "⚡ direct link found", cls: "bg-emerald-900/70 text-emerald-200", title: link.directUrl ? `Direct: ${link.directUrl}` : "Hoster returned a real download URL" },
      alive: { text: "✓ file exists", cls: "bg-teal-900/60 text-teal-200", title: "Landing page reachable and references the file" },
      dead: { text: "✗ dead", cls: "bg-red-900/70 text-red-200", title: "The hoster reports this file is missing/expired" },
      blocked: { text: "⛨ captcha/unreachable", cls: "bg-amber-900/60 text-amber-200", title: "Cloudflare/Turnstile gate or the hoster couldn't be reached — link is NOT confirmed dead" },
      idle: { text: "", cls: "" },
    };
    const m = map[st];
    if (!m.text) return null;
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${m.cls}`} title={m.title}>
        {m.text}
      </span>
    );
  };

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
            className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {loadingList && (
              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            )}
            {loadingList
              ? mode === "site"
                ? "Crawling site (sitemaps, pages…)…"
                : "Fetching listing…"
              : "Discover Apps"}
          </button>
          {loadingList && (
            <button
              onClick={cancelDiscover}
              className="px-4 py-2.5 rounded-lg bg-[#0a0f1a] border border-red-900/50 text-red-300 hover:text-red-200 font-semibold"
            >
              Cancel
            </button>
          )}
        </div>
          </>
        )}
        {error && (
          <div
            className={`mt-4 rounded-lg border p-4 ${
              errorInfo?.kind === "blocked"
                ? "bg-amber-950/40 border-amber-700/40"
                : errorInfo?.kind === "network"
                  ? "bg-orange-950/30 border-orange-800/40"
                  : "bg-red-950/30 border-red-800/40"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-lg leading-6">
                {errorInfo?.kind === "blocked" ? "⛨" : errorInfo?.kind === "network" ? "🌐" : "⚠️"}
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">
                  {errorInfo?.kind === "blocked"
                    ? "Site is protected (Cloudflare / captcha)"
                    : errorInfo?.kind === "network"
                      ? "Couldn't reach the site"
                      : errorInfo?.kind === "empty"
                        ? "No entries found"
                        : "Heads up"}
                </p>
                <p className="text-sm text-gray-300 mt-1">{error}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {(errorInfo?.kind === "blocked" || errorInfo?.kind === "network" || errorInfo?.kind === "empty") && mode !== "paste" && (
                    <button
                      onClick={switchToPaste}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                    >
                      Switch to Paste HTML
                    </button>
                  )}
                  {mode !== "paste" && (
                    <button
                      onClick={fetchList}
                      className="px-3 py-1.5 rounded-lg bg-[#0a0f1a] border border-blue-900/50 text-blue-200 hover:text-white text-xs font-semibold"
                    >
                      ↻ Retry
                    </button>
                  )}
                </div>
                {errorInfo?.kind === "blocked" && (
                  <p className="text-xs text-amber-200/70 mt-2">
                    Open the page in your browser, solve the challenge if any, press <kbd className="px-1 bg-black/40 rounded">Ctrl+A</kbd> then <kbd className="px-1 bg-black/40 rounded">Ctrl+C</kbd>, and paste it in Paste HTML mode.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        {source && !error && (
          <p className="text-emerald-400/80 text-sm mt-3 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
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
              const linkCount = it.detail?.links?.length ?? 0;
              return (
                <label key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-900/20 cursor-pointer">
                  <input type="checkbox" checked={selected.has(i)} onChange={() => toggleOne(i)} className="accent-blue-600 shrink-0" />
                  <span className="text-white text-sm truncate">{it.entry.title}</span>
                  {it.loading && (
                    <span className="flex items-center gap-1.5 text-blue-300/70 data-xs shrink-0">
                      <span className="w-3 h-3 border-2 border-blue-400/40 border-t-blue-300 rounded-full animate-spin" />
                      fetching…
                    </span>
                  )}
                  {it.error && (
                    <span className="text-red-300/90 data-xs shrink-0 truncate max-w-[220px]" title={it.error}>
                      ⚠ {it.error}
                    </span>
                  )}
                  {it.detail && !it.error && (
                    <span className={`data-xs shrink-0 ${linkCount > 0 ? "text-emerald-300/80" : "text-amber-300/80"}`}>
                      {linkCount > 0 ? `${linkCount} link${linkCount === 1 ? "" : "s"}` : "no links"}
                    </span>
                  )}
                  <span className="text-blue-300/40 data-xs truncate ml-auto">{it.entry.url}</span>
                </label>
              );
            })}
          </div>
          {items.length > 0 && (
            <div className="flex items-center gap-3 mt-3 text-xs text-blue-300/60 flex-wrap">
              <span className="font-semibold text-blue-200">{selectedCount} selected</span>
              <span>·</span>
              <span className="text-emerald-300/70">{items.filter((it) => it.detail && !it.error).length} with details</span>
              <span>·</span>
              <span className="text-red-300/70">{items.filter((it) => it.error).length} failed</span>
              {items.some((it) => it.error) && (
                <button
                  onClick={() => {
                    const failed = items.map((it, i) => (it.error ? i : -1)).filter((i) => i >= 0);
                    setSelected(new Set(failed));
                  }}
                  className="text-red-300 hover:text-red-200 underline underline-offset-2"
                >
                  Select failed to retry
                </button>
              )}
            </div>
          )}
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
            className="mt-4 px-5 py-2.5 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {loadingDetails && (
              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            )}
            {loadingDetails
              ? `Fetching download links… ${progress.done}/${progress.total}`
              : `Fetch download links for ${selectedCount} selected`}
          </button>
        </div>
      )}

      {items.some((it) => it.detail || it.error || it.loading) && (
        <div className="bg-[#111827] rounded-xl p-6 border border-blue-900/30 mb-6">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h2 className="text-lg font-semibold text-white">3 · Download links</h2>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => resolveHosterLinks()}
                disabled={resolving || loadingDetails || selectedCount === 0}
                title="Follows each hoster link (datanodes.to, fuckingfast.co, pixeldrain, gofile, …) to confirm the file exists and extract the real direct URL"
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resolving ? `Verifying hosters… ${resolveProgress.done}/${resolveProgress.total}` : "⚡ Verify hoster links"}
              </button>
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
          </div>
          {resolving && (
            <div className="mb-4">
              <div className="w-full bg-blue-900/30 rounded-full h-1.5">
                <div className="bg-cyan-500 h-1.5 rounded-full transition-all" style={{ width: `${resolveProgress.total ? (resolveProgress.done / resolveProgress.total) * 100 : 0}%` }} />
              </div>
            </div>
          )}

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
                          {renderResolveBadge(link)}
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
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {(() => {
                          const hosts = detail.links.filter((l) => l.type !== "torrent" && !l.url.startsWith("magnet:"));
                          const direct = hosts.filter((l) => l.resolveState === "direct").length;
                          const alive = hosts.filter((l) => l.resolveState === "alive").length;
                          const dead = hosts.filter((l) => l.resolveState === "dead").length;
                          const blocked = hosts.filter((l) => l.resolveState === "blocked").length;
                          const checked = direct + alive + dead + blocked;
                          if (checked === 0) return <span className="text-blue-300/50 data-xs whitespace-nowrap">{detail.links.length} link{detail.links.length === 1 ? "" : "s"}</span>;
                          return (
                            <span className="flex items-center gap-1.5 data-xs whitespace-nowrap">
                              {direct > 0 && <span className="px-2 py-0.5 rounded bg-emerald-900/70 text-emerald-200 font-semibold">⚡ {direct} direct</span>}
                              {alive > 0 && <span className="px-2 py-0.5 rounded bg-teal-900/60 text-teal-200 font-semibold">✓ {alive} alive</span>}
                              {dead > 0 && <span className="px-2 py-0.5 rounded bg-red-900/70 text-red-200 font-semibold">✗ {dead} dead</span>}
                              {blocked > 0 && <span className="px-2 py-0.5 rounded bg-amber-900/60 text-amber-200 font-semibold">⛨ {blocked}?</span>}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    {(() => {
                      const hosts = detail.links.filter((l) => l.type !== "torrent" && !l.url.startsWith("magnet:"));
                      const allDead = hosts.length > 0 && hosts.every((l) => l.resolveState === "dead");
                      const hasTorrent = detail.links.some((l) => l.type === "torrent" || l.url.startsWith("magnet:"));
                      if (allDead && hasTorrent) {
                        return (
                          <div className="mb-3 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 data-xs">
                            🧲 All file-hoster links are dead — only the torrent mirror is usable for this entry. You&apos;ll be asked to accept or skip torrents on import.
                          </div>
                        );
                      }
                      return null;
                    })()}
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
                          {renderResolveBadge(link)}
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

      {/* Torrent fallback prompt — hoster links dead, but torrents exist */}
      {torrentPrompt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-zxl z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] rounded-2xl border border-amber-700/40 p-8 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-white mb-3">No working file-hoster links — use torrents?</h2>
            <p className="text-gray-300 text-sm mb-4">
              The direct hoster links (DataNodes, FuckingFast, PixelDrain, GoFile…) for{" "}
              <strong className="text-amber-300">{torrentPrompt.indices.length}</strong>{" "}
              {torrentPrompt.indices.length === 1 ? "entry" : "entries"} could not be reached or were reported dead.
              Each entry still has a <strong className="text-cyan-300">torrent / magnet</strong> mirror available.
            </p>
            <div className="max-h-40 overflow-y-auto border border-blue-900/30 rounded-lg divide-y divide-blue-900/20 mb-5">
              {torrentPrompt.indices.map((idx) => (
                <div key={idx} className="px-3 py-2 text-sm text-gray-300 flex items-center gap-2">
                  <span className="text-cyan-400">🧲</span>
                  {items[idx]?.detail?.title || items[idx]?.entry.title}
                </div>
              ))}
            </div>
            <p className="text-blue-300/60 text-xs mb-5">
              Torrents need a BitTorrent client (qBittorrent, etc.). Accept to import them as torrent-only entries,
              or skip these entries and keep looking for direct mirrors.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => confirmTorrentAction("skip")}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-700 text-white font-semibold hover:bg-red-600"
              >
                Skip these ({torrentPrompt.indices.length})
              </button>
              <button
                onClick={() => confirmTorrentAction("accept")}
                className="flex-1 px-4 py-2.5 rounded-lg bg-cyan-700 text-white font-semibold hover:bg-cyan-600"
              >
                Accept torrents
              </button>
            </div>
            <button
              onClick={() => setTorrentPrompt(null)}
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