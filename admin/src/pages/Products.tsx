import type { Catalog } from '../api.ts';
import { EntityPage } from './EntityPage.tsx';

export const Products = ({ catalog, reload }: { catalog: Catalog; reload: () => Promise<void> }) => (
  <EntityPage title="Products" kind="product" path="products" items={catalog.products as any}
    extraField={{ name: 'image', label: 'Image URL' }} reload={reload} />
);
