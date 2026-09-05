import { NextRequest, NextResponse } from "next/server";
import { recordApiCall } from "@/lib/apiUsage";
import { AI_PROVIDERS as PROVIDERS, TUNABLES, VALID_CATEGORIES as VALID_CATS, VALID_PLATFORMS as VALID_PLATS } from "@/lib/config";
import { z } from "zod";

export const dynamic = "force-dynamic";

const SYSTEM = `You are a game and software metadata generator for a download portal called PixelVault.
Given a title and optionally a provided description/context, produce accurate metadata.
Return ONLY valid JSON, no markdown fences, with this exact shape:
{
  "found": true,
  "title": "corrected official title",
  "description": "2-3 sentence polished marketing description",
  "features": ["short feature string", "..."],
  "tags": ["action", "rpg"],
  "category": one of ["pc-games", "windows", "mac", "android", "movies", "ebooks", "tutorials", "korean"],
  "platform": one of ["windows", "mac", "android", "cross-platform"],
  "version": "latest known version or empty string",
  "size": "approximate size like '45 GB' or empty string"
}
Rules:
- category must be one of the listed ids. Use "pc-games" for games, "windows"/"mac"/"android" for apps/software on those platforms, "movies" for films, "tutorials" for courses/udemy, "ebooks" for books.
- platform describes the runtime OS; for PC games use "windows" unless explicitly mac/cross-platform.
- If context/description is provided, ALWAYS use it to enhance and rewrite — never return found:false when context is given, even for obscure titles.
- Only return found:false when no context is given AND the title is not a real product.
- Strip leading # or punctuation from titles like "#BLUD" → "BLUD" for lookup but keep display title polished.`;

interface AiMeta {
  found?: boolean;
  title?: string;
  description?: string;
  features?: string[];
  tags?: string[];
  category?: string;
  platform?: string;
  version?: string;
  size?: string;
}

// Module-level cache for pure-title enrichments (15min TTL, max 300) — avoids repeat LLM calls
const ENRICH_CACHE = new Map<string, { meta: AiMeta; provider: string; ts: number }>();
const ENRICH_TTL_MS = 15 * 60 * 1000;
function enrichCacheGet(title: string) {
  const k = title.toLowerCase().trim();
  const hit = ENRICH_CACHE.get(k);
  if (!hit) return null;
  if (Date.now() - hit.ts > ENRICH_TTL_MS) { ENRICH_CACHE.delete(k); return null; }
  return hit;
}
function enrichCacheSet(title: string, meta: AiMeta, provider: string) {
  if (ENRICH_CACHE.size >= 300) {
    const oldest = ENRICH_CACHE.keys().next().value;
    if (oldest) ENRICH_CACHE.delete(oldest);
  }
  ENRICH_CACHE.set(title.toLowerCase().trim(), { meta, provider, ts: Date.now() });
}

// Per-provider circuit breaker: 3 consecutive failures → skip for 5min
const PROVIDER_BREAKER = new Map<string, { fails: number; blockedUntil: number }>();
const BREAKER_THRESHOLD = 3;
const BREAKER_COOLDOWN_MS = 5 * 60 * 1000;
function isProviderBlocked(name: string): boolean {
  const s = PROVIDER_BREAKER.get(name);
  if (!s) return false;
  if (Date.now() < s.blockedUntil) return true;
  if (Date.now() >= s.blockedUntil && s.blockedUntil !== 0) {
    PROVIDER_BREAKER.set(name, { fails: 0, blockedUntil: 0 });
  }
  return false;
}
function recordProviderFailure(name: string) {
  const s = PROVIDER_BREAKER.get(name) || { fails: 0, blockedUntil: 0 };
  s.fails += 1;
  if (s.fails >= BREAKER_THRESHOLD) s.blockedUntil = Date.now() + BREAKER_COOLDOWN_MS;
  PROVIDER_BREAKER.set(name, s);
}
function recordProviderSuccess(name: string) {
  PROVIDER_BREAKER.set(name, { fails: 0, blockedUntil: 0 });
}

async function callProvider(
  provider: (typeof PROVIDERS)[number],
  prompt: string,
  timeoutMs = TUNABLES.enrichTimeoutMs
): Promise<string> {
  const key = process.env[provider.keyEnv];
  if (!key) throw new Error("no key");
  const res = await fetch(provider.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("empty response");
  return text;
}

const AiMetaSchema = z.object({
  found: z.boolean().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  features: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  platform: z.string().optional(),
  version: z.string().optional(),
  size: z.string().optional(),
}).passthrough();

function extractBalancedJson(text: string): string | null {
  const cleaned = text.replace(/```json|```/g, "").trim();
  // Find first { or [ and extract balanced block
  const startIdx = cleaned.search(/[[{]/);
  if (startIdx === -1) return null;
  const open = cleaned[startIdx];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = startIdx; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return cleaned.slice(startIdx, i + 1);
    }
  }
  // Fallback: last } / ]
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (end > startIdx) return cleaned.slice(startIdx, end + 1);
  return null;
}

function parseJsonLoose(text: string): AiMeta | null {
  const candidate = extractBalancedJson(text);
  if (!candidate) return null;
  try {
    const parsed = JSON.parse(candidate);
    const result = AiMetaSchema.safeParse(parsed);
    if (result.success) return result.data as AiMeta;
    // Array response (batch) — take first object
    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = AiMetaSchema.safeParse(parsed[0]);
      if (first.success) return first.data as AiMeta;
    }
    return parsed as AiMeta;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { checkRateLimit } = await import("@/lib/rateLimit");
  const rl = checkRateLimit(req as unknown as Request, 20);
  if (!rl.ok) return NextResponse.json({ error: "Rate limited — try again shortly." }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
  let body: { titles?: unknown; items?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  type InputItem = { title: string; description?: string };
  let inputs: InputItem[] = [];

  const itemsArr = Array.isArray(body.items) ? (body.items as unknown[]) : [];
  if (itemsArr.length > 0) {
    inputs = itemsArr
      .map((x): { title: string; description?: string } | null => {
        const rec = x && typeof x === "object" ? (x as Record<string, unknown>) : null;
        if (!rec || typeof rec.title !== "string") return null;
        const title = rec.title.trim();
        if (!title) return null;
        return {
          title,
          description: typeof rec.description === "string" ? rec.description.slice(0, 2000) : undefined,
        };
      })
      .filter((x): x is { title: string; description?: string } => !!x)
      .slice(0, TUNABLES.enrichBatchMax);
  }
  if (inputs.length === 0 && Array.isArray(body.titles)) {
    inputs = body.titles
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, TUNABLES.enrichBatchMax)
      .map((t) => ({ title: t }));
  }

  if (inputs.length === 0) {
    return NextResponse.json({ error: `Provide titles array or items array (max ${TUNABLES.enrichBatchMax})` }, { status: 400 });
  }

  const available = PROVIDERS.filter((p) => process.env[p.keyEnv]);
  if (available.length === 0) {
    return NextResponse.json(
      { error: "No LLM API keys configured on the server. Add GROQ_API_KEY (or others) to .env and restart." },
      { status: 503 }
    );
  }

  const VALID_CATEGORIES = [...VALID_CATS] as string[];
  const VALID_PLATFORMS = [...VALID_PLATS] as string[];

  function normalizeMeta(meta: AiMeta, contextDesc: string): AiMeta {
    const out: AiMeta = { ...meta };
    if (contextDesc && out.found === false) {
      out.found = true;
      out.description = out.description || contextDesc.slice(0, 400);
    }
    if (out.category && !VALID_CATEGORIES.includes(out.category)) {
      // map a few common synonyms, else drop to default by the caller
      const c = out.category.toLowerCase();
      out.category =
        c.includes("game") ? "pc-games" :
        c.includes("movie") || c.includes("film") ? "movies" :
        c.includes("android") ? "android" :
        c.includes("mac") ? "mac" :
        c.includes("book") ? "ebooks" :
        c.includes("tutorial") || c.includes("course") ? "tutorials" :
        "pc-games";
    }
    if (out.platform && !VALID_PLATFORMS.includes(out.platform)) {
      out.platform = "windows";
    }
    if (!Array.isArray(out.features)) out.features = [];
    if (!Array.isArray(out.tags)) out.tags = [];
    if (typeof out.description !== "string") out.description = "";
    return out;
  }

  async function enrichOne(input: InputItem) {
    const title = input.title;
    const contextDesc = input.description?.trim() || "";
    if (!contextDesc) {
      const cached = enrichCacheGet(title);
      if (cached) {
        return { title, meta: cached.meta, provider: `${cached.provider}-cache` };
      }
    }
    const prompt = contextDesc
      ? `Title: "${title.replace(/^#+/, "").trim()}"\nProvided description/context (use this to enhance, do not return found:false): """${contextDesc.slice(0, 1200)}"""\nTask: Rewrite into a polished 2-3 sentence marketing description, extract 4-6 features, infer tags/category. Always return found:true.`
      : `Title: "${title.replace(/^#+/, "").trim()}"`;
    let lastError = "";
    let delivered: { meta: AiMeta | null; provider: string } = { meta: null, provider: "" };

    for (const provider of available) {
      if (isProviderBlocked(provider.name)) {
        lastError = `${provider.name}: circuit-open (cooldown)`;
        continue;
      }
      for (let attempt = 0; attempt < 2; attempt++) {
        const started = Date.now();
        try {
          const text = await callProvider(provider, prompt);
          let meta = parseJsonLoose(text);
          if (!meta) {
            // One more salvage pass: the model sometimes wraps JSON in prose.
            meta = parseJsonLoose(text.replace(/[^{]*(\{[\s\S]*\}).*/, "$1"));
          }
          if (!meta) throw new Error("unparseable response");
          meta = normalizeMeta(meta, contextDesc);
          recordApiCall({
            route: "/api/ai/enrich",
            provider: provider.name,
            model: provider.model,
            ok: true,
            latencyMs: Date.now() - started,
          });
          recordProviderSuccess(provider.name);
          delivered = { meta, provider: provider.name };
          if (!contextDesc) enrichCacheSet(title, meta, provider.name);
          lastError = "";
          break;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          recordApiCall({
            route: "/api/ai/enrich",
            provider: provider.name,
            model: provider.model,
            ok: false,
            latencyMs: Date.now() - started,
            error: msg.slice(0, 200),
          });
          recordProviderFailure(provider.name);
          lastError = `${provider.name}: ${msg}`;
          if (/HTTP 40[13]/.test(lastError)) break;
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        }
      }
      if (delivered.meta) break;
    }

    return {
      title,
      meta: delivered.meta,
      provider: delivered.provider,
      ...(lastError && !delivered.meta ? { error: lastError } : {}),
    };
  }

  // Run enrichments with bounded concurrency (providers rate-limit; 3 is safe
  // and turns a 20-title batch from ~minutes down to a few tens of seconds).
  const results: { title: string; meta: AiMeta | null; provider: string; error?: string }[] =
    new Array(inputs.length);
  let cursor = 0;
  const CONCURRENCY = TUNABLES.enrichConcurrency;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, inputs.length) }, async () => {
      while (cursor < inputs.length) {
        const i = cursor++;
        results[i] = await enrichOne(inputs[i]);
      }
    })
  );

  return NextResponse.json({ results });
}
