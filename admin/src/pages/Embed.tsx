import { createElement, useEffect, useState } from 'react';
import type { Catalog } from '../api.ts';

export function Embed({ catalog, brand }: { catalog: Catalog; brand: string }) {
  const [productId, setProductId] = useState('');
  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(!!customElements.get('where-to-buy'));
  const product = catalog.products.find((p) => p.id === productId) ?? catalog.products[0];

  useEffect(() => {
    if (ready) return;
    const s = document.createElement('script');
    s.src = '/wtb.js';
    s.onload = () => setReady(true);
    document.head.append(s);
  }, [ready]);

  if (!product) return <section><h2>Embed</h2><p className="muted">Add a product to get an embed snippet.</p></section>;

  const snippet =
    `<script async src="${location.origin}/wtb.js" data-brand="${brand}"></script>\n` +
    `<where-to-buy product="${product.id}"></where-to-buy>`;
  const stamp = JSON.stringify(catalog); // bust the public cache when data changes

  return (
    <section>
      <h2>Embed</h2>
      <label>Product
        <select value={product.id} onChange={(e) => setProductId(e.target.value)}>
          {catalog.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <pre aria-label="Embed snippet">{snippet}</pre>
      <button onClick={async () => { await navigator.clipboard?.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
        {copied ? 'Copied' : 'Copy snippet'}
      </button>
      <p className="muted">Add the script once per page; use one tag per product. On AEM, put the script in a clientlib and the tag in the component.</p>
      <h3>Live preview</h3>
      <div className="preview" aria-label="Widget preview">
        {ready && createElement('where-to-buy', {
          key: product.id + stamp.length,
          product: product.id,
          catalog: `/api/public/${encodeURIComponent(brand)}/catalog.json?v=${stamp.length}-${Date.now()}`,
        })}
      </div>
    </section>
  );
}
