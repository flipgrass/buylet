import { readFileSync } from 'node:fs';
import { csvToCatalog } from '../src/csv.ts';
import { parseCatalog } from '../src/validate.ts';

const file = process.argv[2];
if (!file) {
  console.error('usage: npm run csv-to-json -- <file.csv> > catalog.json');
  process.exit(2);
}
try {
  const catalog = parseCatalog(csvToCatalog(readFileSync(file, 'utf8')));
  process.stdout.write(JSON.stringify(catalog, null, 2) + '\n');
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
