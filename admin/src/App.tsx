import { useCallback, useEffect, useState } from 'react';
import { api, setCsrf, type Catalog, type Me } from './api.ts';
import { Auth } from './pages/Auth.tsx';
import { Embed } from './pages/Embed.tsx';
import { Import } from './pages/Import.tsx';
import { Offers } from './pages/Offers.tsx';
import { Products } from './pages/Products.tsx';
import { Retailers } from './pages/Retailers.tsx';

const TABS = ['Products', 'Retailers', 'Offers', 'Import', 'Embed'] as const;
type Tab = (typeof TABS)[number];
const EMPTY: Catalog = { products: [], retailers: [], offers: [] };

export function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('Products');
  const [catalog, setCatalog] = useState<Catalog>(EMPTY);

  const reload = useCallback(async () => setCatalog(await api<Catalog>('GET', '/api/admin/catalog')), []);

  const signedIn = useCallback(
    (m: Me) => {
      setCsrf(m.csrf);
      setMe(m);
      void reload();
    },
    [reload],
  );

  useEffect(() => {
    api<Me>('GET', '/api/me').then(signedIn, () => setMe(null));
  }, [signedIn]);

  if (me === undefined) return <p className="center">Loading…</p>;
  if (me === null) return <Auth onDone={signedIn} />;

  const logout = async () => {
    await api('POST', '/api/logout');
    setMe(null);
    setCatalog(EMPTY);
  };

  return (
    <div className="app">
      <header>
        <strong>{me.brand.name}</strong>
        <span className="muted">{me.user.email}</span>
        <button onClick={logout}>Log out</button>
      </header>
      <nav aria-label="Sections">
        {TABS.map((t) => (
          <button key={t} aria-current={t === tab ? 'page' : undefined} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>
      <main>
        {tab === 'Products' && <Products catalog={catalog} reload={reload} />}
        {tab === 'Retailers' && <Retailers catalog={catalog} reload={reload} />}
        {tab === 'Offers' && <Offers catalog={catalog} reload={reload} />}
        {tab === 'Import' && <Import reload={reload} />}
        {tab === 'Embed' && <Embed catalog={catalog} brand={me.brand.slug} />}
      </main>
    </div>
  );
}
