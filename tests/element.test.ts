import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../src/index.ts';
import { resetCatalogCache } from '../src/loader.ts';

const catalog = {
  products: [{ id: 'p1', name: 'Oat <script>x</script> Spread' }],
  retailers: [
    { id: 'a', name: 'Alpha' },
    { id: 'b', name: 'Beta' },
    { id: 'c', name: 'Gamma' },
  ],
  offers: [
    { productId: 'p1', retailerId: 'a', url: 'https://a.test/p1', inStock: false },
    { productId: 'p1', retailerId: 'b', url: 'https://b.test/p1?ref=1', inStock: true, price: 4.5, currency: 'USD' },
    { productId: 'p1', retailerId: 'c', url: 'https://c.test/p1', inStock: true },
  ],
};

const tick = () => new Promise((r) => setTimeout(r, 0));
async function mount(attrs: Record<string, string>) {
  const el = document.createElement('where-to-buy');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  await tick(); await tick();
  return el;
}

beforeEach(() => {
  resetCatalogCache();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => catalog })));
});
afterEach(() => { document.body.innerHTML = ''; vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('<where-to-buy>', () => {
  it('lists in-stock retailers first, out-of-stock as non-links', async () => {
    const el = await mount({ product: 'p1', catalog: '/c.json' });
    const items = [...el.shadowRoot!.querySelectorAll('li')];
    expect(items.map((li) => li.dataset.retailer)).toEqual(['b', 'c', 'a']);
    expect(items[2].classList.contains('out')).toBe(true);
    expect(items[2].querySelector('a')).toBeNull();
  });
  it('renders safe, tracked links', async () => {
    const el = await mount({ product: 'p1', catalog: '/c.json' });
    const a = el.shadowRoot!.querySelector('a')!;
    expect(a.target).toBe('_blank');
    expect(a.rel).toBe('noopener noreferrer');
    const u = new URL(a.href);
    expect(u.searchParams.get('ref')).toBe('1');
    expect(u.searchParams.get('utm_source')).toBe('wtb');
    expect(u.searchParams.get('utm_content')).toBe('p1');
  });
  it('emits wtb:view once and wtb:click on click', async () => {
    const seen: string[] = [];
    document.addEventListener('wtb:view', () => seen.push('view'));
    let click: any;
    document.addEventListener('wtb:click', (e) => (click = (e as CustomEvent).detail));
    const el = await mount({ product: 'p1', catalog: '/c.json' });
    el.shadowRoot!.querySelector('a')!.addEventListener('click', (e) => e.preventDefault());
    el.shadowRoot!.querySelector('a')!.click();
    expect(seen).toEqual(['view']);
    expect(click).toMatchObject({ productId: 'p1', retailerId: 'b' });
    expect(click.url).toContain('utm_source=wtb');
  });
  it('renders product name as text, not HTML', async () => {
    const el = await mount({ product: 'p1', catalog: '/c.json' });
    expect(el.shadowRoot!.querySelector('script')).toBeNull();
    expect(el.shadowRoot!.textContent).toContain('<script>x</script>');
  });
  it('shows fallback for unknown product', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = await mount({ product: 'nope', catalog: '/c.json' });
    expect(el.shadowRoot!.textContent).toContain('Where to buy is currently unavailable');
    expect(warn).toHaveBeenCalled();
  });
  it('shows fallback when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = await mount({ product: 'p1', catalog: '/other.json' });
    expect(el.shadowRoot!.textContent).toContain('Where to buy is currently unavailable');
    expect(warn).toHaveBeenCalled();
  });
});
