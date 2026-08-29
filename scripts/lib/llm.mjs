/**
 * Shared LLM client for free providers (Groq, Gemini, Mistral, Z.ai, NVIDIA).
 * OpenAI-compatible endpoints, per-provider rate limiting, automatic fallback.
 * Keys are read from process.env or a root .env file (KEY=value lines).
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

function loadEnvFile() {
  const p = join(ROOT, ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvFile();

export const PROVIDERS = {
  groq: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    keyEnv: "GROQ_API_KEY",
    model: "openai/gpt-oss-120b",
    rpm: 25,
  },
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    keyEnv: "GEMINI_API_KEY",
    model: "gemini-2.5-flash-lite",
    rpm: 10,
  },
  mistral: {
    url: "https://api.mistral.ai/v1/chat/completions",
    keyEnv: "MISTRAL_API_KEY",
    model: "mistral-small-latest",
    rpm: 60,
  },
  zai: {
    url: "https://api.z.ai/api/paas/v4/chat/completions",
    keyEnv: "ZAI_API_KEY",
    model: "glm-4.7-flash",
    rpm: 15,
  },
  nvidia: {
    url: "https://integrate.api.nvidia.com/v1/chat/completions",
    keyEnv: "NVIDIA_API_KEY",
    model: "meta/llama-3.3-70b-instruct",
    rpm: 35,
  },
};

const DEFAULT_CHAIN = ["groq", "gemini", "mistral", "zai", "nvidia"];

const buckets = new Map();

async function acquireSlot(provider) {
  const now = Date.now();
  if (!buckets.has(provider)) buckets.set(provider, []);
  const stamps = buckets.get(provider);
  while (stamps.length && now - stamps[0] > 60000) stamps.shift();
  if (stamps.length >= PROVIDERS[provider].rpm) {
    const wait = 60000 - (now - stamps[0]) + 250;
    await new Promise((r) => setTimeout(r, wait));
    return acquireSlot(provider);
  }
  stamps.push(Date.now());
}

function availableChain(chain = DEFAULT_CHAIN) {
  return chain.filter((p) => process.env[PROVIDERS[p].keyEnv]);
}

export function listAvailable() {
  return availableChain().map((p) => `${p} (${PROVIDERS[p].model})`);
}

export async function chat(messages, opts = {}) {
  const chain = opts.chain || DEFAULT_CHAIN;
  const errors = [];
  for (const provider of availableChain(chain)) {
    const cfg = PROVIDERS[provider];
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await acquireSlot(provider);
        const res = await fetch(cfg.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env[cfg.keyEnv]}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: opts.model || cfg.model,
            messages,
            temperature: opts.temperature ?? 0.4,
            ...(opts.json ? { response_format: { type: "json_object" } } : {}),
          }),
          signal: AbortSignal.timeout(opts.timeoutMs || 60000),
        });
        if (res.status === 429 || res.status === 503) throw new Error(`rate-limited HTTP ${res.status}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (!text) throw new Error("empty response");
        return { provider, text };
      } catch (e) {
        errors.push(`${provider}: ${e.message}`);
        if (/rate-limit|HTTP 40[13]/i.test(e.message)) break;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }
  throw new Error(`All providers failed:\n${errors.join("\n")}`);
}

export async function chatJSON(prompt, systemPrompt, opts = {}) {
  const messages = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
    { role: "user", content: prompt },
  ];
  const { text, provider } = await chat(
    messages,
    { ...opts, json: true, temperature: opts.temperature ?? 0.2 }
  );
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.search(/[[{]/);
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (start === -1 || end === -1) throw new Error(`No JSON in response (${provider}): ${text.slice(0, 120)}`);
  return { data: JSON.parse(cleaned.slice(start, end + 1)), provider };
}

export function requireProviders(minimum = 1) {
  const avail = availableChain();
  if (avail.length < minimum) {
    console.error(`No API keys found. Add one or more to .env at project root:`);
    for (const [name, cfg] of Object.entries(PROVIDERS)) {
      console.error(`  ${cfg.keyEnv}=...   -> ${name}, model ${cfg.model}`);
    }
    process.exit(1);
  }
  console.log(`LLM providers available: ${listAvailable().join(", ")}`);
  return avail;
}
