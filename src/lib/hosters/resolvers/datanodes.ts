import type { HosterResolver, ResolveInput, ResolveResult } from "../types";
import { HOSTERS } from "../registry";
import { hosterRequest, CookieJar, extractSetCookies } from "../hosterHttp";

/**
 * datanodes.to resolution (XFileSharing-Pro derived, verified against public
 * extractors):
 *  1. GET the landing page — establishes the session and (in browser mode)
 *     clears the Cloudflare/Turnstile gate.
 *  2. POST https://datanodes.to/download with the XFS form:
 *        op=download2, id=<fileCode>, method_free=..., dl=1, ...
 *     The response is JSON {"url": "<node download url>"} on success, or a
 *     302 Location to the download node.
 *  Node URLs look like https://rnode2.datanodes.to:8443/d/<token>/<name> and
 *  are session/IP scoped (ipBound).
 */
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

const DL_NODE_RE = /https:\/\/[a-z0-9.-]*datanodes\.[a-z]+(?::\d+)?\/d\/[^\s"'<>]+/i;

export const datanodesResolver: HosterResolver = {
  meta: HOSTERS.datanodes,

  matches(url: string): boolean {
    return /(^|\.)datanodes\.(to|cc|net|com)$/i.test(new URL(url).hostname);
  },

  async resolve(input: ResolveInput): Promise<ResolveResult> {
    const { url, signal, timeoutMs = 20000 } = input;
    const landing = parseLanding(url);
    const base: ResolveResult = {
      inputUrl: url,
      hoster: "datanodes",
      label: HOSTERS.datanodes.label,
      ok: false,
      via: "http",
      fileName: landing?.name || undefined,
    };
    if (!landing) return { ...base, reason: "Malformed datanodes URL" };

    const jar = new CookieJar();

    // 1. Landing page (session + possible cf_clearance cookie)
    const page = await hosterRequest(url, { signal, timeoutMs });
    jar.absorb(extractSetCookies(page));
    jar.absorb([page.headers["cookie"] || ""]);

    if (/just a moment|cf-chl|challenge-platform|cf_chl_opt|turnstile|challenges\.cloudflare/i.test(page.text)) {
      return { ...base, blocked: true, reason: "Cloudflare/Turnstile — needs browser" };
    }
    if (page.status === 404 || /file not found|not exist|removed|deleted|no such file/i.test(page.text.slice(0, 3000))) {
      return { ...base, alive: false, reason: "File not found" };
    }

    // Some pages embed the node URL directly (already-passed challenges)
    const embedded = page.text.match(DL_NODE_RE);

    // 2. POST the XFS download form
    const origin = new URL(url).origin;
    const form = {
      op: "download2",
      id: landing.code,
      rand: "",
      referer: `${origin}/download`,
      method_free: "Free Download >>",
      method_premium: "",
      dl: 1,
    };

    const post = await hosterRequest(`${origin}/download`, {
      method: "POST",
      form,
      redirect: "manual",
      signal,
      timeoutMs,
      headers: {
        Cookie: jar.header() || `lang=english; file_name=${landing.name}; file_code=${landing.code};`,
        Origin: origin,
        Referer: `${origin}/download`,
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json, text/javascript, */*; q=0.01",
      },
    });

    let direct: string | null = embedded ? embedded[0] : null;

    // JSON body: {"url": "..."}
    if (!direct) {
      try {
        const json = JSON.parse(post.text);
        if (json && typeof json.url === "string" && json.url) {
          direct = decodeURIComponent(json.url);
        }
      } catch {
        /* not JSON — check headers/body below */
      }
    }
    // Redirect to a download node
    if (!direct && post.headers.location) {
      const loc = post.headers.location;
      if (/datanodes|\/d\//i.test(loc)) direct = new URL(loc, url).href;
    }
    // Body fallback
    if (!direct) {
      const m = post.text.match(DL_NODE_RE);
      if (m) direct = m[0];
    }

    if (direct) {
      return { ...base, ok: true, alive: true, directUrl: decodeURIComponent(direct) };
    }

    // Captcha / wait page responses mean the file exists but HTTP can't pass
    if (post.status === 403 || /turnstile|captcha|cf-chl|wait/i.test(post.text.slice(0, 2000))) {
      return { ...base, blocked: true, alive: true, reason: "Captcha/wait gate — needs browser" };
    }
    if (page.ok || post.status < 500) {
      return { ...base, alive: true, reason: `Landing reachable (POST ${post.status}); direct link requires browser` };
    }
    return { ...base, reason: `HTTP ${post.status}` };
  },
};
