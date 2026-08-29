export interface ParsedDownloadLink {
  name: string;
  url: string;
  type: "official" | "repack" | "direct" | "cracked";
}

export interface ParsedGameData {
  title: string;
  description: string;
  systemRequirements: string;
  features: string[];
  platform: string;
  version: string;
  size: string;
  rating: number;
  downloadLinks: ParsedDownloadLink[];
}

function normalize(text: string): string {
  return text.replace(/\r/g, "").replace(/\t/g, "  ").replace(/\n{3,}/g, "\n\n");
}

function lines(text: string): string[] {
  return text.split("\n").map((l) => l.trim());
}

function findSection(
  text: string,
  startPatterns: RegExp[],
  stopPatterns: RegExp[]
): string {
  for (const sp of startPatterns) {
    const match = text.match(sp);
    if (!match) continue;
    const startIdx = match.index! + match[0].length;
    const after = text.slice(startIdx);
    let endIdx = after.length;
    for (const ep of stopPatterns) {
      const m = after.match(ep);
      if (m && m.index !== undefined && m.index < endIdx) {
        endIdx = m.index;
      }
    }
    const section = after.slice(0, endIdx).trim();
    if (section.length > 10) return section;
  }
  return "";
}

function extractTitle(text: string): string {
  const ls = lines(text);

  // Explicit label patterns
  const labelPatterns = [
    /(?:^|\n)\s*(?:Title|Game|Name|Software)\s*[:=]\s*(.+)/i,
    /(?:STEAM|GOG|EPIC|ORIGIN|UBISOFT)\s*(?:PAGE|STORE|APP)\s*[:=\-–]\s*(.+)/i,
    /(?:^|\n)\s*#{1,3}\s+(.+)/,
  ];
  for (const p of labelPatterns) {
    const m = text.match(p);
    if (m?.[1]) {
      const t = m[1].trim().replace(/[""]/g, "").replace(/\s*[-–|]\s*(Steam|GOG|Epic|Download).*/i, "");
      if (t.length >= 2 && t.length < 120) return t;
    }
  }

  // Steam-style: first <h1> or first significant line
  for (const l of ls) {
    const clean = l.replace(/^[#*>\-]+\s*/, "").trim();
    if (clean.length < 2 || clean.length > 120) continue;
    if (/^(minimum|recommended|os |cpu |ram |gpu |processor|system requirements|features|about|description|overview)/i.test(clean)) continue;
    if (/^(version|size|rating|score|platform|developer|publisher|release|genre)\s*[:=]/i.test(clean)) continue;
    if (/^\d+\s*(GB|MB|TB)/i.test(clean)) continue;
    return clean.replace(/[""]/g, "");
  }
  return "";
}

function extractDescription(text: string): string {
  // Try labeled sections first
  const labeled = findSection(
    text,
    [
      /(?:Description|About|About this (?:game|software)|Overview|Synopsis|Story|Plot|Introduction)\s*[:=]?\s*\n/i,
    ],
    [
      /\n\s*(?:System Requirements|Minimum|Recommended|Requirements|Specifications|Key Features|Features|Game Features|Highlights|Top Reviews|User Reviews|Technical|Installation)/i,
      /\n\s*(?:OS|CPU|Processor|RAM|Memory|GPU|Graphics|DirectX|Storage|Hard Disk|Sound Card|Network)/i,
    ]
  );
  if (labeled && labeled.length > 20) {
    return labeled.replace(/\n{3,}/g, "\n\n").slice(0, 3000);
  }

  // Fallback: everything between title area and requirements
  const ls = lines(text);
  const reqKeywords = /^(?:system\s*requirements|minimum\s*(?:specs?|requirements?)|recommended\s*(?:specs?|requirements?))/i;
  const descKeywords = /^(?:minimum|recommended|os\s|cpu\s|processor|ram\s|memory|gpu\s|graphics|directx|storage|hard\s*disk|features|key\s*features|highlights|top\s*reviews|user\s*reviews|technical|installation|genre|developer|publisher|release|platform|rating|version|size)/i;

  let startLine = 0;
  let endLine = ls.length;

  // Skip title line(s)
  for (let i = 0; i < ls.length; i++) {
    const l = ls[i].replace(/^[#*>\-]+\s*/, "").trim();
    if (l.length > 5 && !descKeywords.test(l) && !/^\d+\s*(GB|MB)/i.test(l)) {
      startLine = i + 1;
      break;
    }
  }

  // Find where requirements/features start
  for (let i = startLine; i < ls.length; i++) {
    if (reqKeywords.test(ls[i]) || descKeywords.test(ls[i])) {
      endLine = i;
      break;
    }
  }

  const descLines = ls.slice(startLine, endLine).filter((l) => {
    const clean = l.replace(/^[#*>\-]+\s*/, "").trim();
    return clean.length > 0 && !/^(?:title|name|version|size|rating|platform|genre|developer|publisher|release)\s*[:=]/i.test(clean);
  });

  if (descLines.length > 0) {
    return descLines.join("\n\n").trim().replace(/\n{3,}/g, "\n\n").slice(0, 3000);
  }
  return "";
}

function extractSystemRequirements(text: string): string {
  // Try to find "Minimum" and "Recommended" sections together
  const minPattern = /(?:Minimum|Min\.?|System Requirements)\s*(?:Requirements?|Specs?)?\s*[:=]?\s*\n/i;
  const recPattern = /(?:Recommended|Rec\.?)\s*(?:Requirements?|Specs?)?\s*[:=]?\s*\n/i;

  const minMatch = text.match(minPattern);
  const recMatch = text.match(recPattern);

  if (minMatch && recMatch && recMatch.index! > minMatch.index!) {
    const startIdx = minMatch.index!;
    const endPatterns = [
      /\n\s*(?:Features|Key Features|Highlights|Game Features|Top Reviews|User Reviews|About|Description|Installation|Technical)/i,
    ];
    let endIdx = text.length;
    for (const ep of endPatterns) {
      const m = text.slice(recMatch.index! + recMatch[0].length).match(ep);
      if (m?.index !== undefined) {
        const candidate = recMatch.index! + recMatch[0].length + m.index;
        if (candidate < endIdx) endIdx = candidate;
      }
    }
    return text.slice(startIdx, endIdx).trim().slice(0, 3000);
  }

  // Try single "System Requirements" section
  const sysReq = findSection(
    text,
    [/(?:System Requirements|Requirements)\s*[:=]?\s*\n/i],
    [
      /\n\s*(?:Features|Key Features|Highlights|Top Reviews|User Reviews|About|Description|Installation)/i,
    ]
  );
  if (sysReq && sysReq.length > 20) return sysReq.slice(0, 3000);

  // Fallback: collect OS/CPU/RAM/GPU/Storage lines
  const ls = lines(text);
  const reqLines: string[] = [];
  let collecting = false;
  let blankCount = 0;

  for (const l of ls) {
    const lower = l.toLowerCase().replace(/[:=]/g, "").trim();

    if (/^(?:minimum|recommended|system requirements|minimum requirements|recommended requirements)/.test(lower)) {
      collecting = true;
      blankCount = 0;
    }

    if (collecting) {
      if (l.trim() === "") {
        blankCount++;
        if (blankCount >= 2 && reqLines.length > 3) break;
        reqLines.push("");
        continue;
      }
      blankCount = 0;
      reqLines.push(l);
    }

    // Also detect bare spec lines even without a header
    if (!collecting && /^(?:os\s|windows |macos |linux |intel |amd |nvidia |geforce |radeon |directx|ram |memory |gpu |processor |storage |hard disk)/i.test(lower)) {
      collecting = true;
      reqLines.push(l);
    }
  }

  return reqLines.join("\n").trim().replace(/\n{3,}/g, "\n\n");
}

function extractFeatures(text: string): string[] {
  // Try labeled features section
  const section = findSection(
    text,
    [
      /(?:Features|Key Features|Highlights|Game Features|What's (?:new|included)|Special Features|Main Features)\s*[:=]?\s*\n/i,
    ],
    [
      /\n\s*(?:System Requirements|Minimum|Recommended|Requirements|Specifications|Technical|Installation|Top Reviews|User Reviews|About|Description)/i,
    ]
  );

  if (section) {
    const items = section
      .split("\n")
      .map((l) => l.replace(/^[\s•\-\*●■▸►→➜➤◇◆▪]+/, "").replace(/^\d+[.)]\s*/, "").trim())
      .filter((l) => l.length > 3 && l.length < 250 && !/^(?:features|key features|highlights)/i.test(l));
    if (items.length > 0) return items.slice(0, 25);
  }

  // Fallback: find bullet-pointed or numbered lines
  const bullets = text.match(/(?:^|\n)\s*[•\-\*●■▸►→➜➤◆▪]\s*(.+)/g);
  if (bullets && bullets.length >= 2) {
    const items = bullets
      .map((b) => b.replace(/^[\n\s•\-\*●■▸►→➜➤◆▪]+/, "").trim())
      .filter((l) => l.length > 3 && l.length < 250);
    if (items.length >= 2) return items.slice(0, 25);
  }

  // Try numbered lists
  const numbered = text.match(/(?:^|\n)\s*\d+[.)]\s*(.+)/g);
  if (numbered && numbered.length >= 2) {
    const items = numbered
      .map((b) => b.replace(/^\n?\s*\d+[.)]\s*/, "").trim())
      .filter((l) => l.length > 3 && l.length < 250 && !/^(?:minimum|recommended|os |cpu |ram |gpu)/i.test(l));
    if (items.length >= 2) return items.slice(0, 25);
  }

  return [];
}

function extractPlatform(text: string): string {
  const lower = text.toLowerCase();

  // Check explicit platform labels
  const platformMatch = text.match(/(?:Platform|Platforms?)\s*[:=]\s*(.+)/i);
  if (platformMatch?.[1]) {
    const p = platformMatch[1].toLowerCase();
    if (/\bandroid\b/.test(p)) return "android";
    if (/\bmac(?:os)?\b/.test(p)) return "mac";
    if (/\bios\b/.test(p)) return "ios";
    if (/\bwindows\b/.test(p)) return "windows";
  }

  // Detect from keywords (order matters - check specific before general)
  if (/\b(android|apk|play\s*store|google\s*play)\b/.test(lower)) return "android";
  if (/\b(ios|iphone|ipad|app\s*store|apple)\b/.test(lower) && !/\b(windows|pc|steam)\b/.test(lower)) return "ios";
  if (/\b(mac(?:os)?|os\s*x|apple\s*silicon|metal)\b/.test(lower) && !/\b(windows|pc|steam|directx)\b/.test(lower)) return "mac";
  if (/\b(windows|pc|steam|epic\s*games|origin|ubisoft|directx|dx[0-9])\b/.test(lower)) return "windows";
  if (/\b(linux|ubuntu|steam\s*os|proton)\b/.test(lower)) return "windows"; // default for linux
  if (/\b(cross[\s-]*platform|multiplatform)\b/.test(lower)) return "cross-platform";

  // Default based on game-like content
  if (/\b(gpu|graphics|nvidia|amd|geforce|radeon|game|gaming)\b/.test(lower)) return "windows";
  return "windows";
}

function extractVersion(text: string): string {
  const patterns = [
    /(?:Version|Ver\.?|v\.?|Patch|Update)\s*[:=]?\s*(v?[\d]+(?:\.[\d]+)+(?:\s*[\w]*(?:\s*[\w]+)?))?/i,
    /\b(v[\d]+(?:\.[\d]+)+)\b/,
    /[\s,;|]\s*(\d+\.\d+(?:\.\d+)+)\b/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1] && m[1].length >= 3) return m[1].trim();
  }
  return "";
}

function extractSize(text: string): string {
  const patterns = [
    /(?:Size|File Size|Disk Space|Download Size|Storage|Required Storage|Available Space|Install Size)\s*[:=]?\s*([\d.,]+\s*(?:GB|MB|TB|KB))/i,
    /([\d.,]+\s*(?:GB|MB|TB))\s*(?:available|storage|disk|download|install|required|free)/i,
    /(?:requires?|needs?|about)\s*([\d.,]+\s*(?:GB|MB|TB))/i,
    /(\d[\d.,]*\s*(?:GB|MB|TB))\s*(?:SSD|HDD|of\s+storage)?/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim().replace(/,$/, "");
  }
  return "";
}

function extractRating(text: string): number {
  const patterns = [
    /(?:Rating|Score|Rated)\s*[:=]?\s*([\d.]+)\s*(?:\/\s*10|\/\s*5|\s*%|\s*\/\s*100)?/i,
    /([\d.]+)\s*%\s*(?:positive|approval|rating|score)/i,
    /(?:Very Positive|Mostly Positive|Overwhelmingly Positive|Positive)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      if (m[0].match(/very positive|mostly positive|overwhelmingly positive/i)) return 4.5;
      if (m[0].match(/positive/i)) return 4.0;
      if (m?.[1]) {
        let val = parseFloat(m[1]);
        if (m[0].includes("%")) {
          // Steam percentage - convert to /5
          return Math.round((val / 20) * 10) / 10;
        }
        if (val > 10) return 4.5; // weird value, default
        if (val > 5) val = val / 2; // /10 to /5
        if (val >= 0 && val <= 5) return Math.round(val * 10) / 10;
      }
    }
  }
  return 4.5;
}

function extractDownloadLinks(text: string): ParsedDownloadLink[] {
  const links: ParsedDownloadLink[] = [];
  const seen = new Set<string>();

  const urlPattern = /https?:\/\/[^\s<>"')\]]+/gi;
  const urls = text.match(urlPattern) || [];

  const crackPatterns = [/\b(crack|cracked|cracking|c0ding)\b/i, /\b(cpy|skidrow|codex|plaza|fitgirl|repack|corepack)\b/i];
  const repackPatterns = [/\b(repack|repacked|repacking)\b/i, /\b(fitgirl|dodi|corepack|xatab|qoob)\b/i, /\b(compressed|highly compressed)\b/i];
  const officialPatterns = [/\b(official|store|steam|epic games|gog|origin|battle\.net|uplay|ubisoft)\b/i, /store\.steampowered\.com/i, /epicgames\.com/i, /gog\.com/i];
  const directPatterns = [/\b(direct|download|mirror|mega|mediafire|google drive|onedrive|dropbox)\b/i];

  const linkLines = text.split("\n");

  for (const line of linkLines) {
    const lineUrls = line.match(urlPattern) || [];
    const lineLower = line.toLowerCase();

    for (const url of lineUrls) {
      if (seen.has(url)) continue;
      seen.add(url);

      let type: ParsedDownloadLink["type"] = "direct";
      let name = "Download";

      const isCrack = crackPatterns.some((p) => p.test(line)) || crackPatterns.some((p) => p.test(url));
      const isRepack = repackPatterns.some((p) => p.test(line)) || repackPatterns.some((p) => p.test(url));
      const isOfficial = officialPatterns.some((p) => p.test(line)) || officialPatterns.some((p) => p.test(url));
      const isDirect = directPatterns.some((p) => p.test(line));

      if (isCrack) {
        type = "cracked";
        name = "Cracked";
      } else if (isRepack) {
        type = "repack";
        name = "Repack";
      } else if (isOfficial) {
        type = "official";
        name = "Official";
      } else if (isDirect) {
        type = "direct";
        name = "Direct";
      }

      if (url.includes("steam")) name = "Steam";
      else if (url.includes("epicgames")) name = "Epic Games";
      else if (url.includes("gog.com")) name = "GOG";
      else if (url.includes("mega.nz") || url.includes("mega.co")) name = "MEGA";
      else if (url.includes("mediafire")) name = "MediaFire";
      else if (url.includes("drive.google")) name = "Google Drive";
      else if (url.includes("fitgirl")) { name = "FitGirl Repack"; type = "repack"; }
      else if (url.includes("dodi")) { name = "DODI Repack"; type = "repack"; }

      links.push({ name, url, type });
    }
  }

  if (links.length === 0) {
    const standaloneUrls = text.match(/\b(https?:\/\/[^\s]+)/gi) || [];
    for (const url of standaloneUrls.slice(0, 5)) {
      if (seen.has(url)) continue;
      seen.add(url);
      let type: ParsedDownloadLink["type"] = "direct";
      let name = "Download";
      if (url.includes("steam")) { type = "official"; name = "Steam"; }
      else if (url.includes("epicgames")) { type = "official"; name = "Epic Games"; }
      else if (url.includes("gog.com")) { type = "official"; name = "GOG"; }
      links.push({ name, url, type });
    }
  }

  return links;
}

export function parseGameDetails(text: string): ParsedGameData {
  const cleaned = normalize(text);
  return {
    title: extractTitle(cleaned),
    description: extractDescription(cleaned),
    systemRequirements: extractSystemRequirements(cleaned),
    features: extractFeatures(cleaned),
    platform: extractPlatform(cleaned),
    version: extractVersion(cleaned),
    size: extractSize(cleaned),
    rating: extractRating(cleaned),
    downloadLinks: extractDownloadLinks(text),
  };
}
