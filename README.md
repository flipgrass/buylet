# Where-to-Buy Widget

Embeddable "where to buy" locator: shoppers see which retailers carry a product and click through to buy. Driven by a manually maintained catalog, deployable on AEM or any site. No runtime dependencies; ~2.6 kB gzipped.

## Embed

```html
<script async src="/path/to/wtb.js" data-catalog="/path/to/catalog.json"></script>
<where-to-buy product="sku-1"></where-to-buy>
```
`data-catalog` sets the default catalog; a `catalog` attribute on the element overrides it. Many widgets on a page share one catalog request.

## Catalog

`catalog.json` has `products` (`id`, `name`, optional `image`, `upc`), `retailers` (`id`, `name`, optional `logo`) and `offers` (`productId`, `retailerId`, `url`, optional `price`/`currency`, manual `inStock`). See `demo/catalog.json`.

Or maintain a CSV with columns `product_id,product_name,retailer,url,price,in_stock`:

```sh
npm run csv-to-json -- lists.csv > catalog.json
npm run validate -- catalog.json     # duplicate ids, dangling refs, non-http(s) URLs
```

## Behavior

- In-stock retailers first (catalog order); out-of-stock are greyed and not clickable.
- Buy links open in a new tab (`noopener noreferrer`) with `utm_source=wtb&utm_medium=widget&utm_content=<productId>` unless `utm_source` is already set.
- Events `wtb:view` and `wtb:click` (`productId`, `retailerId`, `url`) bubble from the element and are pushed to `window.dataLayer` when present, so Adobe Analytics/GTM can consume them.
- On any failure the widget shows "Where to buy is currently unavailable" and logs a console warning; the page is never broken.
- Theme with CSS variables on the element or an ancestor: `--wtb-accent`, `--wtb-font`, `--wtb-radius`. Host CSS cannot leak in (Shadow DOM).

## AEM

1. `npm run build` copies `dist/wtb.js` to `aem/clientlib/js/wtb.js`.
2. Add `aem/clientlib` to your `ui.apps` package (category `wtb.widget`; `allowProxy` is on so it serves from `/etc.clientlibs`).
3. Copy `aem/component/` into a component (`wtb.html` + `_cq_dialog`). Authors set **Product ID** and pick the **catalog JSON** from DAM.
4. Dispatcher: cache the catalog JSON and invalidate it on DAM activation. If the catalog is on another origin, enable CORS for it.
5. CSP: allow the clientlib in `script-src` and the catalog origin in `connect-src`.

Not verified against a live AEM instance in this repo (XML well-formedness and the demo page are tested); validate on your author/publish tiers.

## Develop

```sh
npm test        # unit tests (vitest + jsdom)
npm run e2e     # build + Playwright against demo/ (uses system Chrome)
```

## Not included (yet)

Live stock/price feeds, cart/checkout, hosted admin and first-party click storage, analytics dashboards, multi-language/currency.
