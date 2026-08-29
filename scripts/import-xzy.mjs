import { writeFileSync, mkdirSync, existsSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";

const BASE = "https://xzy.runsite.app";
const DIR = join(process.cwd(), "data");
const OUT = join(DIR, "xzy-import.json");
const CP = join(DIR, "xzy-checkpoint.json");

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function jget(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 12000);
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" }, signal: c.signal });
      clearTimeout(t);
      if (!r.ok) { if (i < retries) await sleep(200); else return null; continue; }
      return await r.json();
    } catch { if (i < retries) await sleep(200); else return null; }
  }
  return null;
}

function loadCP() {
  try { if (existsSync(CP)) return JSON.parse(readFileSync(CP, "utf-8")); } catch {}
  return { phase: "list", listItems: [], doneIds: [], detailItems: [] };
}
function saveCP(cp) { writeFileSync(CP, JSON.stringify(cp)); }

async function getAllList() {
  const items = [];
  let off = 0, total = Infinity;
  while (off < total) {
    const d = await jget(`${BASE}/api/games?limit=200&offset=${off}`);
    if (!d?.items?.length) break;
    total = d.total || 0;
    items.push(...d.items);
    off += d.items.length;
    process.stdout.write(`\r  List: ${items.length}/${total}`);
    if (off < total) await sleep(10);
  }
  console.log(`\n  -> ${items.length} items`);
  return items;
}

function trunc(s, n = 600) {
  if (!s || s.length <= n) return s || "";
  const c = s.slice(0, n - 3).lastIndexOf(" ");
  return s.slice(0, c > n * 0.3 ? c : n - 3) + "...";
}
function fixUrl(u) { return !u ? "" : u.startsWith("http") ? u : `${BASE}${u}`; }

function parseLinks(raw) {
  if (!raw) return [];
  const links = [];
  for (const line of raw.split("\n")) {
    const p = line.trim().split("|").map(x => x.trim());
    if (p.length >= 3) {
      links.push({ name: `${p[0]} (${p[1]})`, url: p[2].startsWith("http") ? p[2] : `${BASE}${p[2]}`, type: "direct" });
    } else if (p[0]?.startsWith("http")) {
      links.push({ name: "Download", url: p[0], type: "direct" });
    } else if (p[0]?.startsWith("/")) {
      links.push({ name: "Download", url: `${BASE}${p[0]}`, type: "direct" });
    }
  }
  return links;
}

function sysReq(d) {
  const p = [];
  if (d.os) p.push(`OS: ${d.os}`);
  if (d.processor) p.push(`CPU: ${d.processor}`);
  if (d.memory) p.push(`RAM: ${d.memory}`);
  if (d.graphics) p.push(`GPU: ${d.graphics}`);
  if (d.storage) p.push(`Storage: ${d.storage}`);
  return p.join(", ");
}

function transform(d) {
  const img = fixUrl(d.wallpaper_url);
  const pics = d.screenshots ? d.screenshots.split("\n").map(s => s.trim()).filter(s => s.startsWith("http")) : [];
  const cat = d.type === "game" ? "pc-games" : d.type === "software" ? "windows" : "movies";
  return {
    id: `xzy-${d.id}`, title: d.title || "", description: trunc(d.description),
    category: cat, subcategory: d.genre?.split(",")[0]?.trim() || "",
    platform: cat === "movies" ? "cross-platform" : "windows",
    version: d.version || "", size: "", downloads: d.downloads || 0, rating: d.rating || 0,
    icon: img, poster: img, screenshots: pics, downloadLinks: parseLinks(d.download_links),
    password: "", systemRequirements: sysReq(d), features: [], videoUrl: d.trailer_url || "",
    createdAt: d.created_at || new Date().toISOString(), updatedAt: d.updated_at || undefined,
    _xzyId: d.id, _xzyType: d.type || "", _developer: d.developer || "", _genre: d.genre || "",
  };
}

async function fetchPool(ids, existingMap, concurrency = 200) {
  const results = new Map(existingMap);
  const todo = ids.filter(id => !results.has(id));
  console.log(`  To fetch: ${todo.length} (have ${results.size})`);

  let idx = 0, active = 0, done = 0, failed = 0;
  return new Promise(resolve => {
    function next() {
      while (active < concurrency && idx < todo.length) {
        const id = todo[idx++];
        active++;
        jget(`${BASE}/api/games/${id}`).then(d => {
          active--;
          if (d && !d.detail) { results.set(id, d); }
          else { failed++; }
          done++;
          process.stdout.write(`\r  ${done}/${todo.length} (ok:${results.size} fail:${failed})`);
          if (done === todo.length) resolve([...results.values()]);
          else next();
        }).catch(() => {
          active--; done++; failed++;
          process.stdout.write(`\r  ${done}/${todo.length} (ok:${results.size} fail:${failed})`);
          if (done === todo.length) resolve([...results.values()]);
          else next();
        });
      }
    }
    next();
  });
}

async function main() {
  console.log("=== XZY Importer v4 ===\n");
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });

  const cp = loadCP();

  if (cp.phase === "list") {
    console.log("Phase 1: Fetching item list...");
    cp.listItems = await getAllList();
    cp.phase = "details";
    saveCP(cp);
  } else {
    console.log(`List: ${cp.listItems.length} items`);
  }

  if (cp.phase === "details") {
    const existingMap = new Map();
    for (const d of cp.detailItems) existingMap.set(d.id, d);
    console.log(`\nPhase 2: Fetching details (200 concurrent)...`);
    const allDetails = await fetchPool(cp.listItems.map(i => i.id), existingMap, 200);
    cp.detailItems = allDetails;
    cp.phase = "done";
    saveCP(cp);
  }

  console.log("\nPhase 3: Transforming...");
  const items = cp.detailItems.map(transform);

  const detailIds = new Set(cp.detailItems.map(d => d.id));
  for (const li of cp.listItems) {
    if (!detailIds.has(li.id)) {
      items.push({
        id: `xzy-${li.id}`, title: li.title || "", description: "",
        category: li.type === "game" ? "pc-games" : li.type === "software" ? "windows" : "movies",
        subcategory: li.genre?.split(",")[0]?.trim() || "", platform: "windows",
        version: "", size: "", downloads: li.downloads || 0, rating: li.rating || 0,
        icon: fixUrl(li.wallpaper_url), poster: fixUrl(li.wallpaper_url),
        screenshots: [], downloadLinks: [], password: "", systemRequirements: "",
        features: [], videoUrl: "", createdAt: li.created_at || new Date().toISOString(),
        _xzyId: li.id, _xzyType: li.type || "", _genre: li.genre || "",
      });
    }
  }

  const stats = {};
  for (const i of items) stats[i.category] = (stats[i.category] || 0) + 1;
  const withLinks = items.filter(i => i.downloadLinks.length > 0);

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total: ${items.length}`);
  for (const [k, v] of Object.entries(stats)) console.log(`  ${k}: ${v}`);
  console.log(`With download links: ${withLinks.length}/${items.length}`);

  writeFileSync(OUT, JSON.stringify(items, null, 2));
  console.log(`Saved to ${OUT}`);
  if (existsSync(CP)) unlinkSync(CP);
  console.log("Done!");
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
