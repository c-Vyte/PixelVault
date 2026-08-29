/**
 * File-hoster link resolution.
 *
 * File hosters (datanodes.to, fuckingfast.co, pixeldrain, gofile, ...) hand out
 * *landing page* URLs. The actual file bytes live behind a button/form/JS call
 * on that landing page. A HosterResolver knows how to perform that step so the
 * importer can (a) prove the link really contains a file, (b) extract the real
 * filename for link naming, and (c) hand a ready-to-use direct URL to download
 * managers. Resolvers are pure Node-side HTTP first; Cloudflare/Turnstile
 * protected hosters (datanodes, fuckingfast) fall back to the Playwright
 * browser pool.
 */

export type HosterId =
  | "datanodes"
  | "fuckingfast"
  | "pixeldrain"
  | "gofile"
  | "filekeeper"
  | "krakenfiles"
  | "buzzheavier"
  | "1fichier"
  | "mediafire"
  | "megaup"
  | "sendcm"
  | "multiup"
  | "generic";

export interface HosterMeta {
  id: HosterId;
  /** Human-readable label, e.g. "DataNodes". */
  label: string;
  /** Hostname suffixes this resolver claims (match without leading www.). */
  hosts: RegExp;
  /** True when the host needs a browser (Cloudflare / Turnstile / JS). */
  needsBrowser?: boolean;
  /**
   * True when a resolved direct URL may be bound to the requester's IP/session,
   * i.e. sharing the server-resolved URL with an end user can fail. Such URLs
   * are treated as best-effort ("verified working") rather than published.
   */
  ipBound?: boolean;
  /** Direct-URL quality for sorting (higher = preferred mirror). */
  priority: number;
}

export interface ResolveInput {
  url: string;
  /** AbortSignal propagated from the caller. */
  signal?: AbortSignal;
  /** Soft per-request timeout (ms) for each HTTP hop. */
  timeoutMs?: number;
}

export interface ResolveResult {
  inputUrl: string;
  hoster: HosterId;
  label: string;
  /** true when a real download URL / file record was found. */
  ok: boolean;
  /** The resolved direct download URL, when available. */
  directUrl?: string;
  /** Real filename reported by the hoster (fallback for generic link names). */
  fileName?: string;
  /** Human-readable file size ("1.2 GB") when the hoster exposes it. */
  fileSize?: string;
  /** True when the landing page exists and references a file (no direct URL). */
  alive?: boolean;
  /** "browser" when the browser pool was required/used. */
  via?: "http" | "browser";
  /** true when a captcha/challenge blocked automated resolution. */
  blocked?: boolean;
  reason?: string;
}

export interface HosterResolver {
  meta: HosterMeta;
  /** True when this resolver handles the given URL. */
  matches(url: string): boolean;
  /** Resolve a landing-page URL to a direct download URL / alive status. */
  resolve(input: ResolveInput): Promise<ResolveResult>;
}
