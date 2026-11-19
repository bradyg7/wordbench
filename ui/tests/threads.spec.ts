import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// design/features/threads (accepted 2026-11-17): a thread is a folder with a color. The reader draws a folder's phrase
// or word as a line under it (two lines at most, the hover names every folder), a whole verse as a mark beside the
// verse number with the words untouched, and nothing for a folder whose eye is off; "Shown on the text" lists the
// folders with a color. The marks and the list are answered here; the verses and words are the database's own
// (fixture made by `wb fixture`), no scripture is typed.
const fx = JSON.parse(readFileSync(new URL('../public/fixtures/NUM.25.json', import.meta.url), 'utf8'));

const at = (c: object) => ({ code: 'NUM', c1: 25, v1: 11, i1: 1, c2: null, v2: null, i2: null, ...c });
const names: Record<string, string> = { a: 'Phinehas', b: 'Zeal', c: 'Priests', d: 'Covenant', e: 'Plague', 'folder:v': 'Whole verse folder', off: 'Hidden folder' };
const marks = (hidden: string[]) => ({
  highlights: [], notes: [],
  threads: [
    ...['a', 'b', 'c', 'd', 'e'].map(id => at({ kind: 'phrase', id, color: id === 'a' ? 'yellow' : id === 'b' ? 'blue' : 'pink', c2: 25, v2: 11, i2: 3 })),
    at({ kind: 'verse', id: 'folder:v', color: 'green', v1: 12, i1: null }),
    at({ kind: 'word', id: 'off', color: 'orange', v1: 14, i1: 1 }),
  ],
  thread_names: names, hidden,
});
const eyes = [
  { key: 'thread:a', id: 'a', name: 'Phinehas', color: 'yellow', kind: 'thread', shown: true },
  { key: 'zeal', id: 'zeal', name: 'Zeal', color: 'blue', kind: 'folder', shown: true },
  { key: 'old', id: 'old', name: 'Old study', color: 'pink', kind: 'folder', shown: false },
];

async function ready(page: Page, hidden: string[] = ['off']) {
  await page.route('**/fixtures/NUM.25.json', async route => {
    const f = JSON.parse(JSON.stringify(fx));
    f.reader.marks = marks(hidden);
    await route.fulfill({ json: f });
  });
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = route.request().url().split('/').pop()!;
    await route.fulfill({ json: name === 'folder-shown.json' ? eyes : name === 'folder-list.json' ? [] : {} });
  });
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
}



test('a run in five folders is a tab by the verse number, never a line on the words, and the hover names all five (MK7-7, MK7-15)', async ({ page }) => {
  await ready(page);
  const vn = page.locator('.vn[data-v="11"]');
  await expect(vn).toHaveClass(/vth/);
  await expect(vn).toHaveAttribute('title', 'Phinehas, Zeal, Priests, Covenant, Plague');
  expect(await page.locator('.w').evaluateAll(els => els.filter(e => (e as HTMLElement).style.backgroundImage || (e as HTMLElement).style.paddingBottom).length)).toBe(0);
  await expect(page.locator('.w[title]')).toHaveCount(0);
});

test('a whole verse is a mark by its number and its words are not underlined; an eye off draws nothing', async ({ page }) => {
  await ready(page);
  const vn = page.locator('.vn[data-v="12"]');
  await expect(vn).toHaveClass(/vth/);
  await expect(vn).toHaveAttribute('title', 'Whole verse folder');
  const underlined = await page.locator('.para .w').evaluateAll((els, v12) => els.filter(e => (e as HTMLElement).style.backgroundImage && (window as any).__wb.drawn.v[+(e as HTMLElement).dataset.k!] === v12).length, 12);
  expect(underlined).toBe(0);
  const k14 = await page.evaluate(() => { const d = (window as any).__wb.drawn; return d.v.findIndex((v: number, k: number) => v === 14 && d.i[k] === 1); });
  await expect(page.locator(`.w[data-k="${k14}"]`)).not.toHaveAttribute('title', /.+/);
  expect(await page.locator(`.w[data-k="${k14}"]`).evaluate(e => (e as HTMLElement).style.backgroundImage)).toBe('');
});

test('Shown on the text lists the folders with a color, the shown ones first, and Hide all offers an Undo', async ({ page }, info) => {
  test.skip(info.project.name === 'webkit-phone', 'desktop');
  await ready(page);
  await page.locator('#hl-menu').click();
  const menu = page.locator('.layers-menu');
  await expect(menu.getByText('Shown on the text')).toBeVisible();
  await expect(menu.locator('.eye-list > .eye-row')).toHaveText(['Phinehas', 'Zeal']);
  await expect(menu.locator('.eye-group summary')).toHaveText('Other folders (1)');
  await expect(menu).not.toContainText(/thread/i);
  await menu.locator('.eye-search').fill('old');
  await expect(menu.locator('.eye-list > .eye-row')).toHaveCount(0);
  await expect(menu.locator('.eye-group .eye-row')).toHaveText(['Old study']);
  await menu.locator('.eye-search').fill('');
  await menu.locator('.eye-hide-all').click();
  await expect(page.locator('.toast-undo')).toContainText('Undo');
  await expect(page.locator('.toast-undo button')).toBeVisible();
});

test('narrow: Shown on the text is a sheet over the bottom with rows at least 44 px high', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-phone', 'phone');
  await ready(page);
  await page.evaluate(async () => { const p = '/src/toolbar.ts'; (await import(p)).hooks.highlights(document.querySelector('#place') ?? document.body); });
  const menu = page.locator('.layers-menu');
  await expect(menu.getByText('Shown on the text')).toBeVisible();
  const rows = await menu.locator('.eye-row').evaluateAll(els => els.map(e => e.getBoundingClientRect().height));
  expect(rows.length).toBeGreaterThan(1);
  expect(Math.min(...rows)).toBeGreaterThanOrEqual(44);
  const box = (await page.locator('.menu:has(.layers-menu)').boundingBox())!;
  const vh = page.viewportSize()!.height;
  expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(vh - 1);
});
