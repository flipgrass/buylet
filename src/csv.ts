import type { Catalog, Offer, Product, Retailer } from './types.ts';

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const REQUIRED = ['product_id', 'product_name', 'retailer', 'url', 'in_stock'];

export function csvToCatalog(text: string): Catalog {
  const [header, ...rows] = parseCsv(text);
  const col = Object.fromEntries((header ?? []).map((h, i) => [h.trim(), i]));
  const missing = REQUIRED.filter((c) => !(c in col));
  if (missing.length) throw new Error(`CSV is missing column(s): ${missing.join(', ')}`);

  const products = new Map<string, Product>();
  const retailers = new Map<string, Retailer>();
  const offers: Offer[] = [];
  for (const r of rows) {
    const get = (c: string) => (r[col[c]] ?? '').trim();
    const productId = get('product_id');
    const retailerName = get('retailer');
    const retailerId = slug(retailerName);
    if (!products.has(productId)) products.set(productId, { id: productId, name: get('product_name') });
    if (!retailers.has(retailerId)) retailers.set(retailerId, { id: retailerId, name: retailerName });
    const offer: Offer = {
      productId,
      retailerId,
      url: get('url'),
      inStock: /^(true|yes|y|1)$/i.test(get('in_stock')),
    };
    const price = 'price' in col ? get('price') : '';
    if (price !== '' && !Number.isNaN(Number(price))) offer.price = Number(price);
    offers.push(offer);
  }
  return { products: [...products.values()], retailers: [...retailers.values()], offers };
}
