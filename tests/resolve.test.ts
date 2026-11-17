import { describe, expect, it } from 'vitest';
import { resolveDefaultCatalog } from '../src/resolve.ts';

describe('resolveDefaultCatalog', () => {
  it('prefers data-catalog', () => {
    expect(
      resolveDefaultCatalog({ src: 'https://p.test/wtb.js', dataset: { catalog: '/c.json', brand: 'acme' } }),
    ).toBe('/c.json');
  });
  it('builds a public url from data-brand and the script origin', () => {
    expect(resolveDefaultCatalog({ src: 'https://p.test/wtb.js', dataset: { brand: 'acme' } })).toBe(
      'https://p.test/api/public/acme/catalog.json',
    );
  });
  it('encodes the brand slug', () => {
    expect(resolveDefaultCatalog({ src: 'https://p.test/wtb.js', dataset: { brand: 'a b' } })).toContain('/a%20b/');
  });
  it('returns undefined when nothing is configured or src is unusable', () => {
    expect(resolveDefaultCatalog({ src: 'https://p.test/wtb.js', dataset: {} })).toBeUndefined();
    expect(resolveDefaultCatalog({ src: '', dataset: { brand: 'acme' } })).toBeUndefined();
  });
});
