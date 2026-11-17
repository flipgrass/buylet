import { emit } from './events.ts';
import { loadCatalog } from './loader.ts';
import { offersFor, withUtm } from './offers.ts';
import type { Offer } from './types.ts';

const scriptCatalog =
  (document.currentScript as HTMLScriptElement | null)?.dataset.catalog ??
  document.querySelector<HTMLScriptElement>('script[data-catalog]')?.dataset.catalog;

const STYLES = `
:host { display: block; font-family: var(--wtb-font, system-ui, sans-serif); color: #1a1a1a; }
.box { border: 1px solid #d8d8d8; border-radius: var(--wtb-radius, 8px); padding: 16px; max-width: 480px; }
h2 { margin: 0 0 12px; font-size: 1.1rem; }
ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
li { display: flex; align-items: center; justify-content: space-between; gap: 12px;
     padding: 10px 12px; border: 1px solid #e4e4e4; border-radius: var(--wtb-radius, 8px); }
li.out { color: #6b6b6b; background: #f5f5f5; }
.name { font-weight: 600; }
.meta { color: #555; font-size: .875rem; }
a.buy { background: var(--wtb-accent, #0b57d0); color: #fff; text-decoration: none;
        padding: 8px 14px; border-radius: var(--wtb-radius, 8px); font-weight: 600; }
a.buy:hover { filter: brightness(.92); }
a.buy:focus-visible { outline: 3px solid #1a1a1a; outline-offset: 2px; }
.status { font-size: .875rem; }
.fallback { color: #555; }
`;

const isHttp = (u: string) => /^https?:\/\//i.test(u);

function priceText(o: Offer): string {
  if (o.price === undefined) return '';
  try {
    return o.currency
      ? new Intl.NumberFormat(undefined, { style: 'currency', currency: o.currency }).format(o.price)
      : o.price.toFixed(2);
  } catch {
    return o.price.toFixed(2);
  }
}

export class WhereToBuy extends HTMLElement {
  static observedAttributes = ['product', 'catalog'];
  private run = 0;

  connectedCallback(): void {
    void this.render();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) void this.render();
  }

  private fallback(reason: unknown): void {
    console.warn('[where-to-buy]', reason);
    const root = this.shadowRoot!;
    root.replaceChildren(this.styleEl());
    const p = document.createElement('p');
    p.className = 'fallback';
    p.textContent = 'Where to buy is currently unavailable';
    root.append(p);
  }

  private styleEl(): HTMLStyleElement {
    const s = document.createElement('style');
    s.textContent = STYLES;
    return s;
  }

  private async render(): Promise<void> {
    this.shadowRoot ?? this.attachShadow({ mode: 'open' });
    const id = ++this.run;
    const productId = this.getAttribute('product') ?? '';
    const url = this.getAttribute('catalog') ?? scriptCatalog;
    if (!productId || !url) return this.fallback('missing product or catalog');

    let catalog;
    try {
      catalog = await loadCatalog(url);
    } catch (err) {
      return id === this.run ? this.fallback(err) : undefined;
    }
    if (id !== this.run) return;

    const product = catalog.products.find((p) => p.id === productId);
    if (!product) return this.fallback(`unknown product "${productId}"`);

    const box = document.createElement('div');
    box.className = 'box';
    const h = document.createElement('h2');
    h.textContent = product.name;
    const ul = document.createElement('ul');
    ul.setAttribute('aria-label', `Where to buy ${product.name}`);

    for (const { retailer, offer } of offersFor(catalog, productId)) {
      const li = document.createElement('li');
      li.dataset.retailer = retailer.id;
      const left = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = retailer.name;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = [priceText(offer), offer.inStock ? 'In stock' : 'Out of stock']
        .filter(Boolean)
        .join(' · ');
      left.append(name, meta);
      li.append(left);

      if (offer.inStock && isHttp(offer.url)) {
        const a = document.createElement('a');
        a.className = 'buy';
        a.href = withUtm(offer.url, productId);
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = 'Buy';
        a.setAttribute('aria-label', `Buy ${product.name} at ${retailer.name}`);
        a.addEventListener('click', () =>
          emit(this, 'wtb:click', { productId, retailerId: retailer.id, url: a.href }),
        );
        li.append(a);
      } else {
        li.classList.add('out');
      }
      ul.append(li);
    }

    box.append(h, ul);
    this.shadowRoot!.replaceChildren(this.styleEl(), box);
    emit(this, 'wtb:view', { productId });
  }
}
