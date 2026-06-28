/**
 * The only module in Slopcheck that performs network I/O.
 *
 * Everything here is fail-open: any error, timeout, or unexpected status that
 * we cannot interpret confidently returns `null` ("unknown") rather than
 * throwing, so a flaky registry never produces a false "safe" or false
 * "malicious" verdict. A confident 404 is the one exception — it returns
 * `exists: false`, which is a real signal (the package is not registered).
 */

import {
  DOWNLOADS_BASE_URL,
  REGISTRY_BASE_URL,
  REGISTRY_TIMEOUT_MS,
} from '../config.ts';
import type { RegistryMetadata } from '../types.ts';

/** Minimal response shape we depend on (a structural subset of `Response`). */
export interface ResponseLike {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

/** Minimal fetch shape (a structural subset of the global `fetch`). */
export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<ResponseLike>;

export interface RegistryClient {
  getPackageMetadata(name: string): Promise<RegistryMetadata | null>;
  getWeeklyDownloads(name: string): Promise<number | null>;
}

export interface RegistryClientOptions {
  /** Injected for tests; defaults to the global `fetch`. */
  readonly fetch?: FetchLike;
  /** Per-request timeout in milliseconds. */
  readonly timeoutMs?: number;
}

const HTTP_NOT_FOUND = 404;

/** Encode a package name for use in a registry URL (scoped names keep `@`, encode `/`). */
function encodePackageName(name: string): string {
  return name.replaceAll('/', '%2F');
}

function extractCreatedAt(json: unknown): string | null {
  if (typeof json !== 'object' || json === null) return null;
  const time = (json as { time?: unknown }).time;
  if (typeof time !== 'object' || time === null) return null;
  const created = (time as { created?: unknown }).created;
  return typeof created === 'string' ? created : null;
}

function extractDownloads(json: unknown): number | null {
  if (typeof json !== 'object' || json === null) return null;
  const downloads = (json as { downloads?: unknown }).downloads;
  return typeof downloads === 'number' ? downloads : null;
}

export function createRegistryClient(options: RegistryClientOptions = {}): RegistryClient {
  const doFetch: FetchLike = options.fetch ?? (globalThis.fetch as FetchLike);
  const timeoutMs = options.timeoutMs ?? REGISTRY_TIMEOUT_MS;

  const metadataCache = new Map<string, RegistryMetadata | null>();
  const downloadsCache = new Map<string, number | null>();

  /** Fetch a URL with an abort timeout; returns null on any error/timeout. */
  async function fetchWithTimeout(url: string): Promise<ResponseLike | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await doFetch(url, { signal: controller.signal });
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async function getPackageMetadata(name: string): Promise<RegistryMetadata | null> {
    const cached = metadataCache.get(name);
    if (cached !== undefined) return cached;

    const url = `${REGISTRY_BASE_URL}/${encodePackageName(name)}`;
    const result = await readMetadata(name, url);
    metadataCache.set(name, result);
    return result;
  }

  async function readMetadata(name: string, url: string): Promise<RegistryMetadata | null> {
    const res = await fetchWithTimeout(url);
    if (res === null) return null; // network error / timeout ⇒ unknown
    if (res.status === HTTP_NOT_FOUND) {
      return { name, exists: false, createdAt: null };
    }
    if (!res.ok) return null; // 5xx etc. ⇒ unknown
    try {
      const json = await res.json();
      return { name, exists: true, createdAt: extractCreatedAt(json) };
    } catch {
      return null; // unparseable body ⇒ unknown
    }
  }

  async function getWeeklyDownloads(name: string): Promise<number | null> {
    const cached = downloadsCache.get(name);
    if (cached !== undefined) return cached;

    const url = `${DOWNLOADS_BASE_URL}/${encodePackageName(name)}`;
    const result = await readDownloads(url);
    downloadsCache.set(name, result);
    return result;
  }

  async function readDownloads(url: string): Promise<number | null> {
    const res = await fetchWithTimeout(url);
    if (res === null || !res.ok) return null; // error / 404 ⇒ unavailable
    try {
      return extractDownloads(await res.json());
    } catch {
      return null;
    }
  }

  return { getPackageMetadata, getWeeklyDownloads };
}
