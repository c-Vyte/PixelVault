export interface ParsedEntry {
  title: string;
  url: string;
}

export interface ParsedLink {
  name: string;
  url: string;
  type: "official" | "repack" | "direct" | "cracked" | "torrent";
  part?: number;
  partTotal?: number;
}

export interface ParsedDetail {
  title: string;
  image: string;
  description: string;
  screenshots: string[];
  links: ParsedLink[];
  password?: string;
  contentType?: "game" | "software" | "movie" | "korean" | "tutorial";
}

export function guessContentType(url: string, title: string): ParsedDetail["contentType"] {
  let host = "";
  let path = "";
  try {
    const u = new URL(url);
    host = u.hostname.replace(/^www\./, "").toLowerCase();
    path = u.pathname.toLowerCase();
  } catch {}
  const t = (title || "").toLowerCase();
  const hostIsLightdl = /(lightdload|lightdl|lightdownload)\.xyz/.test(host);
  if (hostIsLightdl) {
    if (/\/(korean-series|korean|kdrama)\//.test(path) || /\bkorean\b/.test(t) || /kdrama|k-drama/.test(t)) return "korean";
    if (/\/(tutorial|udyemy|udemy-courses)\//.test(path) || /\budemy\b|course|tutorial/i.test(t)) return "tutorial";
    if (/\/(movie|movies|film|silver-screen)\//.test(path) || /\b(1080p|720p|4k|hdrip|webrip|x264|x265|bluray)\b/.test(t)) return "movie";
    if (/\/(game|games)\//.test(path) || /\b(pc game|pc-games)\b/.test(t)) return "game";
    return "software";
  }
  if (/\/(movie|movies|film|series|korean-series|korean)\//.test(path)) return "movie";
  if (/\/(game|games)\//.test(path) || /\b(pc game|repack)\b/.test(t)) return "game";
  if (/\b(udemy|tutorial|course)\b/i.test(t)) return "tutorial";
  return "software";
}

const SKIP_PATH = /\.(css|js|json|png|jpe?g|gif|svg|ico|webp|xml|txt|zip|rar)$/i;
const SKIP_HREF = /^(mailto:|tel:|javascript:|#|data:)/i;
const NAV_WORDS = /(^|\/)(home|about|contact|login|log-in|signin|sign-up|register|privacy|terms|sitemap|faq|support|blog|news|download-pc-software|category|tags?|tag\/|page|feed|rss|search|advertise|submit|dmca|disclaimer|cookie|help|press|review|reviews|changelog|version-history|request|donate|premium|store|cart|account|profile|forum|community|wp-content|wp-includes|author|date|feedback|discuss|report|lostpassword|static)\b/i;

export function decodeEntities(text: string): string {
  return text
    .replace(/&#0?38;|&amp;/gi, "&")
    .replace(/&#0?8211;/g, "–")
    .replace(/&#0?8212;/g, "—")
    .replace(/&#0?8217;|&apos;|&#0?39;/g, "'")
    .replace(/&#0?8220;|&#0?8221;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#0?8216;/g, "'")
    .replace(/&#0?8230;/g, "…")
    .replace(/&#0?176;/g, "°");
}

export function extractAnchors(html: string): { text: string; href: string; index: number }[] {
  const anchors: { text: string; href: string; index: number }[] = [];
  const tagRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html)) !== null) {
    const href = decodeEntities(m[1].trim());
    const inner = m[2];
    const text = decodeEntities(
      inner
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    );
    anchors.push({ text, href, index: m.index });
  }
  return anchors;
}

export function cleanTitle(text: string): string {
  return decodeEntities(text)
    .replace(/\s+Free Download\s*$/i, "")
    .replace(/\s+Download\s*$/i, "")
    .replace(/\s+(Latest|New) Version\s*$/i, "")
    .replace(/\s+for (Windows|Mac|Android|PC)\s*$/i, "")
    .replace(/[|].*$/, "")
    .replace(/^\s*-+\s*/, "")
    .replace(/\s*-\s*$/, "")
    .replace(/-{2,}/g, "-")
    .trim();
}

const GENERIC_LINK_NAMES = /^(download|click here|click here to download|download now|download free|free download|get|install|mirror|server|link|here|direct|part \d+|part\d+)$/i;

export function isGenericLinkName(name: string): boolean {
  return GENERIC_LINK_NAMES.test(name.trim());
}

/**
 * Look backwards from a link's position in the HTML for context clues:
 * headings, bold/strong text, labels, or surrounding paragraph text
 * that might contain the actual name of the item being downloaded.
 */
export function extractContextName(html: string, linkIndex: number): string {
  // Look at up to 2000 chars before the link
  const start = Math.max(0, linkIndex - 2000);
  const before = html.slice(start, linkIndex);

  // Try to find a heading (<h1>-<h6>) that contains the link
  const headingMatch = before.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>\s*$/i);
  if (headingMatch) {
    const text = decodeEntities(headingMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (text.length >= 3 && text.length <= 140 && !isGenericLinkName(text)) {
      return stripSiteSuffix(text, "");
    }
  }

  // Try <strong>, <b>, <span class="title">, <span class="name">, <label>
  const boldMatch = before.match(/<(?:strong|b)\s*[^>]*>([\s\S]*?)<\/(?:strong|b)>\s*$/i);
  if (boldMatch) {
    const text = decodeEntities(boldMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (text.length >= 3 && text.length <= 140 && !isGenericLinkName(text)) {
      return text;
    }
  }

  // Try class-based labels: title, name, game-title, entry-title, post-title
  const classMatch = before.match(/<(?:span|div|p|h[1-6]|a)\s[^>]*class=["'][^"']*(?:title|name|game-title|entry-title|post-title|product-title|item-title)[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|div|p|h[1-6]|a)>\s*$/i);
  if (classMatch) {
    const text = decodeEntities(classMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (text.length >= 3 && text.length <= 140 && !isGenericLinkName(text)) {
      return text;
    }
  }

  // Try list item context: <li>...<a> pattern — grab text before the anchor in the same <li>
  const liMatch = before.match(/<li[^>]*>([\s\S]*?)$/i);
  if (liMatch) {
    const liContent = liMatch[1];
    // Get text before the anchor but after the last <a tag
    const lastAnchor = liContent.lastIndexOf("<a");
    const preAnchor = lastAnchor >= 0 ? liContent.slice(0, lastAnchor) : liContent;
    const text = decodeEntities(preAnchor.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (text.length >= 3 && text.length <= 140 && !isGenericLinkName(text)) {
      return text;
    }
  }

  // Last resort: grab the nearest paragraph or div text before the link
  const paraMatch = before.match(/<(?:p|div|span)[^>]*>\s*([\s\S]{0,200}?)\s*$/i);
  if (paraMatch) {
    const text = decodeEntities(paraMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (text.length >= 5 && text.length <= 140 && !isGenericLinkName(text)) {
      return text;
    }
  }

  return "";
}

export function stripSiteSuffix(title: string, sourceHost: string): string {
  let t = cleanTitle(title);
  const hostWords = sourceHost
    .replace(/^www\./, "")
    .split(".")
    .filter((w) => w.length > 2)
    .join("|");
  const suffix = new RegExp(`\\s*[-|–—]\\s*(${hostWords}|FitGirl Repacks|RE-PACKS|FileCR|DODI Repacks).*$`, "i");
  t = t.replace(suffix, "").replace(/\s+-\s*$/i, "").trim();
  const generic = /\s*[-|–—]\s*(Repacks?|Free|Official Website).*$/i;
  t = t.replace(generic, "").replace(/\s+-\s*$/i, "").trim();
  return t;
}

export function absoluteUrl(base: string, href: string): string {
  try {
    const u = new URL(href, base);
    // fuckingfast.co (and a few hosts) put the real filename in the fragment,
    // e.g. /11i3cwkyd61j#Game.part1.rar — keep it so link naming/parts work.
    const hashLooksLikeFile = /^#?.+\.(rar|zip|7z|exe|iso|bin|part|mp4|mkv|apk|dmg|tar|gz)(\b|$)/i.test(u.hash) || /part\d+/i.test(u.hash);
    if (!hashLooksLikeFile) u.hash = "";
    u.search = "";
    return u.href;
  } catch {
    return "";
  }
}

/** Filename hint carried in a hoster URL fragment (fuckingfast style), if any. */
export function fileNameFromUrlHash(url: string): string {
  try {
    const hash = new URL(url).hash.replace(/^#/, "");
    if (!hash) return "";
    const decoded = decodeURIComponent(hash);
    if (/\.(rar|zip|7z|exe|iso|bin|part|mp4|mkv|apk|dmg)(\b|$)/i.test(decoded) || /part\d+/i.test(decoded)) {
      return decoded;
    }
    return "";
  } catch {
    return "";
  }
}

const FILE_HOSTS =
  /(mega\.nz|mega\.co\.nz|mega\.io|mediafire\.com|fileskeep\.|megaup\.|pixeldrain\.com|pixeldrain\.dev|pixeldrain\.net|pixel\.drain|dropbox\.com|drive\.google\.com|1fichier\.com|1fichier\.net|uptobox\.com|uptobox\.eu|uptobox\.net|userscloud|katfile\.com|turbobit\.net|hitfile\.net|uploadrar|filedot|yandex|volafile|anonfiles|zippyshare|ddownload|racaty|go4up|uploadboy|filecr\.com\/download|mirrorace|samdownloads|onlinedown|wonderfulshare|uploadhub|mdtc|doo\.ws|krakenfiles|qload|uploadfly|send\.cm|wetransfer\.com|megaup\.net|datanodes\.|rnode\d*\.datanodes|fuckingfast\.|dl\.fuckingfast|filekeeper\.|buzzheavier|bzzhr\.co|gofile\.|dropgalaxy|up4ever|files\.fm|filesfm|fireload|multifilemirror|k2s\.cc|keep2share\.com|rapidgator\.net|rg\.to|nitroflare\.com|filefactory\.com|filefox\.cc|keep2share|zippyshare|ddl-mirror|mirrored|nocdn|gdrive|mega\.co|anonfiles\.to|bayfiles\.com|letsupload\.io|mixdrop\.co|streamtape\.com|doodstream\.com|filemoon\.sx|krakenfiles\.com|dropapk\.to|uploadhaven\.com|bowfile\.com|sendspace\.com|4shared\.com|zippyshare\.com|dailyuploads\.net|hexupload\.net|down\.la|downupload\.com|clicknupload\.co|filejoker\.net|uploadgig\.com|alfafile\.net|multiup\.|devuploads\.com|voe\.sx|streamlare|streamvid|mp4upload|filepress\.org)/;

export function isDownloadHref(href: string, base: string): boolean {
  if (SKIP_HREF.test(href)) return false;
  if (/^magnet:/.test(href)) return true;
  try {
    const u = new URL(href, base);
    const path = u.pathname.toLowerCase();
    const host = u.hostname.replace(/^www\./, "");
    const search = u.search.toLowerCase();
    if (path.endsWith(".torrent")) return true;
    if (search.includes("do=download")) return true;
    // Known file-hoster links are downloads even when the path contains a
    // nav-ish word (e.g. mega.io/folder/<id>) — check the host first.
    if (FILE_HOSTS.test(host)) return true;
    if (NAV_WORDS.test(path)) return false;
    if (/\/(download|d\/|get|dl|load|file)\b/.test(path)) return true;
  } catch {
    return false;
  }
  return false;
}

export function classifyLinkType(url: string): ParsedLink["type"] {
  if (url.startsWith("magnet:")) return "torrent";
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();
    if (host.includes("steam") || host.includes("epicgames") || host.includes("gog.com") || host.includes("microsoft.com") || host.includes("play.google.com") || host.includes("apps.apple.com"))
      return "official";
    if (path.endsWith(".torrent") || host.includes("1337x") || host.includes("rutor") || host.includes("piratebay") || host.includes("tapochek") || u.search.includes("do=download"))
      return "torrent";
    if (FILE_HOSTS.test(host)) return "direct";
    if (/fitgirl|dodi|repack|corepack|xatab|qoob|steamrip/.test(host) || /repack/.test(path)) return "repack";
    if (/crack|skidrow|codex|plaza|rutracker/.test(host)) return "cracked";
    return "direct";
  } catch {}
  return "direct";
}

export function linkDisplayName(url: string): string {
  if (url.startsWith("magnet:")) return "Torrent (Magnet)";
  try {
    const u = new URL(url);
    if (u.search.includes("do=download")) return "Download Torrent";
    if (u.pathname.toLowerCase().endsWith(".torrent")) return "Torrent File";
    const host = u.hostname.replace(/^www\./, "");
    const known: Record<string, string> = {
      "mega.nz": "MEGA",
      "mega.co.nz": "MEGA",
      "mega.io": "MEGA",
      "www.mediafire.com": "MediaFire",
      "mediafire.com": "MediaFire",
      "fileskeep.com": "FilesKeep",
      "www.fileskeep.com": "FilesKeep",
      "fileskeep.net": "FilesKeep",
      "fileskeep.org": "FilesKeep",
      "drive.google.com": "Google Drive",
      "store.steampowered.com": "Steam",
      "store.epicgames.com": "Epic Games",
      "www.gog.com": "GOG",
      "datanodes.to": "DataNodes",
      "datanodes.cc": "DataNodes",
      "datanodes.net": "DataNodes",
      "fuckingfast.co": "FuckingFast",
      "fuckingfast.com": "FuckingFast",
      "fuckingfast.io": "FuckingFast",
      "dl.fuckingfast.co": "FuckingFast",
      "filekeeper.net": "FileKeeper",
      "filekeeper.org": "FileKeeper",
      "bzzhr.co": "BuzzHeavier",
      "pixeldrain.com": "PixelDrain",
      "pixeldrain.dev": "PixelDrain",
      "filefactory.com": "FileFactory",
      "files.fm": "Files.fm",
      "keep2share.com": "Keep2Share",
      "k2s.cc": "Keep2Share",
      "rapidgator.net": "RapidGator",
      "rg.to": "RapidGator",
      "nitroflare.com": "NitroFlare",
      "1fichier.com": "1Fichier",
      "uptobox.com": "Uptobox",
      "www.microsoft.com": "Microsoft Store",
      "gofile.io": "GoFile",
      "buzzheavier.com": "BuzzHeavier",
      "multiup.io": "MultiUp",
      "megaup.net": "MegaUp",
      "zippyshare.com": "ZippyShare",
      "uploaded.net": "Uploaded",
      "turbobit.net": "Turbobit",
      "hitfile.net": "HitFile",
      "katfile.com": "KatFile",
      "ddownload.com": "DDownload",
      "racaty.io": "Racaty",
      "go4up.com": "Go4Up",
      "krakenfiles.com": "KrakenFiles",
      "send.cm": "Send.cm",
      "filemoon.sx": "FileMoon",
      "doodstream.com": "DoodStream",
      "streamtape.com": "StreamTape",
      "sendspace.com": "SendSpace",
      "uploadgig.com": "UploadGig",
      "alfafile.net": "AlfaFile",
      "dailyuploads.net": "DailyUploads",
      "hexupload.net": "HexUpload",
    };
    return known[host] || host.split(".")[0];
  } catch {
    return "Download";
  }
}

export function extractNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    
    // Try query params first (e.g. ?filename=GameName.zip)
    const filenameParam = u.searchParams.get("filename") || u.searchParams.get("file") || u.searchParams.get("name");
    if (filenameParam) {
      const cleaned = cleanFilename(decodeURIComponent(filenameParam));
      if (cleaned) return cleaned;
    }

    // Try the last meaningful path segment
    const segments = u.pathname.split("/").filter(Boolean);
    let filename = "";
    // Walk backwards to find a meaningful segment (not just 'download', 'dl', 'get')
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i];
      if (!/^(download|dl|get|load|file|files|uploads?|data|cdn|content)$/i.test(seg)) {
        filename = seg;
        break;
      }
    }
    if (!filename && segments.length > 0) {
      filename = segments[segments.length - 1];
    }
    if (!filename) return "";
    
    filename = decodeURIComponent(filename);
    return cleanFilename(filename);
  } catch {
    return "";
  }
}

function cleanFilename(filename: string): string {
  // Remove extension
  let name = filename.replace(/\.(zip|rar|7z|exe|iso|torrent|apk|dmg|pkg|deb|rpm|AppImage|tar\.gz|tar\.xz|tar\.bz2|tar|img|cue|bin|mdf)$/i, "");
  
  // Remove part numbers
  name = name
    .replace(/_?\.?part\d+/gi, "")
    .replace(/\.\d{3}(?:\.|$)/, "")
    .replace(/\.(r\d+)$/, "");
  
  // Remove common prefixes
  name = name.replace(/^(download[_-]?|dl[_-]?|get[_-]?|file[_-]?)/i, "");
  
  // Remove version-like patterns but keep them for later use
  const versionMatch = name.match(/(v\d+(?:\.\d+)+(?:[_-]?\w+)*)/i);
  const version = versionMatch ? versionMatch[1] : "";
  
  // Replace separators with spaces
  name = name.replace(/[-_.]+/g, " ");
  
  // Remove standalone numbers at the end (often part numbers or sizes)
  name = name.replace(/\s+\d{1,3}\s*$/, "");
  
  // Clean up multiple spaces
  name = name.replace(/\s+/g, " ").trim();
  
  // Capitalize words
  name = name.replace(/\b\w/g, c => c.toUpperCase());
  
  // Re-append version if it was stripped
  if (version && !name.includes(version)) {
    name = `${name} ${version}`;
  }
  
  return name || "";
}

export function extractNameFromPageTitle(title: string): string {
  return cleanTitle(title);
}

function detectPart(url: string): { part?: number; partTotal?: number } {
  try {
    const u = new URL(url);
    // Only treat the fragment as a filename when it really is one — MEGA
    // links put an encrypted base64 key in the fragment (#<id>!<key>) which
    // can coincidentally contain "part1", so exclude those hosters.
    const isMega = /mega\.(nz|co\.nz|io)$/i.test(u.hostname);
    const hashName = isMega ? "" : fileNameFromUrlHash(url);
    const filename = decodeURIComponent(hashName || u.pathname.split("/").pop() || "");
    // A "part N" marker only counts when it sits in a filename that ends with
    // an archive extension (avoids matching folder codes like /wp67code/).
    const hasArchiveExt = /\.(rar|zip|7z|exe|iso|bin|part\d*|tar)(\.|$)/i.test(filename)
      || /\.part\d+\s*$/i.test(filename)
      || /\d{3}\s*$/i.test(filename);
    const p1 = filename.match(/[._-]part(\d+)\s*(\.(?:rar|zip|7z))?\s*$/i)
      || (hasArchiveExt ? filename.match(/[._-]part(\d+)/i) : null);
    if (p1) return { part: parseInt(p1[1], 10) };
    const p2 = filename.match(/\.(\d{3})(?:\.|$)/);
    if (p2 && hasArchiveExt) return { part: parseInt(p2[1], 10) };
    const p3 = filename.match(/\.rar$/) && filename.match(/\.(r\d+)$/);
    if (p3) return { part: parseInt(p3[1].replace(/\D/g, ""), 10) };
  } catch {}
  return {};
}

export function parseListingPage(html: string, url: string): ParsedEntry[] {
  const base = new URL(url).origin;
  const anchors = extractAnchors(html);
  const seen = new Set<string>();
  const entries: ParsedEntry[] = [];

  for (const { text, href } of anchors) {
    if (SKIP_HREF.test(href)) continue;
    if (text.length < 3 || text.length > 140) continue;
    const abs = absoluteUrl(base, href);
    if (!abs) continue;
    if (SKIP_PATH.test(abs)) continue;
    try {
      const u = new URL(abs);
      if (u.hostname !== new URL(url).hostname && !u.hostname.endsWith("." + new URL(url).hostname))
        continue;
    } catch {
      continue;
    }
    if (new RegExp(NAV_WORDS, "i").test(abs)) continue;
    const cleaned = cleanTitle(text);
    if (cleaned.length < 3) continue;
    if (seen.has(abs)) continue;
    seen.add(abs);
    entries.push({ title: cleaned, url: abs });
  }

  const byPath = new Map<string, ParsedEntry>();
  for (const e of entries) {
    try {
      const path = new URL(e.url).pathname;
      const existing = byPath.get(path);
      if (!existing || existing.title.length > e.title.length) {
        byPath.set(path, e);
      }
    } catch {}
  }
  return Array.from(byPath.values());
}

function extractPassword(html: string): string | undefined {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#0?160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ");

  const patterns = [
    /\b(?:zip|archive|file|download|extract|rar)?\s*(?:password|pass|pw|password to extract)\s*[:\-]?\s*["']?([A-Za-z0-9@._:\-]{4,40})["']?/i,
    /\bpassword\s*(?:is|:)\s*["']?([A-Za-z0-9@._:\-]{4,40})["']?/i,
    /\bpass\s*[:\-]\s*["']?([A-Za-z0-9@._:\-]{4,40})["']?/i,
    /\b(?:www\.|https?:\/\/)?\b[a-z0-9\-]+\.[a-z]{2,6}(?:\/[^\s"']*)?\b(?=\s*(?:password|pass))/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const candidate = m[1].trim();
      if (/password|pass/i.test(candidate)) continue;
      if (candidate.length >= 3 && candidate.length <= 40) return candidate;
    }
  }
  return undefined;
}

export function parseDetailPage(html: string, url: string): ParsedDetail {
  const base = new URL(url).origin;
  const sourceHost = new URL(url).hostname.replace(/^www\./, "");

  const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1];
  const titleTag = html.match(/<title[^>]*>([\s\S]{0,150}?)<\/title>/i)?.[1];
  const h1Game = html.match(/<h1[^>]*class=["'][^"']*game-title[^"']*["'][^>]*>([\s\S]{0,300}?)<\/h1>/i)?.[1];

  let title = "";
  if (ogTitle) {
    title = stripSiteSuffix(ogTitle, sourceHost);
  }
  if ((!title || title.length < 3) && titleTag) {
    title = stripSiteSuffix(titleTag, sourceHost);
  }
  if ((!title || title.length < 3) && h1Game) {
    title = cleanTitle(h1Game.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
      .replace(/\s*(Report Problem|Discuss on Forum)\s*$/i, "")
      .trim();
  }
  if (!title || title.length < 3) {
    const allH1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi) || [];
    let best = "";
    for (const h of allH1) {
      const t = cleanTitle(h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
      if (t.length > best.length && !/^(FitGirl Repacks|Post navigation|Support the Cause|RE-PACKS)/i.test(t)) best = t;
    }
    title = best;
  }

  const imageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  let image = imageMatch?.[1] || "";

  const descMatch = html.match(/<meta[^>]*(?:property=["']og:description["']|name=["']description["'])[^>]*content=["']([^"']+)["']/i);
  let description = decodeEntities(descMatch?.[1] || "").trim();

  const contentArea = html.match(/<article[\s\S]*?<\/article>/i)?.[0]
    || html.match(/<div[^>]*class=["'][^"']*(?:post-content|entry-content|single-post|the-content|post-body|tdb_single_content)[^"']*["'][^>]*>[\s\S]*?<\/div>/i)?.[0] || "";

  if (!description) {
    const pRe = /<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi;
    let pm: RegExpExecArray | null;
    while ((pm = pRe.exec(contentArea)) !== null) {
      const t = decodeEntities(pm[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
      if (t.length > 40 && !/^(download|password|pass|install|how to|features|system requirements|screenshots|watch|stream)/i.test(t)) {
        description = t;
        break;
      }
    }
  }
  if (description.length > 600) {
    const cut = description.slice(0, 597).lastIndexOf(" ");
    description = description.slice(0, cut > 200 ? cut : 600) + "…";
  }

  if (!image && contentArea) {
    const firstImg = contentArea.match(/<img\b[^>]*src=["']([^"']+)["']/i)?.[1];
    if (firstImg && /^https?:/i.test(firstImg) && !/logo|icon|avatar|spacer|pixel|placeholder|\.svg|data:image/.test(firstImg)) {
      image = absoluteUrl(base, decodeEntities(firstImg)) || "";
    }
  }

  const screenshots: string[] = [];
  const imgRe = /<img\b[^>]*src=["']([^"']+)["']/gi;
  let im: RegExpExecArray | null;
  while ((im = imgRe.exec(html)) !== null) {
    const src = decodeEntities(im[1]);
    if (!/^https?:/i.test(src)) continue;
    if (/logo|icon|avatar|avatar|spacer|pixel|placeholder|\.svg|data:image/.test(src)) continue;
    const abs = absoluteUrl(base, src);
    if (!abs || screenshots.includes(abs)) continue;
    screenshots.push(abs);
    if (screenshots.length >= 8) break;
  }
  if (image && !screenshots.includes(image)) screenshots.unshift(image);
  const finalScreenshots = screenshots.slice(0, 8);

  const links: ParsedLink[] = [];
  const seen = new Set<string>();
  const anchors = extractAnchors(html);
  for (const { text, href, index } of anchors) {
    if (/^magnet:/.test(href)) {
      if (!seen.has(href)) {
        seen.add(href);
        links.push({ name: "Torrent (Magnet)", url: href, type: "torrent" });
      }
      continue;
    }
    if (!isDownloadHref(href, base)) continue;
    const abs = absoluteUrl(base, href);
    if (!abs || seen.has(abs)) continue;
    const isSameHost = (() => {
      try {
        return new URL(abs).hostname.replace(/^www\./, "") === sourceHost;
      } catch {
        return false;
      }
    })();
    if (isSameHost && !/^magnet:/.test(abs)) {
      const p = (() => { try { return new URL(abs).pathname; } catch { return ""; } })();
      const looksLikeFile =
        /(\/download\/|\/dl\/|\/file\/|\/get\/|\.(?:zip|rar|7z|exe|iso|torrent|apk|dmg)(?:$|\?)|\/[^/]+\.php(?:\?.*(?:down|file|get|dl|load))?)/i.test(p);
      if (!looksLikeFile) continue;
    }
    seen.add(abs);
    const isUrlText = /^(https?:\/\/|magnet:)/i.test(text.trim());
    const anchorText = isUrlText ? "" : text;
    // Hosts like fuckingfast put the real filename in the URL fragment;
    // prefer that hint over generic path-segment extraction.
    const extractedFromUrl = fileNameFromUrlHash(abs)
      ? cleanFilename(fileNameFromUrlHash(abs))
      : extractNameFromUrl(abs);

    // Smart name resolution: context > url extraction > anchor text > host display
    let name: string;
    if (anchorText && !isGenericLinkName(anchorText) && anchorText.length >= 3) {
      name = anchorText;
    } else {
      const contextName = extractContextName(html, index);
      name = contextName || extractedFromUrl || linkDisplayName(abs);
    }
    name = name.slice(0, 80) || "Download";

    const { part, partTotal } = detectPart(abs);
    if (part) name = `${name} (Part ${part}${partTotal ? `/${partTotal}` : ""})`;
    links.push({
      name: cleanTitle(name),
      url: abs,
      type: classifyLinkType(abs),
      ...(part ? { part } : {}),
      ...(partTotal ? { partTotal } : {}),
    });
  }

  if (links.length > 0) {
    const byHost = new Map<string, ParsedLink[]>();
    for (const l of links) {
      const host = l.url.startsWith("magnet:") ? "magnet" : (() => { try { return new URL(l.url).hostname; } catch { return l.url; } })();
      const arr = byHost.get(host) || [];
      arr.push(l);
      byHost.set(host, arr);
    }
    for (const [, arr] of byHost) {
      const partNums = arr.filter((l) => l.part).map((l) => l.part!);
      if (partNums.length > 1) {
        const maxPart = Math.max(...partNums);
        for (const l of arr) if (l.part) l.partTotal = maxPart;
      }
    }
  }

  // SteamRip / Cloudflare protected fallback: use URL before "I'm not a robot" check
  // If page is Cloudflare challenge or steamrip and we have few links, extract preferred hosters directly from raw hrefs
  const isCf = /Just a moment|cf-chl|challenge-platform|cf_chl_opt|Checking your browser|Ray ID:/i.test(html);
  const isSteamRip = sourceHost.includes("steamrip");
  if ((isCf || isSteamRip) && links.length < 8) {
    const PREFERRED = /datanodes|fuckingfast|filekeeper|gofile\.io|pixeldrain\.com|buzzheavier|bzzhr|1fichier\.com|send\.cm|krakenfiles|multiup/i;
    for (const { href } of anchors) {
      if (!PREFERRED.test(href)) continue;
      const abs = absoluteUrl(base, href);
      if (!abs || seen.has(abs)) continue;
      seen.add(abs);
      links.push({
        name: linkDisplayName(abs),
        url: abs,
        type: "direct" as const,
      });
    }
  }

  // Prioritize preferred file hosters before other hosts and before Cloudflare
  // fallback URLs. Datanodes/FuckingFast are the fastest mirrors (per-source
  // guidance) so they rank above the older gofile/pixeldrain preference.
  if (links.length > 1) {
    const score = (u: string) => {
      if (/datanodes/i.test(u)) return 120;
      if (/fuckingfast/i.test(u)) return 115;
      if (/filekeeper/i.test(u)) return 110;
      if (/gofile\.io/i.test(u)) return 100;
      if (/pixeldrain\.com|pixeldrain\.dev|pixel\.drain/i.test(u)) return 95;
      if (/buzzheavier|bzzhr/i.test(u)) return 90;
      if (/krakenfiles/i.test(u)) return 85;
      if (/1fichier\.com/i.test(u)) return 80;
      if (/fileskeep/i.test(u)) return 75;
      if (/mediafire\.com/i.test(u)) return 65;
      if (/mega\.nz|mega\.co\.nz|mega\.io/i.test(u)) return 60;
      if (/^magnet:/i.test(u) || /\.torrent(\?|$)/i.test(u)) return 10;
      return 0;
    };
    links.sort((a, b) => score(b.url) - score(a.url));
  }

  const password = extractPassword(html);

  return { title, image, description, screenshots: finalScreenshots, links: links.slice(0, 40), password, contentType: guessContentType(url, title) };
}
