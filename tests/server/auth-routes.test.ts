// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { setup } from './helpers.ts';

describe('signup / login / session', () => {
  it('signs up, sets an httpOnly cookie, and exposes /api/me', async () => {
    const { client } = setup();
    const c = client();
    const { res, json } = await c.signup('Owner@Acme.test');
    expect(res.status).toBe(201);
    expect(res.headers.get('set-cookie')).toMatch(/HttpOnly/i);
    expect(res.headers.get('set-cookie')).toMatch(/SameSite=Lax/i);
    expect(json.brand.slug).toBe('acme-foods');
    const me = await (await c.req('GET', '/api/me')).json();
    expect(me.user.email).toBe('owner@acme.test');
  });
  it('gives colliding brand names distinct slugs and rejects duplicate emails', async () => {
    const { client } = setup();
    expect((await client().signup('a@x.test')).json.brand.slug).toBe('acme-foods');
    expect((await client().signup('b@x.test')).json.brand.slug).toBe('acme-foods-2');
    expect((await client().signup('a@x.test')).res.status).toBe(409);
  });
  it('validates signup input', async () => {
    const { client } = setup();
    expect((await client().signup('not-an-email')).res.status).toBe(400);
    expect((await client().signup('a@x.test', 'Brand', 'short')).res.status).toBe(400);
    expect((await client().signup('a@x.test', '   ')).res.status).toBe(400);
  });
  it('stores only a hash of the session token and a hashed password', async () => {
    const { client, db } = setup();
    const c = client();
    await c.signup('a@x.test');
    const token = c.cookie.split('=')[1];
    const rows = db.prepare('SELECT token_hash FROM sessions').all() as any[];
    expect(rows[0].token_hash).not.toBe(token);
    const u = db.prepare('SELECT pw_hash FROM users').get() as any;
    expect(u.pw_hash).not.toContain('password123');
  });
  it('logs in, logs out, and invalidates the session', async () => {
    const { client } = setup();
    const c = client();
    await c.signup('a@x.test');
    const c2 = client();
    const login = await c2.req('POST', '/api/login', { email: 'A@x.test', password: 'password123' });
    expect(login.status).toBe(200);
    c2.csrf = ((await login.json()) as any).csrf;
    const oldCookie = c2.cookie;
    expect((await c2.req('GET', '/api/me')).status).toBe(200);
    expect((await c2.req('POST', '/api/logout')).status).toBe(200);
    c2.cookie = oldCookie; // replay the pre-logout session token
    expect((await c2.req('GET', '/api/me')).status).toBe(401);
  });
  it('returns the same error for unknown email and wrong password', async () => {
    const { client } = setup();
    await client().signup('a@x.test');
    const wrong = await client().req('POST', '/api/login', { email: 'a@x.test', password: 'nope-nope' });
    const unknown = await client().req('POST', '/api/login', { email: 'zz@x.test', password: 'nope-nope' });
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
  });
  it('rate limits repeated failures, even with the right password afterwards', async () => {
    const { client } = setup();
    await client().signup('a@x.test');
    const c = client();
    for (let i = 0; i < 5; i++) await c.req('POST', '/api/login', { email: 'a@x.test', password: 'wrong-pass' });
    const blocked = await c.req('POST', '/api/login', { email: 'a@x.test', password: 'password123' });
    expect(blocked.status).toBe(429);
  });
  it('rejects expired sessions', async () => {
    const { client, db } = setup();
    const c = client();
    await c.signup('a@x.test');
    db.prepare('UPDATE sessions SET expires_at = 1').run();
    expect((await c.req('GET', '/api/me')).status).toBe(401);
  });
});

describe('request guards', () => {
  it('requires auth for admin routes', async () => {
    const { client } = setup();
    expect((await client().req('GET', '/api/admin/catalog')).status).toBe(401);
  });
  it('requires the CSRF header on mutations', async () => {
    const { client } = setup();
    const c = client();
    await c.signup('a@x.test');
    const noToken = await c.req('PUT', '/api/admin/products/p1', { name: 'N' }, { 'x-csrf-token': '' });
    expect(noToken.status).toBe(403);
    const ok = await c.req('PUT', '/api/admin/products/p1', { name: 'N' });
    expect(ok.status).toBe(200);
  });
  it('rejects cross-origin mutations', async () => {
    const { client } = setup();
    const c = client();
    await c.signup('a@x.test');
    const res = await c.req('PUT', '/api/admin/products/p1', { name: 'N' }, { origin: 'https://evil.test', host: 'localhost' });
    expect(res.status).toBe(403);
    const same = await c.req('PUT', '/api/admin/products/p1', { name: 'N' }, { origin: 'http://localhost', host: 'localhost' });
    expect(same.status).toBe(200);
  });
});
