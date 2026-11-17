// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { hashPassword, newToken, sha256, verifyPassword } from '../../server/auth.ts';
import { openDb } from '../../server/db.ts';

describe('passwords', () => {
  it('verifies the right password and rejects the wrong one', async () => {
    const h = await hashPassword('correct horse');
    expect(await verifyPassword('correct horse', h)).toBe(true);
    expect(await verifyPassword('wrong', h)).toBe(false);
  });
  it('salts: same password hashes differently', async () => {
    expect(await hashPassword('same-password')).not.toBe(await hashPassword('same-password'));
  });
  it('rejects malformed stored hashes', async () => {
    expect(await verifyPassword('x', 'garbage')).toBe(false);
  });
});

describe('tokens', () => {
  it('are unique, url-safe, and hash deterministically', () => {
    const a = newToken();
    expect(a).not.toBe(newToken());
    expect(a).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(sha256(a)).toBe(sha256(a));
    expect(sha256(a)).not.toBe(a);
  });
});

describe('openDb', () => {
  it('creates the schema and enforces foreign keys', () => {
    const db = openDb(':memory:');
    const tables = db.prepare("select name from sqlite_master where type='table'").all().map((r: any) => r.name);
    expect(tables).toEqual(expect.arrayContaining(['brands', 'users', 'sessions', 'products', 'retailers', 'offers']));
    expect(() =>
      db.prepare("insert into offers(brand_id,product_id,retailer_id,url,in_stock) values (1,'p','r','https://x.test',1)").run(),
    ).toThrow(/FOREIGN KEY/i);
  });
});
