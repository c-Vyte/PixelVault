import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const HTML_PATH = "C:\\Users\\Admin\\Desktop\\elamigos.site\\elamigos.site\\index.html";
const OUT = "C:\\fileshare\\data\\elamigos-games.json";
const BASE = "https://elamigos.site";
const CONC = 15;
const DELAY = 100;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const html = readFileSync(HTML_PATH, "utf-8");

const games = [];
const seen = new Set();
let currentDate = "";
let pos = 0;

// Split by newlines and process line by line
const lines = html.split("\n");
for (const line of lines) {
  // Date header
  const dateMatch = line.match(/<h1>([\d.]+)<\/h1>/);
  if (dateMatch) { currentDate = dateMatch[1]; continue; }

  // Game entry (h3 or h5 with download link)
  const gameMatch = line.match(/<h([35])[^>]*>(.*?)<\/h\1>/);
  if (!gameMatch) continue;

  const inner = gameMatch[2];
  const linkMatch = inner.match(/href="data\/([^"]+\.html)"/);
  if (!linkMatch) continue;

  const href = linkMatch[1];
  if (seen.has(href)) continue;
  seen.add(href);

  // Title = everything before <a>
  const titleParts = inner.split(/<a\s/);
  let title = titleParts[0].replace(/<[^>]+>/g, "").trim();
  title = title.replace(/\s+/g, " ");

  // Extract updates from title
  const updateMatches = title.match(/\+?\[([^\]]+)\]/g) || [];
  const updates = updateMatches.map(u => u.replace(/\+?\[|\]/g, ""));
  const cleanTitle = title.replace(/\+?\[[^\]]+\]/g, "").replace(/\[[^\]]+\]/g, "").trim();

  // Check for Hypervisor
  const hasHypervisor = inner.includes("Hypervisor");

  // Image - look for img tag before this entry
  let img = "";
  const imgMatch = inner.match(/<img\s+src="([^"]+)"/);
  if (imgMatch) img = imgMatch[1];

  games.push({
    title: cleanTitle,
    rawTitle: title,
    href,
    date: currentDate,
    hasHypervisor,
    updates,
    detailUrl: `${BASE}/data/${href}`,
    img,
    downloadLinks: [],
    size: "",
    languages: "",
    description: "",
  });
}

console.log(`Parsed ${games.length} games from index`);

// Fetch detail pages in batches
async function fetchDetail(game) {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 15000);
    const r = await fetch(game.detailUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: c.signal,
    });
    clearTimeout(t);
    if (!r.ok) return;
    const h = await r.text();

    // Extract size
    const sizeMatch = h.match(/(\d+[\d.,]*\s*[GMK]B)/i);
    if (sizeMatch) game.size = sizeMatch[1];

    // Extract languages
    const langMatch = h.match(/Languages?:\s*([^<]+)/i);
    if (langMatch) game.languages = langMatch[1].trim();

    // Extract description (first <p> or <h2> content)
    const descMatch = h.match(/<h2>([^<]+)<\/h2>/);
    if (descMatch) game.description = descMatch[1].trim();

    // Extract download links
    const links = [];
    const linkRegex = /<a\s+href="(https?:\/\/[^"]+)"[^>]*>/g;
    let lm;
    while ((lm = linkRegex.exec(h)) !== null) {
      const url = lm[1];
      // Skip youtube, fonts, navigation
      if (url.includes("youtube.com") || url.includes("fonts") ||
          url.includes("elamigos.site") && url.includes("img")) continue;
      links.push(url);
    }
    game.downloadLinks = links;
  } catch (e) {
    // skip
  }
}

async function main() {
  console.log(`Fetching ${games.length} detail pages (${CONC} concurrent)...`);
  let done = 0;
  for (let i = 0; i < games.length; i += CONC) {
    const batch = games.slice(i, i + CONC);
    await Promise.all(batch.map(g => fetchDetail(g)));
    done += batch.length;
    process.stdout.write(`\r  ${done}/${games.length}`);
    if (i + CONC < games.length) await sleep(DELAY);
  }
  console.log(`\n`);

  const withLinks = games.filter(g => g.downloadLinks.length > 0);
  console.log(`Games with download links: ${withLinks.length}/${games.length}`);

  // Sample
  if (withLinks.length > 0) {
    console.log(`\nSample: ${withLinks[0].title}`);
    console.log(`  Size: ${withLinks[0].size}`);
    console.log(`  Links: ${withLinks[0].downloadLinks.length}`);
    withLinks[0].downloadLinks.forEach(l => console.log(`    ${l}`));
  }

  writeFileSync(OUT, JSON.stringify(games, null, 2));
  console.log(`\nSaved to ${OUT}`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
