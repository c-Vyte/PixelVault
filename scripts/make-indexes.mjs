#!/usr/bin/env node
/**
 * Creates lightweight index files for browser browsing.
 * - Index: just title, category, size, poster (for listing)
 * - Full data stays in data/ for import
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function ensureDir(p) {
  const dir = dirname(p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// XZY: create ultra-light index
const xzyFull = JSON.parse(readFileSync(join(ROOT, 'data', 'xzy-import.json'), 'utf8'));
const xzyIndex = xzyFull.map(item => ({
  title: item.title || item.rawTitle || '',
  category: item._xzyType || 'game',
  genre: item._genre || '',
  size: item.size || '',
  poster: item.icon || item.poster || item.img || '',
  hasLinks: (item.downloadLinks?.length > 0) || (item._links?.length > 0),
}));

const xzyIndexPath = join(ROOT, 'public', 'data', 'xzy-index.json');
ensureDir(xzyIndexPath);
writeFileSync(xzyIndexPath, JSON.stringify(xzyIndex));
console.log(`XZY index: ${xzyIndex.length} items, ${(Buffer.byteLength(JSON.stringify(xzyIndex)) / 1024).toFixed(0)}KB`);

// Also create a chunked version of full XZY data for import
const CHUNK_SIZE = 500;
const xzyChunksDir = join(ROOT, 'public', 'data', 'xzy-chunks');
if (!existsSync(xzyChunksDir)) mkdirSync(xzyChunksDir, { recursive: true });
for (let i = 0; i < xzyFull.length; i += CHUNK_SIZE) {
  const chunk = xzyFull.slice(i, i + CHUNK_SIZE);
  const chunkIdx = Math.floor(i / CHUNK_SIZE);
  writeFileSync(join(xzyChunksDir, `${chunkIdx}.json`), JSON.stringify(chunk));
}
console.log(`XZY chunks: ${Math.ceil(xzyFull.length / CHUNK_SIZE)} chunks of ${CHUNK_SIZE}`);

// ElAmigos: already small enough, just make index too
const elamFull = JSON.parse(readFileSync(join(ROOT, 'public', 'data', 'elamigos-games.json'), 'utf8'));
const elamIndex = elamFull.map(item => ({
  title: item.title || '',
  category: 'pc-games',
  genre: item._genre || '',
  size: item.size || '',
  poster: item.poster || item.icon || '',
  hasLinks: (item.downloadLinks?.length > 0),
}));
writeFileSync(join(ROOT, 'public', 'data', 'elamigos-index.json'), JSON.stringify(elamIndex));
console.log(`ElAmigos index: ${elamIndex.length} items`);

// FitGirl: if exists, create index
const fitgirlPath = join(ROOT, 'public', 'data', 'fitgirl-games.json');
if (existsSync(fitgirlPath)) {
  const fitgirlFull = JSON.parse(readFileSync(fitgirlPath, 'utf8'));
  const fitgirlIndex = fitgirlFull.map(item => ({
    title: item.title || '',
    category: 'pc-games',
    genre: (item.genres || item.steamGenres || []).join(', '),
    size: item.repackSize || '',
    poster: item.poster || '',
    banner: item.banner || '',
    hasLinks: (item.downloads?.length > 0),
    // Enriched fields
    developers: item.developers || [],
    publishers: item.publishers || [],
    releaseDate: item.releaseDate || '',
    steamUrl: item._steamUrl || '',
    metacriticScore: item.metacriticScore || 0,
    videoUrl: item.videoUrl || '',
    systemRequirements: item.systemRequirements || null,
  }));
  writeFileSync(join(ROOT, 'public', 'data', 'fitgirl-index.json'), JSON.stringify(fitgirlIndex));
  console.log(`FitGirl index: ${fitgirlIndex.length} items`);
} else {
  console.log('FitGirl data not ready yet, skipping index');
}

console.log('\nDone!');
