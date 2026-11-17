import type { Offer, Product, Retailer } from '../src/types.ts';
import { validateCatalog } from '../src/validate.ts';

const ID = /^[A-Za-z0-9._-]{1,64}$/;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function checkId(label: string, v: unknown, errors: string[]): void {
  if (typeof v !== 'string' || !ID.test(v)) errors.push(`${label} id must be 1-64 characters: letters, digits, . _ -`);
}

function checkName(v: unknown, errors: string[]): void {
  if (typeof v !== 'string' || !v.trim() || v.length > 200) errors.push('name is required (max 200 characters)');
}

function checkAsset(label: string, v: unknown, errors: string[]): void {
  if (v === undefined || v === null || v === '') return;
  if (typeof v !== 'string' || v.length > 2048 || !(/^https?:\/\//i.test(v) || v.startsWith('/'))) {
    errors.push(`${label} must be an http(s) URL or a site-relative path`);
  }
}

export function validateProduct(p: unknown): string[] {
  if (!isObj(p)) return ['product must be an object'];
  const errors: string[] = [];
  checkId('product', p.id, errors);
  checkName(p.name, errors);
  checkAsset('image', p.image, errors);
  if (p.upc != null && (typeof p.upc !== 'string' || p.upc.length > 32)) errors.push('upc must be a string (max 32)');
  return errors;
}

export function validateRetailer(r: unknown): string[] {
  if (!isObj(r)) return ['retailer must be an object'];
  const errors: string[] = [];
  checkId('retailer', r.id, errors);
  checkName(r.name, errors);
  checkAsset('logo', r.logo, errors);
  return errors;
}

export function validateOffer(o: unknown): string[] {
  if (!isObj(o)) return ['offer must be an object'];
  const errors: string[] = [];
  checkId('product', o.productId, errors);
  checkId('retailer', o.retailerId, errors);
  if (o.currency != null && !(typeof o.currency === 'string' && /^[A-Z]{3}$/.test(o.currency))) {
    errors.push('currency must be a 3-letter code such as USD');
  }
  if (o.price != null && !(typeof o.price === 'number' && Number.isFinite(o.price) && o.price >= 0)) {
    errors.push('price must be a non-negative number');
  }
  if (errors.length) return errors;
  return validateCatalog({
    products: [{ id: o.productId, name: 'x' }],
    retailers: [{ id: o.retailerId, name: 'x' }],
    offers: [o],
  }).map((e) => e.replace(/^offers\[0\] /, ''));
}

export type { Offer, Product, Retailer };
