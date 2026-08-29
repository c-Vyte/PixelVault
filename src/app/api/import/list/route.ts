import { NextRequest, NextResponse } from "next/server";
import { parseListingPage } from "@/lib/importParser";
import { fetchWithFallback } from "@/lib/fetchers";
import { isCloudflareChallenge } from "@/lib/fetchUtils";

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

  const result = await fetchWithFallback(url, { requireHtml: true, timeoutMs: 20000 });

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
    if (result.status === 0) {
      return NextResponse.json(
        { error: result.error || "Could not reach the site — check the URL and try again." },
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

  const entries = parseListingPage(result.text, url);
  if (entries.length === 0) {
    return NextResponse.json(
      { error: "No app entries found on this page. Try 'Paste HTML' mode for better results." },
      { status: 422 }
    );
  }

  return NextResponse.json({
    url,
    source: new URL(url).hostname.replace("www.", ""),
    entries,
    count: entries.length,
  });
}
