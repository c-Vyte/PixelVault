/**
 * Low-level HTTP helpers for hoster resolution.
 *
 * The generic `fetchText` in fetchUtils.ts always follows redirects and treats
 * everything as HTML. Hoster resolution needs:
 *  - POST form requests with manual redirect inspection (datanodes returns
 *    JSON; fuckingfast answers HTMX POSTs with 302 + HX-Redirect)
 *  - cookie jar semantics (landing page -> /download step shares a session)
 *  - JSON responses
 *
 * Node's undici-based global fetch supports `redirect: "manual"` *server-side*
 * and exposes the `location` header (the browser opaqueredirect restriction
 * does not apply here).
 */

import { assertSafeFetchUrl } from "../fetchUtils";

export const HOSTER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export function hosterHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "User-Agent": HOSTER_UA,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    ...(extra || {}),
  };
}

export interface RawResponse {
  ok: boolean;
  status: number;
  /** Headers we care about (lower-cased). */
  headers: Record<string, string>;
  text: string;
  /** Final URL after redirects when following; otherwise the request URL. */
  url: string;
}

function normalizeHeaders(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((v, k) => {
    out[k.toLowerCase()] = v;
  });
  return out;
}

function withTimeout(signal?: AbortSignal, timeoutMs = 20000): { controller: AbortController; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  return {
    controller,
    done: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

export interface HosterRequestOptions {
  method?: "GET" | "POST";
  /** Form body (application/x-www-form-urlencoded). */
  form?: Record<string, string | number>;
  /** Raw string body. */
  body?: string;
  headers?: Record<string, string>;
  /** "follow" (default) or "manual" to inspect 3xx location headers. */
  redirect?: "follow" | "manual";
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Manual cookie jar: merge set-cookie values and send them back. Hoster flows
 * are two hops (landing page sets a session cookie, the POST step requires it).
 */
export class CookieJar {
  private cookies = new Map<string, string>();

  absorb(setCookie: string[] | string | undefined): void {
    if (!setCookie) return;
    const list = Array.isArray(setCookie) ? setCookie : [setCookie];
    for (const raw of list) {
      for (const piece of raw.split(/,(?=[^;]+=)/)) {
        const first = piece.split(";")[0]?.trim();
        if (!first || !first.includes("=")) continue;
        const idx = first.indexOf("=");
        const name = first.slice(0, idx).trim();
        const value = first.slice(idx + 1).trim();
        if (!name) continue;
        this.cookies.set(name, value);
      }
    }
  }

  header(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  get size(): number {
    return this.cookies.size;
  }
}

export async function hosterRequest(rawUrl: string, options: HosterRequestOptions = {}): Promise<RawResponse> {
  assertSafeFetchUrl(rawUrl);
  const { method = "GET", form, body, headers = {}, redirect = "follow", signal, timeoutMs = 20000 } = options;

  const { controller, done } = withTimeout(signal, timeoutMs);
  try {
    const init: RequestInit = {
      method,
      headers: hosterHeaders(headers),
      redirect,
      signal: controller.signal,
    };
    if (form) {
      (init.headers as Record<string, string>)["Content-Type"] = "application/x-www-form-urlencoded";
      init.body = new URLSearchParams(
        Object.entries(form).map(([k, v]) => [k, String(v)])
      ).toString();
    } else if (body !== undefined) {
      init.body = body;
    }

    const res = await fetch(rawUrl, init);
    const buf = new Uint8Array(await res.arrayBuffer());
    const text = Buffer.from(buf).toString("utf-8");
    return {
      ok: res.ok,
      status: res.status,
      headers: normalizeHeaders(res.headers),
      text,
      url: res.url || rawUrl,
    };
  } finally {
    done();
  }
}

/** Extract set-cookie values (Node fetch exposes them as a combined header). */
export function extractSetCookies(res: RawResponse): string[] {
  const raw = res.headers["set-cookie"];
  if (!raw) return [];
  // Multiple Set-Cookie headers arrive comma-joined; split heuristically.
  return raw.split(/,(?=[^;,\s]+=[^;]*;)/).map((s) => s.trim()).filter(Boolean);
}
