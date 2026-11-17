import type { Catalog } from '../../src/types.ts';

export type { Catalog };
export interface Me { user: { email: string }; brand: { slug: string; name: string }; csrf: string }

let csrf = '';
export const setCsrf = (token: string) => { csrf = token; };

export class ApiError extends Error {
  status: number;
  errors: string[];
  constructor(status: number, message: string, errors: string[] = [message]) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  let payload: string | undefined;
  if (typeof body === 'string') {
    payload = body;
    headers['content-type'] = 'text/csv';
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    headers['content-type'] = 'application/json';
  }
  if (method !== 'GET') headers['x-csrf-token'] = csrf;
  const res = await fetch(path, { method, headers, body: payload, credentials: 'same-origin' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.error ?? `Request failed (${res.status})`, json.errors);
  return json as T;
}

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64);
