import { NextRequest, NextResponse } from "next/server";
import { parseDetailPage, guessContentType } from "@/lib/importParser";
import { fetchWithFallback } from "@/lib/fetchers";

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

  const result = await fetchWithFallback(url, { requireHtml: true, timeoutMs: 30000 });

  if (!result.ok) {
    if (result.status === 403 || result.status === 503) {
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
      return NextResponse.json({ error: "Page not found (404)" }, { status: 404 });
    }
    if (result.status === 0) {
      return NextResponse.json(
        {
          error: result.error || "Could not reach the site — check the URL and try again.",
        },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: result.error || `HTTP ${result.status}` }, { status: 502 });
  }

  if (isCloudflareChallenge(result.text)) {
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

  const parsed = parseDetailPage(result.text, result.finalUrl || url);
  return NextResponse.json({
    ...parsed,
    contentType: parsed.contentType || guessContentType(result.finalUrl || url, parsed.title),
  });
}

function isCloudflareChallenge(html: string): boolean {
  return /Just a moment|cf-chl|cFp|c__cf_chl|challenge-platform|cf_chl_opt|Checking your browser|Ray ID:/i.test(html);
}