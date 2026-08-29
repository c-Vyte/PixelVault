import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, "..", "data");
const PUBLIC_DATA_DIR = join(__dirname, "..", "public", "data");
const URL_CACHE_FILE = join(DATA_DIR, "fitgirl-urls.json");
const GAMES_OUTPUT_FILE = join(DATA_DIR, "fitgirl-games.json");
const LIGHT_OUTPUT_FILE = join(PUBLIC_DATA_DIR, "fitgirl-games.json");
const PROGRESS_FILE = join(DATA_DIR, "fitgirl-progress.json");

const BASE_URL = "https://fitgirl-repacks.site";
const AZ_URL = `${BASE_URL}/all-my-repacks-a-z/`;
const TOTAL_PAGES = 144;
const DELAY_MS = 500;
const MAX_RETRIES = 3;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// ── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function decodeHtmlEntities(str) {
  const entities = {
    "&#8211;": "\u2013",
    "&#8212;": "\u2014",
    "&#8216;": "\u2018",
    "&#8217;": "\u2019",
    "&#8220;": "\u201C",
    "&#8221;": "\u201D",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#8230;": "\u2026",
    "&#8217;": "\u2019",
    "&apos;": "'",
    "&#039;": "'",
    "&hellip;": "\u2026",
    "&mdash;": "\u2014",
    "&ndash;": "\u2013",
    "&lsquo;": "\u2018",
    "&rsquo;": "\u2019",
    "&ldquo;": "\u201C",
    "&rdquo;": "\u201D",
    "&nbsp;": " ",
    "&trade;": "\u2122",
    "&copy;": "\u00A9",
    "&reg;": "\u00AE",
    "&eacute;": "\u00E9",
    "&Eacute;": "\u00C9",
    "&egrave;": "\u00E8",
    "&agrave;": "\u00E0",
    "&aacute;": "\u00E1",
    "&oacute;": "\u00F3",
    "&uacute;": "\u00FA",
    "&iacute;": "\u00ED",
    "&ntilde;": "\u00F1",
    "&uuml;": "\u00FC",
    "&uuml;": "\u00FC",
  };
  let result = str;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.split(entity).join(char);
  }
  // Numeric decimal entities
  result = result.replace(/&#(\d+);/g, (_, code) =>
    String.fromCharCode(parseInt(code, 10))
  );
  // Numeric hex entities
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
    String.fromCharCode(parseInt(code, 16))
  );
  return result;
}

function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate",
          "Cache-Control": "no-cache",
          "Upgrade-Insecure-Requests": "1",
        },
        redirect: "follow",
      });
      if (res.status === 403 || res.status === 503) {
        const html = await res.text();
        if (/Just a moment|cf-challenge|DDoS protection|Checking your browser/i.test(html)) {
          throw new Error(`Cloudflare challenge (HTTP ${res.status})`);
        }
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const html = await res.text();
      if (/Just a moment|cf-challenge|DDoS protection/i.test(html.slice(0, 5000))) {
        throw new Error("Cloudflare challenge detected");
      }
      return html;
    } catch (err) {
      console.error(
        `  [Attempt ${attempt}/${retries}] Error fetching ${url}: ${err.message}`
      );
      if (attempt < retries) {
        const wait = attempt * 3000;
        console.log(`  Waiting ${wait / 1000}s before retry...`);
        await sleep(wait);
      } else {
        throw err;
      }
    }
  }
}

function sleep(ms) {
   return new Promise((resolve) => setTimeout(resolve, ms));
}

function logProgress(current, total, extra = "") {
  const pct = ((current / total) * 100).toFixed(1);
  process.stdout.write(`\r  [${current}/${total} ${pct}%]${extra}   `);
  if (current === total) process.stdout.write("\n");
}

function isPreferredHoster(url) {
  return /datanodes\.to|fuckingfast\.co|filekeeper|pixeldrain\.com|gofile\.io/i.test(url);
}

function canonicalHoster(url, fallback = "") {
  const u = (url || "").toLowerCase();
  const f = (fallback || "").toLowerCase();
  const s = u + " " + f;
  if (/datanodes\.to/.test(s)) return "Datanodes";
  if (/pixeldrain\.com/.test(s)) return "PixelDrain";
  if (/fuckingfast\.co/.test(s)) return "FuckingFast";
  if (/filekeeper|filekeep/.test(s)) return "FileKeeper";
  if (/krakenfiles\.com/.test(s)) return "KrakenFiles";
  if (/gofile\.io/.test(s)) return "Gofile";
  if (/1fichier\.com/.test(s)) return "1Fichier";
  if (/mega\.nz/.test(s)) return "Mega";
  if (/mediafire\.com/.test(s)) return "MediaFire";
  if (/uptobox\.com/.test(s)) return "Uptobox";
  if (/mixdrop\.co/.test(s)) return "Mixdrop";
  if (/devuploads\.com/.test(s)) return "DevUploads";
  if (/hexupload\.net/.test(s)) return "HexUpload";
  if (/racaty\.io/.test(s)) return "Racaty";
  if (fallback) return fallback.replace(/^Filehoster:\s*/i, "").trim().slice(0, 24) || "Other";
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "Other"; }
}

function extractPartNum(name, url) {
  const src = `${name} ${url}`;
  const m = src.match(/part0*(\d+)\.rar|\.0*(\d+)\.rar|_part(\d+)|\.part(\d+)|_(\d+)\.zip/i) || src.match(/part\s*0*(\d+)/i);
  if (m) {
    for (let i = 1; i < m.length; i++) if (m[i]) return parseInt(m[i], 10);
  }
  return null;
}

async function fetchPasteLinks(pasteUrl) {
  try {
    const html = await fetchWithRetry(pasteUrl, 2);
    const links = [];
    const rex = /<a\s+href="(https?:\/\/(?:datanodes\.to|fuckingfast\.co|filekeeper\.net|pixeldrain\.com|gofile\.io|krakenfiles\.com|buzzheavier\.com|bzzhr\.co|1fichier\.com|mega\.nz|mediafire\.com|uptobox\.com|mixdrop\.co|devuploads\.com|hexupload\.net|racaty\.io|sendcm\.com)[^"]*)"[^>]*>([^<]*)<\/a>/gi;
    let m;
    while ((m = rex.exec(html)) !== null) {
      links.push({ url: m[1], name: decodeHtmlEntities(m[2]).trim() });
    }
    // Fallback generic
    if (links.length === 0) {
      const gen = /<a\s+href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;
      let g;
      while ((g = gen.exec(html)) !== null) {
        if (g[1].includes("paste.fitgirl-repacks.site") || g[1].includes("fitgirl-repacks.site")) continue;
        if (g[2].trim().length > 1) links.push({ url: g[1], name: decodeHtmlEntities(g[2]).trim() });
        if (links.length >= 30) break;
      }
    }
    return links;
  } catch { return []; }
}

// ── Phase 1: Collect URLs ────────────────────────────────────────────────────

async function collectGameUrls() {
  if (existsSync(URL_CACHE_FILE)) {
    console.log("URL cache found, loading...");
    const cached = JSON.parse(readFileSync(URL_CACHE_FILE, "utf-8"));
    console.log(`  Loaded ${cached.length} cached URLs.`);
    return cached;
  }

  console.log("Phase 1: Collecting game URLs from A-Z listing...");
  const allUrls = [];

  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const url =
      page === 1 ? AZ_URL : `${AZ_URL}?lcp_page0=${page}`;
    logProgress(page, TOTAL_PAGES, " fetching URL list");

    try {
      const html = await fetchWithRetry(url);

      // Extract links from lcp_catlist
      const listMatch = html.match(
        /<ul[^>]*class="lcp_catlist"[^>]*>([\s\S]*?)<\/ul>/
      );
      if (listMatch) {
        const linkRegex = /<li[^>]*>\s*<a\s+href="([^"]+)"[^>]*>([^<]*)<\/a>/gi;
        let m;
        while ((m = linkRegex.exec(listMatch[1])) !== null) {
          const gameUrl = m[1].trim();
          if (gameUrl && gameUrl.startsWith("http")) {
            allUrls.push(gameUrl);
          }
        }
      }
    } catch (err) {
      console.error(`\n  Failed to fetch page ${page}: ${err.message}`);
    }

    if (page < TOTAL_PAGES) await sleep(DELAY_MS);
  }

  console.log(`\n  Collected ${allUrls.length} game URLs.`);

  ensureDir(URL_CACHE_FILE);
  writeFileSync(URL_CACHE_FILE, JSON.stringify(allUrls, null, 2), "utf-8");
  console.log(`  URLs cached to ${URL_CACHE_FILE}`);

  return allUrls;
}

// ── Phase 2: Parse individual game pages ─────────────────────────────────────

function extractBetween(html, startTag, endTag, fromIndex = 0) {
  const s = html.indexOf(startTag, fromIndex);
  if (s === -1) return "";
  const e = html.indexOf(endTag, s + startTag.length);
  if (e === -1) return html.substring(s + startTag.length);
  return html.substring(s + startTag.length, e);
}

async function parseGamePage(html, url) {
  const game = {
    title: "",
    url,
    genres: [],
    companies: "",
    languages: "",
    originalSize: "",
    repackSize: "",
    poster: "",
    banner: "",
    screenshots: [],
    description: "",
    downloads: [],
    downloadsByHoster: {},
    features: [],
    backwardsCompatibility: "",
  };

  // Title
  const titleMatch = html.match(
    /<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/
  );
  if (titleMatch) {
    game.title = decodeHtmlEntities(stripHtml(titleMatch[1])).trim();
  }

  // Genres / tags from entry-footer tag links
  const footerSection = extractBetween(html, "entry-footer", "</footer>");
  const tagRegex = /href="https?:\/\/fitgirl-repacks\.site\/tag\/([^/"]+)\/"[^>]*>([^<]+)<\/a>/gi;
  let tagMatch;
  while ((tagMatch = tagRegex.exec(footerSection || html)) !== null) {
    const genre = decodeHtmlEntities(tagMatch[2]).trim();
    if (genre && !game.genres.includes(genre)) {
      game.genres.push(genre);
    }
  }

  // Also try broader tag search in entire HTML
  if (game.genres.length === 0) {
    const allTagRegex = /href="https?:\/\/fitgirl-repacks\.site\/tag\/([^/"]+)\/"[^>]*>([^<]+)<\/a>/gi;
    let atm;
    while ((atm = allTagRegex.exec(html)) !== null) {
      const genre = decodeHtmlEntities(atm[2]).trim();
      if (
        genre &&
        !game.genres.includes(genre) &&
        !["repack", "fitgirl", "repacks"].includes(genre.toLowerCase())
      ) {
        game.genres.push(genre);
      }
    }
  }

  // Metadata fields: Companies, Languages, Original Size, Repack Size
  const metaPatterns = [
    { key: "companies", pattern: /Companies:\s*<strong>([\s\S]*?)<\/strong>/i },
    { key: "languages", pattern: /Languages:\s*<strong>([\s\S]*?)<\/strong>/i },
    { key: "originalSize", pattern: /Original Size:\s*<strong>([\s\S]*?)<\/strong>/i },
    { key: "repackSize", pattern: /Repack Size:\s*<strong>([\s\S]*?)<\/strong>/i },
  ];

  for (const { key, pattern } of metaPatterns) {
    const m = html.match(pattern);
    if (m) {
      game[key] = decodeHtmlEntities(stripHtml(m[1])).trim();
    }
  }

  // Poster from og:image
  const ogImageMatch = html.match(
    /<meta\s+property="og:image"\s+content="([^"]+)"/i
  );
  if (ogImageMatch) {
    game.poster = ogImageMatch[1];
  }

  // Banner: try Steam header image first (wider, better for banners)
  // Look for Steam app ID in links or images
  const steamAppMatch = html.match(/store\.steampowered\.com\/app\/(\d+)/);
  if (steamAppMatch) {
    game.banner = `https://cdn.akamai.steamstatic.com/steam/apps/${steamAppMatch[1]}/header.jpg`;
  } else {
    // Try to find a wide/banner image from the content (e.g. extras/gif, header images)
    const bannerImgMatch = html.match(/src="(https?:\/\/[^"]*(?:shared\.akamai\.steampowered|steamstatic\.com)[^"]*(?:header|capsule|hero|banner|extras)[^"]*\.(?:jpg|png|gif|webp))"/i);
    if (bannerImgMatch) {
      game.banner = bannerImgMatch[1];
    } else {
      // Fallback: use poster as banner
      game.banner = game.poster;
    }
  }

  // Screenshots from img tags (prioritize wider/larger images for banner candidates)
  const screenshotDomains = [
    "steamstatic.com",
    "imageban.ru",
    "riotpixels",
    "store.steampowered.com",
    "cloudflare.steamstatic.com",
  ];
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
  let imgMatch;
  const seenScreenshots = new Set();
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    const src = imgMatch[1];
    const isScreenshot = screenshotDomains.some((d) =>
      src.toLowerCase().includes(d)
    );
    if (isScreenshot && !seenScreenshots.has(src)) {
      seenScreenshots.add(src);
      game.screenshots.push(src);
    }
  }

  // Description: prefer the "Game Description" spoiler (actual game description)
  // over og:description (which is just a summary with metadata)
  const spoilerMatch = html.match(
    /Game Description\s*<\/div>\s*<div class="su-spoiler-content[^"]*">([\s\S]*?)<\/div>\s*<\/div>/
  );
  if (spoilerMatch) {
    game.description = decodeHtmlEntities(stripHtml(spoilerMatch[1]))
      .substring(0, 2000)
      .trim();
  }
  
  // Fallback to og:description if spoiler not found
  if (!game.description) {
    const ogDescMatch = html.match(
      /<meta\s+property="og:description"\s+content="([^"]*?)"/i
    );
    if (ogDescMatch) {
      game.description = decodeHtmlEntities(ogDescMatch[1]).trim();
    }
  }

  // Truncate description to 2000 chars
  if (game.description.length > 2000) {
    game.description = game.description.substring(0, 1997) + "...";
  }

  // ── Downloads: Direct Links ──
  const directSectionMatch = html.match(
    /<h3>Download Mirrors\s*\(Direct Links?\)\s*<\/h3>([\s\S]*?)(?=<h3>|$)/i
  );
  if (directSectionMatch) {
    const directHtml = directSectionMatch[1];

// Parse each <li> in the direct links section
     const liRegex = /<li>([\s\S]*?)<\/li>/gi;
     let liMatch;

      // Initialize link categorization arrays
      const preferredDirectLinks = [];
      const otherDirectLinks = [];
      const pasteFallbacks = [];
      const hostersWithFileLinks = new Set();

      while ((liMatch = liRegex.exec(directHtml)) !== null) {
       const liContent = liMatch[1];
       let fileLinksInThisLi = 0;

      // Extract the main paste.fitgirl-repacks.site link
      const pasteLinkMatch = liContent.match(
        /<a\s+href="(https?:\/\/paste\.fitgirl-repacks\.site\/[^"]*)"[^>]*>([^<]*)<\/a>/
      );

      // Extract hoster name
      let hosterName = "";
      let pasteUrl = "";
      if (pasteLinkMatch) {
        pasteUrl = pasteLinkMatch[1];
        hosterName = decodeHtmlEntities(pasteLinkMatch[2]).trim();
        // Clean up hoster name
        hosterName = hosterName
          .replace(/^Filehoster:\s*/i, "")
          .trim();
      }

      // Extract hoster info text (speed & usability, etc.)
      const hosterInfoMatch = liContent.match(
        /<a[^>]*>[^<]*<\/a>\s*<span>\(([^)]*)\)<\/span>/
      );
      const hosterInfo = hosterInfoMatch
        ? hosterInfoMatch[1].trim()
        : "";

// Add the main paste index link
       if (pasteUrl) {
         const linkObj = {
           name: hosterName || "Direct Link",
           url: pasteUrl,
           type: "direct",
           hoster: hosterName,
           info: hosterInfo,
         };

         if (isPreferredHoster(pasteUrl)) {
           preferredDirectLinks.push(linkObj);
         } else {
           otherDirectLinks.push(linkObj);
         }
       }

      // Extract individual file links from spoiler content
      const spoilerMatch = liContent.match(
        /class="su-spoiler[^"]*dlinks[^"]*"[^>]*>[\s\S]*?class="su-spoiler-content[^"]*">([\s\S]*?)<\/div>/
      );
      if (spoilerMatch) {
        const spoilerContent = spoilerMatch[1];
        const fileLinkRegex =
          /<a\s+href="(https?:\/\/(?:datanodes\.to|fuckingfast\.co|filekeeper\.net|filekeep|krakenfiles\.com|filepress\.org|streamtape\.com|pixeldrain\.com|gofile\.io|devuploads\.com|mixdrop\.co|uptobox\.com|mega\.nz|mediafire\.com|1fichier\.com|google\.com\/drive|onedrive\.live\.com|hexupload\.net|racaty\.io|voe\.sx|doodstream\.com|streamlare\.com|streamvid\.net|mp4upload\.com|filecrypt\.cc)[^"]*)"[^>]*>([^<]*)<\/a>/gi;
        let fileMatch;
        while ((fileMatch = fileLinkRegex.exec(spoilerContent)) !== null) {
          const fileUrl = fileMatch[1];
          const fileName = decodeHtmlEntities(fileMatch[2]).trim();
const linkObj = {
             name: fileName || "Download File",
             url: fileUrl,
             type: "direct",
             hoster: hosterName,
           };

            if (isPreferredHoster(fileUrl)) {
              preferredDirectLinks.push(linkObj);
            } else {
              otherDirectLinks.push(linkObj);
            }
            hostersWithFileLinks.add(canonicalHoster(fileUrl, hosterName)); fileLinksInThisLi++;
         }

         // Also catch any href in spoiler content that wasn't caught by domain filter
        const genericLinkRegex =
          /<a\s+href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;
        let genMatch;
        while ((genMatch = genericLinkRegex.exec(spoilerContent)) !== null) {
          const gUrl = genMatch[1];
          const gName = decodeHtmlEntities(genMatch[2]).trim();
          // Skip if already captured or if it's a paste link
          if (
            gUrl.includes("paste.fitgirl-repacks.site") ||
            gUrl.includes("fitgirl-repacks.site/tag/") ||
            gUrl.includes("fitgirl-repacks.site/page/") ||
            game.downloads.some((d) => d.url === gUrl)
          ) {
            continue;
          }
          // Skip very small file name references (like "1", "2", etc.)
          if (gName.length > 1) {
const linkObj = {
               name: gName,
               url: gUrl,
               type: "direct",
               hoster: hosterName,
             };

              if (isPreferredHoster(gUrl)) {
                preferredDirectLinks.push(linkObj);
              } else {
                otherDirectLinks.push(linkObj);
              }
              hostersWithFileLinks.add(canonicalHoster(gUrl, hosterName)); fileLinksInThisLi++;
           }
         }
       }
        if (fileLinksInThisLi === 0 && pasteUrl) pasteFallbacks.push({ hosterName, pasteUrl });
      }
      // Resolve paste pages for hosters that had no file links in the spoiler — fetch actual hoster parts
      for (const { hosterName, pasteUrl } of pasteFallbacks) {
        const hostKey = canonicalHoster(pasteUrl, hosterName);
        if (hostersWithFileLinks.has(hostKey)) continue;
        const actualLinks = await fetchPasteLinks(pasteUrl);
        for (const f of actualLinks.slice(0, 25)) {
          const host = canonicalHoster(f.url, hosterName);
          const part = extractPartNum(f.name, f.url);
          const linkObj = { name: f.name || host, url: f.url, type: "direct", hoster: host };
          if (part) linkObj.part = part;
          if (isPreferredHoster(f.url)) preferredDirectLinks.push(linkObj); else otherDirectLinks.push(linkObj);
          hostersWithFileLinks.add(host);
        }
        if (actualLinks.length) await sleep(400);
      }

      // Push prioritized download links: preferred first, then others
      game.downloads.push(...preferredDirectLinks, ...otherDirectLinks);

      // Enrich part numbers and group by hoster for client-side display
      const byHoster = {};
      for (const d of game.downloads) {
        if (d.type !== "direct") continue;
        const host = canonicalHoster(d.url, d.hoster);
        const part = extractPartNum(d.name, d.url);
        if (part) { d.part = part; }
        d.hoster = host;
        if (!byHoster[host]) byHoster[host] = [];
        byHoster[host].push({ ...d });
      }
      // Sort parts numerically within each hoster and set partTotal
      for (const host of Object.keys(byHoster)) {
        byHoster[host].sort((a, b) => (a.part || 0) - (b.part || 0));
        const total = byHoster[host].length;
        if (total > 1) byHoster[host].forEach((d) => { d.partTotal = total; });
      }
      game.downloadsByHoster = byHoster;
   }

  // ── Downloads: Torrent Links ──
  const torrentSectionMatch = html.match(
    /<h3>Download Mirrors\s*\(Torrent\)\s*<\/h3>([\s\S]*?)(?=<h3>|$)/i
  );
  if (torrentSectionMatch) {
    const torrentHtml = torrentSectionMatch[1];

    // Magnet links
    const magnetRegex =
      /<a\s+href="(magnet:\?xt=urn:btih:[^"]+)"[^>]*>\s*magnet\s*<\/a>/gi;
    let magnetMatch;
    while ((magnetMatch = magnetRegex.exec(torrentHtml)) !== null) {
      game.downloads.push({
        name: "Magnet Link",
        url: magnetMatch[1],
        type: "torrent",
        hoster: "BitTorrent",
      });
    }

    // 1337x links
    const x1337Regex =
      /<a\s+href="(https?:\/\/(?:www\.)?1337x\.to\/torrent\/[^"]+)"[^>]*>([^<]*)<\/a>/gi;
    let x1337Match;
    while ((x1337Match = x1337Regex.exec(torrentHtml)) !== null) {
      game.downloads.push({
        name: decodeHtmlEntities(x1337Match[2]).trim() || "1337x",
        url: x1337Match[1],
        type: "torrent",
        hoster: "1337x",
      });
    }

    // .torrent file links from paste.fitgirl-repacks.site
    const torrentFileRegex =
      /<a\s+href="(https?:\/\/paste\.fitgirl-repacks\.site\/[^"]*)"[^>]*>\s*\.torrent file only\s*<\/a>/gi;
    let tfMatch;
    while ((tfMatch = torrentFileRegex.exec(torrentHtml)) !== null) {
      game.downloads.push({
        name: ".torrent file",
        url: tfMatch[1],
        type: "torrent",
        hoster: "FitGirl Paste",
      });
    }

    // Tapochek links
    const tapochekRegex =
      /<a\s+href="(https?:\/\/tapochek\.net\/[^"]+)"[^>]*>([^<]*)<\/a>/gi;
    let tapMatch;
    while ((tapMatch = tapochekRegex.exec(torrentHtml)) !== null) {
      game.downloads.push({
        name: decodeHtmlEntities(tapMatch[2]).trim() || "Tapochek",
        url: tapMatch[1],
        type: "torrent",
        hoster: "Tapochek",
      });
    }

    // RuTracker links
    const rutrackerRegex =
      /<a\s+href="(https?:\/\/(?:www\.)?rutracker\.org\/forum\/viewtopic\.php\?[^"]+)"[^>]*>([^<]*)<\/a>/gi;
    let rtMatch;
    while ((rtMatch = rutrackerRegex.exec(torrentHtml)) !== null) {
      game.downloads.push({
        name: decodeHtmlEntities(rtMatch[2]).trim() || "RuTracker",
        url: rtMatch[1],
        type: "torrent",
        hoster: "RuTracker",
      });
    }

    // Generic torrent tracker links not yet captured
    const genericTorrentRegex =
      /<li>([\s\S]*?)<\/li>/gi;
    let gtMatch;
    while ((gtMatch = genericTorrentRegex.exec(torrentHtml)) !== null) {
      const liHtml = gtMatch[1];
      // Extract all <a> links from this li
      const aLinks = [...liHtml.matchAll(/<a\s+href="([^"]+)"[^>]*>([^<]*)<\/a>/gi)];
      for (const aLink of aLinks) {
        const href = aLink[1];
        const text = decodeHtmlEntities(aLink[2]).trim();
        if (
          href.startsWith("magnet:") ||
          href.includes("1337x.to") ||
          href.includes("paste.fitgirl-repacks.site") ||
          href.includes("tapochek.net") ||
          href.includes("rutracker.org") ||
          href.includes("fitgirl-repacks.site/tag/") ||
          game.downloads.some((d) => d.url === href)
        ) {
          continue;
        }
        if (text && href.startsWith("http")) {
          game.downloads.push({
            name: text,
            url: href,
            type: "torrent",
            hoster: text,
          });
        }
      }
    }
  }

  // ── Repack Features ──
  const featuresSectionMatch = html.match(
    /(?:Repack Features|Features)\s*<\/(?:strong|h\d|b)>([\s\S]*?)(?=<h[23]|<div class="su-spoiler|<p><strong|<\/article|$)/i
  );
  if (featuresSectionMatch) {
    const featureHtml = featuresSectionMatch[1];
    // Extract list items or lines starting with bullet markers
    const liFeatures = [...featureHtml.matchAll(/<li>([\s\S]*?)<\/li>/gi)];
    if (liFeatures.length > 0) {
      for (const f of liFeatures) {
        const text = decodeHtmlEntities(stripHtml(f[1])).trim();
        if (text) game.features.push(text);
      }
    } else {
      // Try line by line, look for bullet-like content
      const lines = featureHtml.split(/\n|<br\s*\/?>/i);
      for (const line of lines) {
        const text = decodeHtmlEntities(stripHtml(line)).trim();
        if (text && text.length > 3) {
          game.features.push(text);
        }
      }
    }
  }

  // Also look for features in <strong> / <b> followed by <ul>
  if (game.features.length === 0) {
    const altFeaturesMatch = html.match(
      /<strong>Repack Features<\/strong>\s*([\s\S]*?)(?=<\/article|<h[23]|<div class="su-spoiler)/i
    );
    if (altFeaturesMatch) {
      const fHtml = altFeaturesMatch[1];
      const fLiRegex = /<li>([\s\S]*?)<\/li>/gi;
      let flMatch;
      while ((flMatch = fLiRegex.exec(fHtml)) !== null) {
        const text = decodeHtmlEntities(stripHtml(flMatch[1])).trim();
        if (text) game.features.push(text);
      }
    }
  }

  // ── Backwards Compatibility Note ──
  const bcMatch = html.match(
    /(?:backwards?\s*compat(?:ibility)?|backward(?:s)?\s*compat(?:ibility)?)\s*[:\-]?\s*([\s\S]*?)(?=<\/p>|<\/div>|<h[23]|<strong|<br\s*\/?>)/i
  );
  if (bcMatch) {
    game.backwardsCompatibility = decodeHtmlEntities(stripHtml(bcMatch[1]))
      .substring(0, 500)
      .trim();
  }

  return game;
}

// ── Light output ─────────────────────────────────────────────────────────────

function makeLightVersion(games) {
  return games.map((g) => ({
    ...g,
    screenshots: g.screenshots.length > 0 ? [g.screenshots[0]] : [],
    features: undefined,
    downloads: (g.downloads || []).filter((d) => 
      d.type === "torrent" || 
      !d.url?.includes("paste.fitgirl-repacks.site")
    ).slice(0, 20),
  }));
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== FitGirl Repacks Scraper ===\n");

  // Phase 1
  const allUrls = await collectGameUrls();
  console.log(`\nTotal game URLs to process: ${allUrls.length}\n`);

  // Phase 2
  console.log("Phase 2: Parsing individual game pages...");

  // Load existing progress from dedicated progress file
  let games = [];
  let processedUrls = new Set();
  let successCount = 0;
  let failCount = 0;
  if (existsSync(PROGRESS_FILE)) {
    console.log("  Loading existing progress...");
    try {
      const progress = JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
      games = progress.games || [];
      successCount = progress.successCount || 0;
      failCount = progress.failCount || 0;
      for (const g of games) {
        if (g.url) processedUrls.add(g.url);
      }
      console.log(`  Resuming: ${games.length} games already parsed.`);
    } catch {
      console.log("  Could not parse progress file, starting fresh.");
      games = [];
      processedUrls = new Set();
      successCount = 0;
      failCount = 0;
    }
  } else if (existsSync(GAMES_OUTPUT_FILE)) {
    // Fallback to old games file if no progress file exists
    console.log("  Loading existing progress from games file...");
    try {
      games = JSON.parse(readFileSync(GAMES_OUTPUT_FILE, "utf-8"));
      for (const g of games) {
        if (g.url) processedUrls.add(g.url);
      }
      console.log(`  Resuming: ${games.length} games already parsed.`);
    } catch {
      console.log("  Could not parse existing file, starting fresh.");
      games = [];
      processedUrls = new Set();
    }
  }

  const remainingUrls = allUrls.filter((u) => !processedUrls.has(u));
  console.log(`  Remaining: ${remainingUrls.length} games to parse.\n`);

  for (let i = 0; i < remainingUrls.length; i++) {
    const url = remainingUrls[i];
    const overallIdx = games.length + 1;
    const totalExpected = allUrls.length;

    logProgress(i + 1, remainingUrls.length, ` game #${overallIdx}`);

    try {
      const html = await fetchWithRetry(url);
      const game = await parseGamePage(html, url);
      games.push(game);
      processedUrls.add(url);
      successCount++;

      // Save progress every 100 games
      if (successCount % 100 === 0) {
        ensureDir(GAMES_OUTPUT_FILE);
        writeFileSync(
          GAMES_OUTPUT_FILE,
          JSON.stringify(games, null, 2),
          "utf-8"
        );
        // Also save dedicated progress file
        ensureDir(PROGRESS_FILE);
        writeFileSync(
          PROGRESS_FILE,
          JSON.stringify({
            games,
            processedUrls: Array.from(processedUrls),
            successCount,
            failCount,
            lastUrl: url,
            timestamp: Date.now(),
          }, null, 2),
          "utf-8"
        );
      }
    } catch (err) {
      console.error(`\n  FAILED: ${url} - ${err.message}`);
      failCount++;
    }

    if (i < remainingUrls.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log("\n\nSaving final output...");

  // Save full data
  ensureDir(GAMES_OUTPUT_FILE);
  writeFileSync(GAMES_OUTPUT_FILE, JSON.stringify(games, null, 2), "utf-8");
  console.log(`  Full data saved to ${GAMES_OUTPUT_FILE}`);

  // Save light version
  ensureDir(LIGHT_OUTPUT_FILE);
  const lightGames = makeLightVersion(games);
  writeFileSync(
    LIGHT_OUTPUT_FILE,
    JSON.stringify(lightGames, null, 2),
    "utf-8"
  );
  console.log(`  Light data saved to ${LIGHT_OUTPUT_FILE}`);

  // Summary
  console.log("\n=== Summary ===");
  console.log(`  Total games parsed: ${games.length}`);
  console.log(`  Successful: ${successCount}`);
  console.log(`  Failed: ${failCount}`);

  // Stats
  const withPosters = games.filter((g) => g.poster).length;
  const withDownloads = games.filter((g) => g.downloads.length > 0).length;
  const withGenres = games.filter((g) => g.genres.length > 0).length;
  const withScreenshots = games.filter((g) => g.screenshots.length > 0).length;
  const withFeatures = games.filter((g) => g.features.length > 0).length;
  const withDescription = games.filter((g) => g.description).length;

  const totalDirectLinks = games.reduce(
    (sum, g) => sum + g.downloads.filter((d) => d.type === "direct").length,
    0
  );
  const totalTorrentLinks = games.reduce(
    (sum, g) => sum + g.downloads.filter((d) => d.type === "torrent").length,
    0
  );

  console.log(`  With posters: ${withPosters}`);
  console.log(`  With download links: ${withDownloads}`);
  console.log(`  With genres: ${withGenres}`);
  console.log(`  With screenshots: ${withScreenshots}`);
  console.log(`  With features: ${withFeatures}`);
  console.log(`  With description: ${withDescription}`);
  console.log(`  Total direct download links: ${totalDirectLinks}`);
  console.log(`  Total torrent download links: ${totalTorrentLinks}`);

  // Auto-create index for admin UI
  console.log("\nCreating index for admin UI...");
  try {
    execSync("node scripts/make-indexes.mjs", { cwd: join(__dirname, ".."), stdio: "inherit" });
    console.log("Index created successfully!");
  } catch (err) {
    console.log(`Index creation failed: ${err.message}`);
    console.log("You can run 'node scripts/make-indexes.mjs' manually later.");
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
