import type { Catalog, ResolvedOffer } from './types.ts';

export function offersFor(catalog: Catalog, productId: string): ResolvedOffer[] {
  const retailers = new Map(catalog.retailers.map((r) => [r.id, r]));
  const resolved: ResolvedOffer[] = [];
  for (const offer of catalog.offers) {
    if (offer.productId !== productId) continue;
    const retailer = retailers.get(offer.retailerId);
    if (retailer) resolved.push({ retailer, offer });
  }
  return [...resolved.filter((r) => r.offer.inStock), ...resolved.filter((r) => !r.offer.inStock)];
}

export function withUtm(url: string, productId: string): string {
  const u = new URL(url);
  if (!u.searchParams.has('utm_source')) {
    u.searchParams.set('utm_source', 'wtb');
    u.searchParams.set('utm_medium', 'widget');
    u.searchParams.set('utm_content', productId);
  }
  return u.toString();
}
