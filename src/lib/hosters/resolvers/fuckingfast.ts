import type { HosterResolver, ResolveInput, ResolveResult } from "../types";
import { HOSTERS } from "../registry";
import { hosterRequest, CookieJar, extractSetCookies } from "../hosterHttp";

/**
 * fuckingfast.co resolution flow (verified against public extractors, 2026):
 *  1. GET the landing page (cookies: Cloudflare may challenge — then the
 *     browser-based fallback takes over).
 *  2a. Legacy pages embed the target in JS:
 *        window.open("https://dl.fuckingfast.co/dl/<token>")
 *      or store it as https://fuckingfast.co/dl/<token> (same token, dl host).
 *  2b. Current pages use HTMX: the download button carries
 *        hx-post="/f/<id>/go" (or hx-get); POST it with HX-Request: true and
 *        read the "hx-redirect" (or "location") response header, which points
 *      at the dl host.
 */
const DL_RE = /https:\/\/(?:dl\.)?fuckingfast\.(?:co|com|io)\/dl\/[A-Za-z0-9._~-]+/i;

function fileIdFromUrl(url: string): string | null {
  const m = url.match(/fuckingfast\.(?:co|com|io)\/(?:f\/)?([a-z0-9]+)/i);
  return m ? m[1] : null;
}

function fileNameFromHash(url: string): string | null {
  try {
    const hash = new URL(url).hash.replace(/^#/, "");
    if (!hash) return null;
    const decoded = decodeURIComponent(hash);
    if (/\.[a-z0-9]{2,5}$/i.test(decoded) || /part\d+/i.test(decoded)) return decoded;
    return null;
  } catch {
    return null;
  }
}

export const fuckingfastResolver: HosterResolver = {
  meta: HOSTERS.fuckingfast,

  matches(url: string): boolean {
    return /(^|\.)fuckingfast\.(co|com|io)$/i.test(new URL(url).hostname);
  },

  async resolve(input: ResolveInput): Promise<ResolveResult> {
    const { url, signal, timeoutMs = 20000 } = input;
    const base: ResolveResult = {
      inputUrl: url,
      hoster: "fuckingfast",
      label: HOSTERS.fuckingfast.label,
      ok: false,
      via: "http",
      fileName: fileNameFromHash(url) || undefined,
    };

    const jar = new CookieJar();

    // 1. Landing page
    const page = await hosterRequest(url, {
      redirect: "follow",
      signal,
      timeoutMs,
      headers: jar.size ? { Cookie: jar.header() } : undefined,
    });
    jar.absorb(extractSetCookies(page));
    jar.absorb([page.headers["cookie"] || ""]);

    if (/just a moment|cf-chl|challenge-platform|cf_chl_opt/i.test(page.text)) {
      return { ...base, blocked: true, reason: "Cloudflare challenge — needs browser" };
    }
    if (page.status === 404 || /file not found|not exist|removed|deleted/i.test(page.text.slice(0, 2000))) {
      return { ...base, alive: false, reason: "File not found" };
    }

    // 2a. Embedded dl link in page JS
    const embedded = page.text.match(DL_RE);
    let direct = embedded ? embedded[0].replace(/^https?:\/\/fuckingfast\./i, "https://dl.fuckingfast.") : null;

    // 2b. HTMX flow
    if (!direct) {
      const hxm = page.text.match(/hx-(post|get)=["']([^"']+)["']/i);
      const method = (hxm?.[1] || "post").toUpperCase() as "POST" | "GET";
      const endpoint = hxm
        ? new URL(hxm[2], url).href
        : (() => {
            const id = fileIdFromUrl(url);
            return id ? `https://fuckingfast.co/f/${id}/go` : null;
          })();

      if (endpoint) {
        const api = await hosterRequest(endpoint, {
          method,
          redirect: "manual",
          signal,
          timeoutMs,
          headers: {
            Cookie: jar.header(),
            "HX-Request": "true",
            "HX-Current-URL": url,
            Referer: url,
            Origin: "https://fuckingfast.co",
          },
        });
        jar.absorb(extractSetCookies(api));
        const loc =
          api.headers["hx-redirect"] ||
          api.headers["hx-location"] ||
          api.headers["location"] ||
          "";
        if (loc) {
          const abs = new URL(loc, url).href;
          if (/fuckingfast/.test(abs)) direct = abs;
        }
        // Some deployments answer 200 with the link in the fragment body
        if (!direct) {
          const bodyMatch = api.text.match(DL_RE);
          if (bodyMatch) direct = bodyMatch[0];
        }
      }
    }

    if (direct) {
      return { ...base, ok: true, alive: true, directUrl: direct };
    }

    // Page loaded fine and advertises a download button but no link extracted:
    // report alive so the torrent-fallback prompt is not triggered.
    if (page.ok && /download|hx-post|hx-get/i.test(page.text)) {
      return { ...base, alive: true, reason: "Landing page reachable; direct link requires browser" };
    }
    return { ...base, reason: `HTTP ${page.status}` };
  },
};
