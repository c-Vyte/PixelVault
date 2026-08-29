import type { HosterResolver, ResolveInput, ResolveResult } from "./types";
import { identifyHoster, isFileHosterUrl, isTorrentUrl, hostnameOf } from "./registry";
import { fuckingfastResolver } from "./resolvers/fuckingfast";
import { datanodesResolver } from "./resolvers/datanodes";
import { pixeldrainResolver, gofileResolver, krakenfilesResolver, makeGenericResolver } from "./resolvers/simpleHosts";
import { browserResolveHoster } from "./browserResolve";

const RESOLVERS: HosterResolver[] = [
  datanodesResolver,
  fuckingfastResolver,
  pixeldrainResolver,
  gofileResolver,
  krakenfilesResolver,
  makeGenericResolver("filekeeper"),
  makeGenericResolver("buzzheavier"),
  makeGenericResolver("1fichier"),
  makeGenericResolver("sendcm"),
  makeGenericResolver("megaup"),
  makeGenericResolver("mediafire"),
  makeGenericResolver("multiup"),
  makeGenericResolver("generic"),
];

export function resolverForUrl(url: string): HosterResolver | null {
  for (const r of RESOLVERS) {
    try {
      if (r.matches(url)) return r;
    } catch {
      /* malformed URL */
    }
  }
  return null;
}

export interface ResolveOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Try the Playwright browser when HTTP is blocked/fails. Default true. */
  useBrowser?: boolean;
  /** Skip hosters whose only resolution path is the browser (fast batches). */
  httpOnly?: boolean;
}

/**
 * Resolve a single file-hoster landing URL.
 * - Torrents/magnets and non-hoster URLs return `{ ok:false, alive:true }`
 *   markers so the caller can classify without an HTTP roundtrip.
 * - HTTP resolver runs first; when it reports a CF/captcha block and the
 *   hoster is browser-capable, the Playwright fallback runs.
 */
export async function resolveHosterLink(rawUrl: string, options: ResolveOptions = {}): Promise<ResolveResult> {
  const { signal, timeoutMs, useBrowser = true, httpOnly = false } = options;

  if (rawUrl.startsWith("magnet:") || isTorrentUrl(rawUrl)) {
    return {
      inputUrl: rawUrl,
      hoster: "generic",
      label: "Torrent",
      ok: false,
      alive: true,
      reason: "torrent",
    };
  }

  const meta = identifyHoster(rawUrl) || (isFileHosterUrl(rawUrl)
    ? { id: "generic" as const, label: "File host", hosts: /.*/, priority: 10 }
    : null);

  if (!meta) {
    return { inputUrl: rawUrl, hoster: "generic", label: hostnameOf(rawUrl) || "Link", ok: false, reason: "not-a-hoster" };
  }

  const resolver = resolverForUrl(rawUrl);
  if (!resolver) {
    return { inputUrl: rawUrl, hoster: meta.id, label: meta.label, ok: false, reason: "no-resolver" };
  }

  const input: ResolveInput = { url: rawUrl, signal, timeoutMs };

  let result: ResolveResult;
  try {
    result = await resolver.resolve(input);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Resolver error";
    result = {
      inputUrl: rawUrl,
      hoster: meta.id,
      label: meta.label,
      ok: false,
      reason: /fetch failed|network|timed out|abort|enotfound|econn|socket|ssl|tls|unreachable/i.test(msg)
        ? "network"
        : msg,
    };
  }

  // HTTP transport failures mean "we couldn't tell", NOT "the file is dead" —
  // never let a resolver outage push the admin toward torrents.
  if (!result.ok && !result.alive && /network|fetch failed|timed out|abort|enotfound|econnreset|econnrefused|socket|ssl|tls|unreachable/i.test(result.reason || "")) {
    result = { ...result, reason: "network" };
  }

  // Browser fallback for Cloudflare/Turnstile gates and failed HTTP on
  // browser-capable hosters.
  const needsBrowserPass =
    useBrowser &&
    !httpOnly &&
    !result.ok &&
    (result.blocked || (meta.needsBrowser && !result.alive) || (meta.needsBrowser && result.reason?.includes("browser")));

  if (needsBrowserPass) {
    const browserResult = await browserResolveHoster(meta.id, { ...input, timeoutMs: 45000 });
    if (browserResult) {
      // Prefer a successful browser result; otherwise keep HTTP's alive signal
      if (browserResult.ok || browserResult.alive) return browserResult;
    }
  }

  return result;
}

export interface BatchResolveOptions extends ResolveOptions {
  /** Max concurrent resolutions. Default 4 (hosters rate-limit aggressively). */
  concurrency?: number;
  onProgress?: (done: number, total: number, result: ResolveResult) => void;
}

/** Resolve many URLs with a bounded concurrency pool; order is preserved. */
export async function resolveHosterLinks(urls: string[], options: BatchResolveOptions = {}): Promise<ResolveResult[]> {
  const { concurrency = 4, onProgress, ...rest } = options;
  const results: ResolveResult[] = new Array(urls.length);
  let cursor = 0;
  let done = 0;

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, urls.length)) }, async () => {
    while (cursor < urls.length) {
      const i = cursor++;
      // Per-link timeout guard so one dead hoster can't stall the batch.
      const result = await resolveHosterLink(urls[i], rest);
      results[i] = result;
      done++;
      onProgress?.(done, urls.length, result);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Classify a set of download links after resolution:
 *  - direct: at least one file hoster link is alive
 *  - torrentOnly: hosters dead/missing but torrent links exist
 *  - none: nothing usable
 */
export function classifyResolvedLinks(
  links: { url: string; type?: string }[],
  resolved: ResolveResult[]
): { hasDirect: boolean; hasTorrent: boolean; deadHosterUrls: string[] } {
  const byUrl = new Map(resolved.map((r) => [r.inputUrl, r]));
  let hasDirect = false;
  let hasTorrent = false;
  const deadHosterUrls: string[] = [];

  for (const link of links) {
    const r = byUrl.get(link.url);
    const isTorrent = link.type === "torrent" || isTorrentUrl(link.url);
    if (isTorrent) {
      hasTorrent = true;
      continue;
    }
    if (r) {
      if (r.ok || r.alive) {
        hasDirect = true;
      } else if (r.blocked || r.reason === "network" || r.reason === "not-a-hoster") {
        // Cloudflare/Turnstile/network outage — we could NOT verify, so never
        // declare the mirror dead (would wrongly push toward torrents).
        hasDirect = true;
      } else {
        deadHosterUrls.push(link.url);
      }
    } else if (isFileHosterUrl(link.url) || link.type === "direct" || link.type === "repack") {
      // Unresolved hoster link — optimistically treat as present.
      hasDirect = true;
    }
  }

  return { hasDirect, hasTorrent, deadHosterUrls };
}

export { identifyHoster, isFileHosterUrl, isTorrentUrl } from "./registry";
export type { ResolveResult, HosterId } from "./types";
