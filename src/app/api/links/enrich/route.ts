import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/links/enrich { links: string[] } → enriches each link via Grok (title/desc/banner/video)
// Body: { links: string[], hint?: string }  hint = page title context if pasted from a store page
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req as unknown as Request, 15);
  if (!rl.ok) return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
  let body: { links?: unknown; hint?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const links = Array.isArray(body.links) ? (body.links as unknown[]).filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u.trim())).map((u) => u.trim()).slice(0, 20) : [];
  if (links.length === 0) return NextResponse.json({ error: "Provide links array (1-20 urls)" }, { status: 400 });
  const hint = typeof body.hint === "string" ? body.hint.slice(0, 500) : "";

  // For each link, derive a title hint from URL, then call /api/ai/enrich + /api/ai/fetch-banner
  const results: unknown[] = [];
  for (const url of links) {
    const urlHint = (() => {
      try {
        const u = new URL(url);
        const seg = u.pathname.split("/").filter(Boolean).pop() || u.hostname;
        return decodeURIComponent(seg).replace(/[-_]+/g, " ").slice(0, 80);
      } catch { return url.slice(0, 80); }
    })();
    const titleHint = hint || urlHint;

    // 1. Grok enrich for name/description/features
    let meta: unknown = null;
    let provider = "";
    try {
      const r = await fetch(`${req.nextUrl.origin}/api/ai/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ title: titleHint, description: `Download link: ${url}` }] }),
      });
      const d = await r.json() as { results?: { meta?: unknown; provider?: string }[] };
      meta = d.results?.[0]?.meta || null;
      provider = d.results?.[0]?.provider || "";
    } catch {}

    // 2. Banner via fetch-banner (Steam/RAWG/web), using Grok title if available
    let banner: string | null = null;
    let bannerProvider = "";
    let videoUrl: string | null = null;
    const bannerTitle = (meta as { title?: string })?.title || titleHint;
    try {
      const r = await fetch(`${req.nextUrl.origin}/api/ai/fetch-banner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: bannerTitle }),
      });
      const d = await r.json() as { banner?: string; provider?: string };
      if (r.ok && d.banner) { banner = d.banner; bannerProvider = d.provider || ""; }
    } catch {}
    // 3. Gameplay video — search YouTube for "<title> gameplay" (best-effort, no API key)
    try {
      const q = encodeURIComponent(bannerTitle + " gameplay");
      const ytRes = await fetch(`https://www.youtube.com/results?search_query=${q}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", Accept: "text/html" },
        signal: AbortSignal.timeout(8000),
      });
      if (ytRes.ok) {
        const ytHtml = await ytRes.text();
        const vid = ytHtml.match(/"videoId":"([a-zA-Z0-9_-]{11})"/)?.[1] || ytHtml.match(/watch\?v=([a-zA-Z0-9_-]{11})/)?.[1];
        if (vid) videoUrl = `https://www.youtube.com/watch?v=${vid}`;
      }
    } catch {}
    results.push({
      url,
      titleHint,
      meta,
      provider,
      banner,
      bannerProvider,
      videoUrl,
    });
  }

  return NextResponse.json({ results });
}
