import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { csvToCatalog } from '../src/csv.ts';
import { validateCatalog } from '../src/validate.ts';
import { hashPassword, newToken, sha256, verifyPassword } from './auth.ts';
import * as store from './store.ts';
import { StoreError } from './store.ts';
import { validateOffer, validateProduct, validateRetailer } from './validators.ts';

interface Auth { userId: number; brandId: number; email: string; slug: string; brandName: string; csrf: string }
type Env = { Variables: { auth: Auth } };

export interface AppOptions { secureCookies?: boolean }

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const MAX_IMPORT_ROWS = 5000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'brand';
const bodyOf = async (c: Context): Promise<Record<string, unknown>> => {
  const b = await c.req.json().catch(() => null);
  return b && typeof b === 'object' && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
};

export function createApp(db: DatabaseSync, opts: AppOptions = {}): Hono<Env> {
  const app = new Hono<Env>();
  const failures = new Map<string, { count: number; resetAt: number }>();
  let dummyHash: Promise<string> | undefined;

  app.use('*', async (c, next) => {
    await next();
    c.res.headers.set('x-content-type-options', 'nosniff');
  });

  // Same-origin guard for state-changing requests.
  app.use('/api/*', async (c, next) => {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      const origin = c.req.header('origin');
      if (origin) {
        const host = c.req.header('x-forwarded-host') ?? c.req.header('host') ?? new URL(c.req.url).host;
        let originHost = '';
        try { originHost = new URL(origin).host; } catch { /* invalid origin */ }
        if (originHost !== host) return c.json({ error: 'cross-origin request rejected' }, 403);
      }
    }
    await next();
  });

  const startSession = (c: Context, userId: number): string => {
    const token = newToken();
    const csrf = newToken();
    db.prepare('INSERT INTO sessions(token_hash, user_id, csrf, expires_at) VALUES (?, ?, ?, ?)').run(
      sha256(token), userId, csrf, Date.now() + SESSION_MS,
    );
    const secure = opts.secureCookies ?? c.req.header('x-forwarded-proto') === 'https';
    setCookie(c, 'sid', token, { httpOnly: true, sameSite: 'Lax', path: '/', secure, maxAge: SESSION_MS / 1000 });
    return csrf;
  };

  const me = (a: Auth) => ({ user: { email: a.email }, brand: { slug: a.slug, name: a.brandName }, csrf: a.csrf });

  app.post('/api/signup', async (c) => {
    const b = await bodyOf(c);
    const brandName = typeof b.brandName === 'string' ? b.brandName.trim() : '';
    const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
    const password = typeof b.password === 'string' ? b.password : '';
    if (!brandName || brandName.length > 100) return c.json({ error: 'Brand name is required (max 100 characters)' }, 400);
    if (!EMAIL.test(email) || email.length > 254) return c.json({ error: 'A valid email is required' }, 400);
    if (password.length < 8 || password.length > 200) return c.json({ error: 'Password must be 8-200 characters' }, 400);
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return c.json({ error: 'That email is already registered' }, 409);

    const pwHash = await hashPassword(password);
    let userId = 0;
    let slug = '';
    db.exec('BEGIN');
    try {
      const base = slugify(brandName);
      slug = base;
      for (let n = 2; db.prepare('SELECT 1 FROM brands WHERE slug = ?').get(slug); n++) slug = `${base}-${n}`;
      userId = store.createUser(db, store.createBrand(db, slug, brandName), email, pwHash);
      db.exec('COMMIT');
    } catch {
      db.exec('ROLLBACK');
      return c.json({ error: 'Could not create account' }, 409);
    }
    const csrf = startSession(c, userId);
    return c.json({ user: { email }, brand: { slug, name: brandName }, csrf }, 201);
  });

  app.post('/api/login', async (c) => {
    const b = await bodyOf(c);
    const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
    const password = typeof b.password === 'string' ? b.password : '';
    const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ?? 'local';
    const key = `${ip}|${email}`;
    const f = failures.get(key);
    if (f && f.count >= LOGIN_MAX_FAILURES && Date.now() < f.resetAt) {
      return c.json({ error: 'Too many failed attempts. Try again later.' }, 429);
    }
    const user = db.prepare(
      'SELECT u.id, u.pw_hash, u.email, b.slug, b.name FROM users u JOIN brands b ON b.id = u.brand_id WHERE u.email = ?',
    ).get(email) as { id: number; pw_hash: string; email: string; slug: string; name: string } | undefined;
    dummyHash ??= hashPassword('dummy-password-for-timing');
    const ok = await verifyPassword(password, user?.pw_hash ?? (await dummyHash));
    if (!user || !ok) {
      const now = Date.now();
      const cur = failures.get(key);
      failures.set(key, !cur || now >= cur.resetAt ? { count: 1, resetAt: now + LOGIN_WINDOW_MS } : { ...cur, count: cur.count + 1 });
      return c.json({ error: 'Incorrect email or password' }, 401);
    }
    failures.delete(key);
    const csrf = startSession(c, user.id);
    return c.json({ user: { email: user.email }, brand: { slug: user.slug, name: user.name }, csrf });
  });

  app.post('/api/logout', (c) => {
    const sid = getCookie(c, 'sid');
    if (sid) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(sid));
    deleteCookie(c, 'sid', { path: '/' });
    return c.json({ ok: true });
  });

  const requireAuth = async (c: Context<Env>, next: () => Promise<void>) => {
    const sid = getCookie(c, 'sid');
    const row = sid
      ? (db.prepare(
          `SELECT s.csrf, s.expires_at, u.id AS userId, u.brand_id AS brandId, u.email, b.slug, b.name AS brandName
           FROM sessions s JOIN users u ON u.id = s.user_id JOIN brands b ON b.id = u.brand_id WHERE s.token_hash = ?`,
        ).get(sha256(sid)) as (Auth & { expires_at: number }) | undefined)
      : undefined;
    if (!row || row.expires_at < Date.now()) {
      if (sid) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(sid));
      return c.json({ error: 'Not signed in' }, 401);
    }
    if (c.req.method !== 'GET' && c.req.header('x-csrf-token') !== row.csrf) {
      return c.json({ error: 'Missing or invalid CSRF token' }, 403);
    }
    c.set('auth', row);
    c.header('cache-control', 'no-store');
    await next();
  };
  app.use('/api/admin/*', requireAuth);
  app.get('/api/me', requireAuth, (c) => c.json(me(c.get('auth'))));

  const fail = (c: Context, errors: string[]) => c.json({ error: errors[0], errors }, 422);

  app.get('/api/admin/catalog', (c) => c.json(store.getCatalog(db, c.get('auth').brandId)));

  app.put('/api/admin/products/:id', async (c) => {
    const p = { ...(await bodyOf(c)), id: c.req.param('id') };
    const errors = validateProduct(p);
    if (errors.length) return fail(c, errors);
    store.upsertProduct(db, c.get('auth').brandId, p as any);
    return c.json(p);
  });
  app.delete('/api/admin/products/:id', (c) =>
    store.deleteProduct(db, c.get('auth').brandId, c.req.param('id')) ? c.json({ ok: true }) : c.json({ error: 'Not found' }, 404));

  app.put('/api/admin/retailers/:id', async (c) => {
    const r = { ...(await bodyOf(c)), id: c.req.param('id') };
    const errors = validateRetailer(r);
    if (errors.length) return fail(c, errors);
    store.upsertRetailer(db, c.get('auth').brandId, r as any);
    return c.json(r);
  });
  app.delete('/api/admin/retailers/:id', (c) =>
    store.deleteRetailer(db, c.get('auth').brandId, c.req.param('id')) ? c.json({ ok: true }) : c.json({ error: 'Not found' }, 404));

  app.put('/api/admin/offers/:productId/:retailerId', async (c) => {
    const o = { ...(await bodyOf(c)), productId: c.req.param('productId'), retailerId: c.req.param('retailerId') };
    const errors = validateOffer(o);
    if (errors.length) return fail(c, errors);
    try {
      store.upsertOffer(db, c.get('auth').brandId, o as any);
    } catch (err) {
      if (err instanceof StoreError) return c.json({ error: err.message }, 404);
      throw err;
    }
    return c.json(o);
  });
  app.delete('/api/admin/offers/:productId/:retailerId', (c) =>
    store.deleteOffer(db, c.get('auth').brandId, c.req.param('productId'), c.req.param('retailerId'))
      ? c.json({ ok: true })
      : c.json({ error: 'Not found' }, 404));

  app.post('/api/admin/import', async (c) => {
    const text = await c.req.text();
    if (text.length > MAX_IMPORT_BYTES) return c.json({ error: 'CSV is too large (max 2 MB)' }, 413);
    let catalog;
    try {
      catalog = csvToCatalog(text);
    } catch (err) {
      return fail(c, [(err as Error).message]);
    }
    if (catalog.offers.length > MAX_IMPORT_ROWS) return fail(c, [`Too many rows (max ${MAX_IMPORT_ROWS})`]);
    const errors = [
      ...validateCatalog(catalog).map((e) => e.replace(/^offers\[(\d+)\]/, (_m, i) => `data row ${Number(i) + 1}:`)),
      ...catalog.products.flatMap((p) => validateProduct(p).map((e) => `product "${p.id}": ${e}`)),
      ...catalog.retailers.flatMap((r) => validateRetailer(r).map((e) => `retailer "${r.name}": ${e}`)),
    ].slice(0, 50);
    if (errors.length) return fail(c, errors);
    const counts = { products: catalog.products.length, retailers: catalog.retailers.length, offers: catalog.offers.length };
    if (c.req.query('dry') === '1') return c.json({ dryRun: true, counts });
    return c.json({ dryRun: false, counts: store.importCatalog(db, c.get('auth').brandId, catalog) });
  });

  app.get('/api/admin/export', (c) => {
    c.header('content-disposition', `attachment; filename="${c.get('auth').slug}-catalog.json"`);
    return c.json(store.getCatalog(db, c.get('auth').brandId));
  });

  app.get('/api/public/:brand/catalog.json', (c) => {
    const brand = db.prepare('SELECT id FROM brands WHERE slug = ?').get(c.req.param('brand')) as { id: number } | undefined;
    if (!brand) return c.json({ error: 'Not found' }, 404);
    const body = JSON.stringify(store.getCatalog(db, brand.id));
    const etag = `"${createHash('sha1').update(body).digest('hex')}"`;
    const headers = {
      'access-control-allow-origin': '*',
      'cross-origin-resource-policy': 'cross-origin',
      'cache-control': 'public, max-age=60',
      'x-content-type-options': 'nosniff',
      etag,
    };
    if (c.req.header('if-none-match') === etag) return new Response(null, { status: 304, headers });
    return new Response(body, { headers: { ...headers, 'content-type': 'application/json; charset=utf-8' } });
  });

  return app;
}
