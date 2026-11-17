export function resolveDefaultCatalog(script: {
  src: string;
  dataset: Record<string, string | undefined>;
}): string | undefined {
  const { catalog, brand } = script.dataset;
  if (catalog) return catalog;
  if (!brand) return undefined;
  try {
    return `${new URL(script.src).origin}/api/public/${encodeURIComponent(brand)}/catalog.json`;
  } catch {
    return undefined;
  }
}
