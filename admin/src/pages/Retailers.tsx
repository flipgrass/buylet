import type { Catalog } from '../api.ts';
import { EntityPage } from './EntityPage.tsx';

export const Retailers = ({ catalog, reload }: { catalog: Catalog; reload: () => Promise<void> }) => (
  <EntityPage title="Retailers" kind="retailer" path="retailers" items={catalog.retailers as any}
    extraField={{ name: 'logo', label: 'Logo URL' }} reload={reload} />
);
