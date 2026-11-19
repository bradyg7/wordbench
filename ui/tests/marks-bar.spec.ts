import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// The mark bar and its drop-down (design/features/marks T6: rows 1, 4 to 10, 20 to 22 and 24). The UI runs without Rust here,
// so every `wb` call it makes is answered by the test's route, which records the command's name (the argv as the fixture
// name: `mark-add-num-25-11-2-25-11-4-style-fixture-promise`). The legend is the fixture `wb legend` made on a generated
// study: eight entries, two of them quick. Where a mark is needed it is made from word positions; no scripture is typed.
const legend = JSON.parse(readFileSync(new URL('../public/fixtures/wb/legend.json', import.meta.url), 'utf8'));
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

interface Run { calls: string[]; at: string }

async function ready(page: Page, opts: { legend?: unknown } = {}): Promise<Run> {
  const run: Run = { calls: [], at: '' };
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').pop()!.replace(/\.json$/, '');
    if (name === 'legend' && opts.legend) return route.fulfill({ json: opts.legend });
    if (name.startsWith('mark-add-')) {
      run.calls.push(name);
      const st = /-style-(.+)$/.exec(name);
      const e = st && legend.entries.find((x: any) => slug(x.label) === st[1]);
      const kc = /-kind-([a-z]+)-color-([a-z0-9]+)/.exec(name);
      const kind = e ? e.kind : kc![1];
      const raw = e ? e.color : kc![2];
      const color = /^[0-9a-f]{6}$/.test(raw) ? `#${raw}` : raw;
      const lines = e ? e.lines : /-lines-(\d)/.exec(name)?.[1] ? +/-lines-(\d)/.exec(name)![1] : undefined;
      return route.fulfill({ json: { id: `m_made${run.calls.length}`, kind, color, ...(lines ? { lines } : {}), at: run.at, created: '2026-11-19T10:00:00Z' } });
    }
    if (name.startsWith('legend-add-')) { run.calls.push(name); return route.fulfill({ json: {} }); }
    return route.fallback();
  });
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  return run;
}

async function wordBox(page: Page, v: number, i: number) {
  const k = await page.evaluate(([v, i]) => { const d = (window as any).__wb.drawn; return d.v.findIndex((vv: number, k: number) => vv === v && d.i[k] === i); }, [v, i]);
  const el = page.locator(`.w[data-k="${k}"]`);
  await el.scrollIntoViewIfNeeded();
  return (await el.boundingBox())!;
}

/** Selects words a..b of a verse with the mouse; the anchor it stands for is kept in `run.at`. */
async function select(page: Page, run: Run, v = 11, a = 2, b = 5) {
  const x = await wordBox(page, v, a), y = await wordBox(page, v, b);
  await page.mouse.move(x.x + 3, x.y + x.height / 2);
  await page.mouse.down();
  await page.mouse.move(y.x + y.width - 3, y.y + y.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator('.markbar')).toBeVisible();
  run.at = await page.evaluate(() => { const s = (window as any).__wb.selector.sel, d = (window as any).__wb.drawn; return `${d.chapter.code}.${d.chapter.chapter}:${d.v[s.a]}.${d.i[s.a]}-${d.chapter.chapter}:${d.v[s.b]}.${d.i[s.b]}`; });
}

const markCount = (page: Page) => page.evaluate(() => (window as any).__wb.drawn.marks.marks.length);
const bar = (page: Page) => page.locator('.markbar');
const menu = (page: Page) => page.locator('.markbar .mb-menu');
const nameOf = (label: string) => slug(label);
/** The `mark add` call that a row stands for: a named entry by --style, an unnamed one by kind and color. */
const callOf = (style: string, label: string) => {
  if (!label.startsWith('Unnamed')) return `-style-${nameOf(label)}`;
  const [kind, color, lines] = style.split(':');
  return `-kind-${kind}-color-${slug(color)}${lines ? `-lines-${lines}` : ''}`;
};

/** The color picker ends with a `change` (a native picker fires `input` while it is dragged and `change` when a color is chosen); fill() sets the value and fires only `input`. */
async function pickColor(page: Page, color: string) {
  const input = menu(page).locator('.mb-any input');
  await input.fill(color);
  await input.evaluate(e => e.dispatchEvent(new Event('change', { bubbles: true })));
}

const KINDS = ['Highlight (H)', 'Underline (U)', 'Circle (C)', 'Box (B)', 'Arrow (A)', 'Margin note (N)'];

test('row 1: words selected: the bar is icons only, just above them, six kinds, the Legend and Add to…, then Copy and Open as a tab (or ⋯ on a phone)', async ({ page }, info) => {
  const phone = info.project.name === 'webkit-phone';
  const run = await ready(page);
  await select(page, run);
  const titles = await bar(page).locator('button').evaluateAll(els => els.map(e => e.getAttribute('title')));
  expect(titles).toEqual([...KINDS, 'Legend', 'Add to…', ...(phone ? ['More'] : ['Copy', 'Open as a tab'])]);
  // icons only: no text in any button
  expect(await bar(page).locator('button').evaluateAll(els => els.map(e => (e.textContent || '').trim()))).toEqual(Array(phone ? 9 : 10).fill(''));
  await expect(bar(page).locator('button svg')).toHaveCount(phone ? 9 : 10);
  await expect(bar(page).locator('.mb-sep')).toHaveCount(3);
  // just above the selection, the same words
  const sel = (await page.locator('.w.sel').first().boundingBox())!, b = (await bar(page).boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(sel.y + 1);
  expect(sel.y - (b.y + b.height)).toBeLessThan(40);
  expect(b.width).toBeLessThanOrEqual(phone ? 374 : 425);
  // the old color bar and its chips are gone
  await expect(page.locator('.colorbar, .selbar, .swatch')).toHaveCount(0);
});

test('row 1: the bar is the same width whatever the legend holds', async ({ page }) => {
  const run = await ready(page);
  await select(page, run);
  const full = (await bar(page).boundingBox())!.width;
  await bar(page).locator('.mb-legend').click();
  await expect(menu(page)).toBeVisible();
  expect((await bar(page).boundingBox())!.width).toBe(full);
  await page.keyboard.press('Escape');
  await expect(bar(page)).toHaveCount(0);
  // the same selection with an empty legend, and with eight entries (the fixture)
  const page2 = await page.context().newPage();
  const run2 = await ready(page2, { legend: { entries: [], unlisted: [] } });
  await select(page2, run2);
  expect((await bar(page2).boundingBox())!.width).toBe(full);
  await bar(page2).locator('.mb-highlight').click();
  await expect(menu(page2)).toBeVisible();
  expect((await bar(page2).boundingBox())!.width).toBe(full);
  expect(legend.entries.length).toBe(8);
});

test('row 5: a kind opens its drop-down away from the selection: quick styles pinned with a tick, then recent, at most six, numbered, Any color…', async ({ page }, info) => {
  const run = await ready(page);
  await select(page, run, 12, 1, 4);
  await bar(page).locator('.mb-highlight').click();
  await expect(menu(page)).toBeVisible();
  const side = await bar(page).getAttribute('data-side');
  const bb = (await bar(page).boundingBox())!, mb = (await menu(page).boundingBox())!;
  if (side === 'above') expect(mb.y + mb.height).toBeLessThanOrEqual(bb.y + 1); else expect(mb.y).toBeGreaterThanOrEqual(bb.y + bb.height - 1);
  const rows = await menu(page).locator('.mb-row').evaluateAll(els => els.map(e => ({ name: e.querySelector('.mb-name')!.textContent, tick: !!e.querySelector('.mb-tick'), n: e.querySelector('.mb-n')?.textContent, sample: !!e.querySelector('.mb-sample'), style: (e as HTMLElement).dataset.style })));
  expect(rows.length).toBeGreaterThan(1);
  expect(rows.length).toBeLessThanOrEqual(6);
  expect(rows.map(r => r.n)).toEqual(rows.map((_, i) => String(i + 1)));
  expect(rows[0]).toMatchObject({ name: 'Fixture promise', tick: true });   // the quick style is pinned on top
  for (const r of rows) { expect(r.sample).toBe(true); expect(r.name).toBeTruthy(); expect(r.style).toMatch(/^highlight:/); }
  // after the quick ones come this chapter's recent styles, by their names (an unnamed style by its style), never a bare dot
  expect(rows.slice(1).some(r => /^Unnamed /.test(r.name!))).toBe(true);
  await expect(menu(page).locator('.mb-any')).toContainText('Any color…');
  await expect(menu(page).locator('.swatch')).toHaveCount(0);
  await expect(menu(page).locator('.mb-any input[type=color]')).toHaveCount(1);
  if (info.project.name === 'webkit-desktop' && process.env.WB_T6_SHOT) await page.screenshot({ path: process.env.WB_T6_SHOT });
  // Underline adds 1 / 2 / 3 lines at its top
  await bar(page).locator('.mb-underline').click();
  await expect(menu(page).locator('.mb-line')).toHaveText(['1 line', '2', '3']);
  const first = await menu(page).locator('> *').first().evaluate(e => e.className);
  expect(first).toContain('mb-lines');
  // a second click on the same icon closes it
  await bar(page).locator('.mb-underline').click();
  await expect(menu(page)).toHaveCount(0);
  // Margin note (T10) opens an empty note in the margin and ends the selection; nothing is written until text is typed
  await bar(page).locator('.mb-note').click();
  await expect(page.locator('textarea.mg-edit')).toBeVisible();
  await expect(bar(page)).toHaveCount(0);
  expect(run.calls).toEqual([]);
});

test('rows 4 and 6: a click on a style makes the mark at once, by --style or by kind and color; the bar closes and the selection clears', async ({ page }) => {
  const run = await ready(page);
  const before = await markCount(page);
  await select(page, run);
  await bar(page).locator('.mb-highlight').click();
  await menu(page).locator('.mb-row', { hasText: 'Fixture promise' }).click();
  await expect.poll(() => markCount(page)).toBe(before + 1);
  await expect.poll(() => run.calls).toEqual([`mark-add-${slug(run.at)}-style-fixture-promise`]);
  expect(await page.evaluate(() => (window as any).__wb.drawn.marks.marks.at(-1))).toMatchObject({ kind: 'highlight', color: 'pink', at: run.at, style: 'highlight:pink' });
  await expect(bar(page)).toHaveCount(0);
  await expect(page.locator('.w.sel')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__wb.selector.sel)).toBeNull();
  // the highlight is drawn under the words now
  expect(await page.locator('.w.hl[style*="hl-pink"]').count()).toBeGreaterThan(0);

  // row 6: the style just used comes first among the recent ones, ahead of the legend's own order
  await select(page, run, 11, 7, 9);
  await bar(page).locator('.mb-circle').click();
  await menu(page).locator('.mb-row', { hasText: 'Fixture place' }).click();
  await select(page, run, 12, 1, 3);
  await bar(page).locator('.mb-circle').click();
  await expect(menu(page)).toBeVisible();
  const names = await menu(page).locator('.mb-row .mb-name').allTextContents();
  expect(names.slice(0, 2)).toEqual(['Fixture place', 'Unnamed orange circle']);   // recent first: the last used, then this chapter's circle
  expect(names).toContain('Fixture person');
  // an unnamed style is made by kind and color, not by a name it does not have
  await menu(page).locator('.mb-row', { hasText: 'Unnamed orange circle' }).click();
  await expect.poll(() => run.calls.at(-1)).toBe(`mark-add-${slug(run.at)}-kind-circle-color-orange`);
  await expect(bar(page)).toHaveCount(0);
});

test('rows 7 and 8: a color no entry has is drawn at once and asks for its name; Enter adds the entry', async ({ page }) => {
  const run = await ready(page);
  const before = await markCount(page);
  await select(page, run);
  await bar(page).locator('.mb-underline').click();
  await menu(page).locator('.mb-line[data-lines="2"]').click();
  await pickColor(page, '#12ab34');
  await expect.poll(() => run.calls.length).toBe(1);
  expect(run.calls[0]).toBe(`mark-add-${slug(run.at)}-kind-underline-color-12ab34-lines-2`);
  await expect.poll(() => markCount(page)).toBe(before + 1);   // drawn already
  await expect(page.locator('.mk-line[data-lines="2"]')).not.toHaveCount(0);
  // the drop-down keeps a name field, focused; the bar stays until it is answered
  await expect(bar(page)).toBeVisible();
  await expect(menu(page).locator('.mb-pen')).toBeFocused();
  await expect(menu(page)).toContainText('Name this pen');
  await page.keyboard.type('My double');
  await page.keyboard.press('Enter');
  await expect.poll(() => run.calls.length).toBe(2);
  expect(run.calls[1]).toBe('legend-add-kind-underline-color-12ab34-lines-2-name-my-double');
  await expect(bar(page)).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__wb.selector.sel)).toBeNull();
});

test('row 9: Enter or Esc with no name leaves the new pen Unnamed in the legend', async ({ page }) => {
  const run = await ready(page);
  await select(page, run);
  await bar(page).locator('.mb-box').click();
  await pickColor(page, '#ab12cd');
  await expect(menu(page).locator('.mb-pen')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => run.calls.length).toBe(2);
  await expect.poll(() => run.calls).toEqual([`mark-add-${slug(run.at)}-kind-box-color-ab12cd`, 'legend-add-kind-box-color-ab12cd']);
  await expect(bar(page)).toHaveCount(0);
  await select(page, run, 11, 7, 9);
  await bar(page).locator('.mb-circle').click();
  await pickColor(page, '#cd34ef');
  await expect(menu(page).locator('.mb-pen')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect.poll(() => run.calls.length).toBe(4);
  expect(run.calls[3]).toBe('legend-add-kind-circle-color-cd34ef');
  await expect(bar(page)).toHaveCount(0);
});

test('row 10: the Legend icon lists the whole legend with a filter focused; typing filters, Enter or a click applies; it ends with New pen…', async ({ page }) => {
  const run = await ready(page);
  await select(page, run);
  await bar(page).locator('.mb-legend').click();
  await expect(menu(page).locator('.mb-filter')).toBeFocused();
  const all = await menu(page).locator('.mb-list .mb-row .mb-name').allTextContents();
  for (const e of legend.entries) expect(all).toContain(e.label);
  expect(await menu(page).locator('.mb-row').last().textContent()).toContain('New pen…');
  await page.keyboard.type('later');
  expect(await menu(page).locator('.mb-list .mb-row .mb-name').allTextContents()).toEqual(['Fixture later']);
  await page.keyboard.press('Enter');
  await expect.poll(() => run.calls).toEqual([`mark-add-${slug(run.at)}-style-fixture-later`]);
  await expect(bar(page)).toHaveCount(0);
  // a click applies too
  await select(page, run, 12, 1, 3);
  await bar(page).locator('.mb-legend').click();
  await menu(page).locator('.mb-filter').fill('orange');
  await expect(menu(page).locator('.mb-list .mb-row')).toHaveCount(2);   // the orange box and the unnamed orange circle
  await menu(page).locator('.mb-list .mb-row', { hasText: 'Fixture orange box' }).click();
  await expect.poll(() => run.calls.at(-1)).toBe(`mark-add-${slug(run.at)}-style-fixture-orange-box`);
  // New pen… asks for a kind, then Any color…
  await select(page, run, 11, 7, 9);
  await bar(page).locator('.mb-legend').click();
  await menu(page).locator('.mb-newpen').click();
  await menu(page).locator('.mb-kindpick[data-kind="circle"]').click();
  await pickColor(page, '#334455');
  await expect(menu(page).locator('.mb-pen')).toBeFocused();
  await expect.poll(() => run.calls.at(-1)).toBe(`mark-add-${slug(run.at)}-kind-circle-color-334455`);
});

test('row 20: H U C B pick a kind (A starts an arrow: marks-arrows.spec.ts; N a margin note: marks-margin.spec.ts)', async ({ page }) => {
  const run = await ready(page);
  await select(page, run);
  for (const [key, kind] of [['u', 'underline'], ['c', 'circle'], ['b', 'box'], ['h', 'highlight']] as const) {
    await page.keyboard.press(key);
    await expect(menu(page)).toHaveAttribute('data-menu', kind);
    await expect(bar(page).locator(`.mb-${kind}`)).toHaveClass(/on/);
  }
  await page.keyboard.press('Shift+C');
  await expect(menu(page)).toHaveAttribute('data-menu', 'circle');   // Shift+C is C
  expect(run.calls).toEqual([]);
  await expect(bar(page)).toBeVisible();
});

test('row 21: 1 to 6 apply that row of an open drop-down', async ({ page }) => {
  const run = await ready(page);
  await select(page, run);
  await page.keyboard.press('1');   // no drop-down open: nothing
  expect(run.calls).toEqual([]);
  await page.keyboard.press('h');
  await expect(menu(page)).toBeVisible();
  const row = await menu(page).locator('.mb-row').nth(1).evaluate(e => ({ style: (e as HTMLElement).dataset.style!, label: e.querySelector('.mb-name')!.textContent! }));
  await page.keyboard.press('2');
  await expect.poll(() => run.calls).toEqual([`mark-add-${slug(run.at)}${callOf(row.style, row.label)}`]);
  await expect(bar(page)).toHaveCount(0);
});

test('row 22: a kind\'s key pressed twice applies its last style', async ({ page }) => {
  const run = await ready(page);
  await select(page, run);
  await page.keyboard.press('c');
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press('c');
  // the last circle this chapter has is the fixture's orange one
  await expect.poll(() => run.calls.length).toBe(1);
  expect(run.calls[0]).toBe(`mark-add-${slug(run.at)}-kind-circle-color-orange`);
  await expect(bar(page)).toHaveCount(0);
  // what was just used is the last style after that
  await select(page, run, 11, 7, 9);
  await page.keyboard.press('b');
  await menu(page).locator('.mb-row', { hasText: 'Fixture orange box' }).click();
  await select(page, run, 12, 1, 3);
  await page.keyboard.press('b');
  await page.keyboard.press('b');
  await expect.poll(() => run.calls.length).toBe(3);
  expect(run.calls[2]).toBe(`mark-add-${slug(run.at)}-style-fixture-orange-box`);
});

test('row 24: Esc, or a click outside, closes the bar and makes nothing', async ({ page }) => {
  const run = await ready(page);
  const before = await markCount(page);
  await select(page, run);
  await page.keyboard.press('h');
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(bar(page)).toHaveCount(0);
  await expect(page.locator('.w.sel')).toHaveCount(0);
  await select(page, run);
  await page.locator('.ch-title').click();
  await expect(bar(page)).toHaveCount(0);
  await expect(page.locator('.w.sel')).toHaveCount(0);
  expect(run.calls).toEqual([]);
  expect(await markCount(page)).toBe(before);
});

test('phone: the same bar with 44 px targets above the selection; a tap opens the drop-down and a row makes the mark', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-phone', 'phone');
  const run = await ready(page);
  const x = await wordBox(page, 11, 2);
  const touch = (type: string, px: number, py: number) => page.evaluate(([type, px, py]) => {
    const t = document.elementFromPoint(px as number, py as number)!;
    t.dispatchEvent(new PointerEvent(type as string, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: px as number, clientY: py as number, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
  }, [type, px, py]);
  await touch('pointerdown', x.x + 4, x.y + x.height / 2);
  await page.waitForTimeout(600);
  const y = await wordBox(page, 11, 4);
  await touch('pointermove', y.x + 4, y.y + y.height / 2);
  await touch('pointerup', y.x + 4, y.y + y.height / 2);
  await expect(bar(page)).toBeVisible();
  run.at = await page.evaluate(() => { const s = (window as any).__wb.selector.sel, d = (window as any).__wb.drawn; return `${d.chapter.code}.${d.chapter.chapter}:${d.v[s.a]}.${d.i[s.a]}-${d.chapter.chapter}:${d.v[s.b]}.${d.i[s.b]}`; });
  const boxes = await bar(page).locator('button').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height }; }));
  expect(boxes).toHaveLength(9);
  for (const b of boxes) expect(b.h).toBeGreaterThanOrEqual(44);
  const bb = (await bar(page).boundingBox())!;
  expect(bb.x).toBeGreaterThanOrEqual(0);
  expect(bb.x + bb.width).toBeLessThanOrEqual(390);
  await bar(page).locator('.mb-highlight').tap();
  await expect(menu(page)).toBeVisible();
  const mb = (await menu(page).boundingBox())!;
  expect(mb.x).toBeGreaterThanOrEqual(0);
  expect(mb.x + mb.width).toBeLessThanOrEqual(390);
  await menu(page).locator('.mb-row', { hasText: 'Fixture promise' }).tap();
  await expect.poll(() => run.calls).toEqual([`mark-add-${slug(run.at)}-style-fixture-promise`]);
  await expect(bar(page)).toHaveCount(0);
});
