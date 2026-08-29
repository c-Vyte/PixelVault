import { FetchOptions, FetchResult, Fetcher } from './types';
import { fetchText, isCloudflareChallenge } from '../fetchUtils';

export class DirectHTTPFetcher implements Fetcher {
  name = 'DirectHTTPFetcher';

  async fetch(url: string, options: FetchOptions = {}): Promise<FetchResult> {
    const result = await fetchText(url, {
      timeoutMs: options.timeoutMs || 20000,
      retries: options.retries ?? 2,
      requireHtml: options.requireHtml,
      signal: options.signal,
    });

    return {
      ok: result.ok,
      text: result.text,
      status: result.status,
      error: result.error,
      contentType: result.contentType,
      finalUrl: url, // Could track redirects if needed
    };
  }

  canHandle(_url: string, _httpResult?: FetchResult): boolean {
    // HTTP fetcher can always handle as first attempt
    return true;
  }
}

export const directHTTPFetcher = new DirectHTTPFetcher();