import { Page } from 'playwright';
import { BrowserPool, getBrowserPool, shutdownBrowserPool } from './BrowserPool';
import { FetchOptions, FetchResult, Fetcher } from './types';
import { isCloudflareChallenge } from '../fetchUtils';

import { REPACK_DOMAINS } from '../config';

const SITE_CONFIGS: Record<string, FetchOptions> = {
  'steamrip.com': {
    waitUntil: 'networkidle',
    scrollToBottom: true,
    clickSelectors: [
      '.load-more',
      '[data-load-more]',
      'button:has-text("Load")',
      'a:has-text("Show more")',
      '.pagination a:last-child',
      'a.page-numbers:last-child',
    ],
    blockResources: ['image', 'font', 'media', 'stylesheet'],
    timeoutMs: 30000,
  },
  'fitgirl-repacks.site': {
    waitUntil: 'networkidle',
    clickSelectors: [
      '.more-link',
      'a:has-text("Read more")',
      'a:has-text("Continue reading")',
    ],
    blockResources: ['image', 'font', 'media'],
    timeoutMs: 30000,
  },
  'skidrowreloaded.com': {
    waitUntil: 'networkidle',
    scrollToBottom: true,
    blockResources: ['image', 'font'],
    timeoutMs: 30000,
  },
  'dodi-repacks.site': {
    waitUntil: 'networkidle',
    blockResources: ['image', 'font', 'media'],
    timeoutMs: 30000,
  },
  'repack-games.com': {
    waitUntil: 'networkidle',
    scrollToBottom: true,
    blockResources: ['image', 'font', 'media'],
    timeoutMs: 30000,
  },
  'elamigos.site': {
    waitUntil: 'networkidle',
    blockResources: ['image', 'font', 'media'],
    timeoutMs: 30000,
  },
  'online-fix.me': {
    waitUntil: 'networkidle',
    blockResources: ['image', 'font', 'media'],
    timeoutMs: 30000,
  },
  default: {
    waitUntil: 'networkidle',
    blockResources: ['image', 'font', 'media', 'stylesheet'],
    timeoutMs: 25000,
  },
};

export function getSiteConfig(url: string): FetchOptions {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    for (const [domain, config] of Object.entries(SITE_CONFIGS)) {
      if (domain !== 'default' && hostname.includes(domain)) {
        return config;
      }
    }
  } catch {}
  return SITE_CONFIGS.default;
}

function looksLikeRepackSite(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return REPACK_DOMAINS.some(d => hostname.includes(d));
  } catch {
    return false;
  }
}

export class BrowserFetcher implements Fetcher {
  name = 'BrowserFetcher';
  private pool: BrowserPool;

  constructor() {
    this.pool = getBrowserPool();
  }

  canHandle(url: string, httpResult?: FetchResult): boolean {
    if (!httpResult?.ok) return true;
    if (isCloudflareChallenge(httpResult.text)) return true;
    if (httpResult.text.length < 5000) return true;
    return looksLikeRepackSite(url);
  }

  async fetch(url: string, options: FetchOptions = {}): Promise<FetchResult> {
    const siteConfig = getSiteConfig(url);
    const mergedOptions = { ...siteConfig, ...options };

    let context: Awaited<ReturnType<BrowserPool['getContext']>> | undefined;
    let page: Page | undefined;
    try {
      context = await this.pool.getContext();
      page = await context.newPage();
    } catch (err) {
      // Playwright browsers not installed (or failed to launch). Return a
      // structured failure instead of an unhandled rejection (which crashes
      // the importing request with a 500). DirectHTTPFetcher results still
      // pass through when the browser is the fallback.
      if (context) this.pool.releaseContext(context);
      return {
        ok: false,
        text: '',
        status: 0,
        error: `browser unavailable: ${err instanceof Error ? err.message.split('\n')[0] : 'launch failed'}`,
      };
    }

    try {
      // Block resources for speed
      if (mergedOptions.blockResources?.length) {
        await page.route('**/*', (route) => {
          const type = route.request().resourceType();
          if (mergedOptions.blockResources?.includes(type)) {
            route.abort();
          } else {
            route.continue();
          }
        });
      }

      // Set custom user agent if provided
      if (mergedOptions.userAgent) {
        await page.setExtraHTTPHeaders({ 'User-Agent': mergedOptions.userAgent });
      }

      // Navigate
      const response = await page.goto(url, {
        waitUntil: mergedOptions.waitUntil || 'networkidle',
        timeout: mergedOptions.timeoutMs || 30000,
      });

      const status = response?.status() ?? 200;

      // Handle Cloudflare challenge (wait for redirect)
      if (await this.isCloudflarePage(page)) {
        await page.waitForLoadState('networkidle', { timeout: 30000 });
      }

      // Scroll for infinite scroll / lazy content
      if (mergedOptions.scrollToBottom) {
        await this.scrollToBottom(page);
      }

      // Click "Load more" buttons
      if (mergedOptions.clickSelectors?.length) {
        for (const selector of mergedOptions.clickSelectors) {
          await this.clickLoadMore(page, selector);
        }
      }

      // Wait for additional selectors
      if (mergedOptions.waitForSelector) {
        try {
          await page.waitForSelector(mergedOptions.waitForSelector, { timeout: 10000 });
        } catch {}
      }

      const html = await page.content();
      const finalUrl = page.url();

      return {
        ok: status < 400,
        text: html,
        status,
        contentType: 'text/html',
        finalUrl,
      };
    } catch (err) {
      return {
        ok: false,
        text: '',
        status: 0,
        error: err instanceof Error ? err.message : 'Browser fetch failed',
      };
    } finally {
      await page.close().catch(() => {});
      this.pool.releaseContext(context);
    }
  }

  private async isCloudflarePage(page: Page): Promise<boolean> {
    try {
      const title = await page.title();
      const content = await page.content();
      return /Just a moment|cf-chl|Checking your browser|Ray ID:|Cloudflare/.test(title + content);
    } catch {
      return false;
    }
  }

  private async scrollToBottom(page: Page): Promise<void> {
    try {
      let previousHeight = 0;
      let sameCount = 0;
      const maxScrolls = 20;

      for (let i = 0; i < maxScrolls; i++) {
        const height = await page.evaluate('document.body.scrollHeight') as number;
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        await page.waitForTimeout(800);

        if (height === previousHeight) {
          sameCount++;
          if (sameCount >= 2) break;
        } else {
          sameCount = 0;
        }
        previousHeight = height;
      }
      // Scroll back to top for consistent content extraction
      await page.evaluate('window.scrollTo(0, 0)');
    } catch {}
  }

  private async clickLoadMore(page: Page, selector: string): Promise<void> {
    try {
      const element = await page.$(selector);
      if (element && await element.isVisible()) {
        await element.click({ timeout: 5000 });
        await page.waitForLoadState('networkidle', { timeout: 10000 });
      }
    } catch {}
  }
}

// Export singleton instance
let browserFetcherInstance: BrowserFetcher | null = null;

export function getBrowserFetcher(): BrowserFetcher {
  if (!browserFetcherInstance) {
    browserFetcherInstance = new BrowserFetcher();
  }
  return browserFetcherInstance;
}