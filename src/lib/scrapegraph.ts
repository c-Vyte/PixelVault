/**
 * ScrapeGraphAI integration — LLM-powered structured extraction.
 * Uses hosted API if SCRAPEGRAPH_API_KEY is set, otherwise falls back to local fetch + Grok enrichment.
 * Docs: https://scrapegraphai.com / https://docs.scrapegraphai.com
 */

export interface ScrapeGraphResult {
  title?: string;
  description?: string;
  image?: string;
  screenshots?: string[];
  links?: { name: string; url: string; type?: string }[];
  videoUrl?: string;
  features?: string[];
  systemRequirements?: string;
  raw?: unknown;
}

const SG_API_URL = process.env.SCRAPEGRAPH_API_URL || "https://api.scrapegraphai.com/v1/smartScraper";
const SG_KEY = process.env.SCRAPEGRAPH_API_KEY;

export async function scrapeWithScrapeGraph(
  url: string,
  prompt = "Extract game/software metadata: title, description, main image, screenshots, download links, video trailer, features, system requirements"
): Promise<ScrapeGraphResult | null> {
  if (!SG_KEY) return null;
  try {
    const res = await fetch(SG_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "SG-APIKEY": SG_KEY },
      body: JSON.stringify({ website_url: url, user_prompt: prompt }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { result?: ScrapeGraphResult; [k: string]: unknown };
    return (data.result as ScrapeGraphResult) || (data as ScrapeGraphResult) || null;
  } catch {
    return null;
  }
}

// Fallback: extract via our existing fetch + Grok enrich — used when SG not configured
export async function scrapeWithFallback(url: string): Promise<ScrapeGraphResult | null> {
  try {
    const { fetchWithFallback } = await import("@/lib/fetchers");
    const result = await fetchWithFallback(url, { requireHtml: true, timeoutMs: 20000 });
    if (!result.ok) return null;
    // Return minimal for Grok to enrich
    return { raw: result.text.slice(0, 8000) };
  } catch {
    return null;
  }
}
