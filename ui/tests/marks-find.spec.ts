import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { notebookRoutes, openMarksPage } from './notebook-fixtures';
import { shotPath } from '../../scripts/shots.mjs';

// Finding marks (design/features/marks T12: rows 51, 52, 53). The UI runs without Rust here: every `wb` answer is the one `wb`
// gave on the generated study (npm run fixtures), named as the command is (`find --kind mark --book Numbers` is
// `find-kind-mark-book-numbers`). No scripture is typed in this file: the words are read from those answers.
const fx = (name: string) => JSON.parse(readFileSync(new URL(`../public/fixtures/wb/${name}.json`, import.meta.url), 'utf8'));
const marksAll = fx('find-kind-mark').groups[0].results as any[];
const margin = fx('find-kind-margin').groups[0].results as any[];
const atEleven = fx('mark-at-num-25-11');

const drawnAt = (page: Page) => page.evaluate(() => (window as any).__wb.drawn.chapter.code + (window as any).__wb.drawn.chapter.chapter);

/** The Notebook at its search, the reader at Numbers 24 (so a result that opens Numbers 25 is seen to move it); requests are listed. */
async function openSearch(page: Page, kind: string, extra: Record<string, unknown> = {}) {
  const asked: string[] = [];
  page.on('request', r => { const m = /fixtures\/wb\/(.+)\.json/.exec(r.url()); if (m) asked.push(m[1]); });
  await notebookRoutes(page, extra);
  await page.goto('/?at=NUM.24');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
  await page.waitForSelector('.pane-notebook');
  await page.locator('.nb-kind').click();
  await page.locator(`.nb-kinds [data-kind="${kind}"]`).click();
  return asked;
}

test.beforeEach(async ({}, info) => { test.skip(info.project.name === 'webkit-phone' && !info.title.startsWith('phone:'), 'desktop'); });

test('row 51: the kinds menu has Marks (and Margin notes); Marks shows the chip row and every mark with its words and reference', async ({ page }) => {
  await openSearch(page, 'mark');
  await expect(page.locator('.nb-kind')).toHaveText('Marks ▾');
  const rows = page.locator('.nb-marks .nb-mrow');
  await expect(rows).toHaveCount(marksAll.length);
  await expect(page.locator('.nb-kind-line')).toHaveText(new RegExp(`^Marks · ${marksAll.length}`));
  // the reference and the words are what `wb find --kind mark` said; the words come from the database
  for (const [i, m] of marksAll.entries()) {
    await expect(rows.nth(i).locator('.nb-item-title')).toHaveText(m.title);
    if (m.snippet) await expect(rows.nth(i).locator('.nb-mwords')).toHaveText(`“${m.snippet}”`);
    await expect(rows.nth(i).locator('.mb-sample')).toHaveCount(1);
    await expect(rows.nth(i).locator('.nb-mlegend')).toHaveText(m.legend);
  }
  // the old highlight is among them, with its words
  expect(marksAll.some(m => m.old && m.snippet)).toBe(true);
  // the T12 controls are retired into the one chip row (filters-v2 rows 26 and 27, NB17: `highlights_chips` in lists-chips.spec.ts)
  await expect(page.locator('.nb-kind-chips').getByRole('button', { name: 'Add filter' })).toBeVisible();
  await expect(page.locator('.nb-mfilters')).toHaveCount(0);
  await page.locator('.pane-notebook').screenshot({ path: shotPath('design/features/marks/build/t12.png') });
});

test('row 51: a click on a mark opens the reader there, and Back returns it', async ({ page }) => {
  await openSearch(page, 'mark');
  expect(await drawnAt(page)).toBe('NUM24');
  const m = marksAll[0];
  await page.locator(`.nb-mrow[data-id="${m.id}"]`).click();
  await expect.poll(() => drawnAt(page)).toBe(`${m.code}${m.chapter}`);
  await expect(page.locator('.nb-mlist')).toBeVisible();   // the results stay
  const back = page.locator('.nb-return');
  await expect(back).toHaveText('Back to Numbers 24:1');
  await back.click();
  await expect.poll(() => drawnAt(page)).toBe('NUM24');
  await expect(back).toHaveCount(0);
});

test('row 52: Margin notes is a kind; a result opens the reader at that chapter with the margin showing that note, and Back returns', async ({ page }) => {
  await openSearch(page, 'margin', { 'mark-notes-numbers-25.json': fx('mark-notes-numbers-25') });
  await expect(page.locator('.nb-kind')).toHaveText('Margin notes ▾');
  const rows = page.locator('.nb-kind-results .nb-item');
  await expect(rows).toHaveCount(margin.length);
  await expect(page.locator('.nb-kind-line')).toHaveText(new RegExp(`^Margin notes · ${margin.length}`));
  for (const [i, n] of margin.entries()) {
    await expect(rows.nth(i).locator('.nb-item-title')).toHaveText(n.title);
    await expect(rows.nth(i).locator('.nb-item-preview')).toHaveText(n.snippet);
  }
  const verse = margin.find(n => n.at === 'NUM.25:11')!;
  expect(await drawnAt(page)).toBe('NUM24');
  await rows.filter({ has: page.locator(`xpath=self::*[@data-id="${verse.id}"]`) }).first().click();
  await expect.poll(() => drawnAt(page)).toBe('NUM25');
  // the note is on show: its card in the open column, or its popover when the margin is signs
  await expect(page.locator(`.mg-card[data-note="${verse.id}"]`)).toBeVisible();
  await expect(page.locator(`.mg-card[data-note="${verse.id}"] .mg-text`)).toContainText(verse.snippet);
  const back = page.locator('.nb-return');
  await expect(back).toHaveText('Back to Numbers 24:1');
  await back.click();
  await expect.poll(() => drawnAt(page)).toBe('NUM24');
});

test('row 52: the Everything search lists a margin group beside the pages', async ({ page }) => {
  await openSearch(page, 'mark');
  await page.locator('.nb-kind').click();
  await expect(page.locator('.nb-kinds .menu-item')).toHaveCount(7);
  const names = (await page.locator('.nb-kinds .menu-item').allTextContents()).map(n => n.split(' ·')[0]);
  expect(names).toEqual(['Everything', 'Pages', 'Saves', 'Questions', 'Margin notes', 'Highlights', 'Marks']);
  const all = fx('find-sort-edited');
  const g = all.groups.find((x: any) => x.kind === 'margin');
  expect(g.count).toBe(margin.length);
  await expect(page.locator('.nb-kinds [data-kind="margin"]')).toHaveText(`Margin notes · ${g.count}`);
});

// ---- row 53: a verse's card lists its marks and the margin notes covering it ---------------------------------------------------

test('row 53: a page\'s scripture block opens the verse\'s card from the verse number, listing every mark and margin note on it', async ({ page }) => {
  await openMarksPage(page, true);
  await page.route('**/fixtures/wb/scripture-numbers-25-11.json', r => r.fulfill({ json: fx('scripture-num-25-11') }));
  await page.route('**/fixtures/wb/mark-notes-numbers-25.json', r => r.fulfill({ json: fx('mark-notes-numbers-25') }));
  const block = page.locator('.sv-block');
  await expect(block.locator('.sv-vn').first()).toBeVisible();
  await block.locator('.sv-vn', { hasText: /^11$/ }).click();
  const card = page.locator('.verse-card');
  await expect(card).toBeVisible();
  const section = card.locator('.vm');
  await expect(section).toBeVisible();
  await expect(section.locator('.vm-mark')).toHaveCount(atEleven.marks.length);
  await expect(section.locator('.vm-note')).toHaveCount(atEleven.notes.length);
  expect(atEleven.marks.length).toBeGreaterThan(1);
  expect(atEleven.notes.length).toBe(2);   // the verse's own note and the span's
  await expect(section.locator('.vm-mark').first().locator('.vm-legend')).toHaveText(atEleven.marks[0].legend);
  await expect(section.locator('.vm-note').first().locator('.vm-text')).toHaveText(atEleven.notes[0].text);
  // a note opens the reader at its chapter with the margin showing it
  await page.locator('.verse-card .vm-note').first().click();
  await expect(page.locator(`.mg-card[data-note="${atEleven.notes[0].id}"]`)).toBeVisible();
});

test('row 53: a verse with no mark and no margin note has no such section in its card', async ({ page }) => {
  await openMarksPage(page, true);
  const empty = fx('mark-at-num-25-13');
  expect([empty.marks.length, empty.notes.length]).toEqual([0, 0]);
  const shown = await page.evaluate(async () => {
    const m = await import('/src/versemarks.ts');
    const box = m.marksOnVerse('NUM.25:13');
    document.body.append(box);
    await new Promise(r => setTimeout(r, 300));
    const hidden = box.hidden;
    box.remove();
    return !hidden;
  });
  expect(shown).toBe(false);
});

test('row 53: in the reader, hovering a verse number shows its marks and margin notes in the card', async ({ page }) => {
  await notebookRoutes(page);
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.evaluate(() => { document.documentElement.dataset.hover = 'on'; });
  const vn = page.locator('#reader .vn[data-v="11"]');
  await vn.scrollIntoViewIfNeeded();
  const b = (await vn.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  const card = page.locator('.hovercard');
  await expect(card).toBeVisible();
  await expect(card.locator('.vm .vm-mark')).toHaveCount(atEleven.marks.length);
  await expect(card.locator('.vm .vm-note')).toHaveCount(atEleven.notes.length);
});

test('phone: tapping a verse number opens the verse card with its marks and margin notes', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-phone', 'phone');
  await notebookRoutes(page);
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  const vn = page.locator('.vn[data-v="11"]');
  await vn.scrollIntoViewIfNeeded();
  const b = (await vn.boundingBox())!;
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  const sheet = page.locator('.sheet');
  await expect(sheet.locator('.sheet-title')).toHaveText('Numbers 25:11');
  await expect(sheet.locator('.vm .vm-mark')).toHaveCount(atEleven.marks.length);
  await expect(sheet.locator('.vm .vm-note')).toHaveCount(atEleven.notes.length);
});
