import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { notebookRoutes } from './notebook-fixtures';

// design/features/marks: the reader's margin (M26, M25, M27, M28, M32, M43, M44), the pencil (M14) and no dotted line (MK-2).
// The answers come from the fixtures `npm run fixtures` made with `wb` on a generated study; the verse is the database's.
const num25 = JSON.parse(readFileSync(new URL('../public/fixtures/NUM.25.json', import.meta.url), 'utf8'));
const verse11: string = num25.verses['11'].text;
const chapter = JSON.parse(readFileSync(new URL('../public/fixtures/wb/margin-num-25.json', import.meta.url), 'utf8'));
const v11 = chapter.verses.find((v: any) => v.v === 11);

async function ready(page: Page, margin = true, query = 'notebook=0') {
  await page.addInitScript(on => localStorage.setItem('wb.layers.v1', JSON.stringify({ mine: true, all: true, margin: on, hidden: [] })), margin);
  await page.goto(`/?at=NUM.25${query ? `&${query}` : ''}`);
  await page.waitForFunction(() => (window as any).__wbReady);
}

const marksPage = JSON.parse(readFileSync(new URL('../public/fixtures/wb/marks-page.json', import.meta.url), 'utf8'));
const openPane = (page: Page, key: string, side: string) => page.evaluate(([key, side]) => {
  (window as any).__wb.dock().open('test', key, key, side, (el: HTMLElement) => { el.textContent = key; });
}, [key, side]);

test('the margin beside verse 11 says its notes and pages, shows their first lines on hover and opens the verse on a click', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  expect(v11.notes).toBeGreaterThanOrEqual(2);
  await ready(page);
  const mark = page.locator('.mg-mark[data-v="11"]');
  await expect(mark).toBeVisible();
  await expect(mark).toContainText(`${v11.notes} notes`);
  await expect(mark).toContainText(`${v11.pages} pages`);
  await mark.hover();
  await expect(page.locator('.mg-pop')).toContainText('First margin note');
  await mark.click();
  const panel = page.locator('.mg-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.mg-verse')).toHaveText(verse11);
  await expect(panel.locator('.mg-note').first()).toBeVisible();
  await expect(panel.locator('.mg-count', { hasText: 'pages' })).toBeVisible();
  // the panel does not cover the verse it is about
  const vn = (await page.locator('.vn[data-v="11"]').boundingBox())!;
  const p = (await panel.boundingBox())!;
  expect(vn.y + vn.height < p.y || vn.y > p.y + p.height || vn.x + vn.width < p.x).toBeTruthy();
});

test('verse 11 with 2 notes and 3 pages says exactly "2 notes · 3 pages" (the counts the Rust test makes)', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  // the fixture study has more at verse 11; the counts of the README's example are served for this one chapter
  await page.route('**/fixtures/wb/margin-num-25.json', r => r.fulfill({ json: { ...chapter, verses: chapter.verses.map((v: any) => (v.v === 11 ? { ...v, notes: 2, pages: 3, around: 0, saves: 0 } : v)) } }));
  await ready(page);
  await expect(page.locator('.mg-mark[data-v="11"]')).toHaveText('2 notes · 3 pages');
});

test('the reading column is the same with the margin on and off', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  const measure = () => page.evaluate(() => {
    const r = document.getElementById('reader')!;
    return { w: r.getBoundingClientRect().width, h: r.scrollHeight, lines: [...r.querySelectorAll('.w')].map(e => Math.round(e.getBoundingClientRect().top)).join(',') };
  });
  await ready(page, true);
  await expect(page.locator('.mg-mark').first()).toBeVisible();
  const on = await measure();
  await ready(page, false);
  await expect(page.locator('.mg-mark')).toHaveCount(0);
  const off = await measure();
  expect(on).toEqual(off);
});

test('writing asks where, and Remember my choice stops the question', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  const calls: string[] = [];
  await page.route('**/fixtures/wb/margin-add-*', r => { calls.push(decodeURIComponent(r.request().url())); return r.fulfill({ json: { id: 'm_test', title: 'Numbers 25:11' } }); });
  await page.route('**/fixtures/wb/settings-margin-write-choice-*', r => r.fulfill({ json: { write_choice: 'margin' } }));
  await ready(page);
  await page.locator('.mg-mark[data-v="11"]').click();
  const field = page.locator('.mg-field');
  await field.fill('A thought');
  await field.press('Enter');
  await expect(page.getByRole('button', { name: 'Leave in the margin' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to a new page' })).toBeVisible();
  await expect(page.locator('.mg-remember')).toContainText('Remember my choice');
  await page.getByRole('button', { name: 'Leave in the margin' }).click();
  await expect.poll(() => calls.length).toBe(1);
  expect(calls[0]).toContain('margin-add-num-25-11-a-thought');
});

test('Add to a new page makes the page and opens it; with Remember my choice set, Enter writes without asking', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  const calls: string[] = [];
  await notebookRoutes(page);
  await page.route('**/fixtures/wb/margin-add-*', r => { calls.push(decodeURIComponent(r.request().url())); return r.fulfill({ json: { id: marksPage.id, title: 'Marks page' } }); });
  await page.route('**/fixtures/wb/settings-margin-write-choice-*', r => r.fulfill({ json: { write_choice: 'page' } }));
  await ready(page);
  await page.locator('.mg-mark[data-v="11"]').click();
  await page.locator('.mg-field').fill('A thought for a page');
  await page.locator('.mg-field').press('Enter');
  await page.locator('.mg-remember input').check();
  await page.getByRole('button', { name: 'Add to a new page' }).click();
  await expect.poll(() => calls.length).toBe(1);
  expect(calls[0]).toContain('margin-add-num-25-11-a-thought-for-a-page-page');
  await expect(page.locator('.pane-notebook')).toContainText('Marks page');
  // the choice is set: Enter writes at once, and nothing is asked
  await page.route('**/fixtures/wb/settings-margin.json', r => r.fulfill({ json: { write_choice: 'margin' } }));
  await page.locator('.mg-mark[data-v="11"], .mg-dot[data-v="11"]').first().click();
  await page.locator('.mg-field').fill('Straight in');
  await page.locator('.mg-field').press('Enter');
  await expect.poll(() => calls.length).toBe(2);
  expect(calls[1]).toContain('margin-add-num-25-11-straight-in');
  await expect(page.locator('.mg-ask')).toBeHidden();
});

test('a margin note has four choices in its menu and nothing else, and a long note shows no prompt', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  await ready(page);
  await page.locator('.mg-mark[data-v="11"]').click();
  await page.locator('.mg-more').first().click();
  const items = page.locator('.menu .menu-item');
  await expect(items).toHaveText(['Grow into a page', 'Add to a page…', 'Make it a question', 'Delete']);
  await page.keyboard.press('Escape');
  await expect(page.locator('.mg-panel')).not.toContainText('Getting long');
});

test('Delete offers Undo, and Undo restores the note', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  const calls: string[] = [];
  await page.route('**/fixtures/wb/margin-rm-*', r => { calls.push('rm'); return r.fulfill({ json: { removed: 'x' } }); });
  await page.route('**/fixtures/wb/margin-restore-*', r => { calls.push('restore'); return r.fulfill({ json: { id: 'x' } }); });
  await ready(page);
  await page.locator('.mg-mark[data-v="11"]').click();
  await page.locator('.mg-more').first().click();
  await page.locator('.menu .menu-item', { hasText: 'Delete' }).click();
  await expect(page.locator('.toast-undo')).toContainText('Margin note deleted');
  await page.locator('.toast-undo button', { hasText: 'Undo' }).click();
  await expect.poll(() => calls).toEqual(['rm', 'restore']);
});

test('a passage shows a bracket and a chapter note sits at the top', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  await ready(page);
  await expect(page.locator('.mg-bracket')).toHaveCount(1);
  await expect(page.locator('.mg-mark.mg-top')).toContainText('1 note on the chapter');
});

test('at 390 px the marks fold to one mark at the verse number and the margin is a sheet', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-phone', 'phone');
  await ready(page);
  const dot = page.locator('.mg-dot[data-v="11"]');
  await expect(dot).toHaveCount(1);
  await expect(page.locator('.mg-mark:not(.mg-top)')).toHaveCount(0);
  await dot.tap();
  const panel = page.locator('.mg-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveClass(/mg-sheet/);
  const b = (await panel.boundingBox())!;
  expect(Math.round(b.y + b.height)).toBe(await page.evaluate(() => window.innerHeight));
  await expect(page.locator('.mg-field')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  // the sheet holds the field and the two choices, inside the screen
  await page.locator('.mg-field').fill('A thought');
  await page.locator('.mg-field').press('Enter');
  for (const name of ['Leave in the margin', 'Add to a new page']) {
    const bb = (await page.getByRole('button', { name }).boundingBox())!;
    expect(bb.x).toBeGreaterThanOrEqual(0);
    expect(bb.x + bb.width).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
    expect(bb.y + bb.height).toBeLessThanOrEqual(await page.evaluate(() => window.innerHeight));
  }
});

test('the pencil is one line under a run, U again removes it, and no dotted line is drawn', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  await ready(page);
  const box = async (v: number, i: number) => {
    const k = await page.evaluate(([v, i]) => { const d = (window as any).__wb.drawn; return d.v.findIndex((vv: number, k: number) => vv === v && d.i[k] === i); }, [v, i]);
    return (await page.locator(`.w[data-k="${k}"]`).boundingBox())!;
  };
  const a = await box(7, 2), b = await box(7, 5);
  await page.mouse.move(a.x + 3, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width - 3, b.y + b.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator('.colorbar')).toBeVisible();
  await page.keyboard.press('u');
  const pencilled = page.locator('.w.pencil');
  await expect(pencilled).toHaveCount(4);
  // the line runs through the spaces between the words too
  expect(await page.locator('.g').evaluateAll(gs => gs.filter(g => (g as HTMLElement).style.backgroundImage.includes('--pencil')).length)).toBe(3);
  // again: select the same words and press U
  await page.mouse.move(a.x + 3, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width - 3, b.y + b.height / 2, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.press('u');
  await expect(page.locator('.w.pencil')).toHaveCount(0);
  // nothing in the reader is underlined with a dotted line
  expect(await page.locator('.w').evaluateAll(ws => ws.some(w => getComputedStyle(w).textDecorationStyle === 'dotted'))).toBe(false);
});

test('a wrapped run is one line under the whole run, broken only where the text line breaks, and a saved phrase keeps its own line beneath', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  await page.setViewportSize({ width: 620, height: 800 });
  // a saved phrase over all of verse 12 in a coloured folder: the colour is the folder's, drawn under the words
  const withPhrase = JSON.parse(JSON.stringify(num25));
  withPhrase.reader.marks.threads.push({ kind: 'phrase', code: 'NUM', c1: 25, v1: 12, i1: 0, c2: 25, v2: 12, i2: 99, id: 'fixture-phrase', color: '#336699' });
  withPhrase.reader.marks.thread_names['fixture-phrase'] = 'Fixture folder';
  await page.route('**/fixtures/NUM.25.json', r => r.fulfill({ json: withPhrase }));
  await ready(page);
  // verse 12 holds the fixture thread's saved phrase (its colour is drawn by threads); select all its words and pencil them
  const all12 = await page.evaluate(() => { const d = (window as any).__wb.drawn; const ks: number[] = []; d.v.forEach((v: number, k: number) => { if (v === 12) ks.push(k); }); return ks; });
  expect(all12.length).toBeGreaterThan(8);
  const idx = all12.slice(1, -1);   // the words the drag covers
  await page.locator(`.w[data-k="${idx[0]}"]`).scrollIntoViewIfNeeded();
  const a = (await page.locator(`.w[data-k="${idx[0]}"]`).boundingBox())!;
  const z = (await page.locator(`.w[data-k="${idx[idx.length - 1]}"]`).boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(z.x + z.width / 2, z.y + z.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('.colorbar')).toBeVisible();
  await page.keyboard.press('u');
  await expect(page.locator('.w.pencil').first()).toBeVisible();
  const rows = await page.evaluate(ks => ks.map(k => { const w = document.querySelector<HTMLElement>(`.w[data-k="${k}"]`)!; const g = document.querySelector<HTMLElement>(`.g[data-k="${k}"]`); return { top: Math.round(w.getBoundingClientRect().top), pen: w.classList.contains('pencil'), bg: w.style.backgroundImage, gap: g ? g.style.backgroundImage : null }; }), idx);
  expect(rows.map(r => r.pen)).toEqual(rows.map(() => true));
  expect(new Set(rows.map(r => r.top)).size).toBeGreaterThanOrEqual(2);   // the run really wraps
  // every word carries the pencil line AND the saved phrase's own line (two layers), so neither is drawn over the other
  for (const r of rows) {
    expect(r.bg.includes('--pencil')).toBe(true);
    expect((r.bg.match(/linear-gradient/g) || []).length).toBe(2);
  }
  // the line runs on through the space between two words on one line, and is not carried across a line break
  rows.forEach((r, i) => {
    if (i + 1 >= rows.length) return;
    if (rows[i + 1].top === r.top) expect(r.gap && r.gap.includes('--pencil')).toBeTruthy();
  });
});

test('among other tabs: four tabs in the study column and the verse’s margin shows the verse and the counts line with no sideways scroll', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  // one tab of four in the study column
  await page.setViewportSize({ width: 1280, height: 800 });
  await ready(page);
  // the four tabs
  for (const k of ['One', 'Two', 'Three', 'Four']) await openPane(page, k, 'left');
  await expect(page.locator('.dock-col.open .tab')).toHaveCount(4);
  expect(Math.round((await page.locator('.dock-col.open').first().boundingBox())!.width)).toBeLessThanOrEqual(500);
  await page.locator('.mg-dot[data-v="11"], .mg-mark[data-v="11"]').first().click();
  const panel = page.locator('.mg-panel');
  await expect(panel.locator('.mg-verse')).toHaveText(verse11);
  await expect(panel.locator('.mg-counts')).toBeVisible();
  expect(await panel.evaluate(p => p.scrollWidth <= p.clientWidth)).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test('floating: at 320 px the counts wrap whole and the pane does not cover the verse it is about', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  await page.setViewportSize({ width: 1000, height: 700 });
  await ready(page);
  // a pane floated beside the reader, then the margin opened
  await openPane(page, 'One', 'left');
  await page.evaluate(() => { const d = (window as any).__wb.dock(); d.move(d.find('One'), 'float'); });
  await expect(page.locator('.dock-float')).toHaveCount(1);
  for (const v of [11, 5]) {
    await page.locator(`.vn[data-v="${v}"]`).scrollIntoViewIfNeeded();
    const mark = page.locator(`.mg-mark[data-v="${v}"], .mg-dot[data-v="${v}"]`);
    if (!(await mark.count())) continue;
    await mark.first().click();
    const panel = page.locator('.mg-panel');
    await expect(panel).toBeVisible();
    const p = (await panel.boundingBox())!;
    expect(Math.round(p.width)).toBe(320);
    expect(await panel.evaluate(e => e.scrollWidth <= e.clientWidth)).toBeTruthy();
    // each count is one whole piece: it never breaks across two lines
    const heights = await panel.locator('.mg-count').evaluateAll(cs => cs.map(c => c.getBoundingClientRect().height));
    expect(Math.max(...heights, 0)).toBeLessThan(24);
    const vn = (await page.locator(`.vn[data-v="${v}"]`).boundingBox())!;
    const touching = vn.y < p.y + p.height && vn.y + vn.height > p.y && vn.x < p.x + p.width && vn.x + vn.width > p.x;
    expect(touching).toBeFalsy();
    await page.locator('.mg-close').click();
  }
});
