# PixelVault — Development Guide

## Next.js Warning

This is NOT the Next.js you know. This version (16.3) has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Project Overview

**PixelVault** — a gaming & software download portal built with Next.js 16.3 App Router, React 19, Tailwind CSS 4, and TypeScript. All data persists in `localStorage` — no database, no real auth.

## Architecture

- **App Router** (`src/app/`) with admin section (`/admin/*`)
- **3 pre-existing TS errors** in `BrowserFetcher.ts` (lines 224, 234) and `siteContent.ts` (line 129) — not caused by our changes
- **localStorage** is the persistence layer — use `saveSoftwareList()` from `src/lib/data.ts` which returns `boolean` and auto-slims data on `QuotaExceededError`
- **Toast system** available via `useToast()` from `@/components/admin/Toast`

## Data Model

```typescript
interface Software {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory: string;
  platform: string;
  version: string;
  size: string;
  downloads: number;
  rating: number;
  icon: string;
  poster: string;
  screenshots: string[];
  downloadLinks: {
    name: string;
    url: string;
    type: string;
    parts?: number;
    partLinks?: string[];
    status?: "alive" | "dead" | "unknown";
    lastChecked?: number;
  }[];
  password?: string;
  systemRequirements?: { minimum?: Record<string, string>; recommended?: Record<string, string> };
  features: string[];
  videoUrl?: string;
  createdAt: string;
  updatedAt?: string;
}
```

## External Data Sources

### XZY API
- `/api/games` — lists ALL items (21,977 = games + software combined)
- `/api/movies` — 4,000+ movies
- `/api/anime` — 1,000+ anime
- `/api/search?q=X` — returns max 100 per category
- Detail via `/api/games/{id}` — contains download links in format: `version | size | /api/filecr/download/slug?link_id=N`
- **Index system**: Lightweight indexes in `public/data/xzy-index.json` (~4MB) for browsing; chunked full data in `public/data/xzy-chunks/*.json` (500 items each)

### ElAmigos (`https://elamigos.site`)
- 3,391 games with download links from `filecrypt.cc` and `keeplinks.org`
- Data at `public/data/elamigos-games.json` (1.6MB)

### FitGirl Repacks (`https://fitgirl-repacks.site`)
- WordPress site; A-Z listing uses LCP plugin with `?lcp_page0=N` pagination (144 pages, ~7,153 games)
- Game pages contain: title, tags, companies, languages, sizes, poster (og:image), banner (Steam header or poster fallback), description (from "Game Description" spoiler, NOT og:description)
- Download links: `paste.fitgirl-repacks.site` (individual file links), torrent links (magnet, 1337x, Tapochek)
- **If hoster has captcha**, use the link BEFORE the captcha as download link
- **If both torrent and repack available**, add both with correct descriptions
- Data at `public/data/fitgirl-games.json` (after scraping completes)

### Index Creator (`scripts/make-indexes.mjs`)
- Creates lightweight index files for all data sources
- XZY chunked full data (500 items per chunk)

## Scrapers

### `scripts/import-xzy.mjs`
- Fetches all 21,875+ items from XZY API with download links
- Background fetch (`scripts/import-xzy-bg.mjs`) runs async, takes ~43 minutes
- Saves to `data/xzy-import.json` (full, 56MB) + `public/data/xzy-import.json` (light, 20.3MB)

### `scripts/parse-elamigos.mjs`
- Scrapes ElAmigos site, extracts game data with filecrypt/keeplinks download links
- 3,391 games extracted

### `scripts/parse-fitgirl.mjs`
- Two-phase scraper: Phase 1 collects all URLs, Phase 2 parses each game page
- Resume support, 1.5s delays between requests, 3 retries per page
- Saves every 10 games to `data/fitgirl-games.json`
- Phase 2 extracts: title, genres, companies, languages, sizes, poster, banner, description, direct links, torrent links, features, compatibility notes

## Admin Pages

### Dashboard (`/admin`)
- Quick action cards (External Data, Import, Software, Settings)
- Reads `softwareList` from localStorage, refreshes via `software-data-changed` custom event
- Shows stats (total software, downloads, avg rating, top categories)

### Software Management (`/admin/software`)
- Grid/table view with search, category filter, sort
- `persistSoftware(list)` helper wraps `localStorage.setItem()` + dispatches `software-data-changed` event
- Bulk operations: delete, remove no-link entries, remove repacks entries
- Auto-link checker: runs in batches of 20, HEAD→GET fallback, 10s timeout
- Link status tracking with `alive/dead/unknown` states

### External Data (`/admin/external-data`)
- Loads lightweight indexes (~4MB) for browsing XZY, ElAmigos, FitGirl data
- Fetches full data chunks only during import
- Handles FitGirl `downloads` array format
- Shows banner, genres, companies, repack sizes
- Toast notifications for import success/error
- Floating scroll-to-top/bottom buttons

### Import (`/admin/import`)
- URL analysis, link extraction, preview
- Supports Yandex Disk, Gofile, Datanodes, Mega.nz, MediaFire, Google Drive
- Context-aware name extraction for generic "Download" links

### Link Checker (`/admin/link-check`)
- Persistent link checking with automatic retry
- Background auto-retry every 30 seconds
- Link health stats per software entry

## Fetching System

### `src/lib/linkFetcher.ts`
- `fetchWithFallback(url)` — retry with Cloudflare bypass + browser fallback
- `HEAD → GET` fallback for services that reject HEAD
- 10 second timeout per request

### `src/lib/hosters/` — File-hoster link resolution (NEW)
File hosters hand out *landing page* URLs that contain the real file behind a
button/form/JS flow. This module follows that flow so the importer can verify a
link really contains a file and extract the direct URL + real filename.
- `registry.ts` — `HOSTERS` metadata (host regex, priority, `needsBrowser`,
  `ipBound`), `identifyHoster()`, `isFileHosterUrl()`, `isTorrentUrl()`.
  Priority order: datanodes(100) > fuckingfast(95) > pixeldrain(90) > gofile(85)
  > buzzheavier(80) > filekeeper(75) > krakenfiles(70) > 1fichier(60) …
- `resolvers/fuckingfast.ts` — GET landing → legacy `window.open(".../dl/…")`
  JS regex OR HTMX flow: POST `/f/<id>/go` with `HX-Request: true`, read
  `hx-redirect`/`location` header → `dl.fuckingfast.co/dl/<token>`. Filename
  comes from the URL fragment (`/<id>#Game.part1.rar`).
- `resolvers/datanodes.ts` — XFileSharing-derived: POST `/download` with
  `op=download2, id=<fileCode>, method_free=…, dl=1` → JSON `{url}` or 302 to
  `rnodeN.datanodes.to:8443/d/<token>/<name>` (session/IP-scoped).
- `resolvers/mediafire.ts` — GET the file page, read the server-rendered
  `#downloadButton` / `a.popsok` href (or any `download*.mediafire.com/...` URL)
  → direct link + filename; non-HTML responses are treated as instant downloads.
- `resolvers/mega.ts` — MEGA files are client-side encrypted (AES key lives in
  the URL fragment; direct URLs only exist in-browser), so it NEVER returns a
  directUrl. It verifies a link is alive and reads size via the public
  `g.api.mega.co.nz/cs` API (`[{a:"g",g:1,p:<id>}]` → `{s, at}` vs `{ea:-8}`
  dead). Handles /file/, /folder/, /embed/ and legacy `/#!<id>!<key>` links.
- `resolvers/fileskeep.ts` — FilesKeep (fileskeep.com), XFileSharing behind
  Cloudflare: GET landing → POST `/` `op=download2, id=<code>` → 302/node URL;
  browser fallback handles the countdown/captcha gate.
- `resolvers/simpleHosts.ts` — pixeldrain (`/api/file/<id>`), gofile (guest
  token → `/api/contents/<code>`), krakenfiles (`/api/v1/file/<id>`), plus a
  generic XFileSharing alive-check fallback for megaup/sendcm/etc.
- `browserResolve.ts` — Playwright fallback for Cloudflare/Turnstile gates:
  fires the same HTMX/XFS POST *inside* a real page (same-origin cookies) and
  captures download events / popups / DOM dl URLs. Dynamically imports
  BrowserPool so it never loads in edge/serverless runtimes.
- `hosterHttp.ts` — raw HTTP client: manual-redirect POST, CookieJar, form
  bodies, hoster browser headers.
- `index.ts` — `resolveHosterLink(url, opts)` (HTTP → browser fallback),
  `resolveHosterLinks(urls, {concurrency})` batch, `classifyResolvedLinks()`
  (hasDirect / hasTorrent / deadHosterUrls). **Network/CF failures are reported
  as `blocked`/`reason:"network"`, never as "dead"** — an outage must not push
  the admin toward torrents.
- API: `POST /api/resolve-links` `{urls, httpOnly?}` → per-link
  `{ok, alive, blocked, network, directUrl, fileName, via, reason}` (max 60/batch).

### Torrent fallback prompt
When an item's file-hoster links are confirmed dead but it still has a
torrent/magnet mirror, the importer prompts **"No working file-hoster links —
use torrents?"** (Accept torrents / Skip). Implemented in
`admin/import/page.tsx` (`torrentPrompt`, `confirmTorrentAction`) and
`admin/external-data/page.tsx` (`torrentGate`, `isTorrentOnly`). Resolved
status persists per-link as `resolveState` / `directUrl` / `resolvedAt`.

### `src/lib/importParser.ts`
- `isGenericLinkName(name)` — rejects "Download", "Download 1", etc.
- `extractContextName(container)` — extracts names from headings, tables, lists
- `extractNameFromUrl(url)` — parses from filename, path, query params
- `fileNameFromUrlHash(url)` — filename from hoster fragment (fuckingfast style)
- `absoluteUrl()` now KEEPS the URL fragment when it looks like a filename
- `FILE_HOSTS` regex + `linkDisplayName()` map for automatic hoster naming
- Link sort priority: datanodes > fuckingfast > filekeeper > gofile > pixeldrain
  > buzzheavier > krakenfiles > 1fichier > torrents last

### `src/lib/BrowserPool.ts`
- Event-driven Promise wait queue (replaced polling `setInterval(100ms)`)
- Headless Chromium instances for browser-level fetching when Node.js fetch fails

## Key Patterns

### Event-Driven Data Refresh
```typescript
// Dispatch after saving:
window.dispatchEvent(new Event("software-data-changed"));

// Listen in components:
useEffect(() => {
  const handler = () => { /* reload from localStorage */ };
  window.addEventListener("software-data-changed", handler);
  return () => window.removeEventListener("software-data-changed", handler);
}, []);
```

### Auto-Slim on Quota Exceeded
```typescript
// In data.ts - saveSoftwareList() catches QuotaExceededError
// and auto-trims in 3 tiers:
// 1. Truncate descriptions/screenshots/features to 500 chars
// 2. Remove screenshots array entirely
// 3. Reduce downloadLinks to first 2 only
```

### Link Status Persistence
```typescript
// Each download link tracks:
// - status: "alive" | "dead" | "unknown"
// - lastChecked: timestamp (Date.now())
// Checked via /api/check-links POST with { urls: string[] }
```

## Background Tasks

- **FitGirl scraper** runs async in terminal — takes ~3+ hours for full 7,153 games
- **Dev server** runs at `http://localhost:3000`
- PowerShell frequently hangs — use `taskkill /F /IM node.exe` to recover

## Current State

### Completed
- Fetching system with retry + Cloudflare bypass + browser fallback
- Link checking with persistent status + auto-retry
- Import parser with context-aware name extraction
- XZY full data fetch (21,875 items)
- ElAmigos scraper (3,391 games)
- Index system for efficient browsing
- External Data admin page
- Dashboard with auto-refresh
- Software bulk operations with event dispatch

### In Progress
- FitGirl Repacks scraper (Phase 2: parsing game pages)
- Needs `make-indexes.mjs` run after scraper finishes to create index files

### Blocked
- PowerShell/terminal extremely sluggish — `taskkill /F /IM node.exe` often needed
- FitGirl scraper takes ~3+ hours; first ~90 scraped with old code (no Steam banner, og:description)

## Import Link Detection Rules

1. **Generic names rejected**: "Download", "Download 1", "Click here", "Link 1", etc.
2. **URL-based naming**: Extracts from filename before query params or path segments
3. **Context-based naming**: Looks at headings, table headers, `<strong>` elements near the link
4. **File host detection**: Automatically names links from known hosts (Gofile → "Gofile", Mega → "Mega.nz", etc.)

## Download Link Format (XZY)

Links in XZY detail pages use pipe-separated format:
```
Version | Size | /api/filecr/download/slug?link_id=N
```
Parse into: `{ name: version, url: "https://xzy.runsite.app/api/filecr/download/slug?link_id=N", type: "direct" }`

## Scraping Rules (FitGirl)

1. **Description**: Use text inside `<div class="entry-content"> <div class="su-box"> <div class="su-box-content"> <div class="su-spoiler"> <div class="su-spoiler-title">Game Description` — NOT `og:description`
2. **Banner**: Extract from Steam header images (`store.steampowered.com/app/{id}`), wide content images, or poster (og:image) as fallback
3. **Download links**: Use link BEFORE captcha as download; if both torrent and repack available, add both with correct descriptions
4. **Sizes**: Parse from "Select download type" section (Repack size, Mirrors size, Lossless size)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
