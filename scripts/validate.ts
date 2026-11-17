import { readFileSync } from 'node:fs';
import { validateCatalog } from '../src/validate.ts';

const file = process.argv[2];
if (!file) {
  console.error('usage: npm run validate -- <catalog.json>');
  process.exit(2);
}
let errors: string[];
try {
  errors = validateCatalog(JSON.parse(readFileSync(file, 'utf8')));
} catch (err) {
  errors = [`cannot read ${file}: ${(err as Error).message}`];
}
if (errors.length) {
  console.error(errors.map((e) => `- ${e}`).join('\n'));
  process.exit(1);
}
console.log(`${file}: OK`);
