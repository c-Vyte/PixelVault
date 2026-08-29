import type { HosterResolver, ResolveInput, ResolveResult } from "../types";
import { HOSTERS } from "../registry";
import { hosterRequest } from "../hosterHttp";

/** PixelDrain: open JSON API. /u/<id> landing -> /api/file/<id> -> name/size; direct = /api/file/<id>?dl=1 */
export const pixeldrainResolver: HosterResolver = {
  meta: HOSTERS.pixeldrain,
  matches(url: string): boolean {
    return /(^|\.)(pixeldrain\.(com|net|dev)|pixel\.drain)$/i.test(new URL(url).hostname);
  },
  async resolve(input: ResolveInput): Promise<ResolveResult> {
    const { url, signal, timeoutMs = 15000 } = input;
    const base: ResolveResult = { inputUrl: url, hoster: "pixeldrain", label: HOSTERS.pixeldrain.label, ok: false };
    try {
      const u = new URL(url);
      const id = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() || "");
      if (!id || id === "l") return { ...base, reason: "Could not parse file id" };
      // /l/<id> lists are folders; the /l/<id>/zip endpoint downloads the bundle
      const isList = /^\/l\//.test(u.pathname);
      const api = isList ? `https://pixeldrain.com/api/list/${id}` : `https://pixeldrain.com/api/file/${id}`;
      const res = await hosterRequest(api, { signal, timeoutMs, headers: { Accept: "application/json" } });
      if (res.status === 404) return { ...base, alive: false, reason: "File not found on PixelDrain" };
      if (!res.ok) return { ...base, alive: res.status < 500, reason: `HTTP ${res.status}` };
      let name: string | undefined;
      try {
        const json = JSON.parse(res.text);
        name = json.name || json.title || undefined;
      } catch { /* ignore */ }
      const direct = isList
        ? `https://pixeldrain.com/api/list/${id}/zip`
        : `https://pixeldrain.com/api/file/${id}?download`;
      return { ...base, ok: true, alive: true, directUrl: direct, fileName: name };
    } catch (err) {
      return { ...base, reason: err instanceof Error ? err.message : "PixelDrain error" };
    }
  },
};

/** GoFile: anonymous guest token -> /api/accounts?authToken -> content metadata. */
export const gofileResolver: HosterResolver = {
  meta: HOSTERS.gofile,
  matches(url: string): boolean {
    return /(^|\.)gofile\.(io|com)$/i.test(new URL(url).hostname);
  },
  async resolve(input: ResolveInput): Promise<ResolveResult> {
    const { url, signal, timeoutMs = 15000 } = input;
    const base: ResolveResult = { inputUrl: url, hoster: "gofile", label: HOSTERS.gofile.label, ok: false };
    try {
      const u = new URL(url);
      // /d/<code> or /d/<code>/<file>
      const m = u.pathname.match(/\/d\/([A-Za-z0-9]+)/);
      if (!m) return { ...base, reason: "Could not parse gofile code" };
      const code = m[1];

      const guest = await hosterRequest("https://api.gofile.io/accounts", {
        method: "POST",
        signal,
        timeoutMs,
        headers: { Accept: "application/json" },
      });
      let token = "";
      try {
        token = JSON.parse(guest.text)?.data?.token || "";
      } catch { /* ignore */ }

      const contentRes = await hosterRequest(
        `https://api.gofile.io/contents/${code}?wt=4fd6sg89d7s6&cache=true`,
        { signal, timeoutMs, headers: token ? { Authorization: `Bearer ${token}`, Accept: "application/json" } : { Accept: "application/json" } }
      );
      if (contentRes.status === 404) return { ...base, alive: false, reason: "GoFile content not found/expired" };
      let name: string | undefined;
      let direct: string | undefined;
      try {
        const json = JSON.parse(contentRes.text) as {
          data?: { name?: string; link?: string; children?: Record<string, { link?: string }> };
        };
        const data = json?.data;
        if (data) {
          name = data.name || undefined;
          const children = data.children ? Object.values(data.children) : [];
          const childLink = children.find((c) => c?.link)?.link;
          direct = childLink || data.link;
        }
      } catch { /* ignore */ }
      if (direct) return { ...base, ok: true, alive: true, directUrl: direct, fileName: name };
      if (contentRes.ok) return { ...base, alive: true, fileName: name, reason: "GoFile folder reachable" };
      return { ...base, reason: `HTTP ${contentRes.status}` };
    } catch (err) {
      return { ...base, reason: err instanceof Error ? err.message : "GoFile error" };
    }
  },
};

/** KrakenFiles: public API at /api/v1/file/<id> returns url + name. */
export const krakenfilesResolver: HosterResolver = {
  meta: HOSTERS.krakenfiles,
  matches(url: string): boolean {
    return /(^|\.)krakenfiles\.com$/i.test(new URL(url).hostname);
  },
  async resolve(input: ResolveInput): Promise<ResolveResult> {
    const { url, signal, timeoutMs = 15000 } = input;
    const base: ResolveResult = { inputUrl: url, hoster: "krakenfiles", label: HOSTERS.krakenfiles.label, ok: false };
    try {
      const id = new URL(url).pathname.split("/").filter(Boolean).pop() || "";
      if (!id) return { ...base, reason: "Could not parse krakenfiles id" };
      const res = await hosterRequest(`https://krakenfiles.com/api/v1/file/${id}`, {
        signal,
        timeoutMs,
        headers: { Accept: "application/json" },
      });
      if (res.status === 404) return { ...base, alive: false, reason: "File not found on KrakenFiles" };
      let direct: string | undefined;
      let name: string | undefined;
      try {
        const json = JSON.parse(res.text);
        direct = json?.data?.url || json?.url;
        name = json?.data?.name || json?.name;
      } catch { /* ignore */ }
      if (direct) return { ...base, ok: true, alive: true, directUrl: direct, fileName: name };
      if (res.ok) return { ...base, alive: true, reason: "KrakenFiles page reachable" };
      return { ...base, reason: `HTTP ${res.status}` };
    } catch (err) {
      return { ...base, reason: err instanceof Error ? err.message : "KrakenFiles error" };
    }
  },
};

/**
 * Generic fallback for XFileSharing-style hosts (megaup, send.cm, buzzheavier,
 * mediafire, multiup, ...): fetch the landing page and look for either a
 * redirect to the download node, an embedded direct URL, or a clear alive/dead
 * signal. Never throws — worst case is "unknown".
 */
const DIRECT_URL_HINTS =
  /https?:\/\/[a-z0-9.-]+\/(?:d|dl|download|files?|get)\/[^\s"'<>\\]+|https?:\/\/[a-z0-9.-]+\.(?:rackcdn|cdn)\.[^\s"'<>\\]+/i;

export function makeGenericResolver(id: "filekeeper" | "buzzheavier" | "1fichier" | "sendcm" | "megaup" | "mediafire" | "multiup" | "generic"): HosterResolver {
  const meta = HOSTERS[id];
  return {
    meta,
    matches(url: string): boolean {
      try {
        return meta.hosts.test(new URL(url).hostname.replace(/^www\./, ""));
      } catch {
        return false;
      }
    },
    async resolve(input: ResolveInput): Promise<ResolveResult> {
      const { url, signal, timeoutMs = 15000 } = input;
      const base: ResolveResult = { inputUrl: url, hoster: id, label: meta.label, ok: false };
      try {
        const res = await hosterRequest(url, { signal, timeoutMs });
        const head = res.text.slice(0, 4000);
        if (/just a moment|cf-chl|challenge-platform/i.test(head)) {
          return { ...base, blocked: true, reason: "Cloudflare challenge" };
        }
        if (res.status === 404 || /file not found|not exist|removed|deleted|expired|no longer available/i.test(head)) {
          return { ...base, alive: false, reason: `${meta.label} reports file missing` };
        }
        const dl = res.text.match(DIRECT_URL_HINTS)?.[0];
        if (dl && /\.(rar|zip|7z|exe|iso|bin|part|mp4|mkv|apk|dmg|tar|gz)(\?|$)/i.test(dl)) {
          return { ...base, ok: true, alive: true, directUrl: dl.replace(/&amp;/g, "&") };
        }
        if (res.ok || res.status === 403) {
          return { ...base, alive: true, reason: res.status === 403 ? "Protected but reachable" : "Landing page reachable" };
        }
        return { ...base, reason: `HTTP ${res.status}` };
      } catch (err) {
        return { ...base, reason: err instanceof Error ? err.message : "Network error" };
      }
    },
  };
}
