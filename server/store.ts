import type { DatabaseSync } from 'node:sqlite';
import type { Catalog, Offer, Product, Retailer } from '../src/types.ts';

export class StoreError extends Error {}

const clean = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as T;

export function createBrand(db: DatabaseSync, slug: string, name: string): number {
  return Number(db.prepare('INSERT INTO brands(slug, name) VALUES (?, ?)').run(slug, name).lastInsertRowid);
}

export function createUser(db: DatabaseSync, brandId: number, email: string, pwHash: string): number {
  return Number(db.prepare('INSERT INTO users(brand_id, email, pw_hash) VALUES (?, ?, ?)').run(brandId, email, pwHash).lastInsertRowid);
}

export function getCatalog(db: DatabaseSync, brandId: number): Catalog {
  const products = db.prepare('SELECT id, name, image, upc FROM products WHERE brand_id = ? ORDER BY rowid').all(brandId);
  const retailers = db.prepare('SELECT id, name, logo FROM retailers WHERE brand_id = ? ORDER BY rowid').all(brandId);
  const offers = db
    .prepare('SELECT product_id, retailer_id, url, price, currency, in_stock FROM offers WHERE brand_id = ? ORDER BY rowid')
    .all(brandId) as any[];
  return {
    products: products.map((p) => clean(p)) as unknown as Product[],
    retailers: retailers.map((r) => clean(r)) as unknown as Retailer[],
    offers: offers.map((o) =>
      clean({
        productId: o.product_id,
        retailerId: o.retailer_id,
        url: o.url,
        price: o.price,
        currency: o.currency,
        inStock: o.in_stock === 1,
      }),
    ) as Offer[],
  };
}

export function upsertProduct(db: DatabaseSync, brandId: number, p: Product): void {
  db.prepare(
    `INSERT INTO products(brand_id, id, name, image, upc) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(brand_id, id) DO UPDATE SET name = excluded.name, image = excluded.image, upc = excluded.upc`,
  ).run(brandId, p.id, p.name, p.image ?? null, p.upc ?? null);
}

export function upsertRetailer(db: DatabaseSync, brandId: number, r: Retailer): void {
  db.prepare(
    `INSERT INTO retailers(brand_id, id, name, logo) VALUES (?, ?, ?, ?)
     ON CONFLICT(brand_id, id) DO UPDATE SET name = excluded.name, logo = excluded.logo`,
  ).run(brandId, r.id, r.name, r.logo ?? null);
}

export function upsertOffer(db: DatabaseSync, brandId: number, o: Offer): void {
  const has = (table: string, id: string) =>
    db.prepare(`SELECT 1 FROM ${table} WHERE brand_id = ? AND id = ?`).get(brandId, id) !== undefined;
  if (!has('products', o.productId)) throw new StoreError(`unknown product "${o.productId}"`);
  if (!has('retailers', o.retailerId)) throw new StoreError(`unknown retailer "${o.retailerId}"`);
  db.prepare(
    `INSERT INTO offers(brand_id, product_id, retailer_id, url, price, currency, in_stock) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(brand_id, product_id, retailer_id) DO UPDATE SET
       url = excluded.url, price = excluded.price, currency = excluded.currency, in_stock = excluded.in_stock`,
  ).run(brandId, o.productId, o.retailerId, o.url, o.price ?? null, o.currency ?? null, o.inStock ? 1 : 0);
}

const del = (db: DatabaseSync, sql: string, ...args: (string | number)[]): boolean =>
  Number(db.prepare(sql).run(...args).changes) > 0;

export const deleteProduct = (db: DatabaseSync, brandId: number, id: string) =>
  del(db, 'DELETE FROM products WHERE brand_id = ? AND id = ?', brandId, id);
export const deleteRetailer = (db: DatabaseSync, brandId: number, id: string) =>
  del(db, 'DELETE FROM retailers WHERE brand_id = ? AND id = ?', brandId, id);
export const deleteOffer = (db: DatabaseSync, brandId: number, productId: string, retailerId: string) =>
  del(db, 'DELETE FROM offers WHERE brand_id = ? AND product_id = ? AND retailer_id = ?', brandId, productId, retailerId);

export function importCatalog(db: DatabaseSync, brandId: number, c: Catalog) {
  db.exec('BEGIN');
  try {
    c.products.forEach((p) => upsertProduct(db, brandId, p));
    c.retailers.forEach((r) => upsertRetailer(db, brandId, r));
    c.offers.forEach((o) => upsertOffer(db, brandId, o));
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return { products: c.products.length, retailers: c.retailers.length, offers: c.offers.length };
}
