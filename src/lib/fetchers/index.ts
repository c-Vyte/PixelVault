import { FetchOptions, FetchResult, Fetcher } from './types';
import { directHTTPFetcher } from './DirectHTTPFetcher';
import { getBrowserFetcher } from './BrowserFetcher';
import { getSiteConfig } from './BrowserFetcher';
import { isCloudflareChallenge } from '../fetchUtils';

export class FetcherRegistry {
  private fetchers: Fetcher[] = [];
  private defaultFetcherName = 'DirectHTTPFetcher';

  constructor() {
    this.register(directHTTPFetcher);
    this.register(getBrowserFetcher());
  }

  register(fetcher: Fetcher): void {
    this.fetchers.push(fetcher);
  }

  setDefault(name: string): void {
    this.defaultFetcherName = name;
  }

  async fetch(url: string, options: FetchOptions = {}): Promise<FetchResult> {
    // 1. Try HTTP first (fast)
    const httpFetcher = this.fetchers.find(f => f.name === 'DirectHTTPFetcher');
    if (!httpFetcher) {
      throw new Error('No HTTP fetcher registered');
    }

    const httpResult = await httpFetcher.fetch(url, options);

    // 2. If HTTP succeeded and not Cloudflare, return
    if (httpResult.ok && !isCloudflareChallenge(httpResult.text)) {
      return httpResult;
    }

    // 3. Try browser fetcher as fallback
    const browserFetcher = this.fetchers.find(f => f.name === 'BrowserFetcher');
    if (browserFetcher && browserFetcher.canHandle(url, httpResult)) {
      const siteConfig = getSiteConfig(url);
      const browserResult = await browserFetcher.fetch(url, { ...options, ...siteConfig });

      // 4. Silent fallback: if browser fails, return HTTP result anyway
      if (browserResult.ok) return browserResult;
      if (httpResult.ok) return httpResult;
      return browserResult; // return browser error
    }

    // 5. No browser available or not needed - return HTTP
    return httpResult;
  }

  getFetchers(): Fetcher[] {
    return this.fetchers;
  }
}

// Singleton instance
let registryInstance: FetcherRegistry | null = null;

export function getFetcherRegistry(): FetcherRegistry {
  if (!registryInstance) {
    registryInstance = new FetcherRegistry();
  }
  return registryInstance;
}

// Convenience function
export async function fetchWithFallback(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  const registry = getFetcherRegistry();
  return registry.fetch(url, options);
}