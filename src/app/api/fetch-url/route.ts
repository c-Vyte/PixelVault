import { NextRequest, NextResponse } from "next/server";
import { fetchWithFallback } from "@/lib/fetchers";
import { recordApiCall } from "@/lib/apiUsage";

function extractMeta(html: string, property: string): string {
  const patterns = [
    new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${property}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function extractTitle(html: string): string {
  const ogTitle = extractMeta(html, "og:title");
  if (ogTitle) return ogTitle;
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch?.[1]?.trim() || "";
}

function extractDescription(html: string): string {
  const ogDesc = extractMeta(html, "og:description");
  if (ogDesc) return ogDesc;
  const metaDesc = extractMeta(html, "description");
  if (metaDesc) return metaDesc;
  return "";
}

function extractImage(html: string): string {
  const ogImage = extractMeta(html, "og:image");
  if (ogImage) return ogImage;
  const twitterImage = extractMeta(html, "twitter:image");
  if (twitterImage) return twitterImage;
  return "";
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const started = Date.now();
  const result = await fetchWithFallback(url, {
    requireHtml: true,
    timeoutMs: 15000,
  });

  recordApiCall({
    route: "/api/fetch-url",
    provider: "fetch-url",
    ok: !!result.ok,
    latencyMs: Date.now() - started,
    error: result.ok ? undefined : `HTTP ${result.status}`,
  });

  if (!result.ok) {
    if (result.status === 403 || result.status === 503) {
      return NextResponse.json(
        {
          error:
            "This site is protected (Cloudflare or WAF) and blocked automated access.",
          blocked: true,
        },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: result.error || `HTTP ${result.status}` },
      { status: result.status || 502 }
    );
  }

  const html = result.text;
  const title = extractTitle(html);
  const description = extractDescription(html);
  const image = extractImage(html);

  return NextResponse.json({
    title,
    description,
    image,
    url,
    domain: new URL(url).hostname.replace("www.", ""),
  });
}
