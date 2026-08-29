// Quick test: parse a single FitGirl game page
const testUrl = 'https://fitgirl-repacks.site/blud/';
const res = await fetch(testUrl, {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0' }
});
const html = await res.text();

console.log('HTML length:', html.length);

// Title
const titleMatch = html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/);
console.log('Title:', titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'NOT FOUND');

// Tags
const tags = [...html.matchAll(/href="https?:\/\/fitgirl-repacks\.site\/tag\/([^/"]+)\/"[^>]*>([^<]+)<\/a>/gi)];
console.log('Tags:', tags.map(m => m[2].trim()));

// Metadata
const companies = html.match(/Companies:\s*<strong>([\s\S]*?)<\/strong>/i);
console.log('Companies:', companies ? companies[1].replace(/<[^>]+>/g, '').trim() : 'NOT FOUND');
const repackSize = html.match(/Repack Size:\s*<strong>([\s\S]*?)<\/strong>/i);
console.log('Repack Size:', repackSize ? repackSize[1].replace(/<[^>]+>/g, '').trim() : 'NOT FOUND');

// Direct links section
const directSection = html.match(/<h3>Download Mirrors\s*\(Direct Links?\)\s*<\/h3>([\s\S]*?)(?=<h3>|$)/i);
console.log('Direct section found:', !!directSection);

// Paste links
const pasteLinks = [...html.matchAll(/<a\s+href="(https?:\/\/paste\.fitgirl-repacks\.site\/[^"]*)"[^>]*>([^<]*)<\/a>/gi)];
console.log('Paste links:', pasteLinks.map(m => ({name: m[2].trim(), url: m[1].substring(0, 80)})));

// Magnet links
const magnets = [...html.matchAll(/<a\s+href="(magnet:\?xt=urn:btih:[^"]+)"[^>]*>\s*magnet\s*<\/a>/gi)];
console.log('Magnet links:', magnets.length);

// 1337x links
const x1337 = [...html.matchAll(/<a\s+href="(https?:\/\/(?:www\.)?1337x\.to\/torrent\/[^"]+)"[^>]*>([^<]*)<\/a>/gi)];
console.log('1337x links:', x1337.map(m => m[2].trim()));

// Direct file links from spoilers
const spoilerFiles = [...html.matchAll(/<a\s+href="(https?:\/\/(?:datanodes\.to|fuckingfast\.co)\/[^"]+)"[^>]*>([^<]+)<\/a>/gi)];
console.log('Spoiler file links:', spoilerFiles.length);
console.log('Sample:', spoilerFiles.slice(0, 3).map(m => ({name: m[2].trim(), url: m[1].substring(0, 80)})));

// Torrent section
const torrentSection = html.match(/<h3>Download Mirrors\s*\(Torrent\)\s*<\/h3>([\s\S]*?)(?=<h3>|$)/i);
console.log('Torrent section found:', !!torrentSection);

// Poster
const ogImage = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
console.log('Poster:', ogImage ? ogImage[1].substring(0, 80) : 'NOT FOUND');
