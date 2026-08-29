import type { HosterResolver, ResolveInput, ResolveResult } from "../types";
import { HOSTERS } from "../registry";
import { hosterRequest } from "../hosterHttp";

/**
 * MediaFire resolution.
 *
 * File pages render the direct URL server-side (it only requires JS on the
 * page for the button to be *clicked*, the href itself is present):
 *   <a id="downloadButton" href="https://download123.mediafire.com/<token>/<file>">
 * Older pages use `<a class="popsok">`. Instant-download links return the file
 * bytes directly (non-HTML content type), in which case the landing URL itself
 * is already the direct link. Also some responses embed an aria-label/obfuscated
 * "downloadLink" / skry... block with the URL.
 */

// Direct MediaFire download hosts (download123.mediafire.com / download.mediafire.com)
const DIRECT_RE = /https?:\/\/download\d*\.mediafire\.com\/[^\s"'<>\\]+/i;

export const mediafireResolver: HosterResolver = {
  meta: HOSTERS.mediafire,

  matches(url: string): boolean {
    return /(^|\.)mediafire\.com$/i.test(new URL(url).hostname);
  },

  async resolve(input: ResolveInput): Promise<ResolveResult> {
    const { url, signal, timeoutMs = 20000 } = input;
    const base: ResolveResult = {
      inputUrl: url,
      hoster: "mediafire",
      label: HOSTERS.mediafire.label,
      ok: false,
    };
    try {
      // Best-effort: fetch whatever mediafire.com URL we were given and look
      // for the direct link / a missing-file marker.
      const res = await hosterRequest(url, { signal, timeoutMs });

      // Instant download / non-HTML → the link itself is the file
      const ct = (res.headers["content-type"] || "").toLowerCase();
      if (res.status === 200 && ct && !ct.includes("text/html") && !ct.includes("application/xhtml")) {
        return { ...base, ok: true, alive: true, directUrl: res.url };
      }

      const head = res.text.slice(0, 6000);
      if (res.status === 404 || /not valid|has been removed|file has been deleted|error.{0,20}404/i.test(head)) {
        return { ...base, alive: false, reason: "MediaFire: file removed/invalid" };
      }
      if (/just a moment|cf-chl|challenge-platform/i.test(head)) {
        return { ...base, blocked: true, reason: "Cloudflare challenge" };
      }

      // 1. Direct URL on the download button
      const btn = res.text.match(/<a\b[^>]*\bid=["']?downloadButton["']?[^>]*\bhref=["']([^"']+)["']/i)
        || res.text.match(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*\bid=["']?downloadButton/i);
      let direct = btn?.[1] || "";

      // 2. Older popsok / aria-click
      if (!direct) {
        const popsok = res.text.match(/<a\b[^>]*\bclass=["'][^"']*popsok[^"']*["'][^>]*\bhref=["']([^"']+)["']/i)
          || res.text.match(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*\bclass=["'][^"']*popsok/i);
        direct = popsok?.[1] || "";
      }

      // 3. Any embedded download*.mediafire.com URL
      if (!direct) {
        direct = res.text.match(DIRECT_RE)?.[0] || "";
      }

      // File name / size from the page
      const name = res.text.match(/<div[^>]*class=["'][^"']*filename[^"']*["'][^>]*>\s*([^<]+?)\s*</i)?.[1]?.trim()
        || res.text.match(/"nm"\s*:\s*"([^"]+)"/)?.[1]
        || undefined;

      if (direct && /^https?:\/\//i.test(direct)) {
        return { ...base, ok: true, alive: true, directUrl: direct.replace(/&amp;/g, "&"), fileName: name };
      }

      if (res.ok) return { ...base, alive: true, fileName: name, reason: "Page reachable; direct link requires click/JS" };
      return { ...base, reason: `HTTP ${res.status}` };
    } catch (err) {
      return { ...base, reason: err instanceof Error ? err.message : "MediaFire error" };
    }
  },
};
