import type { HosterResolver, ResolveInput, ResolveResult } from "../types";
import { HOSTERS } from "../registry";
import { hosterRequest } from "../hosterHttp";

/**
 * MEGA (mega.nz / mega.co.nz) resolution.
 *
 * MEGA files are stored encrypted end-to-end and the AES key lives in the URL
 * fragment (`#<id>!<key>`), so a usable direct URL can ONLY be constructed in
 * the browser (the download is decrypted client-side by mega.io). We therefore
 * never return a directUrl — but the public `g.api.mega.co.nz/cs` API lets us
 * verify a link is alive and read the filename + size, which is exactly what
 * the importer needs for the alive-vs-dead/torrent-fallback decision.
 *
 * Public-link file request: POST https://g.api.mega.co.nz/cs
 *   [ { "a": "g", "g": 1, "p": "<fileId>" } ]   → [ { "s": <size>, "at": "<encName>" } ]
 *   dead links return [ { "ea": <errno> } ] (e.g. -8 ENOENT / -13 etc.).
 */

function parseMegaLink(url: string): { kind: "file" | "folder" | "embed"; id: string } | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (!/mega\.(nz|co\.nz|io)$/i.test(host)) return null;
    // https://mega.nz/file/<id>#<key>  |  /#!<id>!<key>  |  /embed/<id>  |  /folder/<id>
    const pathId = u.pathname.match(/\/(file|folder|embed)\/([a-z0-9_-]+)/i);
    if (pathId) {
      return {
        kind: pathId[1].toLowerCase() === "folder" ? "folder" : pathId[1].toLowerCase() === "embed" ? "embed" : "file",
        id: pathId[2],
      };
    }
    // Legacy /#!<id>!<key>  (IDs use base64url-ish chars incl. uppercase)
    const hashId = (u.hash || "").match(/^#?!?([FfNn])?([A-Za-z0-9_-]{6,})/);
    if (hashId) {
      const typ = hashId[1]?.toLowerCase();
      return { kind: typ === "f" ? "folder" : "file", id: hashId[2] };
    }
    return null;
  } catch {
    return null;
  }
}

function megaErrorReason(ea: unknown): string {
  switch (Number(ea)) {
    case -8: return "MEGA: file/folder no longer exists";
    case -13: return "MEGA: link dead (EOENT)";
    case -9: return "MEGA: link expired";
    case -16: return "MEGA: not available";
    default: return "MEGA: link not accessible";
  }
}

export const megaResolver: HosterResolver = {
  meta: HOSTERS.mega,

  matches(url: string): boolean {
    return /(^|\.)mega\.(nz|co\.nz|io)$/i.test(new URL(url).hostname);
  },

  async resolve(input: ResolveInput): Promise<ResolveResult> {
    const { url, signal, timeoutMs = 15000 } = input;
    const parsed = parseMegaLink(url);
    const base: ResolveResult = { inputUrl: url, hoster: "mega", label: HOSTERS.mega.label, ok: false };
    if (!parsed) return { ...base, reason: "Could not parse MEGA link" };

    try {
      // Folders: use "p" with "n" node type; files: "g":1 for public file info.
      const body = parsed.kind === "folder"
        ? [{ a: "g", n: parsed.id, g: 1 }]
        : [{ a: "g", g: 1, p: parsed.id }];

      const res = await hosterRequest("https://g.api.mega.co.nz/cs", {
        method: "POST",
        body: JSON.stringify(body),
        signal,
        timeoutMs,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
      });

      let json: unknown;
      try {
        json = JSON.parse(res.text);
      } catch {
        json = null;
      }
      const entry = Array.isArray(json) ? json[0] : json;
      const rec = entry as { s?: number; at?: string; ea?: number; name?: string } | undefined;

      if (!rec || typeof rec.ea === "number") {
        return { ...base, alive: false, reason: megaErrorReason(rec?.ea) };
      }

      // "s" (size) present on files means the node exists. Folders return an "f"/"ok" array.
      const alive = typeof rec.s === "number" || Array.isArray((rec as { ok?: unknown }).ok) || typeof rec.at === "string";
      if (!alive) {
        return { ...base, alive: false, reason: megaErrorReason(undefined) };
      }

      const fileSize = typeof rec.s === "number" ? formatSize(rec.s) : undefined;

      // The filename inside "at" is encrypted with the URL key (in the fragment)
      // and can't be decrypted without crypto code — report the node size, not
      // the name, to avoid returning garbled data.
      return {
        ...base,
        ok: true,
        alive: true,
        fileSize,
        reason: "MEGA link valid (file is encrypted; opens on mega.nz)",
      };
    } catch (err) {
      return { ...base, reason: err instanceof Error ? err.message : "MEGA error" };
    }
  },
};

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}
