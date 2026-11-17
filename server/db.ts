import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS brands (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  pw_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  image TEXT,
  upc TEXT,
  PRIMARY KEY (brand_id, id)
);
CREATE TABLE IF NOT EXISTS retailers (
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  logo TEXT,
  PRIMARY KEY (brand_id, id)
);
CREATE TABLE IF NOT EXISTS offers (
  brand_id INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  retailer_id TEXT NOT NULL,
  url TEXT NOT NULL,
  price REAL,
  currency TEXT,
  in_stock INTEGER NOT NULL,
  PRIMARY KEY (brand_id, product_id, retailer_id),
  FOREIGN KEY (brand_id, product_id) REFERENCES products(brand_id, id) ON DELETE CASCADE,
  FOREIGN KEY (brand_id, retailer_id) REFERENCES retailers(brand_id, id) ON DELETE CASCADE
);
`;

export function openDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  db.exec(SCHEMA);
  return db;
}
