import { config } from '../config';

export class HttpError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 15_000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: '*/*',
        'User-Agent': config.wikipediaUserAgent,
        'Api-User-Agent': config.wikipediaUserAgent,
        ...(init.headers || {}),
      },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new HttpError(
        `HTTP ${response.status} ${body.slice(0, 180)}`,
        response.status,
      );
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJsonSilent<T>(
  url: string,
  init?: RequestInit,
  timeoutMs?: number,
): Promise<T | null> {
  try {
    return await fetchJson<T>(url, init, timeoutMs);
  } catch (error) {
    console.warn('fetch failed', url, error);
    return null;
  }
}
