import { NextRequest, NextResponse } from "next/server";
import { BROWSER_HEADERS } from "@/lib/fetchUtils";
import { recordApiCall } from "@/lib/apiUsage";

interface CheckResult {
  url: string;
  status: "alive" | "dead" | "unknown";
  statusCode: number;
}

async function checkUrl(url: string): Promise<CheckResult> {
  try {
    new URL(url);
  } catch {
    return { url, status: "unknown", statusCode: 0 };
  }

  // Try HEAD first, fall back to GET if HEAD is blocked (403/405)
  for (const method of ["HEAD", "GET"] as const) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method,
        headers: BROWSER_HEADERS,
        signal: controller.signal,
        redirect: "follow",
      });

      clearTimeout(timeout);

      if (response.ok || response.status === 301 || response.status === 302) {
        return { url, status: "alive", statusCode: response.status };
      }
      // 403/429 = blocked but site is alive
      if (response.status === 403 || response.status === 429) {
        return { url, status: "unknown", statusCode: response.status };
      }
      // HEAD returned 405 Method Not Allowed — try GET
      if (method === "HEAD" && (response.status === 405 || response.status === 501)) {
        continue;
      }
      return { url, status: "dead", statusCode: response.status };
    } catch {
      // Network error / timeout — try GET if we were on HEAD
      if (method === "HEAD") continue;
      return { url, status: "unknown", statusCode: 0 };
    }
  }

  return { url, status: "unknown", statusCode: 0 };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const urls: string[] = body.urls;

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: "urls array required" }, { status: 400 });
    }

    const BATCH_SIZE = 10;
    const results: CheckResult[] = [];
    const started = Date.now();

    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      const batch = urls.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(checkUrl));
      results.push(...batchResults);
    }

    recordApiCall({
      route: "/api/check-links",
      provider: "link-checker",
      ok: true,
      latencyMs: Date.now() - started,
      items: results.length,
    });

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
