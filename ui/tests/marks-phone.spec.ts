import { test, expect, type Page } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { shotPath } from '../../scripts/shots.mjs';

// The phone (design/features/marks T13: rows 59 to 63 and 69; MK7-31, MK7-32; sheet G). What a desktop drops down or pops
// up opens here as a bottom sheet. The UI runs without Rust, so every `wb` call is answered by this test's route, which
// records the command's name (the argv as the fixture name). Words are the reader's, drawn from the generated fixture
// chapter; no scripture is typed in this file. Touch is made with pointer events of type touch (a long press is a held
// pointer), as the reader's selection reads them.
const legend = JSON.parse(readFileSync(new URL('../public/fixtures/wb/legend.json', import.meta.url), 'utf8'));
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

interface M { id: string; kind: string; color: string; lines?: number; at: string; created: string; legend: string; style: string }
const HL: M = { id: 'm_hl', kind: 'highlight', color: 'yellow', at: 'NUM.25:11.2-25:11.5', created: '2026-11-17T10:00:00Z', legend: 'Fixture promise', style: 'highlight:yellow' };
const UL: M = { id: 'm_ul', kind: 'underline', color: 'blue', lines: 2, at: 'NUM.25:11.3-25:11.4', created: '2026-11-18T10:00:00Z', legend: 'Fixture double', style: 'underline:blue:2' };
const BX: M = { id: 'm_bx', kind: 'box', color: '#cc3322', at: 'NUM.25:11.1-25:11.6', created: '2026-11-19T09:00:00Z', legend: 'Fixture box', style: 'box:#cc3322' };
const NOTE = { id: 'n_11', at: 'NUM.25:11', label: 'Numbers 25:11', kind: 'verse', v1: 11, v2: 11, text: 'A thought on one verse', question: false, done: false, created: '2026-11-18', changed: '', grew: [] as { id: string; title: string }[] };

interface Run { calls: string[]; at: string; to: string; marks: M[] }

async function ready(page: Page, opts: { marks?: M[]; notes?: boolean } = {}): Promise<Run> {
  const run: Run = { calls: [], at: '', to: '', marks: opts.marks || [] };
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => { (window as any).__copied = t; } } });
  });
  const layer: Record<string, number> = { underline: 1, circle: 2, box: 2, highlight: 3 };
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').pop()!.replace(/\.json$/, '');
    if (name.startsWith('mark-add-')) {
      run.calls.push(name);
      const st = /-style-(.+)$/.exec(name);
      const e = st && legend.entries.find((x: any) => slug(x.label) === st[1]);
      const kc = /-kind-([a-z]+)-color-([a-z0-9]+)/.exec(name);
      const kind = e ? e.kind : kc![1];
      const raw = e ? e.color : kc![2];
      const color = /^[0-9a-f]{6}$/.test(raw) ? `#${raw}` : raw;
      const lines = e ? e.lines : /-lines-(\d)/.exec(name)?.[1] ? +/-lines-(\d)/.exec(name)![1] : undefined;
      return route.fulfill({ json: { id: `m_made${run.calls.length}`, kind, color, ...(lines ? { lines } : {}), at: run.at, ...(run.to ? { to: run.to } : {}), created: '2026-11-19T10:00:00Z' } });
    }
    if (name.startsWith('legend-add-')) { run.calls.push(name); return route.fulfill({ json: {} }); }
    if (name.startsWith('mark-at-')) {
      run.calls.push(name);
      const top = [...run.marks].sort((a, b) => layer[a.kind] - layer[b.kind] || (a.created < b.created ? 1 : -1));
      return route.fulfill({ json: { place: 'NUM.25:11.3', marks: top } });
    }
    if (name.startsWith('mark-show-')) { run.calls.push(name); return route.fulfill({ json: { legend: 'Fixture shown' } }); }
    if (name.startsWith('mark-rm-')) { run.calls.push(name); return route.fulfill({ json: { deleted: name.slice(8), trash: 'x.json', days: 7 } }); }
    if (name.startsWith('mark-restore-')) { run.calls.push(name); return route.fulfill({ json: {} }); }
    if (name === 'mark-notes-numbers-25') return route.fulfill({ json: { place: 'Numbers 25', count: opts.notes ? 1 : 0, notes: opts.notes ? [NOTE] : [] } });
    if (name.startsWith('mark-note-')) { run.calls.push(name); return route.fulfill({ json: { ...NOTE, text: undefined, question: false, changed: '2026-11-19' } }); }
    if (name.startsWith('mark-grow-')) { run.calls.push(name); return route.fulfill({ json: { note: { ...NOTE, grew: [{ id: 'p_grown', title: NOTE.label }] }, page: 'p_grown', title: NOTE.label } }); }
    return route.fallback();
  });
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  if (run.marks.length) await page.evaluate(m => { const w = (window as any).__wb; w.drawn.marks.marks = m; w.repaint(); }, run.marks);
  return run;
}

const bar = (page: Page) => page.locator('.markbar:not(.arrow-bar)');
const sheet = (page: Page) => page.locator('.sheet');
const phoneOnly = (info: { project: { name: string } }) => test.skip(info.project.name !== 'webkit-phone', 'a phone row');

async function wordBox(page: Page, v: number, i: number) {
  const k = await page.evaluate(([v, i]) => { const d = (window as any).__wb.drawn; return d.v.findIndex((vv: number, k: number) => vv === v && d.i[k] === i); }, [v, i]);
  const el = page.locator(`.w[data-k="${k}"]`);
  await el.evaluate(e => e.scrollIntoView({ block: 'center' }));
  return (await el.boundingBox())!;
}
const touch = (page: Page, type: string, px: number, py: number) => page.evaluate(([type, px, py]) => {
  const t = document.elementFromPoint(px as number, py as number)!;
  t.dispatchEvent(new PointerEvent(type as string, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: px as number, clientY: py as number, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
}, [type, px, py]);

/** Long-press word a of verse v, then drag to word b (or none) and let go. */
async function longPress(page: Page, v: number, a: number, b = a) {
  const x = await wordBox(page, v, a);
  await touch(page, 'pointerdown', x.x + 4, x.y + x.height / 2);
  await page.waitForTimeout(600);
  const y = b === a ? x : await wordBox(page, v, b);
  await touch(page, 'pointermove', y.x + y.width - 3, y.y + y.height / 2);
  await touch(page, 'pointerup', y.x + y.width - 3, y.y + y.height / 2);
  await expect(page.locator('.markbar')).toBeVisible();
}
const anchor = (page: Page) => page.evaluate(() => { const s = (window as any).__wb.selector.sel, d = (window as any).__wb.drawn; return `${d.chapter.code}.${d.chapter.chapter}:${d.v[s.a]}.${d.i[s.a]}-${d.chapter.chapter}:${d.v[s.b]}.${d.i[s.b]}`; });
const selectedCount = (page: Page) => page.evaluate(() => { const s = (window as any).__wb.selector.sel; return s ? s.b - s.a + 1 : 0; });

test('row 59: long-press a word and drag to extend: the words are selected with the touch handles, and the bar of 44 px icons sits above them', async ({ page }, info) => {
  phoneOnly(info);
  await ready(page);
  await longPress(page, 11, 2, 5);
  expect(await selectedCount(page)).toBeGreaterThanOrEqual(4);
  await expect(page.locator('#reader .w.sel').first()).toBeVisible();
  await expect(page.locator('#reader .handle:not([hidden])')).toHaveCount(2);   // the touch handles stay (T7b)
  const boxes = await bar(page).locator('button').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height }; }));
  expect(boxes).toHaveLength(9);   // six kinds, Legend, Add to…, More
  for (const b of boxes) { expect(b.h).toBeGreaterThanOrEqual(44); expect(b.w).toBeGreaterThanOrEqual(34); }
  const bb = (await bar(page).boundingBox())!;
  expect(bb.x).toBeGreaterThanOrEqual(0);
  expect(bb.x + bb.width).toBeLessThanOrEqual(390);
  const first = (await page.locator('#reader .w.sel').first().boundingBox())!;
  expect(bb.y + bb.height).toBeLessThanOrEqual(first.y + 1);   // above the selection
  mkdirSync('design/features/marks/build', { recursive: true });
  await page.screenshot({ path: shotPath('design/features/marks/build/t13.png') });
});

test('row 60: a tap on a kind opens a bottom sheet, not a drop-down: its styles by name, then Any color…; an underline also has its 1, 2, 3 lines', async ({ page }, info) => {
  phoneOnly(info);
  await ready(page);
  await longPress(page, 11, 2, 5);
  await bar(page).locator('.mb-highlight').tap();
  await expect(sheet(page)).toBeVisible();
  await expect(bar(page).locator('.mb-menu')).toHaveCount(0);   // nothing drops from the bar
  await expect(sheet(page).locator('.sheet-title')).toHaveText('Highlight');
  await expect(sheet(page).locator('.sheet-sub')).toHaveText('Pick a style');
  const names = await sheet(page).locator('.mb-row .mb-name').allTextContents();
  const entries = legend.entries.filter((e: any) => e.kind === 'highlight').map((e: any) => e.label);
  expect(names.length).toBeGreaterThan(0);
  for (const n of names) expect(entries.includes(n) || /^Unnamed /.test(n)).toBe(true);   // legend names, or a style used here that no entry names
  await expect(sheet(page).locator('.mb-any')).toContainText('Any color…');
  expect(await sheet(page).locator('.mb-row').evaluateAll(els => els.every(e => e.getBoundingClientRect().height >= 44))).toBe(true);
  const sb = (await sheet(page).boundingBox())!;
  expect(sb.y).toBeGreaterThan(844 / 2 - 100);   // at the foot of the screen
  expect(sb.y + sb.height).toBeGreaterThanOrEqual(840);
  await page.screenshot({ path: shotPath('design/features/marks/build/t13-sheet.png') });
  // another kind replaces it; an underline has its lines
  await sheet(page).locator('.close').tap();
  await expect(sheet(page)).toHaveCount(0);
  await expect(bar(page)).toBeVisible();   // the bar stays until a style is chosen
  await bar(page).locator('.mb-underline').tap();
  await expect(sheet(page).locator('.sheet-title')).toHaveText('Underline');
  await expect(sheet(page).locator('.mb-lines button')).toHaveText(['1 line', '2', '3']);
});

test('row 60: the Legend icon opens a sheet: a filter, the whole legend, then New pen…', async ({ page }, info) => {
  phoneOnly(info);
  const run = await ready(page);
  await longPress(page, 11, 2, 5);
  await bar(page).locator('.mb-legend').tap();
  await expect(sheet(page).locator('.sheet-title')).toHaveText('Legend');
  const filter = sheet(page).locator('.mb-filter');
  await expect(filter).toBeVisible();
  const all = sheet(page).locator('.mb-list .mb-row');
  const n = await all.count();
  expect(n).toBeGreaterThanOrEqual(legend.entries.filter((e: any) => e.kind !== 'arrow').length);
  await filter.fill('fixture promise');
  await expect(all).toHaveCount(1);
  await expect(all.first().locator('.mb-name')).toHaveText('Fixture promise');
  await filter.fill('');
  await expect(sheet(page).locator('.mb-newpen')).toHaveText('New pen…');
  await sheet(page).locator('.mb-newpen').tap();
  await expect(sheet(page).locator('.mb-kindpick')).toHaveCount(4);
  expect(run.calls).toEqual([]);   // nothing was made
});

test('row 61: a tap on a style draws the mark, and the sheet and the bar close', async ({ page }, info) => {
  phoneOnly(info);
  const run = await ready(page);
  await longPress(page, 11, 2, 5);
  run.at = await anchor(page);
  const before = await page.evaluate(() => (window as any).__wb.drawn.marks.marks.length);
  await bar(page).locator('.mb-highlight').tap();
  await sheet(page).locator('.mb-row', { hasText: 'Fixture promise' }).tap();
  await expect.poll(() => run.calls).toEqual([`mark-add-${slug(run.at)}-style-fixture-promise`]);
  await expect(sheet(page)).toHaveCount(0);
  await expect(bar(page)).toHaveCount(0);
  await expect(page.locator('#reader .w.sel')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__wb.drawn.marks.marks.length)).toBe(before + 1);
  // from the Legend sheet too
  await longPress(page, 12, 2, 4);
  run.at = await anchor(page);
  await bar(page).locator('.mb-legend').tap();
  await sheet(page).locator('.mb-list .mb-row', { hasText: 'Fixture promise' }).tap();
  await expect.poll(() => run.calls.length).toBe(2);
  await expect(sheet(page)).toHaveCount(0);
  await expect(bar(page)).toHaveCount(0);
});

test('row 61: Any color… draws at once and asks for its name in the sheet; tapping away leaves the pen Unnamed', async ({ page }, info) => {
  phoneOnly(info);
  const run = await ready(page);
  await longPress(page, 11, 2, 5);
  run.at = await anchor(page);
  await bar(page).locator('.mb-circle').tap();
  const input = sheet(page).locator('.mb-any input');
  await input.fill('#12ab34');
  await input.evaluate(e => e.dispatchEvent(new Event('change', { bubbles: true })));
  await expect.poll(() => run.calls[0]).toBe(`mark-add-${slug(run.at)}-kind-circle-color-12ab34`);
  await expect(sheet(page).locator('.mb-pen')).toBeVisible();
  await expect(sheet(page).locator('.sheet-title')).toHaveText('New pen');
  await page.touchscreen.tap(195, 40);   // the scrim, above the sheet
  await expect(sheet(page)).toHaveCount(0);
  await expect(bar(page)).toHaveCount(0);
  await expect.poll(() => run.calls).toEqual([`mark-add-${slug(run.at)}-kind-circle-color-12ab34`, 'legend-add-kind-circle-color-12ab34']);
});

test('row 62: a tap on marked words opens the mark card as a bottom sheet: every mark there, topmost first, each with Change and Delete', async ({ page }, info) => {
  phoneOnly(info);
  const run = await ready(page, { marks: [HL, UL, BX] });
  const b = await wordBox(page, 11, 3);
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  const card = sheet(page).locator('.mark-card');
  await expect(card).toBeVisible();
  const sb = (await sheet(page).boundingBox())!;
  expect(sb.y + sb.height).toBeGreaterThanOrEqual(840);   // a bottom sheet
  const all = card.locator('.mc-mark');
  await expect(all.locator('.mc-name')).toHaveText(['Fixture double', 'Fixture box', 'Fixture promise']);
  await expect(all.getByRole('button', { name: 'Change' })).toHaveCount(3);
  await expect(all.getByRole('button', { name: 'Delete' })).toHaveCount(3);
  expect(run.calls).toEqual(['mark-at-num-25-11-3']);
  // Change opens that kind's styles; Delete removes with Undo
  await all.nth(0).getByRole('button', { name: 'Change' }).tap();
  await expect(card.locator('.mc-drop [data-menu="underline"]')).toBeVisible();
  await all.nth(2).getByRole('button', { name: 'Delete' }).tap();
  await expect.poll(() => run.calls.filter(c => c.startsWith('mark-rm-'))).toEqual(['mark-rm-m-hl']);
  await expect(page.locator('.toast')).toContainText('Mark deleted');
});

test('row 63: a tap on a margin sign opens the note as a bottom sheet: editable, with Grow into a page', async ({ page }, info) => {
  phoneOnly(info);
  const run = await ready(page, { notes: true });
  await page.waitForFunction(() => document.querySelector('.margin-col') && !(document.querySelector('.margin-col') as HTMLElement).hidden);
  const sign = page.locator('.margin-col .mg-sign[data-v="11"]');
  await sign.evaluate(e => e.scrollIntoView({ block: 'center' }));
  await sign.tap();
  await expect(sheet(page)).toContainText('A thought on one verse');
  expect((await sheet(page).boundingBox())!.y).toBeGreaterThan(300);
  // the verse stays visible above the sheet
  const vn = (await page.locator('#reader .vn[data-v="11"]').boundingBox())!;
  expect(vn.y).toBeLessThan((await sheet(page).boundingBox())!.y);
  // editable
  await sheet(page).locator('.mg-text').tap();
  const ta = sheet(page).locator('textarea');
  await expect(ta).toBeFocused();
  await ta.fill('A thought on one verse, written here');
  await sheet(page).locator('.close').tap();   // closing the sheet keeps what was written
  await expect.poll(() => run.calls.filter(c => c.startsWith('mark-note-'))).toEqual(['mark-note-n-11-text-a-thought-on-one-verse-written-here']);
  await expect(sheet(page)).toHaveCount(0);
  // Grow into a page
  await sign.evaluate(e => e.scrollIntoView({ block: 'center' }));
  await sign.tap();
  await sheet(page).getByRole('button', { name: 'Note menu' }).tap();
  await sheet(page).getByRole('menuitem', { name: 'Grow into a page' }).tap();
  await expect.poll(() => run.calls.filter(c => c.startsWith('mark-grow-'))).toEqual(['mark-grow-n-11']);
});

test('row 69: Copy and Open as a tab sit behind ⋯ as a small sheet with 44 px rows; Copy writes the words with their reference', async ({ page }, info) => {
  phoneOnly(info);
  await ready(page);
  await longPress(page, 11, 2, 5);
  await bar(page).locator('.mb-more').tap();
  const more = sheet(page).locator('[data-menu="more"]');
  await expect(more.locator('.mb-row')).toHaveText(['Copy', 'Open as a tab']);
  expect(await more.locator('.mb-row').evaluateAll(els => els.every(e => e.getBoundingClientRect().height >= 44))).toBe(true);
  const sb = (await sheet(page).boundingBox())!;
  expect(sb.height).toBeLessThan(844 / 2);   // small
  await more.locator('.mb-row', { hasText: 'Copy' }).tap();
  await expect(sheet(page)).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__copied)).toMatch(/\(Numbers 25:\d+ KJV\)$/);
  await expect(bar(page)).toBeVisible();
});

test('arrows on a phone: the Arrow icon starts the target step; a long-press on another word is the target; Cancel leaves nothing made', async ({ page }, info) => {
  phoneOnly(info);
  const run = await ready(page);
  const arrowsBefore = await page.locator('.mk-arrow').count();   // the fixture chapter has one
  await longPress(page, 7, 2, 3);
  run.at = await anchor(page);
  await bar(page).locator('.mb-arrow').tap();
  const ab = page.locator('.arrow-bar');
  await expect(ab.locator('.ab-text')).toHaveText('Select where it points');
  for (const b of await ab.locator('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await ab.getByRole('button', { name: 'Cancel' }).tap();
  await expect(ab).toHaveCount(0);
  expect(run.calls).toEqual([]);
  // again, and a word in another verse is the target
  await longPress(page, 7, 2, 3);
  await bar(page).locator('.mb-arrow').tap();
  await expect(ab).toBeVisible();
  run.to = 'NUM.25:12.1';
  await longPress(page, 12, 1);
  await expect.poll(() => run.calls.length).toBe(1);
  expect(run.calls[0]).toMatch(/^mark-add-num-25-7-2-25-7-3-kind-arrow-color-blue-to-num-25-12-1/);
  await expect(page.locator('.mk-arrow')).toHaveCount(arrowsBefore + 1);
});
