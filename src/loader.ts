import type { Catalog } from './types.ts';
import { parseCatalog } from './validate.ts';

const cache = new Map<string, Promise<Catalog>>();

export function resetCatalogCache(): void {
  cache.clear();
}

export function loadCatalog(url: string, fetchFn: typeof fetch = (...a) => fetch(...a)): Promise<Catalog> {
  let p = cache.get(url);
  if (!p) {
    p = fetchFn(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Catalog request failed: HTTP ${res.status}`);
        return res.json();
      })
      .then(parseCatalog);
    cache.set(url, p);
    p.catch(() => cache.delete(url));
  }
  return p;
}
