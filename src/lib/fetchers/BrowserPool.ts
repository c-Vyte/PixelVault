import { chromium, Browser, BrowserContext } from 'playwright';
import { existsSync } from 'fs';

export class BrowserPool {
  private browser: Browser | null = null;
  private contexts: BrowserContext[] = [];
  private availableContexts: BrowserContext[] = [];
  private maxContexts: number;
  private idleTimeoutMs: number;
  private launchPromise: Promise<Browser> | null = null;
  private waitQueue: ((ctx: BrowserContext) => void)[] = [];

  constructor(
    maxContexts = 2,
    idleTimeoutMs = 5 * 60 * 1000
  ) {
    this.maxContexts = maxContexts;
    this.idleTimeoutMs = idleTimeoutMs;
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) {
      return this.browser;
    }

    if (this.launchPromise) {
      return this.launchPromise;
    }

    const systemChromePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ];

    let executablePath: string | undefined;
    for (const path of systemChromePaths) {
      if (existsSync(path)) {
        executablePath = path;
        break;
      }
    }

    this.launchPromise = (async () => {
      this.browser = await chromium.launch({
        headless: true,
        executablePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-breakpad',
          '--disable-component-extensions-with-background-pages',
          '--disable-extensions',
          '--disable-features=TranslateUI,BlinkGenPropertyTrees',
          '--disable-ipc-flooding-protection',
          '--disable-renderer-backgrounding',
          '--enable-features=NetworkService,NetworkServiceInProcess',
          '--force-color-profile=srgb',
          '--metrics-recording-only',
          '--mute-audio',
          '--disable-features=AudioServiceOutOfProcess',
        ],
      });

      this.browser.on('disconnected', () => {
        this.browser = null;
        this.contexts = [];
        this.availableContexts = [];
        this.launchPromise = null;
        // Reject all waiters — browser died
        for (const waiter of this.waitQueue) {
          waiter(null as unknown as BrowserContext);
        }
        this.waitQueue = [];
      });

      return this.browser;
    })();

    return this.launchPromise;
  }

  private async createContext(): Promise<BrowserContext> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: [],
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    context.setDefaultTimeout(30000);
    context.setDefaultNavigationTimeout(30000);

    return context;
  }

  async getContext(): Promise<BrowserContext> {
    // Fast path: available context exists
    if (this.availableContexts.length > 0) {
      return this.availableContexts.pop()!;
    }

    // Can create a new context
    if (this.contexts.length < this.maxContexts) {
      const context = await this.createContext();
      this.contexts.push(context);
      return context;
    }

    // Wait for one to become available (event-driven, no polling)
    return new Promise<BrowserContext>((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Remove this waiter from the queue
        this.waitQueue = this.waitQueue.filter(w => w !== waiter);
        // Force-create a context as last resort
        this.createContext().then(ctx => {
          this.contexts.push(ctx);
          resolve(ctx);
        }).catch(reject);
      }, 15000);

      const waiter = (ctx: BrowserContext) => {
        clearTimeout(timeout);
        resolve(ctx);
      };
      this.waitQueue.push(waiter);
    });
  }

  releaseContext(context: BrowserContext): void {
    for (const page of context.pages()) {
      if (!page.isClosed()) {
        page.close().catch(() => {});
      }
    }

    if (!this.contexts.includes(context)) return;

    // Wake a waiter instead of pooling
    if (this.waitQueue.length > 0) {
      const waiter = this.waitQueue.shift()!;
      waiter(context);
      return;
    }

    this.availableContexts.push(context);

    // Schedule idle cleanup
    setTimeout(() => {
      const idx = this.availableContexts.indexOf(context);
      if (idx !== -1) {
        this.availableContexts.splice(idx, 1);
        this.contexts = this.contexts.filter(c => c !== context);
        context.close().catch(() => {});
      }
    }, this.idleTimeoutMs);
  }

  async shutdown(): Promise<void> {
    for (const context of this.contexts) {
      await context.close().catch(() => {});
    }
    this.contexts = [];
    this.availableContexts = [];

    // Reject all waiters
    for (const waiter of this.waitQueue) {
      waiter(null as unknown as BrowserContext);
    }
    this.waitQueue = [];

    if (this.browser?.isConnected()) {
      await this.browser.close().catch(() => {});
    }
    this.browser = null;
    this.launchPromise = null;
  }

  getStats() {
    return {
      browserConnected: this.browser?.isConnected() ?? false,
      totalContexts: this.contexts.length,
      availableContexts: this.availableContexts.length,
      activeContexts: this.contexts.length - this.availableContexts.length,
      waiters: this.waitQueue.length,
    };
  }
}

let poolInstance: BrowserPool | null = null;

export function getBrowserPool(): BrowserPool {
  if (!poolInstance) {
    poolInstance = new BrowserPool(2, 5 * 60 * 1000);
  }
  return poolInstance;
}

export async function shutdownBrowserPool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.shutdown();
    poolInstance = null;
  }
}
