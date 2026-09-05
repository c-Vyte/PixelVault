import { NextRequest, NextResponse } from "next/server";
import { serverGetAll, serverGetPublished, serverSaveAll } from "@/lib/serverStore";
import type { Software } from "@/lib/data";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.ADMIN_PASSWORD || process.env.ADMIN_TOKEN;
  if (!expected) return true;
  const hdr = req.headers.get("x-admin-token") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const cookie = req.cookies.get("admin_token")?.value;
  return hdr === expected || cookie === expected;
}

// GET /api/software?published=1  → published only (client)
// GET /api/software?all=1        → all including pending (admin, requires auth if ADMIN_TOKEN set)
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const wantAll = url.searchParams.get("all") === "1";
  if (wantAll && !isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const list = wantAll ? await serverGetAll() : await serverGetPublished();
  return NextResponse.json(list, { headers: { "Cache-Control": "no-store" } });
}

// POST /api/software  body: Software[]  (full list) or { items: Software[] }  — admin only if ADMIN_TOKEN set
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const list: Software[] = Array.isArray(body) ? (body as Software[]) : Array.isArray((body as { items?: unknown }).items) ? ((body as { items: Software[] }).items) : [];
  if (!Array.isArray(list)) return NextResponse.json({ error: "Body must be Software[]" }, { status: 400 });
  // Basic sanity: each item must have id and title
  for (const it of list) {
    if (!it || typeof (it as { id?: unknown }).id !== "string" || typeof (it as { title?: unknown }).title !== "string") {
      return NextResponse.json({ error: "Each item must have id and title" }, { status: 400 });
    }
  }
  await serverSaveAll(list);
  return NextResponse.json({ ok: true, count: list.length });
}

// Optional: PUT for single upsert (admin)
export async function PUT(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let item: Software;
  try { item = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!item?.id || !item?.title) return NextResponse.json({ error: "id and title required" }, { status: 400 });
  const all = await serverGetAll();
  const idx = all.findIndex((s) => s.id === item.id);
  if (idx >= 0) all[idx] = item; else all.push(item);
  await serverSaveAll(all);
  return NextResponse.json({ ok: true });
}
