/**
 * ScrapeGraphAI — now the PRIMARY scraper for download links (replaces normal fetch+parse).
 * Falls back to normal fetchWithFallback + importParser if no API key or ScrapeGraph fails.
 */

export interface ScrapeGraphLinksResult {
  links: { name: string; url: string; type?: string }[];
  title?: string;
  description?: string;
}

const SG_API_URL = process.env.SCRAPEGRAPH_API_URL || "https://api.scrapegraphai.com/v1/smartScraper";
const SG_KEY = process.env.SCRAPEGRAPH_API_KEY;

export async function scrapeDownloadLinksWithScrapeGraph(url: string): Promise<ScrapeGraphLinksResult | null> {
  if (!SG_KEY) return null;
  try {
    const res = await fetch(SG_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "SG-APIKEY": SG_KEY },
      body: JSON.stringify({
        website_url: url,
        user_prompt:
          "Extract all download links for this game/software: return JSON { links: [{name, url, type}], title, description }. For each link, url must be absolute https:// or magnet:, name is hoster or filename, type is direct/repack/torrent/official. Include every hoster (datanodes, fuckingfast, filekeeper, gofile, pixeldrain, buzzheavier, 1fichier, mediafire, mega, filecrypt, keeplinks, etc.) and every part (part1, part2, .001). Do not miss multi-part archives.",
      }),
      signal: AbortSignal.timeout(35000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { result?: { links?: { name?: string; url?: string; type?: string }[]; title?: string; description?: string } & Record<string, unknown> };
    const result = (data.result as ScrapeGraphLinksResult) || (data as unknown as ScrapeGraphLinksResult);
    if (!result || !Array.isArray(result.links) || result.links.length === 0) return null;
    // Normalize
    const links = result.links
      .filter((l) => l && typeof l.url === "string" && /^https?:\/\/|magnet:/.test(l.url))
      .map((l) => ({ name: l.name || "Download", url: l.url, type: l.type || "direct" }));
    if (links.length === 0) return null;
    return { links, title: result.title, description: result.description };
  } catch {
    return null;
  }
}
