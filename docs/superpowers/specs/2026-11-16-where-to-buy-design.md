# Where-to-Buy Widget: Design

## Goal
An embeddable "where to buy" locator in the style of MikMak Commerce (shopper sees which retailers carry a product and clicks through to buy), delivered with Shoprocket-style embed ergonomics (one async script plus a tag). It must run on Adobe Experience Manager (AEM) sites and be driven by manually maintained product and retailer lists.

## Non-goals
- Live retailer stock or price feeds (stock is a manual flag).
- Cart, checkout, payments, or a hosted admin/API (possible later; see "Later").
- Analytics dashboards (the widget emits events; the host site's analytics collects them).
- Reverse engineering MikMak's proprietary widget or backend. Design is from public product behavior only. The REA MCP is not part of this build.

## Embed contract
```html
<script async src="/etc.clientlibs/site/clientlibs/wtb.js"
        data-catalog="/content/dam/brand/wtb/catalog.json"></script>
<where-to-buy product="sku-123"></where-to-buy>
```
- The script registers the `where-to-buy` custom element. Load order does not matter (the element upgrades when defined).
- `data-catalog` on the script sets the default catalog URL. A `catalog` attribute on the element overrides it.
- Catalog fetches are de-duplicated per URL (one request for many widgets on a page).

## Data
One `catalog.json`:
- `products[]`: `id`, `name`, `image?`, `upc?`
- `retailers[]`: `id`, `name`, `logo?`
- `offers[]`: `productId`, `retailerId`, `url`, `price?`, `currency?`, `inStock` (boolean, manual)

Authoring options: edit the JSON directly, or maintain a CSV (`product_id,product_name,retailer,url,price,in_stock`) and convert it with `scripts/csv-to-json`. `scripts/validate` fails on duplicate ids, dangling references, and non-http(s) URLs.

## Widget behavior
- Shadow DOM isolates it from host CSS. Theming via CSS custom properties (`--wtb-accent`, `--wtb-font`, `--wtb-radius`).
- Renders product header, then retailers: in-stock first (catalog order), out-of-stock greyed and not clickable.
- Buy links: `target=_blank`, `rel="noopener noreferrer"`, `utm_source=wtb&utm_medium=widget&utm_content=<productId>` appended unless already present.
- Accessible: list semantics, visible focus, text contrast per WCAG AA, no motion.
- Dispatches bubbling, composed CustomEvents `wtb:view` (once per render) and `wtb:click` (`productId`, `retailerId`, `url`) and pushes the same objects to `window.dataLayer` if it exists.
- Failure: unknown product, fetch error, or invalid JSON renders a quiet fallback ("Where to buy is currently unavailable") and logs `console.warn`. The host page is never broken.

## AEM integration (`aem/`)
- Clientlib definition (category `wtb.widget`) wrapping the built bundle.
- HTL snippet: `<where-to-buy product="${properties.productId}">` with the catalog path from a DAM-backed dialog field.
- README: Dispatcher caching, CORS if the catalog is cross-origin, CSP `script-src`/`connect-src` notes.
- Not run against a live AEM instance in this project; verified by static demo plus lint of the XML/HTL.

## Repository layout
`src/` (component, fetch, render, events), `demo/` (page + sample catalog), `aem/`, `scripts/` (csv-to-json, validate), `tests/`.
Stack: TypeScript, Vite (library build to one IIFE `wtb.js`), no runtime dependencies.

## Testing
- Vitest: CSV conversion, validator rules, ordering and UTM logic, fallback rendering.
- Playwright E2E on the demo page: retailer order, click opens the right URL, events and `dataLayer` fire, hostile host stylesheet does not leak in, fetch failure shows the fallback.
- Size budget: bundle <= 15 kB gzipped, checked in the build.

## Later (out of scope now)
Hosted admin + first-party click storage; multi-language and currency; postal-code or store-level lookup; cart and checkout.
