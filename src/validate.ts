import type { Catalog } from './types.ts';

const isObj = (v: unknown): v is Record<string, any> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isHttpUrl = (s: unknown): boolean => {
  if (typeof s !== 'string') return false;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

export function validateCatalog(raw: unknown): string[] {
  if (!isObj(raw)) return ['catalog must be an object'];
  const errors: string[] = [];
  for (const key of ['products', 'retailers', 'offers']) {
    if (!Array.isArray(raw[key])) errors.push(`${key} must be an array`);
  }
  if (errors.length) return errors;

  const ids = (kind: 'products' | 'retailers') => {
    const seen = new Set<string>();
    raw[kind].forEach((item: any, i: number) => {
      if (!isObj(item) || typeof item.id !== 'string' || !item.id) {
        errors.push(`${kind}[${i}] needs a non-empty id`);
        return;
      }
      if (typeof item.name !== 'string' || !item.name) errors.push(`${kind}[${i}] needs a name`);
      if (seen.has(item.id)) errors.push(`duplicate ${kind} id "${item.id}"`);
      seen.add(item.id);
    });
    return seen;
  };
  const productIds = ids('products');
  const retailerIds = ids('retailers');

  raw.offers.forEach((o: any, i: number) => {
    if (!isObj(o)) return void errors.push(`offers[${i}] must be an object`);
    if (!productIds.has(o.productId)) errors.push(`offers[${i}] has unknown product "${o.productId}"`);
    if (!retailerIds.has(o.retailerId)) errors.push(`offers[${i}] has unknown retailer "${o.retailerId}"`);
    if (!isHttpUrl(o.url)) errors.push(`offers[${i}] url must be an http(s) URL`);
    if (typeof o.inStock !== 'boolean') errors.push(`offers[${i}] inStock must be a boolean`);
    if (o.price !== undefined && typeof o.price !== 'number') errors.push(`offers[${i}] price must be a number`);
  });
  return errors;
}

export function parseCatalog(raw: unknown): Catalog {
  const errors = validateCatalog(raw);
  if (errors.length) throw new Error(`Invalid catalog: ${errors.join('; ')}`);
  return raw as Catalog;
}
