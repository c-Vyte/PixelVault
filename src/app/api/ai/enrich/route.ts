import { NextRequest, NextResponse } from "next/server";
import { recordApiCall } from "@/lib/apiUsage";

export const dynamic = "force-dynamic";

const PROVIDERS = [
  {
    name: "groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    keyEnv: "GROQ_API_KEY",
    model: "openai/gpt-oss-120b",
  },
  {
    name: "gemini",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    keyEnv: "GEMINI_API_KEY",
    model: "gemini-2.5-flash-lite",
  },
  {
    name: "mistral",
    url: "https://api.mistral.ai/v1/chat/completions",
    keyEnv: "MISTRAL_API_KEY",
    model: "mistral-small-latest",
  },
  {
    name: "zai",
    url: "https://api.z.ai/api/paas/v4/chat/completions",
    keyEnv: "ZAI_API_KEY",
    model: "glm-4.7-flash",
  },
] as const;

const SYSTEM = `You are a game and software metadata generator for a download portal called PixelVault.
Given a title and optionally a provided description/context, produce accurate metadata.
Return ONLY valid JSON, no markdown fences, with this exact shape:
{
  "found": true,
  "title": "corrected official title",
  "description": "2-3 sentence polished marketing description",
  "features": ["short feature string", "..."],
  "tags": ["action", "rpg"],
  "category": "pc-games" | "apps" | "android-apps",
  "platform": "windows" | "mac" | "android" | "cross-platform",
  "version": "latest known version or empty string",
  "size": "approximate size like '45 GB' or empty string"
}
Rules:
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

async function callProvider(
  provider: (typeof PROVIDERS)[number],
  prompt: string,
  timeoutMs = 60000
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

function parseJsonLoose(text: string): AiMeta | null {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.search(/[[{]/);
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: { titles?: unknown; items?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  type InputItem = { title: string; description?: string };
  let inputs: InputItem[] = [];

  if (Array.isArray((body as any).items)) {
    inputs = (body as any).items
      .filter((x: any) => x && typeof x.title === "string")
      .map((x: any) => ({ title: String(x.title).trim(), description: typeof x.description === "string" ? x.description.slice(0, 2000) : undefined }))
      .filter((x: any) => x.title)
      .slice(0, 20);
  }
  if (inputs.length === 0 && Array.isArray(body.titles)) {
    inputs = body.titles
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20)
      .map((t) => ({ title: t }));
  }

  if (inputs.length === 0) {
    return NextResponse.json({ error: "Provide titles array or items array (max 20)" }, { status: 400 });
  }

  const available = PROVIDERS.filter((p) => process.env[p.keyEnv]);
  if (available.length === 0) {
    return NextResponse.json(
      { error: "No LLM API keys configured on the server. Add GROQ_API_KEY (or others) to .env and restart." },
      { status: 503 }
    );
  }

  const results: { title: string; meta: AiMeta | null; provider: string; error?: string }[] = [];

  for (const input of inputs) {
    const title = input.title;
    const contextDesc = input.description?.trim() || "";
    const prompt = contextDesc
      ? `Title: "${title.replace(/^#+/, "").trim()}"\nProvided description/context (use this to enhance, do not return found:false): """${contextDesc.slice(0, 1200)}"""\nTask: Rewrite into a polished 2-3 sentence marketing description, extract 4-6 features, infer tags/category. Always return found:true.`
      : `Title: "${title.replace(/^#+/, "").trim()}"`;
    let lastError = "";
    let delivered: { meta: AiMeta | null; provider: string } = { meta: null, provider: "" };

    for (const provider of available) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const started = Date.now();
        try {
          const text = await callProvider(provider, prompt);
          const meta = parseJsonLoose(text);
          if (!meta) throw new Error("unparseable response");
          if (contextDesc && meta.found === false) {
            meta.found = true;
            meta.description = meta.description || contextDesc.slice(0, 400);
          }
          recordApiCall({
            route: "/api/ai/enrich",
            provider: provider.name,
            model: provider.model,
            ok: true,
            latencyMs: Date.now() - started,
          });
          delivered = { meta, provider: provider.name };
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
          lastError = `${provider.name}: ${msg}`;
          if (/HTTP 40[13]/.test(lastError)) break;
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        }
      }
      if (delivered.meta) break;
    }

    results.push({
      title,
      meta: delivered.meta,
      provider: delivered.provider,
      ...(lastError && !delivered.meta ? { error: lastError } : {}),
    });
  }

  return NextResponse.json({ results });
}
