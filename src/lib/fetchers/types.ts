export interface FetchResult {
  ok: boolean;
  text: string;
  status: number;
  error?: string;
  contentType?: string;
  finalUrl?: string;
}

export interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  requireHtml?: boolean;
  signal?: AbortSignal;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  waitForSelector?: string;
  scrollToBottom?: boolean;
  clickSelectors?: string[];
  blockResources?: string[];
  userAgent?: string;
}

export interface Fetcher {
  fetch(url: string, options?: FetchOptions): Promise<FetchResult>;
  name: string;
  canHandle(url: string, httpResult?: FetchResult): boolean;
}