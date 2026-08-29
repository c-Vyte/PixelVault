#!/usr/bin/env node
/**
 * AI enrichment: fills missing descriptions, features and tags on software items
 * using free LLM providers. Resume-safe via progress file.
 *
 * Usage:
 *   node scripts/ai-enrich.mjs            # process up to 50 items missing data
 *   node scripts/ai-enrich.mjs --limit 200
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { chatJSON, requireProviders } from "./lib/llm.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");

const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx !== -1 ? Number(args[limitIdx + 1]) || 50 : 50;
const PROGRESS = join(DATA_DIR, "ai-enrich-progress.json");
const OUTPUT = join(DATA_DIR, "ai-enriched.json");

function ensureDir(p) { const d = dirname(p); if (!existsSync(d)) mkdirSync(d, { recursive: true }); }
ensureDir(DATA_DIR);

function loadList() {
  const candidates = [
    join(PUBLIC_DIR(), "software-index.json"),
    join(DATA_DIR, "fitgirl-games.json"),
    join(DATA_DIR, "xzy-index.json"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      console.log(`Loading ${p}`);
      return JSON.parse(readFileSync(p, "utf8"));
    }
  }
  return null;
}
function PUBLIC_DIR() { return join(ROOT, "public", "data"); }

const items = loadList();
if (!items) {
  console.error("No source list found in data/. Expected software-index.json or fitgirl-games.json.");
  process.exit(1);
}

const done = existsSync(PROGRESS) ? new Set(JSON.parse(readFileSync(PROGRESS, "utf8"))) : new Set();
const enriched = existsSync(OUTPUT) ? JSON.parse(readFileSync(OUTPUT, "utf8")) : {};

const SYSTEM = `You are a game/software metadata generator for a download portal.
Return ONLY valid JSON with this shape:
{"description": "2-3 sentence marketing description", "features": ["short feature", "..."], "tags": ["action","rpg"], "category": "pc-games|apps|android-apps"}`;

const targets = items
  .filter((it) => it && it.title && (!it.description || it.description.length < 40) && !done.has(it.title))
  .slice(0, LIMIT);

console.log(`${targets.length} items to enrich (limit ${LIMIT}), ${done.size} already done`);

let ok = 0;
for (const item of targets) {
  try {
    const { data } = await chatJSON(
      `Title: "${item.title}"${item.size ? `\nSize: ${item.size}` : ""}${item.source ? `\nSource: ${item.source}` : ""}
Generate metadata for this title.`,
      SYSTEM,
      { timeoutMs: 45000 }
    );
    enriched[item.title] = {
      description: data.description || "",
      features: Array.isArray(data.features) ? data.features.slice(0, 8) : [],
      tags: Array.isArray(data.tags) ? data.tags.slice(0, 10) : [],
      category: data.category || "pc-games",
    };
    done.add(item.title);
    ok++;
    if (ok % 10 === 0) {
      writeFileSync(PROGRESS, JSON.stringify([...done]));
      writeFileSync(OUTPUT, JSON.stringify(enriched, null, 2));
      console.log(`  ...${ok}/${targets.length} saved`);
    }
  } catch (e) {
    console.error(`FAIL "${item.title}": ${e.message.split("\n")[0]}`);
  }
}

writeFileSync(PROGRESS, JSON.stringify([...done]));
writeFileSync(OUTPUT, JSON.stringify(enriched, null, 2));
console.log(`Done. Enriched ${ok} items -> ${OUTPUT}`);
