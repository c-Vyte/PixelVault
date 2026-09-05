import { promises as fs } from "fs";
import path from "path";
import type { Software } from "./data";

// Neon Postgres for Vercel (ephemeral fs) — falls back to file volume for Hetzner/Render
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

async function neonGetAll(): Promise<Software[] | null> {
  if (!DATABASE_URL) return null;
  try {
    // @ts-ignore - optional dep, only needed on Vercel with DATABASE_URL
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(DATABASE_URL);
    await sql`CREATE TABLE IF NOT EXISTS pixelvault_software (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW())`;
    const rows = await sql`SELECT data FROM pixelvault_software ORDER BY updated_at DESC`;
    if (!rows || rows.length === 0) return [];
    return rows.map((r: { data: Software }) => r.data as Software);
  } catch {
    return null;
  }
}

async function neonSaveAll(list: Software[]): Promise<boolean> {
  if (!DATABASE_URL) return false;
  try {
    // @ts-ignore
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(DATABASE_URL);
    await sql`CREATE TABLE IF NOT EXISTS pixelvault_software (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`DELETE FROM pixelvault_software`;
    // Batch insert (50 per batch to avoid param limits)
    for (let i = 0; i < list.length; i += 50) {
      const batch = list.slice(i, i + 50);
      const values = batch.map((s) => [s.id, JSON.stringify(s)] as const);
      // Use template literal with sql helper for batch
      for (const [id, data] of values) {
        await sql`INSERT INTO pixelvault_software (id, data) VALUES (${id}, ${data}::jsonb) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`;
      }
    }
    return true;
  } catch {
    return false;
  }
}

// File-backed store on persistent volume (/app/data for Hetzner Coolify, fallback to ./data)
const DATA_DIR = process.env.DATA_DIR || (process.env.NODE_ENV === "production" ? "/app/data" : path.join(process.cwd(), "data"));
const DATA_FILE = path.join(DATA_DIR, "software.json");

async function ensureDir() {
  try { await fs.mkdir(DATA_DIR, { recursive: true }); } catch {}
}

export async function serverGetAll(): Promise<Software[]> {
  const neonData = await neonGetAll();
  if (neonData !== null) return neonData;
  try {
    await ensureDir();
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Software[];
    return [];
  } catch {
    return [];
  }
}

export async function serverSaveAll(list: Software[]): Promise<void> {
  if (await neonSaveAll(list)) return;
  await ensureDir();
  const tmp = DATA_FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(list, null, 2), "utf-8");
  await fs.rename(tmp, DATA_FILE);
}

export async function serverGetPublished(): Promise<Software[]> {
  const all = await serverGetAll();
  return all.filter((s) => !s.status || s.status === "published");
}
