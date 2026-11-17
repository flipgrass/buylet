import { useState } from 'react';
import { api, ApiError } from '../api.ts';

const TEMPLATE = 'product_id,product_name,retailer,url,price,in_stock\nsku-1,Oat Spread 250g,Acme Mart,https://acme.example/oat,4.99,yes\n';
type Counts = { products: number; retailers: number; offers: number };

export function Import({ reload }: { reload: () => Promise<void> }) {
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<Counts | null>(null);
  const [done, setDone] = useState<Counts | null>(null);

  const reset = () => { setErrors([]); setPreview(null); setDone(null); };

  async function run(dry: boolean) {
    reset();
    try {
      const r = await api<{ counts: Counts }>('POST', `/api/admin/import${dry ? '?dry=1' : ''}`, text);
      if (dry) setPreview(r.counts);
      else { setDone(r.counts); setText(''); await reload(); }
    } catch (err) {
      setErrors(err instanceof ApiError ? err.errors : [(err as Error).message]);
    }
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'where-to-buy-template.csv' });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section>
      <h2>Import CSV</h2>
      <p className="muted">
        Columns: <code>product_id, product_name, retailer, url, price, in_stock</code>. Existing products,
        retailers and offers with the same keys are updated; nothing is deleted.
      </p>
      <p><button onClick={downloadTemplate}>Download template</button></p>
      <label>Upload a CSV file
        <input type="file" accept=".csv,text/csv" onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) { setText(await file.text()); reset(); }
        }} />
      </label>
      <label>…or paste CSV
        <textarea rows={8} value={text} onChange={(e) => { setText(e.target.value); reset(); }} />
      </label>
      <div className="actions">
        <button onClick={() => run(true)} disabled={!text.trim()}>Preview</button>
        <button className="primary" onClick={() => run(false)} disabled={!preview}>Import</button>
      </div>
      {preview && <p role="status">Ready: {preview.products} products, {preview.retailers} retailers, {preview.offers} offers.</p>}
      {done && <p role="status">Imported {done.products} products, {done.retailers} retailers, {done.offers} offers.</p>}
      {errors.length > 0 && (
        <ul role="alert" className="error">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
      )}
    </section>
  );
}
