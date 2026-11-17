import { describe, expect, it } from 'vitest';
import { csvToCatalog, parseCsv } from '../src/csv.ts';
import { validateCatalog } from '../src/validate.ts';

const CSV = [
  'product_id,product_name,retailer,url,price,in_stock',
  'p1,"Spread, Oat",Acme Mart,https://acme.test/p1,4.99,yes',
  'p1,"Spread, Oat",Beta Shop,https://beta.test/p1,,no',
  'p2,Jam,Acme Mart,https://acme.test/p2,2.5,TRUE',
].join('\r\n');

describe('parseCsv', () => {
  it('handles quoted commas, escaped quotes and CRLF', () => {
    expect(parseCsv('a,"b,c","d ""e"""\r\nx,y,z')).toEqual([
      ['a', 'b,c', 'd "e"'],
      ['x', 'y', 'z'],
    ]);
  });
});

describe('csvToCatalog', () => {
  const cat = csvToCatalog(CSV);
  it('dedupes products and retailers', () => {
    expect(cat.products.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(cat.retailers.map((r) => r.id)).toEqual(['acme-mart', 'beta-shop']);
    expect(cat.offers).toHaveLength(3);
  });
  it('takes product name from the first row', () => {
    expect(cat.products[0].name).toBe('Spread, Oat');
  });
  it('parses stock and price', () => {
    expect(cat.offers.map((o) => o.inStock)).toEqual([true, false, true]);
    expect(cat.offers[0].price).toBe(4.99);
    expect(cat.offers[1].price).toBeUndefined();
  });
  it('produces a valid catalog', () => {
    expect(validateCatalog(cat)).toEqual([]);
  });
  it('throws on missing columns', () => {
    expect(() => csvToCatalog('product_id,url\np1,https://x.test')).toThrow(/column/);
  });
});
