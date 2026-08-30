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
    .replace(/\b(directors|editions?|deluxe|ultimate|gold|goty|game of the year|complete|remaster(ed)?|repack|fitgirl|codex|skidrow|plaza|crack|update|v\d[\d.]*|build\s*\d+|all\s*dlc?|bonus|full|pc|free|download)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cheap similarity score 0..1 based on shared tokens. */
function similarity(a: string, b: string): number {
  const ta = new Set(norm(a).split(" ").filter(Boolean));
  const tb = new Set(norm(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let common = 0;
  ta.forEach((t) => { if (tb.has(t)) common++; });
  // containment matters: "blud" query vs "blud" title
  return common / Math.max(ta.size, tb.size);
}

interface SteamItem { id: number; name: string; tiny_image?: string; }

async function steamSearch(title: string): Promise<SteamItem[]> {
  const q = encodeURIComponent(title.replace(/^#+/, "").replace(/\s*[\(\[].*?(repack|fitgirl|codex|skidrow).*?[\)\]]/i, "").trim());
  const res = await fetch(`https://store.steampowered.com/api/storesearch/?term=${q}&cc=us&l=english`, {
    headers: { "User-Agent": UA },
    signal: timeout(REQ_TIMEOUT),
  });
  if (!res.ok) throw new Error(`steam ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

/** Try Steam first; pick the best-matching app, return a few candidate images. */
async function steamBanner(title: string): Promise<{ url: string; kind: string } | null> {
  const items = await steamSearch(title);
  if (items.length === 0) return null;

  // Rank results by name similarity rather than blindly taking items[0].
  const scored = items
    .map((it) => ({ it, score: similarity(title, it.name) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  // Require a plausible match so we don't attach an unrelated game's banner.
  if (best.score < 0.45 && items.length > 0) {
    // Fall back to the first result only if it's a strong containment match.
    if (similarity(title, best.it.name) < 0.35) return null;
  }
  const id = best.it.id;
  // header.jpg = 460x215 landscape banner; library_hero = 1920x620 wide banner.
  return { url: `https://cdn.akamai.steamstatic.com/steam/apps/${id}/library_hero.jpg`, kind: "steam-library-hero" };
}

/** Secondary Steam image if the hero 404s. */
function steamFallbackImages(appId: number): string[] {
  return [
    `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/capsule_616x353.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/page_bg_raw.jpg`,
  ];
}

const ALLOWED_IMG_HOSTS = /(steamstatic|steampowered|akamai|cloudflare|steamcdn|gog-cdn|gog\.com|epicgames|ubi\.com|ubisoft|rockstargames|microsoft|xbox|playstation|ign|pcgamingwiki|wikimedia|githubusercontent|moddb|indiedb|bandainamco|ea\.com|cdn\.)/i;
const IMG_EXT = /\.(jpe?g|png|webp)(\?|$)/i;

function absUrl(u: string, base: string): string {
  try { return new URL(u, base).href; } catch { return ""; }
}

function pickImageFromHtml(html: string, base: string): string | null {
  // 1. OG / twitter image (highest signal)
  const meta =
    html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image(?::src)?)["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image(?::src)?)["']/i)?.[1];
  if (meta) return absUrl(meta.replace(/&amp;/g, "&"), base);

  // 2. Largest-looking <img> with an allowed host (game banners live on CDNs)
  const imgRe = /<img[^>]+(?:src|data-src|data-original)=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["'][^>]*>/gi;
  const candidates: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html))) {
    const src = absUrl(m[1].replace(/&amp;/g, "&"), base);
    if (!src) continue;
    const tag = m[0];
    const w = parseInt(tag.match(/width=["']?(\d{3,4})/i)?.[1] || "0", 10);
    // Prefer wide images (banners are 460+ wide).
    if (w && w < 300) continue;
    candidates.push(src);
    if (candidates.length >= 20) break;
  }
  const onCdn = candidates.find((c) => ALLOWED_IMG_HOSTS.test(c));
  return onCdn || candidates[0] || null;
}

/** DuckDuckGo HTML search → top result pages → og:image. Robust to lite endpoint changes. */
async function duckImage(title: string): Promise<string | null> {
  const queries = [`${title} game steam banner`, `${title} game cover`];
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
        // DDG wraps result targets in uddg= redirect params or plain hrefs
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

    // Visit the top result pages and pull a banner-ish image.
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

/** Verify an image URL actually resolves (HEAD→GET fallback). */
async function imageExists(url: string): Promise<boolean> {
  for (const method of ["HEAD", "GET"] as const) {
    try {
      const res = await fetch(url, {
        method,
        headers: { "User-Agent": UA },
        signal: timeout(6000),
        redirect: "follow",
      });
      if (method === "GET") res.body?.cancel();
      if (res.ok) return true;
      if (res.status === 405 || res.status === 403) continue;
      return false;
    } catch {
      if (method === "HEAD") continue;
      return false;
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  let body: { title?: unknown; kind?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const tried: string[] = [];
  const providers: string[] = [];

  // 1. Steam (best match) with image-type fallbacks
  try {
    const steam = await steamBanner(title);
    if (steam) {
      tried.push(steam.url);
      if (await imageExists(steam.url)) {
        recordApiCall({ route: "/api/ai/fetch-banner", provider: "steam-hero", ok: true, latencyMs: Date.now() - started });
        return NextResponse.json({ banner: steam.url, provider: "steam-library-hero", title });
      }
      const appId = steam.url.match(/apps\/(\d+)/)?.[1];
      if (appId) {
        for (const fb of steamFallbackImages(Number(appId))) {
          tried.push(fb);
          if (await imageExists(fb)) {
            recordApiCall({ route: "/api/ai/fetch-banner", provider: "steam-fallback", ok: true, latencyMs: Date.now() - started });
            return NextResponse.json({ banner: fb, provider: "steam", title });
          }
        }
      }
      providers.push("steam");
    }
  } catch { /* fall through to web */ }

  // 2. Web search (DuckDuckGo → result page og:image)
  try {
    const web = await duckImage(title);
    if (web) {
      recordApiCall({ route: "/api/ai/fetch-banner", provider: "web-og", ok: true, latencyMs: Date.now() - started });
      return NextResponse.json({ banner: web, provider: "web", title });
    }
  } catch { /* no banner */ }

  recordApiCall({ route: "/api/ai/fetch-banner", provider: "none", ok: false, latencyMs: Date.now() - started, error: "not found" });
  return NextResponse.json(
    { error: "No banner found on the internet for this title. Try a more exact title, or add the banner manually.", tried: tried.slice(0, 8) },
    { status: 404 }
  );
}
