import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const LIMIT = 15 * 1024;
const size = gzipSync(readFileSync('dist/wtb.js')).length;
console.log(`dist/wtb.js: ${size} bytes gzipped (limit ${LIMIT})`);
if (size > LIMIT) {
  console.error('Bundle exceeds size budget');
  process.exit(1);
}
