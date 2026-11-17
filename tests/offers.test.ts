import { describe, expect, it } from 'vitest';
import { offersFor, withUtm } from '../src/offers.ts';
import type { Catalog } from '../src/types.ts';

const cat: Catalog = {
  products: [{ id: 'p1', name: 'P' }],
  retailers: [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
    { id: 'd', name: 'D' },
  ],
  offers: [
    { productId: 'p1', retailerId: 'a', url: 'https://a.test', inStock: false },
    { productId: 'p1', retailerId: 'b', url: 'https://b.test', inStock: true },
    { productId: 'p1', retailerId: 'c', url: 'https://c.test', inStock: false },
    { productId: 'p1', retailerId: 'd', url: 'https://d.test', inStock: true },
  ],
};

describe('offersFor', () => {
  it('puts in-stock first and keeps catalog order within groups', () => {
    expect(offersFor(cat, 'p1').map((r) => r.retailer.id)).toEqual(['b', 'd', 'a', 'c']);
  });
  it('returns [] for unknown product', () => {
    expect(offersFor(cat, 'zzz')).toEqual([]);
  });
});

describe('withUtm', () => {
  it('adds utm params and keeps existing query', () => {
    const u = new URL(withUtm('https://x.test/p?ref=1', 'p1'));
    expect(u.searchParams.get('ref')).toBe('1');
    expect(u.searchParams.get('utm_source')).toBe('wtb');
    expect(u.searchParams.get('utm_medium')).toBe('widget');
    expect(u.searchParams.get('utm_content')).toBe('p1');
  });
  it('does not override an existing utm_source', () => {
    const u = new URL(withUtm('https://x.test/p?utm_source=brand', 'p1'));
    expect(u.searchParams.get('utm_source')).toBe('brand');
    expect(u.searchParams.has('utm_medium')).toBe(false);
  });
});
