import type { HosterId, HosterMeta } from "./types";

/**
 * Master list of recognised file hosters. Priority drives mirror ordering when
 * importing (higher = preferred). The regex matches the URL hostname without
 * its leading "www.".
 */
export const HOSTERS: Record<HosterId, HosterMeta> = {
  datanodes: {
    id: "datanodes",
    label: "DataNodes",
    hosts: /(^|\.)datanodes\.(to|cc|net|com)$/i,
    needsBrowser: true, // Cloudflare + Turnstile; plain HTTP often 403s
    ipBound: true, // dl node URLs are issued per session/IP
    priority: 100,
  },
  fuckingfast: {
    id: "fuckingfast",
    label: "FuckingFast",
    hosts: /(^|\.)fuckingfast\.(co|com|io)$/i,
    needsBrowser: true, // Cloudflare in front; HTMX POST works when CF is passed
    ipBound: true, // dl.fuckingfast.co URLs are short-lived/session-scoped
    priority: 95,
  },
  pixeldrain: {
    id: "pixeldrain",
    label: "PixelDrain",
    hosts: /(^|\.)(pixeldrain\.(com|net|dev)|pixel\.drain)$/i,
    needsBrowser: false, // /api/file/<id> is open and CORS-friendly
    ipBound: false, // /api/file/<id>?dl=1 works for anyone
    priority: 90,
  },
  gofile: {
    id: "gofile",
    label: "GoFile",
    hosts: /(^|\.)gofile\.(io|com)$/i,
    needsBrowser: false,
    ipBound: false, // content links carry their own token
    priority: 85,
  },
  buzzheavier: {
    id: "buzzheavier",
    label: "BuzzHeavier",
    hosts: /(^|\.)(buzzheavier\.com|bzzhr\.co)$/i,
    needsBrowser: false, // XFileSharing; /<id>/<name> direct pattern
    ipBound: true,
    priority: 80,
  },
  filekeeper: {
    id: "filekeeper",
    label: "FileKeeper",
    hosts: /(^|\.)filekeeper\.(net|com|org)$/i,
    needsBrowser: true,
    ipBound: true,
    priority: 75,
  },
  krakenfiles: {
    id: "krakenfiles",
    label: "KrakenFiles",
    hosts: /(^|\.)krakenfiles\.com$/i,
    needsBrowser: false, // /api/v1/file/<id> JSON
    ipBound: false,
    priority: 70,
  },
  "1fichier": {
    id: "1fichier",
    label: "1Fichier",
    hosts: /(^|\.)1fichier\.com$/i,
    needsBrowser: true, // countdown + anti-bot
    ipBound: true,
    priority: 60,
  },
  sendcm: {
    id: "sendcm",
    label: "Send.cm",
    hosts: /(^|\.)send\.cm$/i,
    needsBrowser: false, // XFileSharing style
    ipBound: true,
    priority: 55,
  },
  megaup: {
    id: "megaup",
    label: "MegaUp",
    hosts: /(^|\.)megaup\.net$/i,
    needsBrowser: false, // XFileSharing style
    ipBound: true,
    priority: 50,
  },
  mediafire: {
    id: "mediafire",
    label: "MediaFire",
    hosts: /(^|\.)mediafire\.com$/i,
    needsBrowser: false,
    ipBound: false,
    priority: 45,
  },
  multiup: {
    id: "multiup",
    label: "MultiUp",
    hosts: /(^|\.)multiup\.(io|org|com)$/i,
    needsBrowser: false,
    ipBound: false,
    priority: 40,
  },
  generic: {
    id: "generic",
    label: "File host",
    hosts: /(^|\.)(filecrypt\.cc|keeplinks\.org|mirrorace\.com|multiup\.org|ddownload\.com|rapidgator\.net|nitroflare\.com|uploadgig\.com|katfile\.com|hexupload\.net|clicknupload\.(co|cc)|updown\.io|dropgalaxy\.com|devuploads\.com|racaty\.io|mixdrop\.co|doodstream\.com|filemoon\.sx|streamtape\.com|voe\.sx)$/i,
    needsBrowser: false,
    ipBound: true,
    priority: 10,
  },
};

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function identifyHoster(url: string): HosterMeta | null {
  if (url.startsWith("magnet:")) return null;
  const host = hostnameOf(url);
  if (!host) return null;
  for (const meta of Object.values(HOSTERS)) {
    if (meta.hosts.test(host)) return meta;
  }
  return null;
}

/** Regex for any recognised file-host landing page (mirrors importParser but expanded). */
export const FILE_HOSTER_URL_RE =
  /(datanodes\.(to|cc|net)|fuckingfast\.(co|com|io)|pixeldrain\.(com|net|dev)|pixel\.drain|gofile\.(io|com)|buzzheavier\.com|bzzhr\.co|filekeeper\.(net|com)|krakenfiles\.com|1fichier\.com|send\.cm|megaup\.net|mediafire\.com|multiup\.(io|org|com)|filecrypt\.cc|keeplinks\.org|mirrorace\.com|ddownload\.com|rapidgator\.net|nitroflare\.com|uploadgig\.com|katfile\.com|hexupload\.net|clicknupload|racaty\.io|mixdrop\.co|doodstream\.com|filemoon\.sx|streamtape\.com|voe\.sx)/i;

export function isFileHosterUrl(url: string): boolean {
  return FILE_HOSTER_URL_RE.test(hostnameOf(url));
}

export function isTorrentUrl(url: string): boolean {
  if (url.startsWith("magnet:")) return true;
  try {
    const u = new URL(url);
    return (
      u.pathname.toLowerCase().endsWith(".torrent") ||
      /1337x|rutor|piratebay|tapochek|rutracker/i.test(u.hostname) ||
      u.search.toLowerCase().includes("do=download")
    );
  } catch {
    return false;
  }
}
