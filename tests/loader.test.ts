import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCatalog, resetCatalogCache } from '../src/loader.ts';

const good = {
  products: [{ id: 'p1', name: 'P' }],
  retailers: [{ id: 'r1', name: 'R' }],
  offers: [{ productId: 'p1', retailerId: 'r1', url: 'https://r.test', inStock: true }],
};
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

beforeEach(() => resetCatalogCache());

describe('loadCatalog', () => {
  it('fetches once for concurrent calls to the same url', async () => {
    const f = vi.fn(async () => ok(good));
    await Promise.all([loadCatalog('/c.json', f), loadCatalog('/c.json', f)]);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('rejects on HTTP errors and does not cache the failure', async () => {
    const bad = vi.fn(async () => ({ ok: false, status: 404 }) as Response);
    await expect(loadCatalog('/c.json', bad)).rejects.toThrow(/404/);
    const f = vi.fn(async () => ok(good));
    await expect(loadCatalog('/c.json', f)).resolves.toBeTruthy();
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('rejects invalid catalogs', async () => {
    await expect(loadCatalog('/c.json', async () => ok({}))).rejects.toThrow(/Invalid catalog/);
  });
});
