import type { Hono } from 'hono';
import { createApp } from '../../server/app.ts';
import { openDb } from '../../server/db.ts';

export function setup() {
  const db = openDb(':memory:');
  const app = createApp(db);
  return { db, app, client: (a: Hono<any> = app) => new Client(a) };
}

export class Client {
  cookie = '';
  csrf = '';
  constructor(private app: Hono<any>) {}

  async req(method: string, path: string, body?: unknown, extra: Record<string, string> = {}) {
    const headers: Record<string, string> = { ...extra };
    if (this.cookie) headers.cookie = this.cookie;
    if (this.csrf && method !== 'GET' && !('x-csrf-token' in headers)) headers['x-csrf-token'] = this.csrf;
    let payload: string | undefined;
    if (typeof body === 'string') payload = body;
    else if (body !== undefined) {
      payload = JSON.stringify(body);
      headers['content-type'] = 'application/json';
    }
    const res = await this.app.request(`http://localhost${path}`, { method, headers, body: payload });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0];
    return res;
  }

  async signup(email: string, brandName = 'Acme Foods', password = 'password123') {
    const res = await this.req('POST', '/api/signup', { email, brandName, password });
    const json = (await res.json()) as any;
    if (res.status === 201) this.csrf = json.csrf;
    return { res, json };
  }
}
