import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { marksPage, notebookRoutes, openMarksPage } from './notebook-fixtures';

// design/features/marks in the Notebook: Scripture in this page (M22, M23, M39), a passage with my marks (M6, M7), a margin
// note shown in a page, Margin notes in the Library (M30, M31) and the search's kinds (M21). Every answer is what `wb`
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

test('a passage with my marks: the switch, one dot per verse that has something, a card in place that does not scroll the page', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  const calls: string[] = [];
  await notebookRoutes(page);
  await page.route('**/fixtures/wb/block-scripture-*', r => { calls.push(new URL(r.request().url()).pathname.split('/').at(-1)!); return r.fulfill({ json: {} }); });
  await openMarksPage(page);
  const block = page.locator('.nb-scripture');
  await expect(block).toBeVisible();
  await expect(block.getByRole('button', { name: 'With my marks' })).toHaveClass(/on/);
  await expect(block.getByRole('button', { name: 'Just the text' })).not.toHaveClass(/on/);
  const dots = block.locator('.sv-dot');
  const wanted = (fx(`page-scripture-${marksPage.id.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`).blocks[0].verses as any[]).filter(v => v.dot).map(v => String(v.v));
  expect(wanted.length).toBeGreaterThan(0);
  expect(await dots.evaluateAll(ds => ds.map(d => (d as HTMLElement).dataset.v))).toEqual(wanted);
  const scroller = page.locator('.pane-notebook .nb-scroll, .pane-notebook .nb-editor, .pane-notebook').first();
  const scrolled = () => page.evaluate(() => [...document.querySelectorAll('*')].reduce((n, e) => n + (e as HTMLElement).scrollTop, 0));
  const before = await scrolled();
  await block.locator('.sv-dot[data-v="11"]').click();
  const card = block.locator('.sv-dotcard');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Seed note (synthetic).');
  expect(await scrolled()).toBe(before);
  void scroller;
  // switched back, the fence holds the reference and the switch only
  await block.getByRole('button', { name: 'Just the text' }).click();
  await expect.poll(() => calls.some(c => c.endsWith('-no-marks.json'))).toBe(true);
  // the verse is the database's
  await expect(block.locator('.sv-t').first()).toContainText(num25.verses['10'].text.slice(0, 20));
});

test('a margin note shown in a page is one jot block holding the note', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  await notebookRoutes(page);
  await openMarksPage(page);
  const jot = page.locator('.nb-jotblock');
  await expect(jot.locator('.nbj-text')).toHaveText('Seed note (synthetic).');
  await expect(jot.locator('.nbj-head')).toContainText('From the margin at Numbers 25:11');
});

test('Margin notes in the Library: a folded row, books then chapters with counts, a note under its verse’s first words, a click opens the reader with its margin, Back keeps the row', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  const list = fx('margin-list');
  await notebookRoutes(page, { 'notebook-sidebar-at-num-24.json': fx('notebook-sidebar-at-num-25') });
  await page.goto('/?at=NUM.24');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
  const row = page.locator('.mgl');
  await expect(row).toBeVisible();
  await expect(row.locator('.mgl-sum')).toContainText('Margin notes');
  await expect(row.locator('.mgl-sum .nb-count')).toHaveText(String(list.total));
  await expect(row).not.toHaveAttribute('open', '');
  await row.locator('.mgl-sum').click();
  const book = row.locator('.mgl-book[data-code="NUM"]');
  await expect(book.locator('summary').first()).toHaveText(`Numbers · ${list.books[0].count}`);
  await book.locator('summary').first().click();
  const chapter = book.locator('.mgl-chapter[data-chapter="25"]');
  await expect(chapter.locator('summary')).toContainText('Numbers 25 ·');
  await chapter.locator('summary').click();
  const note = chapter.locator('.mgl-note').filter({ hasText: 'First margin note' });
  await expect(note.locator('.mgl-verse')).toHaveText(new RegExp('^' + num25.verses['11'].text.split(' ')[0]));
  // a margin note is never dragged into a folder or pinned
  expect(await note.getAttribute('draggable')).toBeNull();
  await note.click();
  await expect(page.locator('.mg-panel')).toBeVisible();
  await expect(page.locator('.ch-title')).toContainText('Numbers 25');
  // Back returns to where the reader was, and the row is still where it was
  await page.evaluate(() => (window as any).__wb.run('back'));
  await expect(page.locator('.ch-title')).toContainText('Numbers 24');
  await expect(chapter.locator('.mgl-note').filter({ hasText: 'First margin note' })).toBeVisible();
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
  await expect(menu.locator('.menu-item')).toHaveCount(6);
  const names = await menu.locator('.menu-item').allTextContents();
  expect(names.map(n => n.split(' ·')[0])).toEqual(['Everything', 'Pages', 'Saves', 'Questions', 'Margin notes', 'Highlights']);
  const all = fx('find-sort-edited');
  const margin = all.groups.find((g: any) => g.kind === 'margin').count;
  expect(names[4]).toBe(`Margin notes · ${margin}`);
  await menu.locator('[data-kind="margin"]').click();
  await expect(kind).toHaveText('Margin notes ▾');
  await expect(page.locator('.nb-kind-line')).toHaveText(new RegExp(`^Margin notes · ${margin}`));
  await expect(page.locator('.nb-kind-results .nb-item')).toHaveCount(margin);
  await expect(page.locator('.pane-notebook .chip, .pane-notebook .nb-kind-list')).toHaveCount(0);
});
