// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { validateCatalog } from '../../src/validate.ts';
import { setup } from './helpers.ts';

describe('public catalog', () => {
  it('serves a valid widget catalog with CORS and caching headers, no auth needed', async () => {
    const { client } = setup();
    const owner = client();
    await owner.signup('a@x.test');
    await owner.req('PUT', '/api/admin/products/p1', { name: 'Spread' });
    await owner.req('PUT', '/api/admin/retailers/r1', { name: 'Shop' });
    await owner.req('PUT', '/api/admin/offers/p1/r1', { url: 'https://s.test/p1', inStock: true });

    const res = await client().req('GET', '/api/public/acme-foods/catalog.json');
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('cache-control')).toContain('max-age=60');
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(validateCatalog(await res.json())).toEqual([]);
  });
  it('supports ETag revalidation and changes the tag when data changes', async () => {
    const { client } = setup();
    const owner = client();
    await owner.signup('a@x.test');
    const first = await client().req('GET', '/api/public/acme-foods/catalog.json');
    const etag = first.headers.get('etag')!;
    const same = await client().req('GET', '/api/public/acme-foods/catalog.json', undefined, { 'if-none-match': etag });
    expect(same.status).toBe(304);
    await owner.req('PUT', '/api/admin/products/p1', { name: 'New' });
    const changed = await client().req('GET', '/api/public/acme-foods/catalog.json', undefined, { 'if-none-match': etag });
    expect(changed.status).toBe(200);
  });
  it('404s for unknown brands', async () => {
    const { client } = setup();
    expect((await client().req('GET', '/api/public/nobody/catalog.json')).status).toBe(404);
  });
});
