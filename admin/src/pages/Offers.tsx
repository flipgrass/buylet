import { useState } from 'react';
import { api, type Catalog } from '../api.ts';
import type { Offer, Retailer } from '../../../src/types.ts';

function Row({ productId, retailer, offer, reload }: { productId: string; retailer: Retailer; offer?: Offer; reload: () => Promise<void> }) {
  const [url, setUrl] = useState(offer?.url ?? '');
  const [price, setPrice] = useState(offer?.price?.toString() ?? '');
  const [currency, setCurrency] = useState(offer?.currency ?? '');
  const [inStock, setInStock] = useState(offer?.inStock ?? true);
  const [msg, setMsg] = useState('');
  const base = `/api/admin/offers/${encodeURIComponent(productId)}/${encodeURIComponent(retailer.id)}`;

  async function run(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      setMsg(ok);
      await reload();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  const save = () =>
    run(() => api('PUT', base, {
      url, inStock,
      price: price === '' ? undefined : Number(price),
      currency: currency.trim().toUpperCase() || undefined,
    }), 'Saved');
  const remove = () => run(async () => {
    await api('DELETE', base);
    setUrl(''); setPrice(''); setCurrency('');
  }, 'Removed');

  return (
    <tr>
      <td>{retailer.name}</td>
      <td><input aria-label={`${retailer.name} URL`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /></td>
      <td><input aria-label={`${retailer.name} price`} type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="narrow" /></td>
      <td><input aria-label={`${retailer.name} currency`} value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value)} className="narrow" placeholder="USD" /></td>
      <td><input aria-label={`${retailer.name} in stock`} type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} /></td>
      <td className="actions">
        <button className="primary" onClick={save} aria-label={`Save ${retailer.name}`}>Save</button>
        {offer && <button onClick={remove} aria-label={`Remove ${retailer.name}`}>Remove</button>}
        <span role="status" className="muted">{msg}</span>
      </td>
    </tr>
  );
}

export function Offers({ catalog, reload }: { catalog: Catalog; reload: () => Promise<void> }) {
  const [productId, setProductId] = useState('');
  const selected = catalog.products.find((p) => p.id === productId) ?? catalog.products[0];

  if (catalog.products.length === 0 || catalog.retailers.length === 0) {
    return <section><h2>Offers</h2><p className="muted">Add at least one product and one retailer first.</p></section>;
  }
  return (
    <section>
      <h2>Offers</h2>
      <label>Product
        <select value={selected.id} onChange={(e) => setProductId(e.target.value)}>
          {catalog.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <table>
        <thead><tr><th>Retailer</th><th>Buy URL</th><th>Price</th><th>Currency</th><th>In stock</th><th /></tr></thead>
        <tbody>
          {catalog.retailers.map((r) => (
            <Row key={`${selected.id}|${r.id}`} productId={selected.id} retailer={r} reload={reload}
              offer={catalog.offers.find((o) => o.productId === selected.id && o.retailerId === r.id)} />
          ))}
        </tbody>
      </table>
    </section>
  );
}
