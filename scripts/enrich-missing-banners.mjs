#!/usr/bin/env node
/**
 * Enrich missing banners/posters/descriptions for apps/games without banner.
 * Hybrid: Steam-first for games, DuckDuckGo lite + og:image extraction for software.
 * Reuses throttling/resume pattern from parse-fitgirl / enrich-fitgirl-steam.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const PUBLIC_DIR = join(ROOT, "public", "data");

const DELAY_MS = 1500;
const MAX_RETRIES = 3;
const BATCH_SAVE = 20;

const PROGRESS = join(DATA_DIR, "enrich-banners-progress.json");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function ensureDir(p) { const d = dirname(p); if (!existsSync(d)) mkdirSync(d, { recursive: true }); }
function isMissingBanner(item) {
  const p = item.poster || item.icon || item.banner || "";
  return !p || p.includes("placehold.co") || p.includes("via.placeholder");
}
function stripHtml(s) { return s.replace(/<[^>]+>/g, "").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").trim(); }

async function fetchWithRetry(url, opts = {}) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "text/html,application/json,*/*", ...opts.headers },
        signal: AbortSignal.timeout(15000),
        ...opts,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      if (attempt === MAX_RETRIES) throw e;
      await sleep(1000 * attempt);
    }
  }
}

// Steam: try search via store search suggestion API, then appdetails
async function steamSearch(title) {
  try {
    const q = encodeURIComponent(title);
    // store search suggestion: https://store.steampowered.com/search/suggest?term=...&f=games&cc=US&l=english
    const url = `https://store.steampowered.com/search/suggest?term=${q}&f=games&cc=US&l=english`;
    const res = await fetchWithRetry(url);
    const html = await res.text();
    // html contains data-ds-appid="12345"
    const m = html.match(/data-ds-appid="(\d+)"/);
    if (m) return m[1];
    // fallback: search page
    const url2 = `https://store.steampowered.com/search/?term=${q}&category1=998`;
    const res2 = await fetchWithRetry(url2);
    const html2 = await res2.text();
    const m2 = html2.match(/\/app\/(\d+)\//);
    if (m2) return m2[1];
  } catch {}
  return null;
}

async function fetchSteamDetails(appId) {
  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=US&l=english`;
    const res = await fetchWithRetry(url, { headers: { Accept: "application/json" } });
    const data = await res.json();
    const d = data?.[appId]?.data;
    if (!d) return null;
    return {
      banner: d.header_image || `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
      poster: d.header_image || "",
      description: stripHtml(d.short_description || d.about_the_game || "").substring(0, 800),
      screenshots: (d.screenshots || []).slice(0,3).map(s=>s.path_full),
      systemRequirements: d.pc_requirements ? stripHtml(d.pc_requirements.minimum || "").substring(0,600) : "",
    };
  } catch { return null; }
}

async function duckDuckGoSearch(query) {
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetchWithRetry(url);
    const html = await res.text();
    const links = [];
    // lite: <a href="//duckduckgo.com/l/?uddg=https%3A%2F%2F...">
    const re1 = /uddg=([^&"]+)/g;
    let m;
    while ((m = re1.exec(html)) !== null) {
      try { const u = decodeURIComponent(m[1]); if (u.startsWith("http")) links.push(u); } catch {}
      if (links.length >= 5) break;
    }
    // fallback: direct <a rel="nofollow" href="https://...">
    if (links.length === 0) {
      const re2 = /<a[^>]+href="(https:\/\/[^"]+)"[^>]*class="result-link"/g;
      while ((m = re2.exec(html)) !== null) { links.push(m[1]); if (links.length >=5) break; }
    }
    return links.slice(0,5);
  } catch { return []; }
}

function extractOg(html, url) {
  // og:image
  let m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    || html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  let banner = m ? m[1] : "";
  if (banner && banner.startsWith("//")) banner = "https:" + banner;
  else if (banner && banner.startsWith("/")) { try { banner = new URL(banner, url).href; } catch {} }
  // og:description
  let md = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  let desc = md ? stripHtml(md[1]).substring(0,800) : "";
  if (!banner) {
    const im = html.match(/<img[^>]+src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp))["']/i);
    if (im) banner = im[1];
  }
  return { banner, description: desc };
}

async function enrichItem(item) {
  if (!isMissingBanner(item)) return { item, enriched: false, reason: "has banner" };
  const title = (item.title || "").trim();
  if (!title) return { item, enriched: false, reason: "no title" };
  const isGame = (item.category === "pc-games" || item.category === "game" || (item.genres && item.genres.length) || item.repackSize);

  // 1) Steam-first for games
  if (isGame) {
    const appId = await steamSearch(title);
    if (appId) {
      const steam = await fetchSteamDetails(appId);
      if (steam && steam.banner) {
        return { item: { ...item, banner: steam.banner, poster: steam.poster || item.poster || steam.banner, icon: steam.banner, description: item.description || steam.description, screenshots: item.screenshots?.length ? item.screenshots : steam.screenshots, systemRequirements: item.systemRequirements || steam.systemRequirements, _steamAppId: appId }, enriched: true, reason: `steam ${appId}` };
      }
    }
    await sleep(DELAY_MS);
  }

  // 2) DuckDuckGo generic
  const query = `${title} ${isGame ? "steam official" : "official site download"}`;
  const links = await duckDuckGoSearch(query);
  for (const link of links.slice(0,3)) {
    try {
      const res = await fetchWithRetry(link);
      const html = await res.text();
      const { banner, description } = extractOg(html, link);
      if (banner && banner.startsWith("http") && !banner.includes("duckduckgo.com")) {
        // basic validation: skip tiny icons
        if (banner.includes("favicon") || banner.includes("logo") && banner.length < 80) continue;
        return { item: { ...item, banner, poster: item.poster || banner, icon: banner, description: item.description || description }, enriched: true, reason: `og ${new URL(link).hostname}` };
      }
      await sleep(400);
    } catch { await sleep(400); }
  }
  return { item, enriched: false, reason: "no og found" };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const targetArg = args.find(a => a.startsWith("--target="))?.split("=")[1] || "all"; // all | fitgirl | xzy | elamigos
  const limitArg = args.find(a => a.startsWith("--limit="))?.split("=")[1];
  const limit = limitArg ? parseInt(limitArg,10) : Infinity;

  const sources = [];
  if (targetArg === "all" || targetArg === "fitgirl") {
    const p = join(PUBLIC_DIR, "fitgirl-games.json");
    if (existsSync(p)) sources.push({ name: "fitgirl", path: p, publicPath: p, dataPath: join(DATA_DIR, "fitgirl-games.json") });
  }
  if (targetArg === "all" || targetArg === "xzy") {
    const p = join(ROOT, "data", "xzy-import.json");
    if (existsSync(p)) sources.push({ name: "xzy", path: p, publicPath: join(PUBLIC_DIR, "xzy-import.json"), dataPath: p });
  }
  if (targetArg === "all" || targetArg === "elamigos") {
    const p = join(PUBLIC_DIR, "elamigos-games.json");
    if (existsSync(p)) sources.push({ name: "elamigos", path: p, publicPath: p, dataPath: join(DATA_DIR, "elamigos-games.json") });
  }

  if (sources.length === 0) { console.log("No sources found for target", targetArg); return; }

  // load progress
  let progress = {};
  if (existsSync(PROGRESS)) { try { progress = JSON.parse(readFileSync(PROGRESS,"utf-8")); } catch {} }

  for (const src of sources) {
    console.log(`\n=== ${src.name} (${src.path}) ===`);
    const raw = JSON.parse(readFileSync(src.path, "utf-8-sig"));
    const arr = Array.isArray(raw) ? raw : [];
    const missing = arr.filter(isMissingBanner);
    console.log(`Total ${arr.length}, missing banner ${missing.length}`);

    if (missing.length === 0) continue;
    let toProcess = missing.slice(0, limit);
    // resume: skip already attempted in progress
    const key = `${src.name}_done`;
    const doneSet = new Set(progress[key] || []);
    toProcess = toProcess.filter(it => !doneSet.has(it.title));
    console.log(`To enrich ${toProcess.length} (after resume filter)`);

    let enrichedCount = 0;
    for (let i = 0; i < toProcess.length; i++) {
      const item = toProcess[i];
      const idx = arr.findIndex(x => x.title === item.title);
      process.stdout.write(`[${i+1}/${toProcess.length}] ${item.title.substring(0,50)} ... `);
      try {
        const res = await enrichItem(item);
        if (res.enriched) {
          arr[idx] = res.item;
          enrichedCount++;
          console.log(`OK (${res.reason})`);
        } else {
          console.log(`SKIP (${res.reason})`);
        }
      } catch (e) { console.log(`ERR ${e.message}`); }
      // track progress
      if (!progress[key]) progress[key] = [];
      progress[key].push(item.title);
      if ((i+1) % BATCH_SAVE === 0) { ensureDir(PROGRESS); writeFileSync(PROGRESS, JSON.stringify(progress,null,2)); }
      await sleep(DELAY_MS);
    }

    console.log(`Enriched ${enrichedCount}/${toProcess.length} for ${src.name}`);
    if (!dryRun && enrichedCount>0) {
      ensureDir(src.path);
      writeFileSync(src.path, JSON.stringify(arr, null, 2));
      if (src.dataPath && src.dataPath !== src.path && existsSync(src.dataPath)) {
        try { writeFileSync(src.dataPath, JSON.stringify(arr, null,2)); } catch {}
      }
      console.log(`Saved ${src.path}`);
      // regenerate index
      try {
        const { execSync } = await import("child_process");
        execSync("node scripts/make-indexes.mjs", { cwd: ROOT, stdio: "inherit" });
      } catch (e) { console.log("make-indexes failed", e.message); }
    }
    ensureDir(PROGRESS); writeFileSync(PROGRESS, JSON.stringify(progress,null,2));
  }
  console.log("\nDone. Use --dry-run to preview without writing. --target=fitgirl|xzy|elamigos --limit=20");
}

main().catch(e=>{ console.error(e); process.exit(1); });
