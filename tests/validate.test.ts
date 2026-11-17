import { describe, expect, it } from 'vitest';
import { parseCatalog, validateCatalog } from '../src/validate.ts';

const good = () => ({
  products: [{ id: 'p1', name: 'Oat Spread' }],
  retailers: [{ id: 'r1', name: 'Shop' }],
  offers: [{ productId: 'p1', retailerId: 'r1', url: 'https://shop.test/p1', inStock: true }],
});

describe('validateCatalog', () => {
  it('accepts a valid catalog', () => {
    expect(validateCatalog(good())).toEqual([]);
  });
  it('rejects non-objects', () => {
    expect(validateCatalog(null).join()).toContain('object');
  });
  it('flags duplicate product ids', () => {
    const c = good();
    c.products.push({ id: 'p1', name: 'Dup' });
    expect(validateCatalog(c).join()).toContain('duplicate');
  });
  it('flags offers with unknown retailer', () => {
    const c = good();
    c.offers[0].retailerId = 'nope';
    expect(validateCatalog(c).join()).toContain('unknown retailer');
  });
  it('flags non-http urls', () => {
    const c = good();
    c.offers[0].url = 'javascript:alert(1)';
    expect(validateCatalog(c).join()).toContain('http');
  });
  it('flags non-boolean inStock', () => {
    const c: any = good();
    c.offers[0].inStock = 'yes';
    expect(validateCatalog(c).join()).toContain('inStock');
  });
});

describe('parseCatalog', () => {
  it('returns the catalog when valid', () => {
    expect(parseCatalog(good()).products).toHaveLength(1);
  });
  it('throws listing problems when invalid', () => {
    expect(() => parseCatalog({})).toThrow(/products/);
  });
});
