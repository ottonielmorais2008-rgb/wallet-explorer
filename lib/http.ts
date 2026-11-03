// Small server-side fetch helper: timeout, one retry on 429/5xx, and an in-memory TTL cache.
type Entry = { expires: number; value: unknown };
const cache = new Map<string, Entry>();
const MAX_ENTRIES = 500;

export class UpstreamError extends Error {}

export async function fetchJson<T>(url: string, init: RequestInit = {}, ttlMs = 60_000): Promise<T> {
  const key = `${init.method ?? "GET"} ${url} ${typeof init.body === "string" ? init.body : ""}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;

  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: { accept: "application/json", "content-type": "application/json", ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
    } catch {
      if (attempt === 0) continue;
      throw new UpstreamError(`Timeout or network error for ${new URL(url).host}`);
    }
    if ((res.status === 429 || res.status >= 500) && attempt === 0) {
      await new Promise((r) => setTimeout(r, 600));
      continue;
    }
    if (!res.ok) throw new UpstreamError(`${new URL(url).host} returned HTTP ${res.status}`);
    const text = await res.text();
    let value: T;
    try {
      value = JSON.parse(text) as T;
    } catch {
      throw new UpstreamError(`${new URL(url).host} returned a non-JSON response`);
    }
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
    cache.set(key, { expires: Date.now() + ttlMs, value });
    return value;
  }
  throw new UpstreamError(`Request to ${new URL(url).host} failed`);
}

export async function rpc<T>(urls: string[], method: string, params: unknown[]): Promise<T> {
  let last: unknown;
  for (const url of urls) {
    try {
      const out = await fetchJson<{ result?: T; error?: { message: string } }>(url, {
        method: "POST",
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      if (out.error) throw new UpstreamError(`${method}: ${out.error.message}`);
      return out.result as T;
    } catch (e) {
      last = e; // try the next public endpoint
    }
  }
  throw last instanceof Error ? last : new UpstreamError(`${method} failed`);
}
