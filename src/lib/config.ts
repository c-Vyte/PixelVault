/**
 * Centralized configuration for fetching + AI enhancement.
 * Env-tunable where operational; single source of truth for enums that were
 * previously duplicated across 3 admin pages and 2 API routes.
 */

// ── AI providers (order = fallback priority) ──────────────────────────
// Fix: `openai/gpt-oss-120b` was not a real Groq model — replaced with verified `llama-3.3-70b-versatile`.
export const AI_PROVIDERS = [
  { name: "grok", url: "https://api.x.ai/v1/chat/completions", keyEnv: "XAI_API_KEY", model: "grok-3-mini" },
  { name: "groq", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY", model: "llama-3.3-70b-versatile" },
  { name: "gemini", url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", keyEnv: "GEMINI_API_KEY", model: "gemini-2.5-flash-lite" },
  { name: "mistral", url: "https://api.mistral.ai/v1/chat/completions", keyEnv: "MISTRAL_API_KEY", model: "mistral-small-latest" },
  { name: "zai", url: "https://api.z.ai/api/paas/v4/chat/completions", keyEnv: "ZAI_API_KEY", model: "glm-4.7-flash" },
] as const;

export type AiProviderName = typeof AI_PROVIDERS[number]["name"];

// ── Shared enums (were duplicated in enrich route + ai-fetch page + data.ts) ──
export const VALID_CATEGORIES = ["pc-games", "windows", "mac", "android", "movies", "ebooks", "tutorials", "korean"] as const;
export const VALID_PLATFORMS = ["windows", "mac", "android", "cross-platform", "ios"] as const;
export const VALID_LINK_TYPES = ["official", "repack", "direct", "cracked", "torrent"] as const;

// ── Repack / fetcher domains ──────────────────────────────────────────
export const REPACK_DOMAINS = [
  "steamrip.com",
  "fitgirl-repacks.site",
  "dodi-repacks.site",
  "skidrowreloaded.com",
  "repack-games.com",
  "re-packs.com",
  "elamigos.site",
  "gamedrive.org",
  "online-fix.me",
  "crackwatch.com",
  "cs.rin.ru",
] as const;

// ── Defaults (were scattered) ─────────────────────────────────────────
export const DEFAULTS = {
  rating: 4,
  importRating: 4.5,
  downloads: 0,
  platform: "windows" as const,
  category: "pc-games" as const,
  status: "pending" as const,
  placeholderBannerBg: "7c3aed",
  placeholderPosterBg: "4c1d95",
  placeholderImportBg: "3b82f6",
} as const;

// ── Tunables (env-overridable) ────────────────────────────────────────
function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const TUNABLES = {
  // enrich route
  enrichConcurrency: envInt("AI_ENRICH_CONCURRENCY", 3),
  enrichTimeoutMs: envInt("AI_ENRICH_TIMEOUT_MS", 60000),
  enrichBatchMax: envInt("AI_ENRICH_BATCH_MAX", 20),
  // fetch-banner
  bannerTimeoutMs: envInt("BANNER_TIMEOUT_MS", 9000),
  bannerValidateTimeoutMs: envInt("BANNER_VALIDATE_TIMEOUT_MS", 6000),
  // import page
  importResolveBatch: envInt("IMPORT_RESOLVE_BATCH", 15),
  // BrowserPool
  browserMaxContexts: envInt("BROWSER_MAX_CONTEXTS", 2),
  browserIdleMs: envInt("BROWSER_IDLE_MS", 5 * 60 * 1000),
  browserWaitQueueMs: envInt("BROWSER_WAIT_QUEUE_MS", 15000),
  // cache TTLs
  bannerCacheTtlMs: envInt("BANNER_CACHE_TTL_MS", 30 * 60 * 1000),
  enrichCacheTtlMs: envInt("ENRICH_CACHE_TTL_MS", 15 * 60 * 1000),
} as const;

// ── User-Agent rotation (stale Chrome/124 was hardcoded) ──────────────
export const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
] as const;
export function pickUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}
