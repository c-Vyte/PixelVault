/**
 * Group raw download links into the data model used for software entries.
 *
 * Multi-part repacks are served as N links to the same file hoster
 * (datanodes.to/<code>/Game.part1.rar, part2.rar, …). These should collapse
 * into a single "repack" link with `parts` + `partLinks[]`; standalone links
 * stay as individual direct/torrent/official entries. Client-safe (no Node
 * APIs) so both the import page and the software editor can use it.
 */

export type LinkType = "official" | "repack" | "direct" | "cracked" | "torrent";

export interface RawLink {
  url: string;
  name?: string;
  type?: LinkType | string;
}

export interface GroupedLink {
  name: string;
  url: string;
  type: LinkType;
  parts?: number;
  partLinks?: { part: number; url: string }[];
  status?: "unknown";
}

/** Extract a "part N" number from a URL (path or hash fragment), else null. Supports: part1.rar, part01.rar, _part1, .001, .r00, .r01 */
export function detectPartNumber(url: string): number | null {
  if (!url || url.startsWith("magnet:")) return null;
  let file = "";
  try {
    const u = new URL(url);
    const isMega = /mega\.(nz|co\.nz|io)$/i.test(u.hostname);
    const hash = isMega ? "" : u.hash.replace(/^#/, "");
    file = decodeURIComponent(hash || u.pathname.split("/").pop() || "");
  } catch {
    file = url;
  }
  // part1.rar / part01.rar / .part1.rar / _part01 / .r00 / .r01 / .001
  const m =
    file.match(/[._-]part?0*(\d+)\s*(?:\.(?:rar|zip|7z|exe|001))?\s*$/i) ||
    file.match(/\.r0*(\d{1,3})(?:\.|$)/i) ||
    file.match(/\.(\d{3})(?:\.|$)/);
  if (m) {
    const n = parseInt(m[1], 10);
    // .r00 is actually part 0 in WinRAR old style (file.r00 = part 1), normalize to 1
    if (/\.r0*0+(?:\.|$)/i.test(file) && n === 0) return 1;
    if (n >= 0 && n <= 999) return n === 0 ? 1 : n;
  }
  return null;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url;
  }
}

/**
 * A stable "archive identity" from a part URL: filename with the part number and
 * numeric padding removed, so Game.part1.rar / Game.part2.rar share a key but
 * two different files on the same host do not.
 */
function archiveBaseName(url: string): string {
  let file = "";
  try {
    const u = new URL(url);
    const isMega = /mega\.(nz|co\.nz|io)$/i.test(u.hostname);
    const hash = isMega ? "" : u.hash.replace(/^#/, "");
    file = decodeURIComponent(hash || u.pathname.split("/").pop() || "");
  } catch {
    file = url;
  }
  return file
    .replace(/[._-]part?0*\d+\s*(\.(rar|zip|7z|exe|001))?$/i, "$1")
    .replace(/\.r0*\d+(\.|$)/i, "$1")
    .replace(/\.\d{3}(\.|$)/i, "$1")
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i, "");
}

/**
 * Build grouped links: links that carry a part number and share a host + type
 * become a single repack entry; everything else passes through individually.
 */
export function groupLinks(raw: RawLink[], classifyType?: (url: string) => LinkType): GroupedLink[] {
  const out: GroupedLink[] = [];
  const groups = new Map<string, { url: string; part: number; name: string; type: LinkType }[]>();

  const typeOf = (l: RawLink): LinkType => {
    if (l.type === "torrent" || l.url.startsWith("magnet:")) return "torrent";
    if (l.type && ["official", "repack", "direct", "cracked", "torrent"].includes(l.type)) return l.type as LinkType;
    return classifyType ? classifyType(l.url) : "direct";
  };

  for (const l of raw) {
    const url = (l.url || "").trim();
    if (!url) continue;
    const part = detectPartNumber(url);
    if (part) {
      const type = typeOf(l);
      // Torrents/magnets are never multipart file groups.
      if (type !== "torrent") {
        const key = `${type}|${hostOf(url)}|${archiveBaseName(url)}`;
        const arr = groups.get(key) || [];
        arr.push({ url, part, name: l.name || "Download", type });
        groups.set(key, arr);
        continue;
      }
    }
  }

  // Emit grouped multipart entries first — renumber sequentially (1..N) for clean display
  for (const [, arr] of groups) {
    if (arr.length === 0) continue;
    const sorted = [...arr].sort((a, b) => a.part - b.part);
    // Only treat as a multipart repack when there really are multiple parts
    if (sorted.length > 1) {
      // Detect gaps (e.g., part40,41) — we still show 1..N sequentially, but preserve original for reference
      out.push({
        name: sorted[0].name.replace(/\s*[\(\[]?part\s*\d+[\)\]]?.*$/i, "").trim() || "Repack",
        url: sorted[0].url,
        type: "repack",
        parts: sorted.length,
        partLinks: sorted.map((s, idx) => ({ part: idx + 1, url: s.url })),
        status: "unknown",
      });
    } else {
      const singlePart = sorted[0].part;
      // Single file that looks like part01.rar but is actually single (e.g., fg-optional-hd-textures.part01.rar with only 1 link)
      // Treat as single direct if it's the only file and part==1, else as 1-part repack if part>1 (e.g., orphan part40)
      if (singlePart > 1) {
        out.push({
          name: sorted[0].name.replace(/\s*[\(\[]?part\s*\d+[\)\]]?.*$/i, "").trim() || "Repack",
          url: sorted[0].url,
          type: "repack",
          parts: 1,
          partLinks: [{ part: 1, url: sorted[0].url }],
          status: "unknown",
        });
      } else {
        out.push({ name: sorted[0].name, url: sorted[0].url, type: sorted[0].type, parts: 1, partLinks: [], status: "unknown" });
      }
    }
  }

  // Then standalone (non-part) links.
  for (const l of raw) {
    const url = (l.url || "").trim();
    if (!url) continue;
    if (detectPartNumber(url) && !(l.type === "torrent" || url.startsWith("magnet:"))) continue; // consumed above
    out.push({
      name: l.name || "Download",
      url,
      type: typeOf(l),
      parts: 1,
      partLinks: [],
      status: "unknown",
    });
  }

  return out;
}
