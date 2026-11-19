import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Selecting a verse or a span, Add to…, Open as a tab, Ctrl+1 to Ctrl+9, Copy, the right-click menu and the phone's ⋯
// (design/features/marks T7 and T7b: rows 2, 3, 11, 12, 23 and 64 to 70). The UI runs without Rust here, so every `wb` call
// is answered by this test's route, which records the command's name (the argv as the fixture name). The words are the
// reader's, drawn from the generated fixture chapter; no scripture is typed in this file.
const legend = JSON.parse(readFileSync(new URL('../public/fixtures/wb/legend.json', import.meta.url), 'utf8'));
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

interface Run { calls: string[] }

async function ready(page: Page, opts: { legend?: unknown } = {}): Promise<Run> {
  const run: Run = { calls: [] };
  // the clipboard is the test's: what Copy writes is kept in window.__copied
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => { (window as any).__copied = t; } } });
  });
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').pop()!.replace(/\.json$/, '');
    if (name === 'legend' && opts.legend) return route.fulfill({ json: opts.legend });
    if (name === 'thread-list') return route.fulfill({ json: [{ id: 'th1', name: 'Fixture folder', color: 'green', count: 2 }] });
    if (/^(mark-add|thread-add|save|block-add|legend-add)-/.test(name)) {
      run.calls.push(name);
      if (name.startsWith('mark-add-')) {
        const st = /-style-(.+)$/.exec(name);
        const e = st && legend.entries.find((x: any) => slug(x.label) === st[1]);
        return route.fulfill({ json: { id: `m_made${run.calls.length}`, kind: e ? e.kind : 'highlight', color: e ? e.color : 'yellow', at: 'x', created: '2026-11-19T10:00:00Z' } });
      }
      return route.fulfill({ json: {} });
    }
    return route.fallback();
  });
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  return run;
}

const bar = (page: Page) => page.locator('.markbar');
const ctx = (page: Page) => page.locator('.mb-ctx');
const desktopOnly = (info: { project: { name: string } }) => test.skip(info.project.name !== 'webkit-desktop', 'a desktop row');
const phoneOnly = (info: { project: { name: string } }) => test.skip(info.project.name !== 'webkit-phone', 'a phone row');

/** The verse number's element, scrolled into view. */
async function vn(page: Page, v: number) {
  const el = page.locator(`#reader .vn[data-v="${v}"]`);
  await el.scrollIntoViewIfNeeded();
  return el;
}

/** The words of the selection, as the reader draws them. */
const selectedWords = (page: Page) => page.evaluate(() => { const d = (window as any).__wb.drawn, s = (window as any).__wb.selector.sel; return s ? d.text.slice(s.a, s.b + 1).join(' ') : ''; });
const selectedVerses = (page: Page) => page.evaluate(() => { const d = (window as any).__wb.drawn, s = (window as any).__wb.selector.sel; return s ? [...new Set<number>(d.v.slice(s.a, s.b + 1))] : []; });
const wordCount = (page: Page, v: number) => page.evaluate(v => (window as any).__wb.drawn.v.filter((x: number) => x === v).length, v);

/** Selects words 2..5 of verse 11 with the mouse. */
async function dragWords(page: Page, v = 11, a = 2, b = 5) {
  const box = async (i: number) => {
    const k = await page.evaluate(([v, i]) => { const d = (window as any).__wb.drawn; return d.v.findIndex((vv: number, k: number) => vv === v && d.i[k] === i); }, [v, i]);
    const el = page.locator(`#reader .w[data-k="${k}"]`);
    await el.scrollIntoViewIfNeeded();
    return (await el.boundingBox())!;
  };
  const x = await box(a), y = await box(b);
  await page.mouse.move(x.x + 3, x.y + x.height / 2);
  await page.mouse.down();
  await page.mouse.move(y.x + y.width - 3, y.y + y.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(bar(page)).toBeVisible();
}

/** The bar's Highlight drop-down, then the named row. */
async function applyStyle(page: Page, name: string) {
  await bar(page).locator('.mb-highlight').click();
  await bar(page).locator('.mb-menu .mb-row', { hasText: name }).click();
}

test('row 2: a click on a verse number selects the whole verse, like a browser selection with no handles, and the bar appears above it', async ({ page }, info) => {
  desktopOnly(info);
  const run = await ready(page);
  await (await vn(page, 11)).click();
  await expect(bar(page)).toBeVisible();
  expect(await selectedVerses(page)).toEqual([11]);
  await expect(page.locator('#reader .w.sel')).toHaveCount(await wordCount(page, 11));
  await expect(page.locator('#reader .handle:not([hidden])')).toHaveCount(0);
  const sel = (await page.locator('#reader .w.sel').first().boundingBox())!, b = (await bar(page).boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(sel.y + 1);
  // clicking another verse number moves the selection to that verse
  await (await vn(page, 12)).click();
  expect(await selectedVerses(page)).toEqual([12]);
  // the bar's mark is the whole verse
  await applyStyle(page, 'Fixture promise');
  await expect.poll(() => run.calls).toEqual(['mark-add-num-25-12-style-fixture-promise']);
});

test('row 2 (phone): a tap on a verse number still opens the verse card, with Note, Question, Thread and Copy', async ({ page }, info) => {
  phoneOnly(info);
  await ready(page);
  await (await vn(page, 11)).tap();
  await expect(page.locator('.sheet .verse-view')).toBeVisible();
  await expect(page.locator('.sheet .acts .act')).toContainText(['Note', 'Question', 'Thread', 'Copy']);
  await expect(bar(page)).toHaveCount(0);
});

test('row 3: a click on a verse number then a shift-click on another selects the span between, the bar for it', async ({ page }, info) => {
  desktopOnly(info);
  const run = await ready(page);
  await (await vn(page, 11)).click();
  await (await vn(page, 13)).click({ modifiers: ['Shift'] });
  await expect(bar(page)).toBeVisible();
  expect(await selectedVerses(page)).toEqual([11, 12, 13]);
  await expect(page.locator('#reader .handle:not([hidden])')).toHaveCount(0);
  await applyStyle(page, 'Fixture promise');
  await expect.poll(() => run.calls).toEqual(['mark-add-num-25-11-25-13-style-fixture-promise']);
  // the span the other way round is the same span
  await (await vn(page, 13)).click();
  await (await vn(page, 11)).click({ modifiers: ['Shift'] });
  expect(await selectedVerses(page)).toEqual([11, 12, 13]);
});

test('row 3: the span may cross a chapter of the same book', async ({ page }, info) => {
  desktopOnly(info);
  const run = await ready(page);
  await (await vn(page, 18)).click();
  await page.evaluate(() => (window as any).__wb.open('NUM', 26, 1));
  await page.waitForFunction(() => (window as any).__wb.drawn?.chapter.chapter === 26);
  await (await vn(page, 1)).click({ modifiers: ['Shift'] });
  await expect(bar(page)).toBeVisible();
  expect(await selectedVerses(page)).toEqual([1]);
  await applyStyle(page, 'Fixture promise');
  await expect.poll(() => run.calls).toEqual(['mark-add-num-25-18-26-1-style-fixture-promise']);
});

test('row 11: Add to… offers a page, a folder or a save, each by the commands the reader already has', async ({ page }, info) => {
  desktopOnly(info);
  const run = await ready(page);
  await (await vn(page, 11)).click();
  const choices = () => page.locator('.add-to .menu-item');
  await bar(page).locator('.mb-add').click();
  await expect(choices()).toHaveText(['A page…', 'A folder…', 'A save (the Shelf)']);
  // a save: wb save <place>
  await page.locator('.add-to [data-act="save"]').click();
  await expect.poll(() => run.calls).toEqual(['save-num-25-11']);
  // a folder: the folder chooser, then wb thread add
  await (await vn(page, 11)).click();
  await bar(page).locator('.mb-add').click();
  await page.locator('.add-to [data-act="folder"]').click();
  await page.locator('.chooser-row', { hasText: 'Fixture folder' }).click();
  await expect.poll(() => run.calls).toEqual(['save-num-25-11', 'thread-add-fixture-folder-num-25-11']);
  // a page: the page list, then a scripture block in it (wb block add)
  await (await vn(page, 11)).click();
  await bar(page).locator('.mb-add').click();
  await page.locator('.add-to [data-act="page"]').click();
  await page.locator('.chooser-row', { hasText: 'Marks page' }).click();
  await expect.poll(() => run.calls.length).toBe(3);
  expect(run.calls[2]).toMatch(/^block-add-n-\d+-[0-9a-f]+-scripture-numbers-25-11$/);
});

test('row 12 and 65: Open as a tab opens the selection in a new reader tab, a step on the trail, and the reader keeps its place', async ({ page }, info) => {
  desktopOnly(info);
  await ready(page);
  await page.route('**/fixtures/wb/text-num-25-11-version-kjv-json.json', r => r.fulfill({ json: { verses: [{ book: 'Numbers', c: 25, v: 11 }] } }));
  await (await vn(page, 11)).click();
  const steps = await page.locator('#trailline .trail-step').count();
  await expect(bar(page).locator('.mb-tab')).toHaveAttribute('title', 'Open as a tab');
  await bar(page).locator('.mb-tab').click();
  await expect(page.locator('.pane-reader2 .reader2 .vn-asked[data-v="11"]')).toBeAttached();
  await expect(page.locator('#trailline .trail-step')).toHaveCount(steps + 1);
  // the reader itself did not move
  expect(await page.evaluate(() => (window as any).__wb.drawn.chapter.chapter)).toBe(25);
  await expect(bar(page)).toHaveCount(0);
});

test('row 23: with words selected, Ctrl+1 to Ctrl+9 apply the legend entry that holds that key', async ({ page }, info) => {
  desktopOnly(info);
  const withKeys = { ...legend, entries: legend.entries.map((e: any) => e.label === 'Fixture box' ? { ...e, key: 'Ctrl+7' } : e.label === 'Fixture later' ? { ...e, key: 'Ctrl+2' } : e) };
  const run = await ready(page, { legend: withKeys });
  await dragWords(page);
  await page.keyboard.press('Control+7');
  await expect.poll(() => run.calls.length).toBe(1);
  expect(run.calls[0]).toMatch(/^mark-add-num-25-11-2-25-11-5-style-fixture-box$/);
  await expect(bar(page)).toHaveCount(0);
  // a key no entry holds does nothing
  await dragWords(page);
  await page.keyboard.press('Control+5');
  await page.waitForTimeout(150);
  expect(run.calls).toHaveLength(1);
  await expect(bar(page)).toBeVisible();
  await page.keyboard.press('Control+2');
  await expect.poll(() => run.calls.length).toBe(2);
  expect(run.calls[1]).toMatch(/style-fixture-later$/);
});

test('row 64: Copy and Open as a tab follow Add to…, each named on hover; Copy writes the words with their reference and says Copied', async ({ page }, info) => {
  desktopOnly(info);
  await ready(page);
  await dragWords(page);
  const titles = await bar(page).locator('button').evaluateAll(els => els.map(e => e.getAttribute('title')));
  expect(titles.slice(-3)).toEqual(['Add to…', 'Copy', 'Open as a tab']);
  expect(titles).toHaveLength(10);
  const words = await selectedWords(page);
  await bar(page).locator('.mb-copy').click();
  await expect(bar(page).locator('.mb-flash')).toHaveText('Copied');
  await expect(bar(page)).toBeVisible();
  expect(await page.evaluate(() => (window as any).__copied)).toBe(`${words} (Numbers 25:11 KJV)`);
  expect(words.split(' ').length).toBeGreaterThan(2);
  await expect(bar(page).locator('.mb-flash')).toHaveCount(0, { timeout: 4000 });
  // the words are those on the page, never typed here
  const shown = await page.locator('#reader .w.sel').evaluateAll(els => els.map(e => (e.textContent || '').trim()).join(' '));
  expect(shown.replace(/\s+/g, ' ')).toContain(words.split(' ')[0]);
});

test('row 66: right-click on a selection opens a menu beside the pointer with the six kinds, Legend…, Add to…, Copy and Open as a tab, each with its key; the bar hides', async ({ page }, info) => {
  desktopOnly(info);
  await ready(page);
  await dragWords(page);
  const w = (await page.locator('#reader .w.sel').nth(1).boundingBox())!;
  const at = { x: w.x + w.width / 2, y: w.y + w.height / 2 };
  await page.mouse.click(at.x, at.y, { button: 'right' });
  await expect(ctx(page)).toBeVisible();
  const rows = await ctx(page).locator('.mb-crow').evaluateAll(els => els.map(e => ({ name: e.querySelector('.mb-name')!.textContent, key: e.querySelector('.mb-key')?.textContent ?? '' })));
  expect(rows).toEqual([
    { name: 'Highlight', key: 'H' }, { name: 'Underline', key: 'U' }, { name: 'Circle', key: 'C' }, { name: 'Box', key: 'B' },
    { name: 'Arrow', key: 'A' }, { name: 'Margin note', key: 'N' }, { name: 'Legend…', key: '' }, { name: 'Add to…', key: '' },
    { name: 'Copy', key: 'Ctrl+C' }, { name: 'Open as a tab', key: '' },
  ]);
  const m = (await ctx(page).boundingBox())!;
  expect(Math.abs(m.x - at.x)).toBeLessThan(12);
  expect(m.y).toBeLessThanOrEqual(at.y + 12);   // opens at the pointer, or higher when the window's edge is near
  expect(m.y + m.height).toBeGreaterThanOrEqual(at.y - 12);
  await expect(bar(page)).toBeHidden();
  // a right-click with no selection keeps the verse menu the reader has always had
  await page.keyboard.press('Escape');
  await page.mouse.click(5, 5);
  await expect(page.locator('#reader .w.sel')).toHaveCount(0);
  await page.locator('#reader .w').nth(40).click({ button: 'right' });
  await expect(ctx(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open in a new tab', exact: true })).toBeVisible();
});

test('row 67: hovering or arrowing to a kind opens its styles as a submenu, the same rows as the bar\'s drop-down', async ({ page }, info) => {
  desktopOnly(info);
  await ready(page);
  await dragWords(page);
  await bar(page).locator('.mb-highlight').click();
  const own = await bar(page).locator('.mb-menu .mb-row').evaluateAll(els => els.map(e => ({ name: e.querySelector('.mb-name')!.textContent, n: e.querySelector('.mb-n')?.textContent })));
  await page.keyboard.press('Escape');
  await dragWords(page);
  await page.locator('#reader .w.sel').nth(1).click({ button: 'right' });
  await ctx(page).locator('[data-act="highlight"]').hover();
  const sub = ctx(page).locator('.mb-sub[data-menu="highlight"]');
  await expect(sub).toBeVisible();
  expect(await sub.locator('.mb-row').evaluateAll(els => els.map(e => ({ name: e.querySelector('.mb-name')!.textContent, n: e.querySelector('.mb-n')?.textContent })))).toEqual(own);
  await expect(sub.locator('.mb-any')).toContainText('Any color…');
  // hovering another kind swaps the submenu; Arrow has none
  await ctx(page).locator('[data-act="underline"]').hover();
  await expect(ctx(page).locator('.mb-sub[data-menu="underline"] .mb-line')).toHaveCount(3);
  await ctx(page).locator('[data-act="arrow"]').hover();
  await expect(ctx(page).locator('.mb-sub')).toHaveCount(0);
  await ctx(page).locator('[data-act="highlight"]').hover();
  await expect(sub).toBeVisible();
  if (process.env.WB_T7_SHOT) await page.screenshot({ path: process.env.WB_T7_SHOT });
});

test('row 68: a row does the bar\'s action; Esc closes the menu and makes nothing; Margin note opens an empty note', async ({ page }, info) => {
  desktopOnly(info);
  const run = await ready(page);
  await dragWords(page);
  const open = async () => { await page.locator('#reader .w.sel').nth(1).click({ button: 'right' }); await expect(ctx(page)).toBeVisible(); };
  // Esc closes the menu, makes nothing, and the selection and the bar remain
  await open();
  await page.keyboard.press('Escape');
  await expect(ctx(page)).toHaveCount(0);
  await expect(bar(page)).toBeVisible();
  await expect(page.locator('#reader .w.sel')).not.toHaveCount(0);
  expect(run.calls).toEqual([]);
  await open();
  // the arrow keys reach a kind's styles, and a number applies one, as the bar's keys do
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await expect(ctx(page).locator('.mb-sub')).toBeVisible();
  await page.keyboard.press('1');
  await expect.poll(() => run.calls).toEqual(['mark-add-num-25-11-2-25-11-5-style-fixture-promise']);
  await expect(ctx(page)).toHaveCount(0);
  await expect(bar(page)).toHaveCount(0);
  // Margin note opens an empty note in the margin and writes nothing (T10); Arrow starts choosing a target (T9, ui/tests/marks-arrows.spec.ts)
  await dragWords(page);
  await open();
  await ctx(page).locator('[data-act="note"]').click();
  await expect(ctx(page)).toHaveCount(0);
  await expect(page.locator('textarea.mg-edit')).toBeVisible();
  expect(run.calls).toHaveLength(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('textarea.mg-edit')).toHaveCount(0);
  // a style row clicked in the submenu; Copy; Open as a tab; Legend…
  await dragWords(page);
  await open();
  await ctx(page).locator('[data-act="highlight"]').hover();
  await ctx(page).locator('.mb-sub .mb-row', { hasText: 'Fixture later' }).click();
  await expect.poll(() => run.calls.length).toBe(2);
  expect(run.calls[1]).toMatch(/style-fixture-later$/);
  await dragWords(page);
  const words = await selectedWords(page);
  await open();
  await ctx(page).locator('[data-act="copy"]').click();
  await expect.poll(() => page.evaluate(() => (window as any).__copied)).toBe(`${words} (Numbers 25:11 KJV)`);
  await expect(ctx(page)).toHaveCount(0);
  await expect(bar(page)).toBeVisible();
  await open();
  await ctx(page).locator('[data-act="legend"]').click();
  await expect(bar(page).locator('.mb-menu[data-menu="legend"]')).toBeVisible();
});

test('row 69 (phone): Copy and Open as a tab sit behind a ⋯ icon at the bar\'s end, in a small sheet with 44 px rows', async ({ page }, info) => {
  phoneOnly(info);
  await ready(page);
  const x = await (async () => { const el = page.locator('#reader .w[data-k="12"]'); await el.scrollIntoViewIfNeeded(); return (await el.boundingBox())!; })();
  const touch = (type: string, px: number, py: number) => page.evaluate(([type, px, py]) => {
    const t = document.elementFromPoint(px as number, py as number)!;
    t.dispatchEvent(new PointerEvent(type as string, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: px as number, clientY: py as number, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
  }, [type, px, py]);
  await touch('pointerdown', x.x + 4, x.y + x.height / 2);
  await page.waitForTimeout(600);
  await touch('pointermove', x.x + x.width - 2, x.y + x.height / 2 + 1);
  await touch('pointerup', x.x + x.width - 2, x.y + x.height / 2 + 1);
  await expect(bar(page)).toBeVisible();
  const titles = await bar(page).locator('button').evaluateAll(els => els.map(e => e.getAttribute('title')));
  expect(titles).toEqual(['Highlight (H)', 'Underline (U)', 'Circle (C)', 'Box (B)', 'Arrow (A)', 'Margin note (N)', 'Legend', 'Add to…', 'More']);
  expect(await bar(page).locator('button').evaluateAll(els => els.every(e => e.getBoundingClientRect().height >= 44))).toBe(true);
  const bb = (await bar(page).boundingBox())!;
  expect(bb.x).toBeGreaterThanOrEqual(0);
  expect(bb.x + bb.width).toBeLessThanOrEqual(390);
  const words = await selectedWords(page);
  await bar(page).locator('.mb-more').tap();
  const menu = page.locator('.sheet [data-menu="more"]');   // a small sheet (T13)
  await expect(menu.locator('.mb-row')).toHaveText(['Copy', 'Open as a tab']);
  expect(await menu.locator('.mb-row').evaluateAll(els => els.every(e => e.getBoundingClientRect().height >= 44))).toBe(true);
  await menu.locator('.mb-row', { hasText: 'Copy' }).tap();
  expect(await page.evaluate(() => (window as any).__copied)).toMatch(/\(Numbers 25:\d+ KJV\)$/);
  expect(words.length).toBeGreaterThan(0);
  await expect(bar(page)).toBeVisible();
});

test('row 70: a selection made with the mouse has no round handles at its ends; a touch selection keeps them', async ({ page }, info) => {
  await ready(page);
  if (info.project.name === 'webkit-desktop') {
    await dragWords(page);
    await expect(page.locator('#reader .w.sel').first()).toBeVisible();
    await expect(page.locator('#reader .handle:not([hidden])')).toHaveCount(0);
    expect(await page.locator('#reader .handle').evaluateAll(els => els.every(e => (e as HTMLElement).hidden || getComputedStyle(e).display === 'none'))).toBe(true);
    return;
  }
  // a phone: press and hold, the two handles stay so the selection can be dragged longer by touch
  const el = page.locator('#reader .w[data-k="12"]');
  await el.scrollIntoViewIfNeeded();
  const x = (await el.boundingBox())!;
  const touch = (type: string, px: number, py: number) => page.evaluate(([type, px, py]) => {
    const t = document.elementFromPoint(px as number, py as number)!;
    t.dispatchEvent(new PointerEvent(type as string, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: px as number, clientY: py as number, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
  }, [type, px, py]);
  await touch('pointerdown', x.x + 4, x.y + x.height / 2);
  await page.waitForTimeout(600);
  await touch('pointerup', x.x + 4, x.y + x.height / 2);
  await expect(bar(page)).toBeVisible();
  await expect(page.locator('#reader .handle:not([hidden])')).toHaveCount(2);
});
