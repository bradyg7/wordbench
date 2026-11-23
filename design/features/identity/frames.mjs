// Writes rows/<id>.png and rows/index.json from frames.html (one .frame a picture, data-row = its table row).
//   node design/features/identity/frames.mjs
import { webkit } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, 'rows'), { recursive: true });
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1640, height: 1100 } });
await page.goto(pathToFileURL(join(here, 'frames.html')).href);
const read = n => JSON.parse(readFileSync(join(here, 'data', n), 'utf8'));
await page.evaluate(d => window.fill(d), { john: read('john1-1.json'), ps: read('ps119-105.json') });
await page.evaluate(() => document.fonts.ready);
const index = [];
for (const f of await page.locator('.frame').all()) {
  const id = await f.getAttribute('data-id'), row = Number(await f.getAttribute('data-row'));
  const caption = (await f.locator('.cap').textContent()).trim();
  await f.screenshot({ path: join(here, 'rows', `${id}.jpg`), type: 'jpeg', quality: 80 });
  index.push({ id, row, file: `rows/${id}.jpg`, caption });
}
index.sort((a, b) => a.row - b.row);
writeFileSync(join(here, 'rows', 'index.json'), JSON.stringify(index, null, 2) + '\n');
await browser.close();
console.log(`${index.length} frames`);
