import { gunzipSync } from "node:zlib";

/**
 * Shared HTTP fetching utilities for the importing/pulling features.
 * Consolidates the browser header spoofing, Cloudflare challenge detection,
 * retry/backoff logic, charset decoding and URL hardening that were previously
 * copy-pasted across the import API routes.
 */

export interface FetchResult {
  ok: boolean;
  text: string;
  status: number;
  error?: string;
  contentType?: string;
}

/** Browser-like headers so smaller sites and CDNs treat us as a real browser. */
export const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

/** True when an HTML body looks like a Cloudflare / WAF interstitial page. */
export function isCloudflareChallenge(html: string): boolean {
  return /Just a moment|cf-chl|cFp|c__cf_chl|challenge-platform|cf_chl_opt/i.test(html);
}

/** URL schemes that should never be fetched from the server (SSRF hardening). */
const BLOCKED_SCHEMES = /^(file|ftp|gopher|dict|ldap|tftp|javascript|data|about):/i;

/**
 * Lightweight SSRF guard. Rejects obviously dangerous URL schemes and private
 * hostnames. DNS resolution of the hostname to an IP is deliberately omitted to
 * keep requests fast (resolution happens inside fetch); hostname-level checks
 * still stop the most common internal targets (localhost, 127.x, metadata).
 */
export function assertSafeFetchUrl(rawUrl: string): void {
  const url = new URL(rawUrl);
  if (BLOCKED_SCHEMES.test(url.protocol)) {
    throw new Error(`Blocked URL scheme "${url.protocol}"`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported URL scheme "${url.protocol}"`);
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.startsWith("127.") ||
    host === "169.254.169.254" ||
    host.endsWith(".internal") ||
    host.endsWith(".local")
  ) {
    throw new Error("Blocked private/internal host");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function gunzip(textOrBuffer: Buffer): string {
  try {
    return gunzipSync(textOrBuffer).toString("utf-8");
  } catch {
    return "";
  }
}

export interface FetchTextOptions {
  /** Base timeout for a single attempt, in ms. Default 20000. */
  timeoutMs?: number;
  /** Number of retries on network error / 429. Default 2. */
  retries?: number;
  /** Set to true to require an HTML content type (listing/detail pages). */
  requireHtml?: boolean;
  /** Request headers merged over BROWSER_HEADERS. */
  headers?: Record<string, string>;
  /** AbortSignal to cancel from the caller. */
  signal?: AbortSignal;
}

/**
 * Fetches a URL and returns its text, handling:
 *  - scheme/host SSRF guard
 *  - browser header spoofing
 *  - redirect following
 *  - gzip/deflate/br decompression (content-encoding or raw .gz payloads)
 *  - charset decoding (utf-8 / latin1 / win-125x fallbacks)
 *  - retries with backoff on 429 and transient network errors
 */
export async function fetchText(rawUrl: string, options: FetchTextOptions = {}): Promise<FetchResult> {
  const {
    timeoutMs = 20000,
    retries = 2,
    requireHtml = false,
    headers = {},
    signal,
  } = options;

  let url: URL;
  try {
    url = new URL(rawUrl);
    assertSafeFetchUrl(rawUrl);
  } catch (err) {
    return {
      ok: false,
      text: "",
      status: 0,
      error: err instanceof Error ? err.message : "Invalid URL",
    };
  }

  const isGzipFile = /\.(gz|xml\.gz)$/i.test(url.pathname);

  for (let attempt = 0; attempt <= retries; attempt++) {
    // Combine the caller's signal with our own timeout signal.
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onOuterAbort = () => controller.abort();
    signal?.addEventListener("abort", onOuterAbort);

    try {
      const response = await fetch(url, {
        headers: { ...BROWSER_HEADERS, ...headers },
        redirect: "follow",
        signal: controller.signal,
      });

      if (response.status === 429 && attempt < retries) {
        controller.abort();
        clearTimeout(timer);
        signal?.removeEventListener("abort", onOuterAbort);
        await sleep(1500 * (attempt + 1));
        continue;
      }

      const contentType = response.headers.get("content-type") || "";
      const buffer = new Uint8Array(await response.arrayBuffer());
      const raw = Buffer.from(buffer);

      // Decompress. Node fetch auto-decompresses content-encoding, but a
      // raw .gz sitemap might arrive as application/gzip without an encoding
      // header — handle that case explicitly.
      let text: string;
      const encoding = (response.headers.get("content-encoding") || "").toLowerCase();
      if ((encoding.includes("gzip") || isGzipFile) && raw.length > 2 && raw[0] === 0x1f && raw[1] === 0x8b) {
        text = gunzip(raw);
        if (!text) {
          controller.abort();
          clearTimeout(timer);
          signal?.removeEventListener("abort", onOuterAbort);
          return { ok: false, text: "", status: response.status, error: "Failed to decompress response", contentType };
        }
      } else {
        const charsetMatch = contentType.match(/charset=([\w-]+)/i);
        const charset = charsetMatch
          ? charsetMatch[1].toLowerCase()
          : encoding.includes("br")
            ? // brotli raw is unusual; let fetch handle it — fall back below
              "utf-8"
            : "utf-8";
        try {
          text = new TextDecoder(charset === "utf8" ? "utf-8" : charset).decode(buffer);
        } catch {
          text = new TextDecoder("utf-8").decode(buffer);
        }
      }

      if (response.ok && requireHtml) {
        const ct = contentType.toLowerCase();
        if (!ct.includes("text/html") && !ct.includes("application/xhtml") && ct && !isGzipFile) {
          controller.abort();
          clearTimeout(timer);
          signal?.removeEventListener("abort", onOuterAbort);
          return { ok: false, text: "", status: response.status, error: "Not an HTML page", contentType };
        }
      }

      clearTimeout(timer);
      signal?.removeEventListener("abort", onOuterAbort);
      return { ok: response.ok, text, status: response.status, contentType };
    } catch (err) {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onOuterAbort);
      const aborted = signal?.aborted || timedOut || (err instanceof DOMException && err.name === "AbortError");
      if (aborted && attempt === retries && !signal?.aborted) {
        return { ok: false, text: "", status: 0, error: "Request timed out" };
      }
      if (attempt === retries) {
        return {
          ok: false,
          text: "",
          status: 0,
          error: err instanceof Error ? err.message : "Network error",
        };
      }
      await sleep(800 * (attempt + 1));
    }
  }

  return { ok: false, text: "", status: 0, error: "Max retries exceeded" };
}