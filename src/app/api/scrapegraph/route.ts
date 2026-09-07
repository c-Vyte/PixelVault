import { NextRequest, NextResponse } from "next/server";
import { scrapeWithScrapeGraph, scrapeWithFallback } from "@/lib/scrapegraph";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/scrapegraph { url, prompt? } → { result }
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req as unknown as Request, 20);
  if (!rl.ok) return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
  let body: { url?: unknown; prompt?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url || !/^https?:\/\//.test(url)) return NextResponse.json({ error: "Valid url required" }, { status: 400 });
  try { new URL(url); } catch { return NextResponse.json({ error: "Invalid URL" }, { status: 400 }); }
  const prompt = typeof body.prompt === "string" ? body.prompt : undefined;
  const sg = await scrapeWithScrapeGraph(url, prompt);
  if (sg) return NextResponse.json({ result: sg, provider: "scrapegraph" });
  const fallback = await scrapeWithFallback(url);
  if (fallback) return NextResponse.json({ result: fallback, provider: "fallback" });
  return NextResponse.json({ error: "Scrape failed" }, { status: 502 });
}
