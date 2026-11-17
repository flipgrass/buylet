import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { secureHeaders } from 'hono/secure-headers';
import { createApp } from './app.ts';
import { openDb } from './db.ts';

const port = Number(process.env.PORT ?? 3000);
const dbPath = process.env.DB_PATH ?? 'data/wtb.db';
if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });

const app = createApp(openDb(dbPath), { secureCookies: process.env.NODE_ENV === 'production' });

// The widget bundle is embedded cross-origin by brands' sites.
app.use('/wtb.js', async (c, next) => {
  await next();
  c.header('access-control-allow-origin', '*');
  c.header('cross-origin-resource-policy', 'cross-origin');
  c.header('cache-control', 'public, max-age=300');
});
app.get('/wtb.js', serveStatic({ path: './dist/wtb.js' }));

// Admin pages get strict headers; the embeddable widget and public catalog above do not.
app.use(
  '*',
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'https:', 'data:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      frameAncestors: ["'none'"],
    },
  }),
);

app.use('/*', serveStatic({ root: './admin/dist' }));
app.get('*', serveStatic({ path: './admin/dist/index.html' }));

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Where-to-Buy platform: http://localhost:${info.port}`);
});
