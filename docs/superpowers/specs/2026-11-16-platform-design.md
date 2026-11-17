# Where-to-Buy Platform: Design

Extends `2026-11-16-where-to-buy-design.md`. Turns the widget into a multi-brand platform: brands sign in, enter or upload products and retailers, and embed the widget with a snippet.

## Architecture
Single Node service: Hono API + `node:sqlite` + React/Vite admin SPA (served by the same process). Widget stays in `src/`.
Layout: `server/` (db, auth, store, validators, app, index), `admin/` (React SPA), `src/` (widget), `tests/`, `e2e/`, `e2e-platform/`.

## Accounts and isolation
- `POST /api/signup` creates brand + first user + session. Password >= 8 chars, hashed with scrypt (random salt).
- Sessions: random token in httpOnly SameSite=Lax cookie `sid`; only a SHA-256 hash is stored; 7-day expiry.
- Mutating admin requests require header `x-csrf-token` (value returned by `/api/me` and signup/login). Mutating `/api/*` requests with an `Origin` host differing from `Host` are rejected.
- Login is rate-limited (5 failures per 15 min per IP+email). Wrong email and wrong password return the same error.
- Every admin query is scoped by the session's `brand_id`; request bodies/paths never supply it.

## Data
Per brand: `products(id,name,image,upc)`, `retailers(id,name,logo)`, `offers(product_id,retailer_id,url,price,currency,in_stock)` with one offer per (product, retailer); deleting a product or retailer cascades to its offers. Entity ids match `^[A-Za-z0-9._-]{1,64}$`; names <= 200 chars; URLs http(s) only. Validation reuses `validateCatalog`.

## API
Admin (session required): `GET /api/me`, `GET /api/admin/catalog`, `PUT|DELETE /api/admin/products/:id`, `PUT|DELETE /api/admin/retailers/:id`, `PUT|DELETE /api/admin/offers/:productId/:retailerId`, `POST /api/admin/import[?dry=1]` (CSV text body), `GET /api/admin/export`.
Public: `GET /api/public/:brand/catalog.json` (CORS `*`, `Cache-Control: public, max-age=60`, ETag/304), `GET /wtb.js`.

## CSV import
Same columns as before. `?dry=1` returns counts and row-level errors without writing. Real import upserts products, retailers and offers by key, inside one transaction; any error aborts with nothing written.

## Admin screens
Login/Signup; Products; Retailers; Offers (pick product, edit retailer rows: url, price, currency, in-stock toggle); Import (upload, preview, confirm); Embed (snippet with copy button + live widget preview).

## Widget change
`data-brand="<slug>"` on the script resolves the default catalog to `<script origin>/api/public/<slug>/catalog.json`. `data-catalog` still takes precedence (AEM/DAM use).

## Non-goals
Billing, multi-user brands, email password reset, click analytics storage, cloud deployment, image upload (image/logo are URLs).

## Testing
Vitest (node env, in-memory SQLite): auth, CSRF/origin, CRUD, cascade, import dry-run/commit/rollback, tenant isolation, public endpoint caching. Playwright: sign up, create retailer/product/offer, widget preview renders, CSV import, logout.
