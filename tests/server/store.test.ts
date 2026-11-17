// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { openDb } from '../../server/db.ts';
import * as store from '../../server/store.ts';
import { validateOffer, validateProduct, validateRetailer } from '../../server/validators.ts';

let db: ReturnType<typeof openDb>;
let a: number;
let b: number;
beforeEach(() => {
  db = openDb(':memory:');
  a = store.createBrand(db, 'a', 'A');
  b = store.createBrand(db, 'b', 'B');
});

const seed = (brand: number) => {
  store.upsertProduct(db, brand, { id: 'p1', name: 'Spread' });
  store.upsertRetailer(db, brand, { id: 'r1', name: 'Shop' });
  store.upsertOffer(db, brand, { productId: 'p1', retailerId: 'r1', url: 'https://s.test/p1', inStock: true, price: 4.5 });
};

describe('validators', () => {
  it('accepts good entities', () => {
    expect(validateProduct({ id: 'p-1.x', name: 'N' })).toEqual([]);
    expect(validateRetailer({ id: 'r1', name: 'N', logo: 'https://l.test/x.png' })).toEqual([]);
    expect(validateOffer({ productId: 'p', retailerId: 'r', url: 'https://x.test', inStock: false })).toEqual([]);
  });
  it('rejects bad ids, long names, bad urls and images', () => {
    expect(validateProduct({ id: 'has space', name: 'N' }).join()).toContain('id');
    expect(validateProduct({ id: 'p', name: 'x'.repeat(201) }).join()).toContain('name');
    expect(validateProduct({ id: 'p', name: 'N', image: 'javascript:1' }).join()).toContain('image');
    expect(validateOffer({ productId: 'p', retailerId: 'r', url: 'ftp://x', inStock: true }).join()).toContain('http');
    expect(validateOffer({ productId: 'p', retailerId: 'r', url: 'https://x.test', inStock: 'y' }).join()).toContain('inStock');
  });
});

describe('store', () => {
  it('round-trips a catalog', () => {
    seed(a);
    expect(store.getCatalog(db, a)).toEqual({
      products: [{ id: 'p1', name: 'Spread' }],
      retailers: [{ id: 'r1', name: 'Shop' }],
      offers: [{ productId: 'p1', retailerId: 'r1', url: 'https://s.test/p1', price: 4.5, inStock: true }],
    });
  });
  it('upsert updates in place', () => {
    seed(a);
    store.upsertProduct(db, a, { id: 'p1', name: 'Renamed', upc: '123' });
    expect(store.getCatalog(db, a).products).toEqual([{ id: 'p1', name: 'Renamed', upc: '123' }]);
  });
  it('rejects offers for unknown product or retailer', () => {
    expect(() => store.upsertOffer(db, a, { productId: 'x', retailerId: 'y', url: 'https://x.test', inStock: true })).toThrow(/unknown/);
  });
  it('cascades deletes to offers', () => {
    seed(a);
    expect(store.deleteProduct(db, a, 'p1')).toBe(true);
    expect(store.getCatalog(db, a).offers).toEqual([]);
    expect(store.deleteProduct(db, a, 'p1')).toBe(false);
  });
  it('isolates brands, even with identical ids', () => {
    seed(a);
    seed(b);
    store.deleteRetailer(db, a, 'r1');
    expect(store.getCatalog(db, a).offers).toHaveLength(0);
    expect(store.getCatalog(db, b).offers).toHaveLength(1);
    expect(store.deleteProduct(db, a, 'nope')).toBe(false);
  });
  it('imports atomically: a failure leaves nothing behind', () => {
    const bad = {
      products: [{ id: 'p9', name: 'N' }],
      retailers: [{ id: 'r9', name: 'N' }],
      offers: [{ productId: 'p9', retailerId: 'missing', url: 'https://x.test', inStock: true }],
    };
    expect(() => store.importCatalog(db, a, bad)).toThrow();
    expect(store.getCatalog(db, a).products).toEqual([]);
  });
  it('imports and upserts', () => {
    seed(a);
    const counts = store.importCatalog(db, a, {
      products: [{ id: 'p1', name: 'New name' }, { id: 'p2', name: 'Two' }],
      retailers: [{ id: 'r1', name: 'Shop' }],
      offers: [{ productId: 'p2', retailerId: 'r1', url: 'https://s.test/p2', inStock: false }],
    });
    expect(counts).toEqual({ products: 2, retailers: 1, offers: 1 });
    const c = store.getCatalog(db, a);
    expect(c.products.map((p) => p.name)).toEqual(['New name', 'Two']);
    expect(c.offers).toHaveLength(2);
  });
});
