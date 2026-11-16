import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// design/features/panels (accepted 2026-11-16): every pane's head is the template: the kind label, the title, one
// subtitle line; the way back only when the pane was opened from a verse picked in the text.
// The count comes from the database-generated fixture; no scripture is typed here.
const fx = JSON.parse(readFileSync(new URL('../public/fixtures/NUM.25.json', import.meta.url), 'utf8'));
const word = fx.words['11.24'];
const strong = word.lexicon.strong;

const ready = async (page: Page) => {
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = route.request().url().split('/').pop()!;
    const data = name.startsWith('count-') ? { occurrences: word.count.times, verses: word.count.verses, by_book: {} } : {};
    await route.fulfill({ json: data });
  });
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
};
const openCount = (page: Page) => page.evaluate(async s => { const path = '/src/panes.ts'; (await import(path)).openCount(s); }, strong);

test.beforeEach(async ({}, info) => { test.skip(info.project.name === 'webkit-phone', 'desktop'); });

test('a pane head shows its kind over the title, and no way back when nothing was picked', async ({ page }) => {
  await ready(page);
  await openCount(page);
  const hd = page.locator('.pane-count .pane-head').first();
  await expect(hd.locator('.pane-kind')).toHaveText('Count');
  await expect(hd.locator('.pane-title')).toHaveText(strong);
  await expect(hd.locator('.pane-sub')).toContainText(`${word.count.times} times`);
  await expect(hd.locator('.pane-from')).toHaveCount(0);
});

test('opened from a picked verse, the head has the way back to it', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    const w = window as any;
    return import('/src/app.ts').then(m => { m.app.picked = { anchor: 'NUM.25:11', label: 'Numbers 25:11' }; void w; });
  });
  await openCount(page);
  const from = page.locator('.pane-count .pane-from');
  await expect(from).toContainText('From Numbers 25:11');
  await page.evaluate(() => import('/src/app.ts').then(m => { m.app.picked = null; }));
  await from.locator('button').click();
  await expect(page.locator('#place .place-label')).toContainText('Numbers 25');
});
