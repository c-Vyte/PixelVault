import { NextRequest, NextResponse } from "next/server";
import { serverGetAll } from "@/lib/serverStore";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const token = process.env.CRON_SECRET || process.env.ADMIN_TOKEN || process.env.ADMIN_PASSWORD || "";
  if (!token) return true;
  const hdr = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
  return hdr === token;
}

// GET /api/cron/backup?secret=CRON_SECRET — snapshots /app/data/software.json to /app/data/backups/software-YYYY-MM-DD.json
// Called nightly via Vercel Cron (vercel.json) and via docker-compose healthcheck on Hetzner/Render.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const all = await serverGetAll();
  if (all.length === 0) return NextResponse.json({ ok: true, backedUp: 0, message: "No data to backup" });
  const dir = process.env.DATA_DIR || (process.env.NODE_ENV === "production" ? "/app/data" : path.join(process.cwd(), "data"));
  const backupDir = path.join(dir, "backups");
  try { await fs.mkdir(backupDir, { recursive: true }); } catch {}
  const stamp = new Date().toISOString().slice(0, 10);
  const file = path.join(backupDir, `software-${stamp}.json`);
  const tmp = file + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(all, null, 2), "utf-8");
  await fs.rename(tmp, file);
  // Prune backups older than 14 days
  try {
    const files = await fs.readdir(backupDir);
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    for (const f of files) {
      const p = path.join(backupDir, f);
      const st = await fs.stat(p);
      if (st.mtimeMs < cutoff) await fs.unlink(p).catch(() => {});
    }
  } catch {}
  return NextResponse.json({ ok: true, backedUp: all.length, file });
}
