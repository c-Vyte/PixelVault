import { NextRequest, NextResponse } from "next/server";
import { BROWSER_HEADERS, isCloudflareChallenge } from "@/lib/fetchUtils";
import { recordApiCall } from "@/lib/apiUsage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UA = BROWSER_HEADERS["User-Agent"];
const REQ_TIMEOUT = 9000;

function timeout(ms: number) {
  return AbortSignal.timeout(ms);
}

/** Normalise a title for fuzzy comparison. */
function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/&amp;/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(
      /\b(directors|editions?|deluxe|ultimate|gold|goty|game of the year|complete|remaster(ed)?|repack|fitgirl|codex|skidrow|plaza|crack|update|v\d[\d.]*|build\s*\d+|all\s*dlc?|bonus|full|pc|free|download|edition)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

/** Cheap similarity score 0..1 based on shared tokens. */
function similarity(a: string, b: string): number {
  const ta = norm(a).split(" ").filter(Boolean);
  const tb = norm(b).split(" ").filter(Boolean);
  if (ta.length === 0 || tb.length === 0) return 0;
  const setB = new Set(tb);
  let common = 0;
  new Set(ta).forEach((t) => { if (setB.has(t)) common++; });
  // Dice-style: weight coverage of the shorter (query) side more heavily.
  const dice = (2 * common) / (new Set(ta).size + setB.size);
  const containment = common / Math.min(new Set(ta).size, setB.size);
  return Math.max(dice, containment * 0.9);
}

interface SteamItem { id: number; name: string; tiny_image?: string; price?: unknown; }

async function steamSearch(title: string): Promise<SteamItem[]> {
  const clean = title.replace(/^#+/, "").replace(/\s*[\(\[].*?(repack|fitgirl|codex|skidrow|plaza).*?[\)\]]/gi, "").trim();
  const q = encodeURIComponent(clean);
  const res = await fetch(`https://store.steampowered.com/api/storesearch/?term=${q}&cc=us&l=english`, {
    headers: { "User-Agent": UA },
    signal: timeout(REQ_TIMEOUT),
  });
  if (!res.ok) throw new Error(`steam ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

interface SteamDetail {
  name?: string;
  header_image?: string;
  capsule_image?: string;
  capsule_imagev5?: string;
  library_hero_image?: string;
  library_hero?: string;
  screenshots?: { path_full: string }[];
  background_raw?: string;
  movies?: { webm?: { max?: string; 480?: string } }[];
}

async function steamAppDetail(appId: number): Promise<SteamDetail | null> {
  try {
    const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}&cc=us&l=english`, {
      headers: { "User-Agent": UA },
      signal: timeout(REQ_TIMEOUT),
    });
    if (!res.ok) return null;
    const json = await res.json() as Record<string, { success: boolean; data: SteamDetail }>;
    const entry = json[String(appId)];
    return entry?.success ? entry.data : null;
  } catch {
    return null;
  }
}

/** Candidate image URLs for a Steam app, in preference order. */
function steamCandidates(appId: number, detail: SteamDetail | null, want: "banner" | "poster"): string[] {
  const cdn = (file: string) => `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/${file}`;
  const banner = [
    detail?.library_hero_image,
    detail?.library_hero,
    cdn("library_hero.jpg"),
    detail?.header_image,
    cdn("header.jpg"),
    detail?.background_raw,
    cdn("page_bg_raw.jpg"),
    ...(detail?.screenshots?.map((s) => s.path_full) || []),
  ];
  const poster = [
    detail?.capsule_imagev5 || detail?.capsule_image,
    cdn("library_600x900.jpg"),
    cdn("capsule_616x353.jpg"),
    detail?.header_image,
    cdn("header.jpg"),
  ];
  const list = (want === "poster" ? poster : banner)
    .filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u));
  return Array.from(new Set(list));
}

const ALLOWED_IMG_HOSTS = /(steamstatic|steampowered|akamai|gog-cdn|gog\.com|epicgames|ubi\.com|ubisoft|rockstargames|microsoft|xbox|playstation|ign|pcgamingwiki|wikimedia|githubusercontent|moddb|indiedb|bandainamco|ea\.com|cdn\.)/i;
const IMG_EXT = /\.(jpe?g|png|webp)(\?|$)/i;

function absUrl(u: string, base: string): string {
  try { return new URL(u, base).href; } catch { return ""; }
}

function pickImageFromHtml(html: string, base: string): string | null {
  const meta =
    html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image(?::src)?)["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image(?::src)?)["']/i)?.[1];
  if (meta) return absUrl(meta.replace(/&amp;/g, "&"), base);

  const imgRe = /<img[^>]+(?:src|data-src|data-original)=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["'][^>]*>/gi;
  const candidates: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html))) {
    const src = absUrl(m[1].replace(/&amp;/g, "&"), base);
    if (!src) continue;
    const tag = m[0];
    const w = parseInt(tag.match(/width=["']?(\d{3,4})/i)?.[1] || "0", 10);
    if (w && w < 300) continue;
    candidates.push(src);
    if (candidates.length >= 20) break;
  }
  return candidates.find((c) => ALLOWED_IMG_HOSTS.test(c)) || candidates[0] || null;
}

/** DuckDuckGo HTML search → top result pages → og:image. */
async function duckImage(title: string, want: "banner" | "poster"): Promise<string | null> {
  const shape = want === "poster" ? "cover poster" : "banner header";
  const queries = [`${title} game steam ${shape}`, `${title} game ${shape}`];
  for (const query of queries) {
    let resultLinks: string[] = [];
    for (const endpoint of [
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`,
    ]) {
      try {
        const res = await fetch(endpoint, {
          headers: { "User-Agent": UA, Accept: "text/html" },
          signal: timeout(REQ_TIMEOUT),
        });
        if (!res.ok) continue;
        const html = await res.text();
        const links: string[] = [];
        const re = /href="(https?:\/\/[^"]+)"/gi;
        let mm: RegExpExecArray | null;
        while ((mm = re.exec(html))) {
          let href = mm[1].replace(/&amp;/g, "&");
          const uddg = href.match(/[?&]uddg=([^&]+)/i);
          if (uddg) { try { href = decodeURIComponent(uddg[1]); } catch { /* keep */ } }
          if (!/duckduckgo\.com|duck\.com/.test(href) && /^https?:\/\//.test(href)) links.push(href);
        }
        if (links.length) { resultLinks = links.slice(0, 6); break; }
      } catch { /* try next endpoint */ }
    }

    for (const pageUrl of resultLinks) {
      try {
        const res = await fetch(pageUrl, {
          headers: { "User-Agent": UA, Accept: "text/html" },
          signal: timeout(REQ_TIMEOUT),
          redirect: "follow",
        });
        if (!res.ok) continue;
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("text/html")) continue;
        const html = await res.text();
        if (isCloudflareChallenge(html)) continue;
        const img = pickImageFromHtml(html, pageUrl);
        if (img && IMG_EXT.test(img)) return img;
      } catch { /* next page */ }
    }
  }
  return null;
}

/**
 * Validate an image URL resolves to a real, reasonably-sized raster.
 * Uses a ranged GET so we don't download the whole asset.
 */
async function validateImage(url: string): Promise<boolean> {
  for (const method of ["GET", "HEAD"] as const) {
    try {
      const res = await fetch(url, {
        method,
        headers: { "User-Agent": UA, Range: "bytes=0-2047" },
        signal: timeout(6000),
        redirect: "follow",
      });
      if (!res.ok && res.status !== 206) {
        if (res.status === 405 || res.status === 403) continue;
        return false;
      }
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      const len = Number(res.headers.get("content-length") || 0);
      const looksImage = ct.includes("image/") || IMG_EXT.test(url);
      // Steam/CDN images are reliably real; only reject obvious non-images or
      // placeholder-sized responses.
      if (looksImage && (len === 0 || len > 400 || /steamstatic|steampowered|akamai/.test(url))) {
        if (method === "GET") res.body?.cancel();
        return true;
      }
      if (method === "GET") res.body?.cancel();
      return looksImage;
    } catch {
      if (method === "HEAD") continue;
      return false;
    }
  }
  return false;
}

async function firstValid(urls: string[]): Promise<string | null> {
  for (const u of urls) {
    if (await validateImage(u)) return u;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  let body: { title?: unknown; kind?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  const want: "banner" | "poster" = body.kind === "poster" ? "poster" : "banner";

  const candidates: { url: string; provider: string }[] = [];

  // 1. Steam — best-match app, then appdetails for verified image variants.
  try {
    const items = await steamSearch(title);
    if (items.length > 0) {
      const scored = items
        .map((it) => ({ it, score: similarity(title, it.name) }))
        .sort((a, b) => b.score - a.score);
      // Accept the top result when it's a reasonable match; try the first 2 apps.
      const top = scored.slice(0, scored[0].score >= 0.3 ? 2 : 1);
      for (const { it, score } of top) {
        if (score < 0.2 && it !== scored[0].it) continue;
        const detail = await steamAppDetail(it.id);
        const urls = steamCandidates(it.id, detail, want);
        const valid = await firstValid(urls);
        if (valid) {
          recordApiCall({ route: "/api/ai/fetch-banner", provider: "steam", ok: true, latencyMs: Date.now() - started });
          return NextResponse.json({
            banner: valid,
            provider: "steam",
            steamAppId: it.id,
            matchedTitle: detail?.name || it.name,
            kind: want,
            candidates: urls.slice(0, 6),
            title,
          });
        }
        urls.forEach((url) => candidates.push({ url, provider: "steam" }));
      }
    }
  } catch { /* fall through to web */ }

  // 2. Web search (DuckDuckGo → result page og:image)
  try {
    const web = await duckImage(title, want);
    if (web && (await validateImage(web))) {
      recordApiCall({ route: "/api/ai/fetch-banner", provider: "web-og", ok: true, latencyMs: Date.now() - started });
      return NextResponse.json({ banner: web, provider: "web", kind: want, title });
    }
  } catch { /* no banner */ }

  recordApiCall({ route: "/api/ai/fetch-banner", provider: "none", ok: false, latencyMs: Date.now() - started, error: "not found" });
  return NextResponse.json(
    { error: "No banner found on the internet for this title. Try a more exact title, request a poster instead, or add it manually.", candidates: candidates.slice(0, 8) },
    { status: 404 }
  );
}
