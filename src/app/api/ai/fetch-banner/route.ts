import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36";

async function steamBanner(title: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(title.replace(/^#+/, "").trim());
    const searchRes = await fetch(`https://store.steampowered.com/api/storesearch/?term=${q}&cc=us&l=english`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!searchRes.ok) return null;
    const data = await searchRes.json();
    const first = data.items?.[0];
    if (!first?.id) return null;
    return `https://cdn.akamai.steamstatic.com/steam/apps/${first.id}/header.jpg`;
  } catch { return null; }
}

async function duckImage(title: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`${title} game`);
    const res = await fetch(`https://lite.duckduckgo.com/lite/?q=${q}`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/href="(https?:\/\/[^"]+)"/);
    if (!m) return null;
    const pageUrl = m[1];
    const pageRes = await fetch(pageUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
    if (!pageRes.ok) return null;
    const pageHtml = await pageRes.text();
    const og = pageHtml.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i) || pageHtml.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:image"/i);
    if (og) return og[1];
    const img = pageHtml.match(/<img[^>]+src="([^"]+\.(?:jpg|png|webp))"/i);
    return img ? img[1] : null;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  let banner = await steamBanner(title);
  if (!banner) banner = await duckImage(title);
  if (!banner) return NextResponse.json({ error: "No banner found on internet for this title." }, { status: 404 });
  return NextResponse.json({ banner });
}
