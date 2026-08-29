import { NextRequest, NextResponse } from "next/server";
import { resolveHosterLinks } from "@/lib/hosters";
import { recordApiCall } from "@/lib/apiUsage";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/resolve-links
 * Body: { urls: string[], httpOnly?: boolean }
 *
 * Resolves file-hoster landing URLs (datanodes.to, fuckingfast.co,
 * pixeldrain, gofile, ...) into { ok, alive, directUrl, fileName, blocked }
 * results. Used by the admin importer to verify hoster links really contain a
 * file and to decide when to offer the torrent fallback.
 */
export async function POST(request: NextRequest) {
  let body: { urls?: unknown; httpOnly?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const urls = Array.isArray(body.urls) ? body.urls.filter((u): u is string => typeof u === "string" && u.trim().length > 0) : [];
  if (urls.length === 0) {
    return NextResponse.json({ error: "urls array required" }, { status: 400 });
  }
  if (urls.length > 60) {
    return NextResponse.json({ error: "Too many URLs (max 60 per batch)" }, { status: 413 });
  }

  const started = Date.now();
  try {
    const results = await resolveHosterLinks(urls.slice(0, 60), {
      concurrency: 4,
      httpOnly: body.httpOnly === true,
      timeoutMs: 20000,
    });

    recordApiCall({
      route: "/api/resolve-links",
      provider: "hoster-resolver",
      ok: true,
      latencyMs: Date.now() - started,
      items: results.length,
    });

    return NextResponse.json({
      results: results.map((r) => ({
        inputUrl: r.inputUrl,
        hoster: r.hoster,
        label: r.label,
        ok: r.ok,
        alive: r.alive ?? r.ok,
        blocked: !!r.blocked || r.reason === "network",
        network: r.reason === "network",
        directUrl: r.directUrl || null,
        fileName: r.fileName || null,
        fileSize: r.fileSize || null,
        via: r.via || "http",
        reason: r.reason || null,
      })),
      durationMs: Date.now() - started,
    });
  } catch (err) {
    recordApiCall({
      route: "/api/resolve-links",
      provider: "hoster-resolver",
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : "resolve failed",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to resolve links" },
      { status: 502 }
    );
  }
}
