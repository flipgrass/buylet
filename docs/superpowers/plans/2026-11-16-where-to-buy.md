# Where-to-Buy Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an embeddable `<where-to-buy>` Web Component, driven by a manual JSON/CSV catalog, deployable on AEM via a clientlib.

**Architecture:** Pure functions (validate, csv, offers, loader, events) feed one custom element rendered in Shadow DOM. Vite bundles to a single IIFE `dist/wtb.js`. Node scripts (native TS stripping) provide CSV import and catalog validation. Playwright E2E runs against a static demo page.

**Tech Stack:** TypeScript, Vite (lib/IIFE), Vitest + jsdom, @playwright/test (system Chrome), Node 26 (runs `.ts` scripts directly). No runtime dependencies.

## Global Constraints

Spec: `docs/superpowers/specs/2026-11-16-where-to-buy-design.md`
- Element `where-to-buy`; attributes `product`, `catalog`; script attribute `data-catalog`.
- Events `wtb:view` and `wtb:click` (bubbles, composed); also pushed to `window.dataLayer` if it exists.
- Buy links: `target=_blank`, `rel="noopener noreferrer"`, append `utm_source=wtb&utm_medium=widget&utm_content=<productId>` unless `utm_source` already present.
- Only http(s) URLs are accepted. Data is rendered with DOM APIs, never `innerHTML`.
- In-stock retailers first (catalog order); out-of-stock greyed and not clickable.
- Failure fallback text: "Where to buy is currently unavailable" + `console.warn`.
- Bundle <= 15 kB gzipped. No runtime dependencies. Theming vars: `--wtb-accent`, `--wtb-font`, `--wtb-radius`.
- CSV columns: `product_id,product_name,retailer,url,price,in_stock`.

## File Structure

| File | Responsibility |
|---|---|
| `src/types.ts` | Catalog types |
| `src/validate.ts` | `validateCatalog`, `parseCatalog` |
| `src/csv.ts` | `parseCsv`, `csvToCatalog` |
| `src/offers.ts` | `offersFor`, `withUtm` |
| `src/loader.ts` | `loadCatalog` (cached fetch) |
| `src/events.ts` | `emit` |
| `src/where-to-buy.ts` | custom element + styles |
| `src/index.ts` | registers element |
| `scripts/validate.ts`, `scripts/csv-to-json.ts`, `scripts/check-size.ts`, `scripts/copy-to-aem.ts` | CLI tools |
| `demo/index.html`, `demo/catalog.json` | demo + E2E target |
| `tests/*.test.ts`, `e2e/widget.spec.ts` | tests |
| `aem/**`, `README.md` | AEM integration + docs |

---

### Task 1: Scaffold

**Files:** Create `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `.gitignore`.

- [ ] **Step 1:** Write `package.json` (scripts: `build`, `test`, `e2e`, `validate`, `csv-to-json`; devDeps typescript, vite, vitest, jsdom, @playwright/test), `tsconfig.json` (strict, `allowImportingTsExtensions`, `noEmit`, DOM lib), `vite.config.ts` (lib entry `src/index.ts`, format `iife`, name `WTB`, `fileName: () => 'wtb.js'`, minify), `vitest.config.ts` (jsdom, `tests/**/*.test.ts`), `.gitignore` (`node_modules`, `dist`, `test-results`, `playwright-report`).
- [ ] **Step 2:** `npm install`. Expected: success.
- [ ] **Step 3:** Commit `chore: scaffold`.

### Task 2: Types + validator

**Files:** Create `src/types.ts`, `src/validate.ts`; Test `tests/validate.test.ts`.

**Produces:** `validateCatalog(raw: unknown): string[]` (empty = valid); `parseCatalog(raw: unknown): Catalog` (throws `Error` listing problems).

- [ ] **Step 1: Failing tests** — valid catalog gives `[]`; duplicate product id, offer pointing at unknown retailer, `javascript:` URL, non-boolean `inStock`, and non-object input each yield an error containing a matching keyword (`duplicate`, `unknown retailer`, `http`, `inStock`, `object`).
- [ ] **Step 2:** `npx vitest run tests/validate.test.ts` -> FAIL (module missing).
- [ ] **Step 3:** Implement per code in repo (`src/validate.ts`).
- [ ] **Step 4:** Run -> PASS. **Step 5:** Commit `feat: catalog validation`.

### Task 3: CSV import

**Files:** Create `src/csv.ts`; Test `tests/csv.test.ts`.

**Produces:** `parseCsv(text: string): string[][]` (quoted fields, `""` escapes, CRLF); `csvToCatalog(text: string): Catalog` (retailer id = slug of name; product name from first row of each product; `in_stock` true for `true|yes|y|1`; blank price omitted; result passes `validateCatalog`).

- [ ] **Step 1: Failing tests** — quoted comma + escaped quote parse; two products x two retailers produce 2/2/4 entries; retailer shared across products is deduped; `in_stock` variants; output validates.
- [ ] **Step 2-5:** run FAIL, implement, run PASS, commit `feat: csv import`.

### Task 4: Offers + UTM

**Files:** Create `src/offers.ts`; Test `tests/offers.test.ts`.

**Consumes:** `Catalog`. **Produces:** `offersFor(catalog, productId): ResolvedOffer[]` where `ResolvedOffer = { retailer: Retailer; offer: Offer }`, in-stock first, stable; `withUtm(url: string, productId: string): string`.

- [ ] **Step 1: Failing tests** — ordering keeps catalog order within groups; unknown product returns `[]`; `withUtm` adds three params, preserves existing query, does not override an existing `utm_source`.
- [ ] **Step 2-5:** FAIL, implement, PASS, commit `feat: offer ordering and utm`.

### Task 5: Loader + events

**Files:** Create `src/loader.ts`, `src/events.ts`; Test `tests/loader.test.ts`, `tests/events.test.ts`.

**Produces:** `loadCatalog(url: string, fetchFn = fetch): Promise<Catalog>` (one fetch per URL; rejects on non-OK or invalid; a rejection is not cached); `emit(el: HTMLElement, name: 'wtb:view'|'wtb:click', detail: Record<string,unknown>): void`.

- [ ] **Step 1: Failing tests** — two concurrent `loadCatalog` calls trigger one fetch; 404 rejects and a retry refetches; `emit` fires a bubbling composed CustomEvent with the detail and pushes `{event, ...detail}` to `window.dataLayer` when present, and does not throw when absent.
- [ ] **Step 2-5:** FAIL, implement, PASS, commit `feat: loader and events`.

### Task 6: Custom element

**Files:** Create `src/where-to-buy.ts`, `src/index.ts`; Test `tests/element.test.ts`.

**Consumes:** all prior modules. **Produces:** registered `where-to-buy` element.

- [ ] **Step 1: Failing tests (jsdom, stub `fetch`)** — renders retailer links in-stock first; out-of-stock rendered as non-link `li.out`; link has `target=_blank`, `rel="noopener noreferrer"` and utm params; clicking dispatches `wtb:click` with `{productId, retailerId, url}`; `wtb:view` once per render; unknown product and failed fetch both render the fallback text and `console.warn`; `<script>` in product name is rendered as text.
- [ ] **Step 2-5:** FAIL, implement, PASS, commit `feat: where-to-buy element`.

### Task 7: CLI scripts + build

**Files:** Create `scripts/validate.ts`, `scripts/csv-to-json.ts`, `scripts/check-size.ts`, `scripts/copy-to-aem.ts`, `tests/cli.test.ts`.

- [ ] **Step 1: Failing test** — spawn `node scripts/csv-to-json.ts <fixture.csv>` and expect valid JSON on stdout; spawn `node scripts/validate.ts` on a bad catalog and expect non-zero exit and an error on stderr.
- [ ] **Step 2-5:** FAIL, implement, PASS. Run `npm run build`; expect `dist/wtb.js` and a printed gzip size under 15360 bytes. Commit `feat: cli tools and build`.

### Task 8: Demo + E2E

**Files:** Create `demo/index.html`, `demo/catalog.json`, `playwright.config.ts`, `e2e/widget.spec.ts`.

- [ ] **Step 1:** Demo page loads `/dist/wtb.js` via `<script async data-catalog="/demo/catalog.json">`, includes a hostile stylesheet (`a{display:none!important}`, `*{color:red!important}`), a good widget (`sku-1`) and a broken one (`catalog="/missing.json"`).
- [ ] **Step 2: Failing E2E** — order of retailers; click opens popup whose URL contains `utm_source=wtb` and pushes to `dataLayer`; links visible despite hostile CSS; broken widget shows fallback.
- [ ] **Step 3:** `npm run e2e` -> PASS (config: system Chrome via `channel: 'chrome'`, `python3 -m http.server 4173` as webServer). Commit `test: e2e demo`.

### Task 9: AEM + docs

**Files:** Create `aem/clientlib/.content.xml`, `aem/clientlib/js.txt`, `aem/component/wtb.html` (HTL), `aem/component/_cq_dialog/.content.xml`, `README.md`.

- [ ] **Step 1:** Write the files; README documents embed, catalog format, CSV workflow, theming, events, AEM steps (clientlib category `wtb.widget`, Dispatcher caching, CORS, CSP), and limits.
- [ ] **Step 2:** Verify XML well-formed with `python3 -I`; confirm `aem/clientlib/js/wtb.js` copied by build. Commit `docs: aem integration`.

## Self-Review

Spec coverage: embed contract (T6,T8), data + CSV + validator (T2,T3,T7), ordering/UTM (T4), events + dataLayer (T5,T6), fallback (T6,T8), isolation (T8), size budget (T7), AEM (T9), non-goals untouched. Signatures consistent across tasks: `offersFor`, `withUtm`, `loadCatalog`, `emit`, `validateCatalog`, `parseCatalog`, `csvToCatalog`.
