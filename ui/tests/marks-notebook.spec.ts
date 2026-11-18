import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { marksPage, notebookRoutes, openMarksPage } from './notebook-fixtures';

// design/features/marks in the Notebook: Scripture in this page (M22, M23, M39), and the search's kinds (M21). Every answer is what `wb`
// said on the generated study (npm run fixtures); no scripture is typed here.
const fx = (name: string) => JSON.parse(readFileSync(new URL(`../public/fixtures/wb/${name}.json`, import.meta.url), 'utf8'));
const overview = fx(`page-overview-${marksPage.id.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
const num25 = JSON.parse(readFileSync(new URL('../public/fixtures/NUM.25.json', import.meta.url), 'utf8'));

test('Scripture in this page: open and at most 6 rows high in a wide pane, in Bible order, each saying where it is named', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  await notebookRoutes(page);
  await openMarksPage(page, true);
  const box = page.locator('.ov');
  await expect(box).toBeVisible();
  await expect(box.locator('.ov-head')).toContainText(`Scripture in this page · ${overview.count}`);
  await expect(box).toHaveClass(/wide/);
  const names = await box.locator('.ov-name').allTextContents();
  expect(names).toEqual(overview.items.map((i: any) => i.label));
  await expect(box.locator('.ov-line')).toBeHidden();
  const list = (await box.locator('.ov-list').boundingBox())!;
  expect(list.height).toBeLessThanOrEqual(6 * 30 + 2);
  // where each is named
  const romans = box.locator('.ov-row', { hasText: 'Romans 10:2' });
  const psalm = box.locator('.ov-row', { hasText: 'Psalms 119:105' });
  await expect(romans.locator('.ov-where')).toHaveText(/¶/);
  const block = box.locator('.ov-row', { hasText: 'Numbers 25:10' });
  await expect(block.locator('.ov-where')).toContainText('scripture block');
  // a click goes to that block; its arrow opens the text in the reader
  await block.locator('.ov-name').click();
  await expect(page.locator('.nb-block.ov-flash')).toHaveCount(1);
  await psalm.locator('.ov-open').click();
  await expect(page.locator('.ch-title, .reader2-title').filter({ hasText: 'Psalms 119' }).first()).toBeVisible();
});

test('Scripture in this page: narrow, one wrapping line that opens the list', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-phone', 'phone');
  await notebookRoutes(page);
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).tap();
  await page.waitForSelector('.pane-notebook');
  await page.evaluate(id => (window as any).__wb.note(id), marksPage.id);
  const box = page.locator('.ov');
  await expect(box).toHaveClass(/narrow/);
  const line = box.locator('.ov-line');
  await expect(line).toBeVisible();
  await expect(box.locator('.ov-list')).toBeHidden();
  await line.tap();
  await expect(box.locator('.ov-list')).toBeVisible();
  await expect(box.locator('.ov-row')).toHaveCount(overview.count);
});

test('a page naming more than 30 scriptures folds to books with counts', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  const books = [['Psalms', 40], ['Isaiah', 40], ['John', 6]] as const;
  const items = books.flatMap(([b, n]) => Array.from({ length: n }, (_, k) => ({ label: `${b} ${k + 1}:1`, ref: `${b} ${k + 1}:1`, book: b, where: [{ n: 1, in: '¶1' }], first: 1 })));
  const folded = { ...overview, count: items.length, folded: true, items, books: books.map(([b, n]) => ({ code: b, name: b, count: n, items: items.filter(i => i.book === b).map(i => i.label) })) };
  await notebookRoutes(page, { [`page-overview-${marksPage.id.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`]: folded });
  await openMarksPage(page, true);
  const box = page.locator('.ov');
  await expect(box.locator('summary')).toHaveText(['Psalms · 40', 'Isaiah · 40', 'John · 6']);
  await box.locator('summary').first().click();
  await expect(box.locator('.ov-book').first().locator('.ov-row')).toHaveCount(40);
});

test('the search’s kinds are one menu at the start of the field, with counts, narrowing to one line of text, no chips and no side list', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  await notebookRoutes(page);
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
  const kind = page.locator('.nb-kind');
  await expect(kind).toHaveText('Everything ▾');
  await kind.click();
  const menu = page.locator('.nb-kinds');
  await expect(menu.locator('.menu-item')).toHaveCount(5);
  const names = await menu.locator('.menu-item').allTextContents();
  expect(names.map(n => n.split(' ·')[0])).toEqual(['Everything', 'Pages', 'Saves', 'Questions', 'Highlights']);
  const all = fx('find-sort-edited');
  const pages = all.groups.find((g: any) => g.kind === 'page').count;
  expect(names[1]).toBe(`Pages · ${pages}`);
  await menu.locator('[data-kind="page"]').click();
  await expect(kind).toHaveText('Pages ▾');
  await expect(page.locator('.nb-kind-line')).toHaveText(new RegExp(`^Pages · ${pages}`));
  await expect(page.locator('.nb-kind-results .nb-item')).toHaveCount(pages);
  await expect(page.locator('.pane-notebook .chip, .pane-notebook .nb-kind-list')).toHaveCount(0);
});
