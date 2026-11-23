// Writes rows/<id>.png and rows/index.json from frames.html (one .frame a picture, data-row = its table row).
//   node design/features/notebook-shell/frames.mjs
import { webkit } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, 'rows'), { recursive: true });
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1640, height: 1100 } });
await page.goto(pathToFileURL(join(here, 'frames.html')).href);
const index = [];
for (const f of await page.locator('.frame').all()) {
  const id = await f.getAttribute('data-id'), row = Number(await f.getAttribute('data-row'));
  const caption = (await f.locator('.cap').textContent()).trim();
  await f.screenshot({ path: join(here, 'rows', `${id}.png`) });
  index.push({ id, row, file: `rows/${id}.png`, caption });
}
index.sort((a, b) => a.row - b.row);
writeFileSync(join(here, 'rows', 'index.json'), JSON.stringify(index, null, 2) + '\n');
await browser.close();
console.log(`${index.length} frames`);
