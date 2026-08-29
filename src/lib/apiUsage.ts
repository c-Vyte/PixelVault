import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";

export interface ApiUsageEntry {
  ts: number;
  route: string;
  provider: string;
  model?: string;
  ok: boolean;
  latencyMs: number;
  items?: number;
  error?: string;
}

export interface ProviderStats {
  provider: string;
  calls: number;
  ok: number;
  failed: number;
  avgLatencyMs: number;
}

export interface DayStats {
  date: string;
  calls: number;
  ok: number;
  failed: number;
}

export interface ApiUsageStats {
  totals: {
    calls: number;
    ok: number;
    failed: number;
    avgLatencyMs: number;
    successRatePct: number;
    last24h: number;
  };
  byProvider: ProviderStats[];
  byDay: DayStats[];
  recentErrors: ApiUsageEntry[];
}

const DATA_DIR = join(process.cwd(), "data");
const USAGE_FILE = join(DATA_DIR, "api-usage.json");
const MAX_ENTRIES = 5000;

function ensureDir(p: string) {
  const d = dirname(p);
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

export function readUsage(): ApiUsageEntry[] {
  try {
    if (!existsSync(USAGE_FILE)) return [];
    return JSON.parse(readFileSync(USAGE_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeUsage(entries: ApiUsageEntry[]) {
  ensureDir(USAGE_FILE);
  writeFileSync(USAGE_FILE, JSON.stringify(entries.slice(-MAX_ENTRIES)));
}

export function recordApiCall(entry: Omit<ApiUsageEntry, "ts">) {
  try {
    const entries = readUsage();
    entries.push({ ...entry, ts: Date.now() });
    writeUsage(entries);
  } catch {}
}

export function computeStats(): ApiUsageStats {
  const entries = readUsage();
  const dayMs = 24 * 60 * 60 * 1000;
  const cutoff24h = Date.now() - dayMs;

  const totals = {
    calls: entries.length,
    ok: entries.filter((e) => e.ok).length,
    failed: entries.filter((e) => !e.ok).length,
    avgLatencyMs: entries.length ? Math.round(entries.reduce((s, e) => s + e.latencyMs, 0) / entries.length) : 0,
    successRatePct: entries.length ? Math.round((entries.filter((e) => e.ok).length / entries.length) * 100) : 0,
    last24h: entries.filter((e) => e.ts >= cutoff24h).length,
  };

  const providerMap = new Map<string, { calls: number; ok: number; failed: number; latency: number }>();
  for (const e of entries) {
    const cur = providerMap.get(e.provider) || { calls: 0, ok: 0, failed: 0, latency: 0 };
    cur.calls++;
    if (e.ok) cur.ok++; else cur.failed++;
    cur.latency += e.latencyMs;
    providerMap.set(e.provider, cur);
  }
  const byProvider: ProviderStats[] = [...providerMap.entries()]
    .map(([provider, s]) => ({
      provider,
      calls: s.calls,
      ok: s.ok,
      failed: s.failed,
      avgLatencyMs: s.calls ? Math.round(s.latency / s.calls) : 0,
    }))
    .sort((a, b) => b.calls - a.calls);

  const dayMap = new Map<string, { calls: number; ok: number; failed: number }>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * dayMs);
    dayMap.set(d.toISOString().slice(0, 10), { calls: 0, ok: 0, failed: 0 });
  }
  for (const e of entries) {
    const key = new Date(e.ts).toISOString().slice(0, 10);
    const cur = dayMap.get(key);
    if (!cur) continue;
    cur.calls++;
    if (e.ok) cur.ok++; else cur.failed++;
  }
  const byDay: DayStats[] = [...dayMap.entries()].map(([date, s]) => ({ date, ...s }));

  const recentErrors = entries.filter((e) => !e.ok).slice(-20).reverse();

  return { totals, byProvider, byDay, recentErrors };
}
