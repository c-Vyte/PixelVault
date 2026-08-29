/**
 * Browser fallback for hoster resolution.
 *
 * When plain HTTP hits Cloudflare/Turnstile (datanodes.to, fuckingfast.co,
 * filekeeper...), drive a real Chromium page:
 *  - let the CF challenge auto-pass (headful-style context, waits),
 *  - fire the download action *inside the page* (fetch with same-origin
 *    cookies), or click the button,
 *  - capture the direct URL from an hx-redirect header, a new download event,
 *    or a window.open/new-tab popup.
 *
 * Returns null when no browser is available in the runtime so the caller can
 * keep the HTTP result.
 */

import type { ResolveInput, ResolveResult } from "./types";

async function getPageContext(): Promise<{
  page: import("playwright").Page;
  context: import("playwright").BrowserContext;
  release: () => void;
} | null> {
  try {
    // Dynamic import keeps Playwright out of edge/serverless bundles unless used.
    const poolMod = await import("../fetchers/BrowserPool");
    const pool = poolMod.getBrowserPool();
    const context = await pool.getContext();
    const page = await context.newPage();
    return {
      page,
      context,
      release: () => {
        page.close().catch(() => {});
        pool.releaseContext(context);
      },
    };
  } catch {
    return null;
  }
}

export async function browserResolveHoster(
  hoster: "datanodes" | "fuckingfast" | string,
  input: ResolveInput
): Promise<ResolveResult | null> {
  const { url, timeoutMs = 45000 } = input;
  const ctx = await getPageContext();
  if (!ctx) return null;
  const { page, release } = ctx;

  const base: ResolveResult = {
    inputUrl: url,
    hoster: hoster as ResolveResult["hoster"],
    label: hoster === "datanodes" ? "DataNodes" : hoster === "fuckingfast" ? "FuckingFast" : "File host",
    ok: false,
    via: "browser",
  };

  // Direct URLs captured from download events / popups
  const captured: string[] = [];
  const onDownload = (d: import("playwright").Download) => {
    try {
      const dlUrl = (d as unknown as { url(): string }).url?.();
      if (dlUrl) captured.push(dlUrl);
    } catch { /* ignore */ }
  };
  const onPopup = (p: import("playwright").Page) => {
    try {
      const pu = p.url();
      if (pu && pu.startsWith("http")) captured.push(pu);
    } catch { /* ignore */ }
  };
  page.on("download", onDownload);
  page.context().on("page", onPopup);

  try {
    const goto = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });

    // Let Cloudflare/Turnstile auto-clear if present
    for (let i = 0; i < 12; i++) {
      const title = await page.title().catch(() => "");
      const body = await page.evaluate(() => document.body?.innerText?.slice(0, 400) || "").catch(() => "");
      const challenged = /just a moment|checking your browser|verify you are human|turnstile|cf-chl/i.test(title + body);
      if (!challenged) break;
      await page.waitForTimeout(2000);
    }

    if (goto?.status && goto.status() >= 400 && goto.status() !== 403) {
      return { ...base, alive: goto.status() !== 404, reason: `HTTP ${goto.status()}` };
    }

    if (hoster === "fuckingfast") {
      // Same-origin HTMX POST inside the page -> read hx-redirect
      const direct = await page.evaluate(async (pageUrl) => {
        const idMatch = pageUrl.match(/fuckingfast\.(?:co|com|io)\/(?:f\/)?([a-z0-9]+)/i);
        const button = document.querySelector('[hx-post], [hx-get]') as HTMLElement | null;
        const hxAttr = button?.getAttribute("hx-post") || button?.getAttribute("hx-get") || null;
        const endpoint = hxAttr
          ? new URL(hxAttr, location.href).href
          : idMatch ? `${location.origin}/f/${idMatch[1]}/go` : null;
        if (!endpoint) return null;
        try {
          const res = await fetch(endpoint, {
            method: button?.hasAttribute("hx-get") ? "GET" : "POST",
            headers: { "HX-Request": "true", "HX-Current-URL": pageUrl },
            credentials: "include",
            redirect: "manual",
          } as RequestInit);
          const redir = res.headers.get("hx-redirect") || res.headers.get("hx-location") || res.headers.get("location");
          if (redir) return new URL(redir, location.href).href;
          const text = await res.text();
          const m = text.match(/https:\/\/(?:dl\.)?fuckingfast\.(?:co|com|io)\/dl\/[A-Za-z0-9._~-]+/i);
          return m ? m[0] : null;
        } catch {
          return null;
        }
      }, url).catch(() => null);

      if (direct) return { ...base, ok: true, alive: true, directUrl: direct };

      // Fallback: click the download button and wait for a popup/download
      await page.click('a:has-text("DOWNLOAD"), button:has-text("DOWNLOAD"), [hx-post], .btn').catch(() => {});
      await page.waitForTimeout(3500);
    } else if (hoster === "datanodes") {
      const direct = await page.evaluate(async (pageUrl) => {
        const u = new URL(pageUrl);
        const code = u.pathname.split("/").filter(Boolean)[0] || "";
        const name = u.pathname.split("/").filter(Boolean).pop() || "";
        try {
          const body = new URLSearchParams({
            op: "download2",
            id: code,
            rand: "",
            referer: `${location.origin}/download`,
            method_free: "Free Download >>",
            method_premium: "",
            dl: "1",
          });
          const res = await fetch(`${location.origin}/download`, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "X-Requested-With": "XMLHttpRequest",
            },
            body: body.toString(),
            credentials: "include",
          });
          const text = await res.text();
          try {
            const json = JSON.parse(text);
            if (json?.url) return decodeURIComponent(json.url);
          } catch { /* not json */ }
          const m = text.match(/https:\/\/[a-z0-9.-]*datanodes\.[a-z]+(?::\d+)?\/d\/[^\s"'<>]+/i);
          if (m) return m[0];
          // Cookie hint some builds use
          const hint = name;
          return hint ? null : null;
        } catch {
          return null;
        }
      }, url).catch(() => null);

      if (direct) return { ...base, ok: true, alive: true, directUrl: direct };

      await page.click('button:has-text("Download"), a:has-text("Download"), #downloadbtn, .btn').catch(() => {});
      await page.waitForTimeout(4000);
    } else {
      await page.click('a:has-text("Download"), button:has-text("Download"), .btn, #downloadbtn').catch(() => {});
      await page.waitForTimeout(3500);
    }

    if (captured.length > 0) {
      return { ...base, ok: true, alive: true, directUrl: captured[0] };
    }

    // Last resort: scan the rendered DOM for a dl node URL
    const dlFromDom = await page.evaluate(() => {
      const html = document.documentElement.innerHTML;
      const m =
        html.match(/https:\/\/(?:dl\.)?fuckingfast\.(?:co|com|io)\/dl\/[A-Za-z0-9._~-]+/i) ||
        html.match(/https:\/\/[a-z0-9.-]*datanodes\.[a-z]+(?::\d+)?\/d\/[^\s"'<>\\]+/i);
      return m ? m[0] : null;
    }).catch(() => null);

    if (dlFromDom) return { ...base, ok: true, alive: true, directUrl: dlFromDom };

    // Page loaded (past the gate) but no direct URL surfaced
    const title = await page.title().catch(() => "");
    const dead = /not found|removed|deleted|expired/i.test(title);
    return { ...base, alive: !dead, reason: dead ? "File not found" : "Reached via browser; direct link not surfaced" };
  } catch (err) {
    return { ...base, reason: err instanceof Error ? err.message : "Browser resolution failed" };
  } finally {
    page.off("download", onDownload);
    page.context().off("page", onPopup);
    release();
  }
}
