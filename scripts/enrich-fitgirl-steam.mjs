#!/usr/bin/env node
/**
 * Enriches FitGirl scraped data with original Steam game info.
 * Extracts Steam App ID from banner URLs, fetches from Steam API,
 * and merges system requirements, videos, descriptions, etc.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

const FITGIRL_FULL = join(ROOT, "data", "fitgirl-games.json");
const FITGIRL_LIGHT = join(ROOT, "public", "data", "fitgirl-games.json");
const FITGIRL_ENRICHED = join(ROOT, "data", "fitgirl-enriched.json");
const PROGRESS_FILE = join(ROOT, "data", "fitgirl-enriched-progress.json");

const DELAY_MS = 1500;
const BATCH_SIZE = 50;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(p) {
  const dir = dirname(p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function extractSteamAppId(game) {
  // Try banner URL: steam/apps/{id}/header.jpg
  if (game.banner) {
    const match = game.banner.match(/steam\/apps\/(\d+)\//);
    if (match) return match[1];
  }
  // Try poster URL
  if (game.poster) {
    const match = game.poster.match(/steam\/apps\/(\d+)\//);
    if (match) return match[1];
  }
  // Try description text for store.steampowered.com/app/{id}
  if (game.description) {
    const match = game.description.match(/store\.steampowered\.com\/app\/(\d+)/);
    if (match) return match[1];
  }
  // Try features or any other field
  const fields = [game.description, ...(game.features || [])].join(" ");
  const match = fields.match(/steampowered\.com\/app\/(\d+)/);
  return match ? match[1] : null;
}

async function fetchSteamApp(appId) {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=us&l=english`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data[appId]?.success) return data[appId].data;
    return null;
  } catch (err) {
    console.error(`  Steam API error for ${appId}: ${err.message}`);
    return null;
  }
}

function parseSteamRequirements(steamData) {
  const req = steamData?.pc_requirements;
  if (!req) return { minimum: "", recommended: "" };
  return {
    minimum: stripHtml(req.minimum || ""),
    recommended: stripHtml(req.recommended || ""),
  };
}

function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function mergeGames(fitgirlGame, steamData, appId) {
  const enriched = { ...fitgirlGame };
  enriched._steamAppId = appId;
  enriched._steamUrl = `https://store.steampowered.com/app/${appId}`;

  // Description: prefer Steam's detailed description
  if (steamData?.short_description) {
    enriched.originalDescription = stripHtml(steamData.short_description);
  }
  if (steamData?.description) {
    enriched.originalDescriptionFull = stripHtml(steamData.description);
  }

  // System requirements
  const reqs = parseSteamRequirements(steamData);
  enriched.systemRequirements = reqs;

  // Video
  if (steamData?.movies?.length > 0) {
    const trailer = steamData.movies[0];
    const webmMax = trailer.webm && trailer.webm.max;
    const mp4Max = trailer.mp4 && trailer.mp4.max;
    const webm480 = trailer.webm && trailer.webm["480"];
    enriched.videoUrl = webmMax || mp4Max || webm480 || "";
    enriched.videoThumbnail = trailer.thumbnail;
  }

  // Genres from Steam
  if (steamData?.genres?.length > 0) {
    enriched.steamGenres = steamData.genres.map((g) => g.description);
  }

  // Developers / Publishers
  enriched.developers = steamData?.developers || [];
  enriched.publishers = steamData?.publishers || [];

  // Release date
  if (steamData?.release_date) {
    enriched.releaseDate = steamData.release_date.date;
    enriched.comingSoon = steamData.release_date.coming_soon;
  }

  // Screenshots from Steam
  if (steamData?.screenshots?.length > 0) {
    enriched.steamScreenshots = steamData.screenshots.map((s) => s.path_full || s.path_thumbnail);
  }

  // Metacritic
  if (steamData?.metacritic) {
    enriched.metacriticScore = steamData.metacritic.score;
    enriched.metacriticUrl = steamData.metacritic.url;
  }

  // Content descriptors
  if (steamData?.content_descriptors?.notes) {
    enriched.contentRating = steamData.content_descriptors.notes;
  }

  return enriched;
}

function makeLightVersion(enriched) {
  return enriched.map((g) => ({
    title: g.title,
    url: g.url,
    genres: g.genres,
    companies: g.companies,
    languages: g.languages,
    originalSize: g.originalSize,
    repackSize: g.repackSize,
    poster: g.poster,
    banner: g.banner,
    downloads: g.downloads,
    description: g.description,
    features: g.features,
    // Enriched fields
    _steamAppId: g._steamAppId,
    _steamUrl: g._steamUrl,
    originalDescription: g.originalDescription,
    systemRequirements: g.systemRequirements,
    videoUrl: g.videoUrl,
    videoThumbnail: g.videoThumbnail,
    steamGenres: g.steamGenres,
    developers: g.developers,
    publishers: g.publishers,
    releaseDate: g.releaseDate,
    steamScreenshots: (g.steamScreenshots || []).slice(0, 5),
    metacriticScore: g.metacriticScore,
  }));
}

async function main() {
  console.log("=== FitGirl Steam Enrichment ===\n");

  // Load FitGirl data
  if (!existsSync(FITGIRL_FULL)) {
    console.error("No fitgirl-games.json found. Run parse-fitgirl.mjs first.");
    process.exit(1);
  }

  const games = JSON.parse(readFileSync(FITGIRL_FULL, "utf-8"));
  console.log(`Loaded ${games.length} FitGirl games.\n`);

  // Load progress if exists
  let enriched = [];
  let processedIds = new Set();
  if (existsSync(PROGRESS_FILE)) {
    try {
      enriched = JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
      for (const g of enriched) {
        if (g._steamAppId) processedIds.add(g._steamAppId);
      }
      console.log(`Resuming: ${enriched.length} games already enriched.`);
    } catch {
      console.log("Could not parse progress file, starting fresh.");
      enriched = [];
      processedIds = new Set();
    }
  }

  // Find games with Steam App IDs that haven't been processed
  const toEnrich = [];
  for (const game of games) {
    const appId = extractSteamAppId(game);
    if (appId && !processedIds.has(appId)) {
      toEnrich.push({ game, appId });
    }
  }

  // Also include games without App ID (they'll be added as-is)
  const noAppId = games.filter((g) => !extractSteamAppId(g));

  console.log(`Games with Steam App ID to enrich: ${toEnrich.length}`);
  console.log(`Games without Steam App ID (skip): ${noAppId.length}`);
  console.log(`Already enriched: ${enriched.length}\n`);

  if (toEnrich.length === 0) {
    console.log("Nothing to enrich. Adding games without Steam IDs...");
    for (const game of noAppId) {
      if (!enriched.find((e) => e.title === game.title)) {
        enriched.push(game);
      }
    }
  } else {
    // Enrich in batches
    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;

    for (let i = 0; i < toEnrich.length; i += BATCH_SIZE) {
      const batch = toEnrich.slice(i, i + BATCH_SIZE);
      console.log(
        `\n--- Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(toEnrich.length / BATCH_SIZE)} ---`
      );

      for (const { game, appId } of batch) {
        const idx = i + batch.indexOf({ game, appId }) + 1;
        process.stdout.write(
          `  [${idx}/${toEnrich.length}] ${game.title} (AppID: ${appId})... `
        );

        const steamData = await fetchSteamApp(appId);
        if (steamData) {
          const merged = mergeGames(game, steamData, appId);
          enriched.push(merged);
          processedIds.add(appId);
          successCount++;
          console.log("OK");
        } else {
          enriched.push(game);
          failCount++;
          console.log("FAIL (added without enrichment)");
        }

        await sleep(DELAY_MS);
      }

      // Save progress after each batch
      ensureDir(PROGRESS_FILE);
      writeFileSync(PROGRESS_FILE, JSON.stringify(enriched, null, 2), "utf-8");
      console.log(`  Progress saved (${enriched.length} games)`);
    }

    // Add games without Steam App ID
    for (const game of noAppId) {
      if (!enriched.find((e) => e.title === game.title)) {
        enriched.push(game);
        skipCount++;
      }
    }

    console.log("\n=== Summary ===");
    console.log(`  Enriched from Steam: ${successCount}`);
    console.log(`  Failed (no Steam data): ${failCount}`);
    console.log(`  No App ID (added as-is): ${skipCount}`);
  }

  // Save full enriched data
  ensureDir(FITGIRL_ENRICHED);
  writeFileSync(FITGIRL_ENRICHED, JSON.stringify(enriched, null, 2), "utf-8");
  console.log(`\nFull enriched data saved to ${FITGIRL_ENRICHED}`);

  // Save light version for public
  const lightData = makeLightVersion(enriched);
  ensureDir(FITGIRL_LIGHT);
  writeFileSync(FITGIRL_LIGHT, JSON.stringify(lightData, null, 2), "utf-8");
  console.log(`Light data saved to ${FITGIRL_LIGHT}`);

  // Stats
  const withReqs = enriched.filter((g) => g.systemRequirements?.minimum).length;
  const withVideo = enriched.filter((g) => g.videoUrl).length;
  const withScreenshots = enriched.filter((g) => g.steamScreenshots?.length > 0).length;
  const withDevs = enriched.filter((g) => g.developers?.length > 0).length;

  console.log(`\n=== Enrichment Stats ===`);
  console.log(`  Total games: ${enriched.length}`);
  console.log(`  With system requirements: ${withReqs}`);
  console.log(`  With video/trailer: ${withVideo}`);
  console.log(`  With Steam screenshots: ${withScreenshots}`);
  console.log(`  With developer info: ${withDevs}`);

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
