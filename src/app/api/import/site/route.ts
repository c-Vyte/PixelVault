import { NextRequest, NextResponse } from "next/server";
import { parseListingPage, type ParsedEntry } from "@/lib/importParser";
import { fetchWithFallback } from "@/lib/fetchers";
import { isCloudflareChallenge } from "@/lib/fetchUtils";

const BLOCKED_HOSTS = ["repacks-games.com"];

/** Hard wall-clock cap for the entire crawl so a single request can't run forever. */
const CRAWL_WALL_CLOCK_MS = 120_000;

function extractSitemapUrls(text: string): string[] {
  const urls = text.match(/<loc>([^<]+)<\/loc>/g) || [];
  return urls.map((u) => u.replace(/<\/?loc>/g, "").trim());
}

function slugToTitle(slug: string): string {
  return slug
    .replace(/\.html?$/i, "")
    .replace(/^\d+-/, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

const JUNK_SITEMAP = /attachment|post_tag|author/;

async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

function isGameUrl(u: URL, origin: string): boolean {
  if (u.origin !== origin) return false;
  const path = u.pathname.replace(/\/$/, "");
  if (path === "/") return false;
  if (/\.html?$/i.test(path)) return true;
  if (/\.(php|xml|css|js|png|jpg|jpeg|webp|gif|svg|ico|torrent)$/i.test(path)) return false;
  const segments = path.split("/").filter(Boolean);
  if (segments.length < 1 || segments.length > 2) return false;
  // WordPress-style taxonomy/pagination/asset prefixes are never games, even
  // with a slug attached (e.g. /category/elamigos-repacks/, /tag/forza-horizon-6/).
  if (/^(category|categories|tag|tags|author|page|wp-content|wp-includes|wp-json|feed|search|news|shop|contact|about|faq|privacy|terms|downloads?|repacks?)$/i.test(segments[0])) return false;
  const last = segments[segments.length - 1];
  if (last.length < 3 || last.length > 140) return false;
  if (/^(home|all-my-repacks-[a-z-]+|popular-repacks(?:-of-the-year)?|pop-repacks)$/i.test(last)) return false;
  return true;
}

/** Pull Sitemap: URLs listed in robots.txt (often reachable when the root page is gated). */
function extractRobotsSitemaps(text: string): string[] {
  const out: string[] = [];
  const re = /^\s*sitemap:\s*(\S+)/gim;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(m[1].trim());
  return out;
}

/** Dedup in-flight fetches so the same sitemap URL isn't fetched twice. */
const inflightFetches = new Map<string, Promise<{ ok: boolean; text: string; status: number; error?: string }>>();

async function fetchUrl(url: string, options: { timeoutMs?: number; requireHtml?: boolean } = {}): Promise<{ ok: boolean; text: string; status: number; error?: string }> {
  const key = url;
  const existing = inflightFetches.get(key);
  if (existing) return existing;

  const promise = fetchWithFallback(url, {
    timeoutMs: options.timeoutMs,
    requireHtml: options.requireHtml,
  }).then(result => ({ ok: result.ok, text: result.text, status: result.status, error: result.error }));

  inflightFetches.set(key, promise);
  promise.finally(() => inflightFetches.delete(key));
  return promise;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  const origin = parsed.origin;

  const blockedHost = parsed.hostname.replace(/^www\./, "").toLowerCase();
  if (BLOCKED_HOSTS.includes(blockedHost)) {
    return NextResponse.json(
      {
        error: `This source (${blockedHost}) is not supported. Its download links are obfuscated redirects that point back to the site instead of real files, so they cannot be imported.`,
        blocked: true,
      },
      { status: 400 }
    );
  }

  const entryMap = new Map<string, ParsedEntry>();

  const addEntry = (e: ParsedEntry) => {
    const key = e.url.split("#")[0].replace(/\/$/, "");
    if (!entryMap.has(key)) entryMap.set(key, e);
  };

  // O(1) dedup instead of the previous O(n) `includes()` scan.
  const sitemapQueue: string[] = [];
  const sitemapSeen = new Set<string>();
  const addIfNew = (u: string) => {
    if (!sitemapSeen.has(u)) {
      sitemapSeen.add(u);
      sitemapQueue.push(u);
    }
  };

  // Wall-clock deadline shared by every phase of the crawl.
  const deadline = Date.now() + CRAWL_WALL_CLOCK_MS;
  const expired = () => Date.now() > deadline;

  // 1. Discover sitemap URLs. We try the homepage, robots.txt and the usual
  //    sitemap paths in parallel — a site may gate the root page (Cloudflare)
  //    while still serving robots.txt / sitemap.xml freely, so a blocked
  //    homepage alone is NOT enough to report the site as protected.
  const sitemapCandidates = [
    "/sitemap_index.xml",
    "/sitemap.xml",
    "/wp-sitemap.xml",
    "/sitemap_index.xml.gz",
    "/sitemap.xml.gz",
  ];
  const [root, robots] = await Promise.all([
    fetchUrl(origin + "/", { timeoutMs: 15000 }),
    fetchUrl(origin + "/robots.txt", { timeoutMs: 12000 }),
  ]);

  if (root.ok && !isCloudflareChallenge(root.text)) {
    const sitemapRefs = root.text.match(/<sitemap><loc>([^<]+)<\/loc>/g);
    const inlineSitemaps = root.text.match(/https?:\/\/[^"'\s<>]+sitemap[^"'\s<>]*\.xml(?:\.gz)?/gi) || [];
    for (const s of [
      ...(sitemapRefs || []).map((x) => x.replace(/<\/?sitemap>|<\/?loc>/g, "")),
      ...inlineSitemaps,
      ...extractRobotsSitemaps(robots.ok ? robots.text : ""),
      ...sitemapCandidates.map((p) => origin + p),
    ]) {
      addIfNew(s);
    }
  } else {
    // Homepage failed or is a challenge — still seed from robots + common paths.
    for (const s of [
      ...extractRobotsSitemaps(robots.ok ? robots.text : ""),
      ...sitemapCandidates.map((p) => origin + p),
    ]) {
      addIfNew(s);
    }
  }
  const rootBlocked =
    (!root.ok && (root.status === 403 || root.status === 503)) ||
    (root.ok && isCloudflareChallenge(root.text));

  // Helper used at the end to decide whether the whole site was unreachable.
  const hintPasteHtml =
    "Open a listing page in your browser, press Ctrl+A then Ctrl+C to copy the page source, " +
    "then switch to 'Paste HTML' mode in the importer.";

  // 2. Walk sitemaps (indexes first), classify each sub-sitemap by its filename.
  //    Fetch in parallel, but process breadth-first so indexes resolve before leaves.
  const categoryUrls = new Set<string>();
  let knownGameUrls = 0;

  let sitemapIdx = 0;
  while (sitemapIdx < sitemapQueue.length && sitemapIdx < 40 && !expired()) {
    const batch = sitemapQueue.slice(sitemapIdx, sitemapIdx + 10).map((s) => ({ sUrl: s }));
    sitemapIdx += batch.length;
    await mapConcurrent(batch, 10, async ({ sUrl }) => {
      if (expired()) return;
      if (JUNK_SITEMAP.test(sUrl.split("/").pop()?.toLowerCase() || "")) return;
      const res = await fetchUrl(sUrl, { timeoutMs: 15000 });
      if (!res.ok) return;
      if (/<sitemapindex/i.test(res.text)) {
        for (const s of extractSitemapUrls(res.text)) addIfNew(s);
        return;
      }
      const name = sUrl.split("/").pop()?.toLowerCase() || "";
      const locs = extractSitemapUrls(res.text);
      for (const loc of locs) {
        try {
          const u = new URL(loc);
          if (u.origin !== origin) continue;
          if (/post-sitemap/.test(name) || /news/.test(name)) {
            const slug = u.pathname.replace(/\/$/, "").split("/").pop() || "";
            if (slug && slug.length >= 3 && slug !== "home") {
              knownGameUrls++;
              addEntry({ title: slugToTitle(slug), url: loc });
            }
          } else if (/category/.test(name) || /page-sitemap/.test(name)) {
            const slug = u.pathname.replace(/^\/|\/$/g, "");
            if (slug && slug.split("/").length <= 2) categoryUrls.add(slug);
          } else if (isGameUrl(u, origin)) {
            knownGameUrls++;
            addEntry({ title: slugToTitle(u.pathname.replace(/\/$/, "").split("/").pop() || ""), url: loc });
          }
        } catch {}
      }
    });
  }

  // 3. If sitemaps yielded nothing, scan the root page HTML for links
  if (entryMap.size === 0 && root.ok && !isCloudflareChallenge(root.text) && !expired()) {
    const entries = parseListingPage(root.text, origin + "/");
    for (const e of entries) {
      try {
        const u = new URL(e.url);
        if (isGameUrl(u, origin)) addEntry(e);
        else if (u.origin === origin && u.pathname.split("/").length === 2 && !u.pathname.endsWith(".html"))
          categoryUrls.add(u.pathname.replace(/^\/|\/$/g, ""));
      } catch {}
    }
  }

  // 4. Crawl category pages (+ pagination) for more entries.
  //    Skip when sitemaps already provided plenty — they cover the whole catalog.
  const allCategories = [...categoryUrls];
  if (entryMap.size < 200 && allCategories.length > 0 && !expired()) {
    const crawled = new Set<string>();
    await mapConcurrent(allCategories.slice(0, 12), 6, async (cat) => {
      const basePath = `/${cat.replace(/^\/|\/$/g, "")}`;
      for (let page = 1; page <= 10; page++) {
        if (expired()) return;
        const pageUrl = page === 1 ? `${origin}${basePath}/` : `${origin}${basePath}/page/${page}/`;
        if (crawled.has(pageUrl)) break;
        crawled.add(pageUrl);
        const res = await fetchUrl(pageUrl, { timeoutMs: 15000 });
        if (!res.ok) break;
        const entries = parseListingPage(res.text, origin + "/");
        let foundAny = false;
        for (const e of entries) {
          try {
            const u = new URL(e.url);
            if (!isGameUrl(u, origin)) continue;
            foundAny = true;
            addEntry(e);
          } catch {}
        }
        const hasNext =
          res.text.includes(`page/${page + 1}/`) ||
          /class=["'][^"']*(?:next|pagination)[^"']*["'][\s\S]{0,2000}?page\/(\d+)\//.test(res.text);
        if (!hasNext || !foundAny) break;
      }
    });
  }

  // 5. If we still have nothing, fall back to whatever the root page listed
  if (entryMap.size === 0 && root.ok && !isCloudflareChallenge(root.text) && !expired()) {
    for (const e of parseListingPage(root.text, origin + "/")) {
      try {
        if (isGameUrl(new URL(e.url), origin)) addEntry(e);
      } catch {}
    }
  }

  // 6. Nothing found. Only report "protected" when every path failed AND we
  //    actually saw a Cloudflare interstitial / WAF block — a plain network
  //    timeout or offline server must not be labelled cloud protected.
  if (entryMap.size === 0) {
    if (rootBlocked || (root.ok && isCloudflareChallenge(root.text))) {
      return NextResponse.json(
        {
          error:
            "This site is protected (Cloudflare or WAF) and blocked automated access. " +
            "Tried the homepage, robots.txt and sitemaps. " +
            hintPasteHtml,
          blocked: true,
        },
        { status: 403 }
      );
    }
    if (!root.ok && !robots.ok) {
      return NextResponse.json(
        {
          error:
            `Could not reach the site (homepage: ${root.error || `HTTP ${root.status}`}; robots.txt: ${
              robots.error || `HTTP ${robots.status}`
            }). ` +
            "Check the URL, or " + hintPasteHtml,
        },
        { status: 502 }
      );
    }
  }

  const entries = Array.from(entryMap.values()).slice(0, 1000);
  return NextResponse.json({
    url,
    source: origin.replace("https://", "").replace("http://", "").replace(/\/$/, ""),
    entries,
    count: entries.length,
    knownGameUrls,
  });
}