// Writes demo/index.html: demo.html with data.json written into it, so the demo is one file that opens anywhere.
//   node design/features/identity/demo/build.mjs   (after data.mjs)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, 'demo.html'), 'utf8').replace('/*DATA*/null', readFileSync(join(here, 'data.json'), 'utf8'));
writeFileSync(join(here, 'index.html'), html);
console.log('demo/index.html', html.length, 'bytes');
