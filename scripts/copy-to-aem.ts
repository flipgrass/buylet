import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('aem/clientlib/js', { recursive: true });
copyFileSync('dist/wtb.js', 'aem/clientlib/js/wtb.js');
console.log('copied dist/wtb.js -> aem/clientlib/js/wtb.js');
