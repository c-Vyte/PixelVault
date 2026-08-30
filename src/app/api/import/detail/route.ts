import { NextRequest, NextResponse } from "next/server";
import { parseDetailPage, guessContentType } from "@/lib/importParser";
import { fetchWithFallback } from "@/lib/fetchers";
import { isCloudflareChallenge } from "@/lib/fetchUtils";
import { recordApiCall } from "@/lib/apiUsage";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const started = Date.now();
  const result = await fetchWithFallback(url, { requireHtml: true, timeoutMs: 30000 });

  if (!result.ok) {
    recordApiCall({
      route: "/api/import/detail",
      provider: "detail",
      ok: false,
      latencyMs: Date.now() - started,
      error: `HTTP ${result.status}`,
    });
    if (result.status === 403 || result.status === 503 || result.error === "cloudflare") {
      return NextResponse.json(
        {
          error:
            "This site is protected (Cloudflare or WAF) and blocked automated access. " +
            "Open the page in your browser, press Ctrl+A then Ctrl+C to copy the page source, " +
            "then switch to 'Paste HTML' mode in the importer.",
          blocked: true,
        },
        { status: 403 }
      );
    }
    if (result.status === 404) {
      return NextResponse.json({ error: "Page not found (404) — check the URL." }, { status: 404 });
    }
    if (result.status === 0) {
      return NextResponse.json(
        { error: result.error || "Could not reach the site — check the URL and your connection." },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: result.error || `HTTP ${result.status}` }, { status: result.status || 502 });
  }

  if (isCloudflareChallenge(result.text)) {
    recordApiCall({ route: "/api/import/detail", provider: "detail", ok: false, latencyMs: Date.now() - started, error: "cloudflare" });
    return NextResponse.json(
      {
        error:
          "This site is protected by Cloudflare and requires a browser challenge. " +
          "Open the page in your browser, solve the challenge, then press Ctrl+A / Ctrl+C " +
          "and use the 'Paste HTML' import mode.",
        blocked: true,
      },
      { status: 403 }
    );
  }

  const finalUrl = result.finalUrl || url;
  const parsed = parseDetailPage(result.text, finalUrl);

  const usableLinks = parsed.links.filter((l) => l.url && l.url.trim());
  const directCount = usableLinks.filter((l) => l.type !== "torrent" && !l.url.startsWith("magnet:")).length;
  const torrentCount = usableLinks.length - directCount;
  const hosters = Array.from(
    new Set(
      usableLinks
        .map((l) => { try { return new URL(l.url).hostname.replace(/^www\./, ""); } catch { return ""; } })
        .filter(Boolean)
    )
  ).slice(0, 12);

  recordApiCall({
    route: "/api/import/detail",
    provider: "detail",
    ok: true,
    latencyMs: Date.now() - started,
    items: usableLinks.length,
  });

  return NextResponse.json({
    ...parsed,
    contentType: parsed.contentType || guessContentType(finalUrl, parsed.title),
    finalUrl,
    sourceHost: parsedUrl.hostname.replace(/^www\./, ""),
    // Helpful summary the UI can surface without re-walking the links.
    linkSummary: {
      total: usableLinks.length,
      direct: directCount,
      torrent: torrentCount,
      hosters,
      hasPassword: !!parsed.password,
    },
  });
}
