export interface Software {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory: string;
  platform: "windows" | "mac" | "android" | "ios" | "cross-platform";
  version: string;
  size: string;
  downloads: number;
  rating: number;
  icon: string;
  poster: string;
  screenshots: string[];
  downloadLinks: {
    name: string;
    url: string;
    type: "official" | "repack" | "direct" | "cracked" | "torrent";
    hoster?: string;
    part?: number;
    partTotal?: number;
    parts?: number;
    partLinks?: { part: number; url: string }[];
    status?: "alive" | "dead" | "unknown";
    lastChecked?: string;
    archivedTitle?: string;
    archivedDescription?: string;
    /** Resolved direct download URL from the file hoster (session-scoped). */
    directUrl?: string;
    /** Hoster resolution verdict: direct link found, alive, dead, blocked. */
    resolveState?: "direct" | "alive" | "dead" | "blocked";
    resolvedAt?: string;
  }[];
  downloadsByHoster?: Record<string, { name: string; url: string; type: string; hoster?: string; part?: number; partTotal?: number }[]>;
  password?: string;
  systemRequirements: string;
  features: string[];
  videoUrl?: string;
  createdAt: string;
  updatedAt?: string;
  /** "pending" = imported but not yet approved for public display.
   *  "published" = visible on the client side.
   *  "archived" = hidden from client, kept in admin.
   *  Missing = legacy entry treated as "published". */
  status?: "pending" | "published" | "archived";
}

export const categories = [
  {
    id: "windows",
    name: "Windows",
    icon: "Monitor",
    description: "Software for Windows operating system",
    subcategories: [
      "Backup & Recovery",
      "Office & PDF",
      "Video Editors",
      "Download Managers",
      "Graphics & Design",
      "Hard Disk Tools",
      "Audio & Music",
      "Multimedia",
      "System Utilities",
      "Security",
    ],
  },
  {
    id: "mac",
    name: "Mac",
    icon: "Apple",
    description: "Software for macOS",
    subcategories: [
      "Tools & Utilities",
      "Office & PDF",
      "Graphics Editors",
      "Engineering & Simulation",
      "Video Editors",
      "Audio & Music",
    ],
  },
  {
    id: "android",
    name: "Android Apps",
    icon: "Smartphone",
    description: "Android applications",
    subcategories: [
      "Tools & Utilities",
      "Video Editors",
      "Entertainment",
      "Mobile Browsers",
      "Educational",
      "Photography & Design",
    ],
  },
  {
    id: "pc-games",
    name: "PC Games",
    icon: "Gamepad2",
    description: "Games for PC",
    subcategories: ["Action", "Adventure", "Racing", "Simulation", "Strategy", "RPG", "Shooter", "Horror", "Fighting", "Sports", "Puzzle", "Stealth"],
  },
  {
    id: "ebooks",
    name: "Ebooks",
    icon: "BookOpen",
    description: "Digital books and publications",
    subcategories: ["Programming", "Design", "Business", "Science", "Fiction", "Non-Fiction"],
  },
  {
    id: "movies",
    name: "Movies",
    icon: "Film",
    description: "Movies and films in HD quality",
    subcategories: ["Action", "Adventure", "Comedy", "Drama", "Horror", "Sci-Fi", "Thriller"],
  },
  {
    id: "korean",
    name: "Korean Movies & Series",
    icon: "PlaySquare",
    description: "Korean movies and series",
    subcategories: ["Action", "Romance", "Thriller", "Comedy", "Drama", "Horror"],
  },
  {
    id: "tutorials",
    name: "Tutorials",
    icon: "GraduationCap",
    description: "Learning guides and tutorials",
    subcategories: ["Udemy Courses", "Programming", "Design", "Video Editing", "Photography", "Music"],
  },
];

export const softwareData: Software[] = [];

function sanitizeSoftware(sw: any): Software {
  const clean = (v: any): string => {
    if (typeof v === "string") return v.replace(/\[object Object\],?/g, "").trim();
    if (v == null) return "";
    if (typeof v === "object") return "";
    return String(v).replace(/\[object Object\],?/g, "").trim();
  };
  return {
    ...sw,
    title: clean(sw.title) || "Unknown",
    description: clean(sw.description),
    category: clean(sw.category) || "pc-games",
    subcategory: clean(sw.subcategory),
    platform: (["windows", "mac", "android", "cross-platform"].includes(sw.platform) ? sw.platform : "windows") as Software["platform"],
    version: clean(sw.version),
    size: clean(sw.size),
    icon: clean(sw.icon || sw.poster),
    poster: clean(sw.poster || sw.icon),
    systemRequirements: clean(sw.systemRequirements),
    password: clean(sw.password),
    videoUrl: clean(sw.videoUrl),
    features: Array.isArray(sw.features) ? sw.features.filter((f: any) => typeof f === "string" && !f.includes("[object Object]")) : [],
    screenshots: (() => {
      const raw: string[] = Array.isArray(sw.screenshots) ? sw.screenshots.filter((s: any) => typeof s === "string" && s.startsWith("http")) : [];
      // For apps/software, strip stray game banners that leaked from sidebar-related products (gamedrive etc.)
      const isApp = sw.category !== "pc-games" && sw.category !== "movies" && sw.category !== "korean";
      if (!isApp || raw.length <= 1) return raw.slice(0, 8);
      const titleWords = (sw.title || "").toLowerCase().split(/[^a-z0-9]+/).filter((w: string) => w.length >= 4);
      // Keep ad/join etc. already filtered, but also drop game banners that don't share a title word
      const filtered = raw.filter((url) => {
        if (/cybar|join\.png|advert|banner/i.test(url)) return false;
        const lowerUrl = url.toLowerCase();
        // Keep if URL contains any significant title word
        if (titleWords.some((w: string) => lowerUrl.includes(w))) return true;
        // Keep the poster/icon host image even if slug mismatch (fallback)
        if (sw.icon && lowerUrl === sw.icon.toLowerCase()) return true;
        if (sw.poster && lowerUrl === sw.poster.toLowerCase()) return true;
        return false;
      });
      if (filtered.length === 0) return raw.slice(0, 1);
      return filtered.slice(0, 1);
    })(),
    downloadLinks: Array.isArray(sw.downloadLinks) ? sw.downloadLinks.map((l: any) => ({
      ...l,
      name: clean(l.name) || "Download",
      url: typeof l.url === "string" ? l.url : "",
      type: (["official", "repack", "direct", "cracked", "torrent"].includes(l.type) ? l.type : "direct") as Software["downloadLinks"][0]["type"],
    })).filter((l: any) => l.url) : [],
  } as Software;
}

// In-memory cache for performance
let softwareCache: Software[] | null = null;
let cachePromise: Promise<Software[]> | null = null;

export async function getSoftwareList(): Promise<Software[]> {
  if (softwareCache) return softwareCache;
  if (cachePromise) return cachePromise;

  cachePromise = (async () => {
    // Try server first (shared, Hetzner volume) — published + pending for admin, published only for client via getPublishedSoftwareList
    if (typeof window !== "undefined") {
      try {
        const res = await fetch("/api/software?all=1", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as Software[];
          if (Array.isArray(data) && data.length > 0) {
            const sanitized = data.map(sanitizeSoftware);
            // Keep local cache in sync (offline fallback)
            try {
              const { idbSaveAll } = await import("@/lib/indexedDB");
              idbSaveAll(sanitized).catch(() => {});
            } catch {}
            return sanitized;
          }
        }
      } catch {}
    }
    if (typeof window === "undefined") return softwareData;

    try {
      // Try IndexedDB first (offline fallback)
      const { idbGetAll } = await import("@/lib/indexedDB");
      const data = await idbGetAll();
      if (data.length > 0) {
        const sanitized = data.map(sanitizeSoftware);
        const needsSave = sanitized.some((s, i) => s.screenshots.length !== (data[i] as unknown as { screenshots?: unknown[] }).screenshots?.length);
        if (needsSave) {
          // Background migration: remove game banners from app screenshots
          saveSoftwareList(sanitized).catch(() => {});
          try { window.dispatchEvent(new Event("software-data-changed")); } catch {}
        }
        return sanitized;
      }
    } catch {
      // IndexedDB failed, fall through to localStorage
    }

    // Fallback to localStorage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("softwareData");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const sanitized = parsed.map(sanitizeSoftware);
            const needsSave = sanitized.some((s, i) => s.screenshots.length !== (parsed[i] as { screenshots?: unknown[] }).screenshots?.length);
            if (needsSave) {
              saveSoftwareList(sanitized).catch(() => {});
              try { window.dispatchEvent(new Event("software-data-changed")); } catch {}
            }
            return sanitized;
          }
        } catch {}
      }

      // chunked fallback: softwareData_chunks = count, softwareData_0, softwareData_1, ...
      const chunkCountRaw = localStorage.getItem("softwareData_chunks");
      if (chunkCountRaw) {
        try {
          const count = parseInt(chunkCountRaw, 10);
          if (!isNaN(count) && count > 0) {
            const combined: Software[] = [];
            for (let i = 0; i < count; i++) {
              const chunkRaw = localStorage.getItem(`softwareData_${i}`);
              if (!chunkRaw) continue;
              const chunk = JSON.parse(chunkRaw);
              if (Array.isArray(chunk)) combined.push(...chunk);
            }
            if (combined.length > 0) {
              const sanitized = combined.map(sanitizeSoftware);
              const needsSave = sanitized.some((s, i) => s.screenshots.length !== (combined[i] as { screenshots?: unknown[] }).screenshots?.length);
              if (needsSave) {
                saveSoftwareList(sanitized).catch(() => {});
                try { window.dispatchEvent(new Event("software-data-changed")); } catch {}
              }
              return sanitized;
            }
          }
        } catch {}
      }
    }
    return softwareData.map(sanitizeSoftware);
  })();

  softwareCache = await cachePromise;
  return softwareCache;
}

export async function getSoftwareByIdLive(id: string): Promise<Software | undefined> {
  const list = await getSoftwareList();
  return list.find((s) => s.id === id);
}

/** Returns only published items (and legacy items without a status field).
 *  Use this on client-facing pages. */
export async function getPublishedSoftwareList(): Promise<Software[]> {
  const all = await getSoftwareList();
  const hasValidLinks = (s: Software) => Array.isArray(s.downloadLinks) && s.downloadLinks.some((l) => typeof l.url === "string" && l.url.trim().startsWith("http") && l.url.trim().length > 10);
  return all.filter((s) => (!s.status || s.status === "published") && hasValidLinks(s));
}

/** Alias – returns every item regardless of status.
 *  Use this on admin pages. */
export async function getAllSoftwareList(): Promise<Software[]> {
  return getSoftwareList();
}

export async function getSoftwareByCategoryLive(categoryId: string): Promise<Software[]> {
  const list = await getSoftwareList();
  return list.filter((s) => s.category === categoryId);
}

export async function searchSoftwareLive(query: string): Promise<Software[]> {
  const list = await getSoftwareList();
  const lower = query.toLowerCase();
  return list.filter(
    (s) =>
      s.title.toLowerCase().includes(lower) ||
      s.description.toLowerCase().includes(lower) ||
      s.category.toLowerCase().includes(lower)
  );
}

function slimSoftwareForStorage(item: Software): Software {
  // More aggressive slimming for games with many download links (repacks)
  const isRepack = (item.downloadLinks || []).some(l => l.type === "repack" && (l.parts || 0) > 1);
  const isLarge = (item.downloadLinks || []).length > 10;

  return {
    ...item,
    description: item.description?.substring(0, isLarge ? 200 : 500) || "",
    screenshots: item.screenshots?.slice(0, isLarge ? 1 : 3) || [],
    features: item.features?.slice(0, isLarge ? 3 : 8) || [],
    systemRequirements: item.systemRequirements?.substring(0, isLarge ? 100 : 300) || "",
    downloadLinks: item.downloadLinks?.map((l) => ({
      ...l,
      // Remove partLinks for repacks - they can be reconstructed from the main URL
      partLinks: undefined,
      lastChecked: undefined,
      archivedTitle: undefined,
      archivedDescription: undefined,
    })) || [],
  };
}

export function clearChunkedStorage() {
  const raw = localStorage.getItem("softwareData_chunks");
  if (raw) {
    const count = parseInt(raw, 10);
    if (!isNaN(count)) {
      for (let i = 0; i < count; i++) localStorage.removeItem(`softwareData_${i}`);
    }
    localStorage.removeItem("softwareData_chunks");
  }
}

export function clearSoftwareStorage() {
  try {
    localStorage.removeItem("softwareData");
    clearChunkedStorage();
    // also clear any legacy numbered keys that may have been left behind (up to 50)
    for (let i = 0; i < 50; i++) localStorage.removeItem(`softwareData_${i}`);
    localStorage.removeItem("softwareData_chunks");
    window.dispatchEvent(new Event("software-data-changed"));
    return true;
  } catch {
    return false;
  }
}

export function getStorageInfo(): { hasSingle: boolean; chunkCount: number; totalKeys: number; approxSizeKB: number } {
  let size = 0;
  let totalKeys = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("softwareData")) {
      totalKeys++;
      size += (localStorage.getItem(k)?.length || 0);
    }
  }
  return {
    hasSingle: !!localStorage.getItem("softwareData"),
    chunkCount: parseInt(localStorage.getItem("softwareData_chunks") || "0", 10) || 0,
    totalKeys,
    approxSizeKB: Math.round(size / 1024),
  };
}

function saveChunked(data: Software[], chunkSize = 500): boolean {
  const chunks: Software[][] = [];
  for (let i = 0; i < data.length; i += chunkSize) chunks.push(data.slice(i, i + chunkSize));
  try {
    clearChunkedStorage();
    localStorage.removeItem("softwareData");
    for (let i = 0; i < chunks.length; i++) {
      localStorage.setItem(`softwareData_${i}`, JSON.stringify(chunks[i]));
    }
    localStorage.setItem("softwareData_chunks", String(chunks.length));
    return true;
  } catch {
    // try smaller chunks
    try {
      for (let i = 0; i < chunks.length; i++) localStorage.removeItem(`softwareData_${i}`);
      localStorage.removeItem("softwareData_chunks");
    } catch {}
    return false;
  }
}

export async function saveSoftwareList(data: Software[]): Promise<boolean> {
  // Invalidate in-memory cache so subsequent getSoftwareList() reads fresh data
  softwareCache = null;
  cachePromise = null;

  // Try server first (shared, Hetzner volume) — so manual adds show on client
  if (typeof window !== "undefined") {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const token = localStorage.getItem("adminToken") || "";
      if (token) headers["x-admin-token"] = token;
      const res = await fetch("/api/software", {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });
      if (res.ok) {
        // Keep local cache in sync for offline fallback
        try {
          const { idbSaveAll } = await import("@/lib/indexedDB");
          await idbSaveAll(data);
          clearChunkedStorage();
          localStorage.removeItem("softwareData");
        } catch {}
        return true;
      }
    } catch {}
  }

  try {
    // Try IndexedDB first (much larger quota, offline fallback)
    const { idbSaveAll } = await import("@/lib/indexedDB");
    const success = await idbSaveAll(data);
    if (success) {
      // Clear localStorage to avoid conflicts
      clearChunkedStorage();
      localStorage.removeItem("softwareData");
      return true;
    }
    console.warn("IndexedDB save failed, falling back to localStorage...");
  } catch (err) {
    console.warn("IndexedDB save failed, falling back to localStorage...", err);
  }

  // Fallback to localStorage
  try {
    clearChunkedStorage();
    localStorage.setItem("softwareData", JSON.stringify(data));
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      console.warn("localStorage quota exceeded, slimming data...");
      const slimmed = data.map(slimSoftwareForStorage);
      try {
        clearChunkedStorage();
        localStorage.setItem("softwareData", JSON.stringify(slimmed));
        return true;
      } catch {
        try {
          // More aggressive minimal: keep only 3 download links max, truncate heavily
          const minimal = data.map((s) => ({
            ...s,
            screenshots: s.screenshots?.slice(0, 1) || [],
            features: [],
            systemRequirements: "",
            downloadLinks: s.downloadLinks?.slice(0, 3) || [],
            description: s.description?.substring(0, 150) || "",
          }));
          clearChunkedStorage();
          localStorage.setItem("softwareData", JSON.stringify(minimal));
          return true;
        } catch {
          console.warn("Still too large, trying chunked storage with aggressive slimming...");
          // chunked slimmed with smaller chunks
          const slimmedChunked = data.map(slimSoftwareForStorage);
          if (saveChunked(slimmedChunked, 200)) return true;
          const ultraMinimal = slimmedChunked.map((s) => ({
            ...s,
            screenshots: s.screenshots?.slice(0, 1) || [],
            features: [],
            systemRequirements: "",
            description: s.description?.substring(0, 100) || "",
            downloadLinks: s.downloadLinks?.slice(0, 2) || [],
          } as unknown as Software));
          if (saveChunked(ultraMinimal, 150)) return true;
          console.error("Cannot save to localStorage even after chunked slimming. Data too large.");
          return false;
        }
      }
    }
    return false;
  }
}

export async function initSoftwareData() {
  if (typeof window === "undefined") return;

  try {
    const { idbGetAll } = await import("@/lib/indexedDB");
    const data = await idbGetAll();
    if (data.length === 0) {
      await saveSoftwareList(softwareData);
    }
  } catch {
    const stored = localStorage.getItem("softwareData");
    if (!stored) {
      try {
        await saveSoftwareList(softwareData);
      } catch {}
    }
  }
}

export async function incrementDownloads(id: string): Promise<number> {
  if (typeof window === "undefined") return 0;
  const list = await getSoftwareList();
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) return 0;
  const newCount = (list[idx].downloads || 0) + 1;
  list[idx] = { ...list[idx], downloads: newCount };
  await saveSoftwareList(list);
  recordDownloadEvent(id);
  return newCount;
}

const DOWNLOAD_STATS_KEY = "downloadStats";

export function recordDownloadEvent(id: string): void {
  if (typeof window === "undefined") return;
  const today = new Date().toISOString().split("T")[0];
  let stats: Record<string, number> = {};
  try {
    stats = JSON.parse(localStorage.getItem(DOWNLOAD_STATS_KEY) || "{}");
  } catch {}
  stats[today] = (stats[today] || 0) + 1;
  try {
    localStorage.setItem(DOWNLOAD_STATS_KEY, JSON.stringify(stats));
    window.dispatchEvent(new CustomEvent("download-stats-changed"));
  } catch {}
}

export async function getDownloadStats(): Promise<{ date: string; count: number }[]> {
  const DAYS = 14;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days: Date[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  const dayKeys = days.map((d) => d.toISOString().split("T")[0]);

  let baseline: number[] = new Array(DAYS).fill(0);

  if (typeof window !== "undefined") {
    try {
      const activeWeights = new Array(DAYS).fill(0);
      let totalActiveWeight = 0;
      const list = await getSoftwareList();
      for (const sw of list) {
        const created = sw.createdAt ? new Date(sw.createdAt) : null;
        if (!created || isNaN(created.getTime())) continue;
        created.setHours(0, 0, 0, 0);
        const startIdx = days.findIndex((d) => d.getTime() >= created.getTime());
        const start = startIdx === -1 ? 0 : startIdx;
        const end = DAYS - 1;
        for (let i = start; i <= end; i++) {
          activeWeights[i] += 1;
          totalActiveWeight += 1;
        }
      }
      const totalDownloads = list.reduce((sum, s) => sum + (s.downloads || 0), 0);
      if (totalActiveWeight > 0 && totalDownloads > 0) {
        for (let i = 0; i < DAYS; i++) {
          baseline[i] = (activeWeights[i] / totalActiveWeight) * totalDownloads;
        }
      }
    } catch {}
  }

  let real: Record<string, number> = {};
  if (typeof window !== "undefined") {
    try {
      real = JSON.parse(localStorage.getItem(DOWNLOAD_STATS_KEY) || "{}") as Record<string, number>;
    } catch {}
  }

  return dayKeys.map((date, i) => ({
    date,
    count: Math.round((baseline[i] || 0) + (real[date] || 0)),
  }));
}

export function parseSizeGB(size: string): number | null {
  if (!size) return null;
  const match = size.toLowerCase().match(/([\d.]+)\s*(mb|gb|tb)/);
  if (!match) return null;
  const value = parseFloat(match[1]);
  if (isNaN(value)) return null;
  const unit = match[2];
  if (unit === "mb") return value / 1024;
  if (unit === "tb") return value * 1024;
  return value;
}

// ─── Status management ────────────────────────────────────────────────────

export async function updateSoftwareStatus(
  ids: string[],
  status: "pending" | "published" | "archived"
): Promise<number> {
  const list = await getSoftwareList();
  let changed = 0;
  for (const id of ids) {
    const idx = list.findIndex((s) => s.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], status, updatedAt: new Date().toISOString() };
      changed++;
    }
  }
  if (changed > 0) await saveSoftwareList(list);
  return changed;
}

export async function getSoftwareCountByStatus(): Promise<{
  total: number;
  pending: number;
  published: number;
  archived: number;
}> {
  const list = await getSoftwareList();
  let pending = 0;
  let published = 0;
  let archived = 0;
  for (const s of list) {
    if (s.status === "pending") pending++;
    else if (s.status === "archived") archived++;
    else published++; // "published" or missing (legacy)
  }
  return { total: list.length, pending, published, archived };
}

