import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { notebookRoutes } from './notebook-fixtures';
import { shotPath } from '../../scripts/shots.mjs';

// Colors across the Bible (design/features/marks T14: rows 57 and 58). The UI runs without Rust here: every `wb marks map`
// answer is the one `wb` gave on the generated study (npm run fixtures): the whole map, one style, one folder. No scripture
// is typed in this file.
const fx = (name: string) => JSON.parse(readFileSync(new URL(`../public/fixtures/wb/${name}.json`, import.meta.url), 'utf8'));
const full = fx('marks-map');
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const STYLE = 'underline:blue:2';          // the fixture's "Fixture double"
const YELLOW = 'highlight:yellow';
const folder = full.folders[0];
const chapters = full.books.reduce((n: number, b: any) => n + b.chapters, 0);

const here = (page: Page) => page.evaluate(() => (window as any).__wb.drawn.chapter.code + (window as any).__wb.drawn.chapter.chapter);
const pane = (page: Page) => page.locator('.colormap');

async function ready(page: Page, extra: (p: Page) => Promise<void> = async () => {}) {
  const asked: string[] = [];
  page.on('request', r => { const m = /fixtures\/wb\/(.+)\.json/.exec(r.url()); if (m) asked.push(m[1]); });
  await extra(page);
  await page.goto('/?at=NUM.24');
  await page.waitForFunction(() => (window as any).__wbReady);
  return asked;
}
async function openFromLegend(page: Page) {
  await page.locator('#rail').getByRole('button', { name: 'Legend', exact: true }).click();
  await page.locator('.legend-pane .lg-colors').click();
  await expect(pane(page).locator('.cm-row')).toHaveCount(66);
}

test.beforeEach(async ({}, info) => { test.skip(info.project.name === 'webkit-phone' && !info.title.startsWith('phone:'), 'desktop'); });

test('the fixture map has every book, a style and a folder in Numbers 25', () => {
  expect(full.books).toHaveLength(66);
  expect(full.folders.length).toBeGreaterThan(0);
  const n25 = full.books.find((b: any) => b.code === 'NUM').cells[24];
  expect(n25.styles.length).toBeGreaterThan(1);
  expect(n25.folders).toHaveLength(1);
});

test('row 57: the Legend pane opens Colors across the Bible: every book a row of chapter cells, styles as small bars, a folder as a tab, the empty cells plain', async ({ page }) => {
  await ready(page);
  await openFromLegend(page);
  await expect(pane(page).locator('.cm-title')).toHaveText('Colors across the Bible');
  // every book in order, each with all its chapters
  await expect(pane(page).locator('.cm-book')).toHaveText(full.books.map((b: any) => b.name));
  for (const b of [full.books[0], full.books.find((x: any) => x.code === 'PSA')]) {
    await expect(pane(page).locator(`.cm-row[data-code="${b.code}"] .cm-cell`)).toHaveCount(b.chapters);
  }
  expect(await pane(page).locator('.cm-cell').count()).toBe(chapters);
  // Numbers 25 holds each of its styles as a bar and its folder as a tab
  const n25 = full.books.find((b: any) => b.code === 'NUM').cells[24];
  const cell = pane(page).locator('.cm-row[data-code="NUM"] .cm-cell[data-chapter="25"]');
  await expect(cell).toHaveClass(/has/);
  await expect(cell.locator('.cm-bar')).toHaveCount(n25.styles.length);
  await expect(cell.locator('.cm-tab')).toHaveCount(1);
  await expect(cell).toHaveAttribute('aria-label', new RegExp(`^Numbers 25: .*${n25.folders[0].name}`));
  // a chapter with nothing is plain, and only the chapters that hold something are marked
  const plain = pane(page).locator('.cm-row[data-code="GEN"] .cm-cell[data-chapter="1"]');
  await expect(plain).not.toHaveClass(/has/);
  await expect(plain.locator('.cm-bar, .cm-tab')).toHaveCount(0);
  await expect(pane(page).locator('.cm-cell.has')).toHaveCount(full.chapters_with);
  // the filter row: a chip for each style of the legend and each folder
  await expect(pane(page).locator('.cm-chip:not(.cm-folder) > span:last-child')).toHaveText(full.styles.map((s: any) => s.label));
  await expect(pane(page).locator('.cm-chip.cm-folder')).toHaveText(full.folders.map((f: any) => `Folder: ${f.name}`));
  await expect(pane(page).locator('.cm-chip[aria-pressed="true"]')).toHaveCount(0);
});

test('row 57: the Library search, on Marks, has Colors across the Bible', async ({ page }) => {
  await ready(page, async p => { await notebookRoutes(p, {}); });
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
  await page.waitForSelector('.pane-notebook');
  await page.locator('.nb-kind').click();
  await page.locator('.nb-kinds [data-kind="mark"]').click();
  await page.locator('.nb-colors').click();
  await expect(pane(page).locator('.cm-row')).toHaveCount(66);
});

test('row 57: a style chip fills its chapters and the empty cells are its gaps; a folder chip does the same; a pressed chip clears it', async ({ page }) => {
  const asked = await ready(page);
  await openFromLegend(page);
  const filled = pane(page).locator('.cm-cell.has');
  // one style
  await pane(page).locator(`.cm-chip[data-style="${STYLE}"]`).click();
  const one = fx(`marks-map-style-${slug(STYLE)}`);
  expect(asked).toContain(`marks-map-style-${slug(STYLE)}`);
  await expect(filled).toHaveCount(one.chapters_with);
  expect(one.chapters_with).toBeGreaterThan(0);
  await expect(pane(page).locator('.cm-cell')).toHaveCount(chapters);   // the gaps are cells too, left empty
  await expect(pane(page).locator('.cm-cell:not(.has)')).toHaveCount(chapters - one.chapters_with);
  await expect(pane(page).locator('.cm-bar, .cm-tab')).toHaveCount(0);
  await expect(pane(page).locator('.cm-sub')).toContainText(`Filter: ${one.filter.label} · ${one.total} mark`);
  await expect(pane(page).locator(`.cm-chip[data-style="${STYLE}"]`)).toHaveAttribute('aria-pressed', 'true');
  // the cell is where the fixture says, every count the same fill
  const cellOf = (code: string, c: number) => pane(page).locator(`.cm-row[data-code="${code}"] .cm-cell[data-chapter="${c}"]`);
  const first = one.books.flatMap((b: any) => b.cells.filter((c: any) => c.count).map((c: any) => [b.code, c.chapter]))[0];
  await expect(cellOf(first[0], first[1])).toHaveClass(/has/);
  await expect(cellOf('GEN', 1)).not.toHaveClass(/has/);
  await pane(page).screenshot({ path: shotPath('design/features/marks/build/t14.png') });
  // another style takes its place: one at a time
  await pane(page).locator(`.cm-chip[data-style="${YELLOW}"]`).click();
  await expect(pane(page).locator('.cm-chip[aria-pressed="true"]')).toHaveCount(1);
  await expect(filled).toHaveCount(fx(`marks-map-style-${slug(YELLOW)}`).chapters_with);
  // a folder
  await pane(page).locator(`.cm-chip[data-folder="${folder.key}"]`).click();
  const fo = fx(`marks-map-folder-${slug(folder.key)}`);
  expect(asked).toContain(`marks-map-folder-${slug(folder.key)}`);
  await expect(pane(page).locator('.cm-chip[aria-pressed="true"]')).toHaveCount(1);
  await expect(pane(page).locator(`.cm-chip[data-folder="${folder.key}"]`)).toHaveAttribute('aria-pressed', 'true');
  await expect(filled).toHaveCount(fo.chapters_with);
  await expect(pane(page).locator('.cm-sub')).toContainText(`Filter: ${folder.name}`);
  // pressed again: the whole map
  await pane(page).locator(`.cm-chip[data-folder="${folder.key}"]`).click();
  await expect(pane(page).locator('.cm-sub')).not.toContainText('Filter:');
  await expect(filled).toHaveCount(full.chapters_with);
});

test('row 58: a click on a cell opens the reader at that chapter, a gap too; Back returns', async ({ page }) => {
  await ready(page);
  await openFromLegend(page);
  await pane(page).locator(`.cm-chip[data-style="${STYLE}"]`).click();
  expect(await here(page)).toBe('NUM24');
  await pane(page).locator('.cm-row[data-code="NUM"] .cm-cell[data-chapter="25"]').click();
  await expect.poll(() => here(page)).toBe('NUM25');
  await expect(pane(page).locator('.cm-chip[aria-pressed="true"]')).toHaveCount(1);   // the view is still there, with its filter
  await pane(page).getByRole('button', { name: /^Back to Numbers 24/ }).click();
  await expect.poll(() => here(page)).toBe('NUM24');
  // a gap opens its chapter just the same
  await pane(page).locator('.cm-row[data-code="NUM"] .cm-cell[data-chapter="26"]').click();
  await expect.poll(() => here(page)).toBe('NUM26');
});

test('row 58: a style the marks panel has hidden is shown for the visit, in one line, and the panel\'s setting is not changed', async ({ page }) => {
  const asked = await ready(page);
  await page.evaluate(s => (window as any).__wb.panel.styles.add(s), STYLE);   // what the marks panel's switch does
  await openFromLegend(page);
  await pane(page).locator(`.cm-chip[data-style="${STYLE}"]`).click();
  await pane(page).locator('.cm-row[data-code="NUM"] .cm-cell[data-chapter="25"]').click();
  await expect.poll(() => here(page)).toBe('NUM25');
  await expect(page.locator('.toast')).toContainText('The marks panel had hidden this style');
  expect(asked.filter(a => a.startsWith('settings-marks-')), 'nothing was written to the panel').toEqual([]);
});

test('phone: the grid scrolls, the cells are at least 28 px, and a tap opens the chapter', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-phone', 'phone only');
  await ready(page);
  await page.locator('#more').click();
  await page.locator('.more-menu').getByRole('button', { name: /^Legend/ }).click();
  await page.locator('.legend-pane .lg-colors').click();
  await expect(pane(page).locator('.cm-row')).toHaveCount(66);
  const psa = pane(page).locator('.cm-row[data-code="PSA"] .cm-cell').first();
  const box = (await psa.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(28);
  expect(box.height).toBeGreaterThanOrEqual(28);
  const grid = pane(page).locator('.cm-grid');
  expect(await grid.evaluate(g => g.scrollWidth > g.clientWidth)).toBe(true);
  await grid.evaluate(g => { g.scrollLeft = 400; });
  expect(await grid.evaluate(g => g.scrollLeft)).toBeGreaterThan(0);
  await pane(page).locator('.cm-row[data-code="NUM"] .cm-cell[data-chapter="25"]').scrollIntoViewIfNeeded();
  await pane(page).locator('.cm-row[data-code="NUM"] .cm-cell[data-chapter="25"]').click();
  await expect.poll(() => here(page)).toBe('NUM25');
});
