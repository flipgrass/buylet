import { useState, type FormEvent } from 'react';
import { api, slugify } from '../api.ts';

interface Entity { id: string; name: string; [k: string]: string | undefined }

/** Shared add/edit/delete screen for products and retailers. */
export function EntityPage({
  title, kind, path, items, extraField, reload,
}: {
  title: string;
  kind: 'product' | 'retailer';
  path: 'products' | 'retailers';
  items: Entity[];
  extraField: { name: string; label: string };
  reload: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<Entity | null>(null);
  const [error, setError] = useState('');

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const name = String(f.get('name') ?? '').trim();
    const id = editing?.id ?? (String(f.get('id') ?? '').trim() || slugify(name));
    const extra = String(f.get(extraField.name) ?? '').trim();
    try {
      await api('PUT', `/api/admin/${path}/${encodeURIComponent(id)}`, { name, [extraField.name]: extra || undefined });
      setError('');
      setEditing(null);
      form.reset();
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(item: Entity) {
    if (!confirm(`Delete ${item.name}? Its offers will be removed too.`)) return;
    try {
      await api('DELETE', `/api/admin/${path}/${encodeURIComponent(item.id)}`);
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section>
      <h2>{title}</h2>
      <form key={editing?.id ?? 'new'} onSubmit={save} className="row-form">
        <label>{kind === 'product' ? 'Product name' : 'Retailer name'}
          <input name="name" required maxLength={200} defaultValue={editing?.name} /></label>
        <label>ID (optional)
          <input name="id" pattern="[A-Za-z0-9._\-]{1,64}" defaultValue={editing?.id} disabled={!!editing}
            placeholder="auto from name" /></label>
        <label>{extraField.label}
          <input name={extraField.name} defaultValue={editing?.[extraField.name]} /></label>
        <button className="primary">{editing ? 'Save changes' : `Add ${kind}`}</button>
        {editing && <button type="button" onClick={() => setEditing(null)}>Cancel</button>}
      </form>
      {error && <p role="alert" className="error">{error}</p>}
      {items.length === 0 ? <p className="muted">No {path} yet.</p> : (
        <table>
          <thead><tr><th>Name</th><th>ID</th><th>{extraField.label}</th><th /></tr></thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td>{it.name}</td><td><code>{it.id}</code></td><td>{it[extraField.name]}</td>
                <td className="actions">
                  <button onClick={() => setEditing(it)} aria-label={`Edit ${it.name}`}>Edit</button>
                  <button onClick={() => remove(it)} aria-label={`Delete ${it.name}`}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
