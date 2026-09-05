import { promises as fs } from "fs";
import path from "path";
import type { Software } from "./data";

// File-backed store on persistent volume (/app/data for Hetzner Coolify, fallback to ./data)
const DATA_DIR = process.env.DATA_DIR || (process.env.NODE_ENV === "production" ? "/app/data" : path.join(process.cwd(), "data"));
const DATA_FILE = path.join(DATA_DIR, "software.json");

async function ensureDir() {
  try { await fs.mkdir(DATA_DIR, { recursive: true }); } catch {}
}

export async function serverGetAll(): Promise<Software[]> {
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
  await ensureDir();
  const tmp = DATA_FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(list, null, 2), "utf-8");
  await fs.rename(tmp, DATA_FILE);
}

export async function serverGetPublished(): Promise<Software[]> {
  const all = await serverGetAll();
  return all.filter((s) => !s.status || s.status === "published");
}
