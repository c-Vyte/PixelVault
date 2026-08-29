import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const BASE = "https://xzy.runsite.app";
const DIR = join(process.cwd(), "data");
const IMP = join(DIR, "xzy-import.json");
const LOG = join(DIR, "xzy-bg-fetch.log");

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function jget(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 12000);
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" }, signal: c.signal });
      clearTimeout(t);
      if (!r.ok) { if (i < retries) await sleep(500); else return null; continue; }
      return await r.json();
    } catch { if (i < retries) await sleep(500); else return null; }
  }
  return null;
}

function fixUrl(u) { return !u ? "" : u.startsWith("http") ? u : `${BASE}${u}`; }
function trunc(s, n = 600) {
  if (!s || s.length <= n) return s || "";
  const c = s.slice(0, n - 3).lastIndexOf(" ");
  return s.slice(0, c > n * 0.3 ? c : n - 3) + "...";
}
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

async function main() {
  const log = (msg) => { const line = new Date().toISOString() + " " + msg; console.log(line); writeFileSync(LOG, (existsSync(LOG) ? readFileSync(LOG, "utf-8") : "") + line + "\n"); };

  if (!existsSync(IMP)) { log("No import file found. Run import first."); return; }
  const items = JSON.parse(readFileSync(IMP, "utf-8"));
  log(`Loaded ${items.length} items`);

  const needsDetail = items.filter(i => i.downloadLinks.length === 0 && i.description === "");
  log(`Need details: ${needsDetail.length}`);

  const CONC = 30;
  let done = 0, ok = 0, fail = 0;
  const startTime = Date.now();

  for (let i = 0; i < needsDetail.length; i += CONC) {
    const batch = needsDetail.slice(i, i + CONC);
    const results = await Promise.all(batch.map(async (item) => {
      const d = await jget(`${BASE}/api/games/${item._xzyId}`);
      return { item, data: d && !d.detail ? d : null };
    }));

    for (const { item, data } of results) {
      done++;
      if (data) {
        ok++;
        const idx = items.findIndex(x => x.id === item.id);
        if (idx >= 0) {
          const img = fixUrl(data.wallpaper_url);
          const pics = data.screenshots ? data.screenshots.split("\n").map(s => s.trim()).filter(s => s.startsWith("http")) : [];
          items[idx].description = trunc(data.description);
          items[idx].icon = img;
          items[idx].poster = img;
          items[idx].screenshots = pics;
          items[idx].downloadLinks = parseLinks(data.download_links);
          items[idx].systemRequirements = sysReq(data);
          items[idx].version = data.version || "";
          items[idx].videoUrl = data.trailer_url || "";
          items[idx]._developer = data.developer || "";
        }
      } else {
        fail++;
      }
    }

    if (done % 300 === 0 || done === needsDetail.length) {
      writeFileSync(IMP, JSON.stringify(items, null, 2));
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = ok / elapsed;
      const eta = rate > 0 ? Math.round((needsDetail.length - done) / rate) : "?";
      log(`Progress: ${done}/${needsDetail.length} (ok:${ok} fail:${fail}) ETA:${eta}s`);
    }

    if (i + CONC < needsDetail.length) await sleep(20);
  }

  writeFileSync(IMP, JSON.stringify(items, null, 2));
  const withLinks = items.filter(i => i.downloadLinks.length > 0);
  log(`\n=== DONE ===`);
  log(`Total: ${items.length}, With links: ${withLinks.length}`);
  log(`New details fetched: ${ok}`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
