import type { HosterResolver, ResolveInput, ResolveResult } from "../types";
import { HOSTERS } from "../registry";
import { hosterRequest, CookieJar, extractSetCookies } from "../hosterHttp";

/**
 * FilesKeep (fileskeep.com) resolution.
 *
 * FilesKeep is an XFileSharing-derived host ("Downloading - Fileskeep.com ::
 * Storage for your files") behind Cloudflare with a download countdown. Flow:
 *   1. GET the landing page  → session + file id ("/<code>/<name>")
 *   2. POST origin + / with op=download2, id=<code> (free download form)
 *      → 302 Location to the download node, or an embedded direct URL in the
 *      countdown page, or JSON {url}.
 * Cloudflare/Turnstile failures hand off to the browser fallback.
 */

const DIRECT_NODE_RE = /https?:\/\/[a-z0-9.-]*fileskeep\.[a-z]+(?:\:\d+)?\/[^\s"'<>]+\.(?:rar|zip|7z|exe|iso|bin|mp4|mkv|apk|dmg|tar|gz|part\d*)[^\s"'<>]*/i;

function parseLanding(url: string): { code: string; name: string } | null {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    if (segments.length === 0) return null;
    return {
      code: decodeURIComponent(segments[0]),
      name: decodeURIComponent(segments[segments.length - 1] || ""),
    };
  } catch {
    return null;
  }
}

export const fileskeepResolver: HosterResolver = {
  meta: HOSTERS.fileskeep,

  matches(url: string): boolean {
    return /(^|\.)fileskeep\.(com|net|org)$/i.test(new URL(url).hostname);
  },

  async resolve(input: ResolveInput): Promise<ResolveResult> {
    const { url, signal, timeoutMs = 20000 } = input;
    const landing = parseLanding(url);
    const base: ResolveResult = {
      inputUrl: url,
      hoster: "fileskeep",
      label: HOSTERS.fileskeep.label,
      ok: false,
      via: "http",
      fileName: landing?.name || undefined,
    };
    if (!landing) return { ...base, reason: "Malformed FilesKeep URL" };

    const jar = new CookieJar();
    const origin = new URL(url).origin;

    const page = await hosterRequest(url, { signal, timeoutMs });
    jar.absorb(extractSetCookies(page));
    jar.absorb([page.headers["cookie"] || ""]);

    if (/just a moment|cf-chl|challenge-platform|cf_chl_opt|turnstile|challenges\.cloudflare/i.test(page.text)) {
      return { ...base, blocked: true, alive: true, reason: "Cloudflare/Turnstile — needs browser" };
    }
    if (page.status === 404 || /file not found|not exist|removed|deleted|no such file|invalid download/i.test(page.text.slice(0, 3000))) {
      return { ...base, alive: false, reason: "FilesKeep: file missing" };
    }

    // Countdown page may already embed the direct node URL
    let direct = page.text.match(DIRECT_NODE_RE)?.[0] || null;
    const fileName = landing.name
      || page.text.match(/<div[^>]*class=["'][^"']*filename[^"']*["'][^>]*>\s*([^<]+?)\s*</i)?.[1]?.trim()
      || page.text.match(/<title>\s*(?:Downloading\s*[-–]?\s*)?([^<]+?)\s*(?:-\s*Fileskeep)?<\/title>/i)?.[1]?.trim()
      || undefined;

    if (!direct) {
      const form = {
        op: "download2",
        id: landing.code,
        rand: "",
        referer: url,
        method_free: "Free Download",
        method_premium: "",
        dl: 1,
      };
      const post = await hosterRequest(`${origin}/`, {
        method: "POST",
        form,
        redirect: "manual",
        signal,
        timeoutMs,
        headers: {
          Cookie: jar.header(),
          Origin: origin,
          Referer: url,
          "X-Requested-With": "XMLHttpRequest",
          Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        },
      });

      try {
        const json = JSON.parse(post.text);
        if (json && typeof json.url === "string" && json.url) direct = decodeURIComponent(json.url);
      } catch { /* not JSON */ }

      if (!direct && post.headers.location) {
        direct = new URL(post.headers.location, url).href;
      }
      if (!direct) {
        direct = post.text.match(DIRECT_NODE_RE)?.[0] || post.text.match(/https?:\/\/[a-z0-9.-]+\/d\/[^\s"'<>]+/i)?.[0] || null;
      }
      if (!direct && /turnstile|captcha|cf-chl|countdown|wait|timer/i.test(post.text.slice(0, 3000))) {
        return { ...base, blocked: true, alive: true, reason: "Captcha/countdown gate — needs browser" };
      }
    }

    if (direct) {
      return { ...base, ok: true, alive: true, directUrl: decodeURIComponent(direct), fileName };
    }

    if (page.ok || page.status === 403) {
      return { ...base, alive: true, fileName, reason: "Landing reachable; direct link requires browser" };
    }
    return { ...base, reason: `HTTP ${page.status}` };
  },
};
