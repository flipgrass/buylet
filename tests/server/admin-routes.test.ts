// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { setup, type Client } from './helpers.ts';

async function seed(c: Client) {
  await c.req('PUT', '/api/admin/products/p1', { name: 'Oat Spread' });
  await c.req('PUT', '/api/admin/retailers/r1', { name: 'Shop' });
  return c.req('PUT', '/api/admin/offers/p1/r1', { url: 'https://s.test/p1', inStock: true, price: 4.5, currency: 'USD' });
}

describe('admin CRUD', () => {
  it('creates, reads, updates and deletes through the API', async () => {
    const { client } = setup();
    const c = client();
    await c.signup('a@x.test');
    expect((await seed(c)).status).toBe(200);
    let cat = (await (await c.req('GET', '/api/admin/catalog')).json()) as any;
    expect(cat.offers[0]).toMatchObject({ productId: 'p1', retailerId: 'r1', price: 4.5, inStock: true });
    await c.req('PUT', '/api/admin/offers/p1/r1', { url: 'https://s.test/p1', inStock: false });
    cat = (await (await c.req('GET', '/api/admin/catalog')).json()) as any;
    expect(cat.offers[0].inStock).toBe(false);
    expect((await c.req('DELETE', '/api/admin/offers/p1/r1')).status).toBe(200);
    expect((await c.req('DELETE', '/api/admin/offers/p1/r1')).status).toBe(404);
    expect((await c.req('DELETE', '/api/admin/products/p1')).status).toBe(200);
  });
  it('validates input with 422 and a readable message', async () => {
    const { client } = setup();
    const c = client();
    await c.signup('a@x.test');
    expect((await c.req('PUT', '/api/admin/products/bad id', { name: 'N' })).status).toBe(422);
    await c.req('PUT', '/api/admin/products/p1', { name: 'N' });
    await c.req('PUT', '/api/admin/retailers/r1', { name: 'R' });
    const bad = await c.req('PUT', '/api/admin/offers/p1/r1', { url: 'javascript:alert(1)', inStock: true });
    expect(bad.status).toBe(422);
    expect(((await bad.json()) as any).error).toContain('http');
    expect((await c.req('PUT', '/api/admin/offers/p1/ghost', { url: 'https://x.test', inStock: true })).status).toBe(404);
  });
  it('never leaks or changes another brand\'s data', async () => {
    const { client } = setup();
    const a = client();
    const b = client();
    await a.signup('a@x.test', 'Brand A');
    await b.signup('b@x.test', 'Brand B');
    await seed(a);
    await seed(b);
    await b.req('PUT', '/api/admin/products/p1', { name: 'B version' });
    const catA = (await (await a.req('GET', '/api/admin/catalog')).json()) as any;
    expect(catA.products[0].name).toBe('Oat Spread');
    expect((await b.req('DELETE', '/api/admin/retailers/r1')).status).toBe(200);
    const catA2 = (await (await a.req('GET', '/api/admin/catalog')).json()) as any;
    expect(catA2.offers).toHaveLength(1);
  });
});

const CSV = 'product_id,product_name,retailer,url,price,in_stock\np1,Spread,Acme Mart,https://acme.test/p1,4.99,yes\np1,Spread,Beta,https://beta.test/p1,,no\n';

describe('CSV import / export', () => {
  it('dry run reports counts and writes nothing', async () => {
    const { client } = setup();
    const c = client();
    await c.signup('a@x.test');
    const res = await c.req('POST', '/api/admin/import?dry=1', CSV);
    expect(await res.json()).toEqual({ dryRun: true, counts: { products: 1, retailers: 2, offers: 2 } });
    expect(((await (await c.req('GET', '/api/admin/catalog')).json()) as any).products).toEqual([]);
  });
  it('imports, then upserts on re-import', async () => {
    const { client } = setup();
    const c = client();
    await c.signup('a@x.test');
    expect((await c.req('POST', '/api/admin/import', CSV)).status).toBe(200);
    await c.req('POST', '/api/admin/import', CSV.replace('4.99', '5.99'));
    const cat = (await (await c.req('GET', '/api/admin/catalog')).json()) as any;
    expect(cat.offers).toHaveLength(2);
    expect(cat.offers[0].price).toBe(5.99);
  });
  it('reports row-level errors and writes nothing', async () => {
    const { client } = setup();
    const c = client();
    await c.signup('a@x.test');
    const bad = CSV + 'p2,Jam,Acme Mart,ftp://nope,1,yes\n';
    const res = await c.req('POST', '/api/admin/import', bad);
    expect(res.status).toBe(422);
    expect(((await res.json()) as any).errors.join()).toContain('data row 3');
    expect(((await (await c.req('GET', '/api/admin/catalog')).json()) as any).products).toEqual([]);
  });
  it('rejects CSVs with missing columns', async () => {
    const { client } = setup();
    const c = client();
    await c.signup('a@x.test');
    const res = await c.req('POST', '/api/admin/import', 'product_id,url\np1,https://x.test\n');
    expect(res.status).toBe(422);
    expect(((await res.json()) as any).error).toContain('column');
  });
  it('exports the catalog as a download', async () => {
    const { client } = setup();
    const c = client();
    await c.signup('a@x.test');
    await seed(c);
    const res = await c.req('GET', '/api/admin/export');
    expect(res.headers.get('content-disposition')).toContain('acme-foods-catalog.json');
    expect(((await res.json()) as any).products).toHaveLength(1);
  });
});
