import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { shotPath } from '../../scripts/shots.mjs';

// Arrows within a chapter (design/features/marks T9: rows 13 to 16 and 48; MK7-25). The UI runs without Rust here, so each
// `wb` call it makes is answered by the test's route and recorded by name (the argv as the fixture name). Places are word and
// verse positions of the generated chapter: no scripture is typed. Arrows are drawn with a mouse on the desktop reader; on a
// phone a tap on a verse number opens the verse's card, so these cases run on the desktop only.
const legend = JSON.parse(readFileSync(new URL('../public/fixtures/wb/legend.json', import.meta.url), 'utf8'));
const STAY = 'An arrow stays in this chapter. Links across chapters come with cross-references, later.';

interface M { id: string; kind: string; color: string; lines?: number; at: string; to?: string; created: string; legend: string; style: string; changed?: string }
interface Run { calls: string[]; at: string; to: string; marks: M[] }

const A1: M = { id: 'a1', kind: 'arrow', color: 'blue', at: 'NUM.25:11', to: 'NUM.25:12', created: '2026-11-18T10:00:00Z', legend: 'Unnamed blue arrow', style: 'arrow:blue' };
const A2: M = { id: 'a2', kind: 'arrow', color: 'orange', at: 'NUM.25:7', to: 'NUM.25:13', created: '2026-11-18T11:00:00Z', legend: 'Unnamed orange arrow', style: 'arrow:orange' };

async function ready(page: Page, opts: { legend?: unknown; marks?: M[]; lastStyle?: string } = {}): Promise<Run> {
  const run: Run = { calls: [], at: '', to: '', marks: opts.marks || [] };
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').pop()!.replace(/\.json$/, '');
    if (name === 'legend' && opts.legend) return route.fulfill({ json: opts.legend });
    if (name.startsWith('mark-add-')) {
      run.calls.push(name);
      const color = /-color-([a-z0-9]+)/.exec(name)![1];
      return route.fulfill({ json: { id: `m_arrow${run.calls.length}`, kind: 'arrow', color: /^[0-9a-f]{6}$/.test(color) ? `#${color}` : color, at: run.at, to: run.to, created: '2026-11-19T10:00:00Z' } });
    }
    if (name.startsWith('mark-style-')) {
      run.calls.push(name);
      const raw = /-color-([a-z0-9]+)/.exec(name)![1];
      const m = run.marks.find(x => name.startsWith(`mark-style-${x.id}-`))!;
      return route.fulfill({ json: { ...m, color: /^[0-9a-f]{6}$/.test(raw) ? `#${raw}` : raw, legend: undefined, style: undefined, changed: '2026-11-19T12:00:00Z' } });
    }
    if (name.startsWith('mark-show-')) { run.calls.push(name); return route.fulfill({ json: { legend: 'Unnamed arrow' } }); }
    if (name.startsWith('mark-rm-')) { run.calls.push(name); return route.fulfill({ json: { deleted: name.slice(8), trash: 'x.json', days: 7 } }); }
    if (name.startsWith('mark-restore-')) { run.calls.push(name); return route.fulfill({ json: {} }); }
    return route.fallback();
  });
  if (opts.lastStyle) await page.addInitScript(c => localStorage.setItem('wb.arrowStyle', c), opts.lastStyle);
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.evaluate(m => { const w = (window as any).__wb; w.drawn.marks.marks = m; w.repaint(); }, run.marks);
  return run;
}

async function wordBox(page: Page, v: number, i: number) {
  const k = await page.evaluate(([v, i]) => { const d = (window as any).__wb.drawn; return d.v.findIndex((vv: number, k: number) => vv === v && d.i[k] === i); }, [v, i]);
  const el = page.locator(`.w[data-k="${k}"]`);
  await el.scrollIntoViewIfNeeded();
  return (await el.boundingBox())!;
}
/** Words a..b of a verse selected by dragging. */
async function drag(page: Page, v: number, a: number, b: number) {
  const x = await wordBox(page, v, a), y = await wordBox(page, v, b);
  await page.mouse.move(x.x + 3, x.y + x.height / 2);
  await page.mouse.down();
  await page.mouse.move(y.x + y.width - 3, y.y + y.height / 2, { steps: 6 });
  await page.mouse.up();
}
async function vn(page: Page, v: number) {
  const el = page.locator(`#reader .vn[data-v="${v}"]`);
  await el.scrollIntoViewIfNeeded();
  return el;
}
const bar = (page: Page) => page.locator('.markbar:not(.arrow-bar)');
const abar = (page: Page) => page.locator('.arrow-bar');
const count = (page: Page) => page.evaluate(() => ((window as any).__wb.drawn.marks.marks || []).length);
const card = (page: Page) => page.locator('.mark-card');

/** The start: a verse's number clicked, then Arrow (the icon, the key, or the right-click menu's row). */
async function start(page: Page, run: Run, v: number, how: 'icon' | 'key' | 'menu' = 'icon') {
  run.at = `NUM.25:${v}`;
  await (await vn(page, v)).click();
  await expect(bar(page)).toBeVisible();
  if (how === 'icon') await bar(page).getByRole('button', { name: 'Arrow (A)' }).click();
  else if (how === 'key') await page.keyboard.press('a');
  else {
    const sel = (await page.locator('.w.sel').first().boundingBox())!;
    await page.mouse.click(sel.x + sel.width / 2, sel.y + sel.height / 2, { button: 'right' });
    await page.locator('.mb-ctx [data-act="arrow"]').click();
  }
  await expect(abar(page)).toBeVisible();
}

test.beforeEach(({}, info) => { test.skip(info.project.name === 'webkit-phone', 'a tap on a verse number opens its card on a phone'); });

test('row 13: Arrow (the icon, A, or the right-click menu) leaves the start outlined and shrinks the bar to "Select where it points" with Back and Cancel', async ({ page }) => {
  const run = await ready(page);
  for (const how of ['icon', 'key', 'menu'] as const) {
    await start(page, run, 11, how);
    await expect(bar(page)).toHaveCount(0);
    await expect(abar(page).locator('.ab-text')).toHaveText('Select where it points');
    expect(await abar(page).locator('button').allTextContents()).toEqual(['Back', 'Cancel']);
    // the start words stay outlined: the whole verse
    const n = await page.evaluate(() => { const d = (window as any).__wb.drawn; return d.v.filter((x: number) => x === 11).length; });
    await expect(page.locator('.w.arrow-from')).toHaveCount(n);
    expect(await page.locator('.w.arrow-from').first().evaluate(e => getComputedStyle(e).outlineStyle)).toBe('solid');
    await abar(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(abar(page)).toHaveCount(0);
  }
  expect(run.calls).toEqual([]);   // nothing was made
});

test('row 14: a verse number clicked is the target: wb mark add <from> --kind arrow --color <c> --to <ref>, the arrow drawn in the gutter, and the choice is said', async ({ page }) => {
  const run = await ready(page);
  await start(page, run, 11);
  run.to = 'NUM.25:13';
  await (await vn(page, 13)).click();
  await expect.poll(() => run.calls).toEqual(['mark-add-num-25-11-kind-arrow-color-blue-to-num-25-13']);   // no legend entry, none used before: the default ink
  await expect(page.locator('.mk-arrow')).toHaveCount(1);
  await expect(abar(page)).toHaveCount(0);
  await expect(page.locator('.toast')).toContainText('blue: the default ink');
  expect(await count(page)).toBe(1);
  // the arrow is in the gutter: left of every word, its end hit areas too
  const first = Math.min(...(await page.locator('#reader .w').evaluateAll(els => els.map(e => e.getBoundingClientRect().left))));
  const box = (await page.locator('.mk-arrow path').first().boundingBox())!;
  expect(box.x + box.width).toBeLessThan(first);
  for (const e of await page.locator('.mk-end').all()) { const b = (await e.boundingBox())!; expect(b.x + b.width).toBeLessThanOrEqual(first); }
  // the color is kept as the last arrow style used
  expect(await page.evaluate(() => localStorage.getItem('wb.arrowStyle'))).toBe('blue');
});

test('row 14: a word selection is a target too; the color is the last arrow style used, else the first arrow entry of the legend, else a default ink', async ({ page, browser }) => {
  const run = await ready(page, { lastStyle: '#cc3322' });
  await start(page, run, 7);
  run.to = 'NUM.25:12.1-25:12.3';
  await drag(page, 12, 1, 3);
  await expect.poll(() => run.calls.length).toBe(1);
  expect(run.calls[0]).toMatch(/^mark-add-num-25-7-kind-arrow-color-cc3322-to-num-25-12-1-25-12/);
  await expect(page.locator('.toast')).toContainText('#cc3322: the last arrow style used');
  await expect(page.locator('.mk-arrow')).toHaveCount(1);
  // no last style: the first arrow entry of the legend
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page2 = await ctx2.newPage();
  const run2 = await ready(page2, { legend: { entries: [...legend.entries, { kind: 'arrow', color: 'green', name: 'Pointer', label: 'Pointer', style: 'arrow:green' }], unlisted: [] } });
  await start(page2, run2, 11);
  run2.to = 'NUM.25:12';
  await (await vn(page2, 12)).click();
  await expect.poll(() => run2.calls).toEqual(['mark-add-num-25-11-kind-arrow-color-green-to-num-25-12']);
  await expect(page2.locator('.toast')).toContainText('Pointer: the first arrow style in the legend');
  await ctx2.close();
});

test('row 14: a target in the same verse makes nothing (an arrow joins two verses) and the mode stays', async ({ page }) => {
  const run = await ready(page);
  await start(page, run, 11);
  await drag(page, 11, 1, 3);
  await expect(page.locator('.toast')).toContainText('two different verses');
  await expect(abar(page)).toBeVisible();
  expect(run.calls).toEqual([]);
});

test('row 15: trying to leave the chapter (next, previous, a link, the command field) keeps the reader and says arrows stay in one chapter', async ({ page }) => {
  const run = await ready(page);
  await start(page, run, 11);
  const here = await page.locator('#place').textContent();
  for (const act of ['next', 'prev', 'link', 'search'] as const) {
    if (act === 'next') await page.locator('#next').click();
    else if (act === 'prev') await page.locator('#prev').click();
    else if (act === 'link') await page.evaluate(() => (window as any).__wb.open('NUM', 26));
    else { await page.locator('#cmd').fill('Num 26'); await page.locator('#cmd').press('Enter'); }
    await expect(abar(page).locator('.ab-text')).toHaveText(STAY);
    expect(await abar(page).locator('button:visible').allTextContents()).toEqual(['Cancel']);
    expect(await page.locator('#place').textContent()).toBe(here);
    expect(await page.evaluate(() => (window as any).__wb.drawn.chapter.chapter)).toBe(25);
    await expect(page.locator('.w.arrow-from').first()).toBeVisible();   // the start is still outlined
  }
  expect(run.calls).toEqual([]);
  // Cancel ends the mode; the reader is still where it was
  await abar(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(abar(page)).toHaveCount(0);
  await expect(page.locator('.w.arrow-from')).toHaveCount(0);
});

test('row 16: Back returns to the start selection with the bar open; Cancel and Esc end arrow mode and make nothing', async ({ page }) => {
  const run = await ready(page);
  await start(page, run, 11);
  await abar(page).getByRole('button', { name: 'Back' }).click();
  await expect(abar(page)).toHaveCount(0);
  await expect(bar(page)).toBeVisible();
  const n = await page.evaluate(() => { const d = (window as any).__wb.drawn; return d.v.filter((x: number) => x === 11).length; });
  await expect(page.locator('.w.sel')).toHaveCount(n);
  await expect(page.locator('.w.arrow-from')).toHaveCount(0);
  await expect(page.locator('#reader .vn.vsel')).toHaveCount(1);
  // the bar is whole again: a style from it is made on the same verse
  await bar(page).getByRole('button', { name: 'Arrow (A)' }).click();
  await expect(abar(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(abar(page)).toHaveCount(0);
  await expect(page.locator('.w.arrow-from')).toHaveCount(0);
  await expect(page.locator('.w.sel')).toHaveCount(0);
  // Cancel
  await start(page, run, 12);
  await abar(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(abar(page)).toHaveCount(0);
  await expect(bar(page)).toHaveCount(0);
  expect(run.calls).toEqual([]);
  expect(await count(page)).toBe(0);
});

test('row 48: a click on an arrow\'s end opens its card: its two verses, style, Change (color only) and Delete with Undo; words stay selectable', async ({ page }, info) => {
  const run = await ready(page, { marks: [A1, A2] });
  await expect(page.locator('.mk-arrow')).toHaveCount(2);
  await (await vn(page, 11)).scrollIntoViewIfNeeded();
  // the end is a hit area of its own; the layers around it take no pointer, so a drag over words still selects them
  await drag(page, 11, 2, 5);
  await expect(page.locator('.w.sel').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.w.sel')).toHaveCount(0);
  const end = page.locator('.mk-end[data-mark="a1"][data-end="to"]');
  await end.evaluate(e => e.scrollIntoView({ block: 'center' }));
  const b = (await end.boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await expect(card(page)).toBeVisible();
  const one = card(page).locator('.mc-mark');
  await expect(one).toHaveCount(1);
  await expect(one.locator('.mc-name')).toHaveText('Unnamed blue arrow');
  await expect(one.locator('.mc-verses')).toHaveText(/ 25:11 to 25:12$/);
  await expect(one.locator('.mc-sample.s-arrow')).toBeVisible();
  await expect(one.getByRole('button', { name: 'Change' })).toBeVisible();
  await expect(one.getByRole('button', { name: 'Delete' })).toBeVisible();
  await expect(page.locator('.word-card')).toHaveCount(0);
  if (info.project.name === 'webkit-desktop') {
    await page.screenshot({ path: shotPath('design/features/marks/build/t9.png') });
  }
  // Change: a color only; the arrow keeps its two verses
  await one.getByRole('button', { name: 'Change' }).click();
  const input = card(page).locator('.mc-drop .mb-any input');
  await input.fill('#d9822b');
  await input.evaluate(e => e.dispatchEvent(new Event('change', { bubbles: true })));
  await expect.poll(() => run.calls.filter(c => c.startsWith('mark-style-'))).toEqual(['mark-style-a1-color-d9822b']);
  await expect(card(page)).toHaveCount(0);
  await expect(page.locator('.mk-arrow[data-mark="a1"] path').first()).toHaveAttribute('stroke', '#d9822b');
  expect(await page.evaluate(() => (window as any).__wb.drawn.marks.marks.find((m: any) => m.id === 'a1').to)).toBe('NUM.25:12');
  // Delete, then Undo
  const end2 = page.locator('.mk-end[data-mark="a2"][data-end="from"]');
  await end2.evaluate(e => e.scrollIntoView({ block: 'center' }));
  const b2 = (await end2.boundingBox())!;
  await page.mouse.click(b2.x + b2.width / 2, b2.y + b2.height / 2);
  await expect(card(page).locator('.mc-verses')).toHaveText(/ 25:7 to 25:13$/);
  await card(page).getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('.mk-arrow')).toHaveCount(1);
  await expect(page.locator('.toast')).toContainText('Mark deleted');
  await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.mk-arrow')).toHaveCount(2);
  expect(run.calls.filter(c => /^mark-(rm|restore)-/.test(c))).toEqual(['mark-rm-a2', 'mark-restore-a2']);
});
