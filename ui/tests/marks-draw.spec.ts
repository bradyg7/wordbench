import { test, expect, type Page } from '@playwright/test';
import { shotPath } from '../../scripts/shots.mjs';
import { readFileSync } from 'node:fs';

// The reader draws the marks (design/features/marks T5, rows 42 and 44 to 47, and the WebKit side of 49). The fixture
// holds what `wb fixture` made on a generated study: a mark of every kind, a legend entry for two of them and a folder with
// a color. Where a test needs more marks they are made from the fixture's own word positions; no scripture is typed.
const fx = JSON.parse(readFileSync(new URL('../public/fixtures/NUM.25.json', import.meta.url), 'utf8'));
const legend = JSON.parse(readFileSync(new URL('../public/fixtures/wb/legend.json', import.meta.url), 'utf8'));
const verses: { v: number; words: { i: number }[] }[] = fx.reader.chapter.verses;

async function ready(page: Page, marks?: unknown[], more?: (f: any) => void) {
  if (marks || more) {
    await page.route('**/fixtures/NUM.25.json', async route => {
      const f = JSON.parse(JSON.stringify(fx));
      if (marks) f.reader.marks.marks = marks;
      more?.(f);
      await route.fulfill({ json: f });
    });
  }
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.waitForSelector('.mk-layers .mk-layer', { state: 'attached' });
  // the layers are placed on the next frame
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** A mark on the words a..b of a verse (indexes into its words), made like the core makes them. */
let n = 0;
function mark(kind: string, color: string, v: number, a: number, b: number, extra: Record<string, unknown> = {}) {
  const w = verses.find(x => x.v === v)!.words;
  n++;
  const lines = extra.lines as number | undefined;
  const style = kind === 'underline' ? `underline:${color}:${lines ?? 1}` : `${kind}:${color}`;
  return { id: `m_t${n}`, kind, color, at: `NUM.25:${v}.${w[a].i}-25:${v}.${w[b].i}`, created: `2026-01-01T00:00:${String(n % 60).padStart(2, '0')}Z`, legend: `Unnamed ${color} ${kind}`, style, ...extra };
}

const rect = (e: Element) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };

test('the fixture has a mark of every kind, and the reader draws each in its own layer, in the fixed order', async ({ page }, info) => {
  await ready(page);
  // the layers are in the markup in the order that paints them: shapes, underlines, arrows (the highlight is the words' own background, beneath)
  expect(await page.locator('.mk-layers > .mk-layer').evaluateAll(els => els.map(e => e.getAttribute('data-layer')))).toEqual(['shapes', 'underlines', 'arrows']);
  // 1. a highlight is a fill under the words
  const fills = await page.locator('.w.hl').evaluateAll(els => els.map(e => getComputedStyle(e).backgroundColor));
  expect(fills.length).toBeGreaterThan(0);
  for (const f of fills) expect(f).not.toBe('rgba(0, 0, 0, 0)');
  // 2. a box is a thin rectangle, a circle a rounded outline; neither fills
  const box = page.locator('.mk-shape.mk-box').first();
  const circle = page.locator('.mk-shape.mk-circle').first();
  await expect(box).toBeAttached();
  await expect(circle).toBeAttached();
  expect(await box.evaluate(e => ({ bg: getComputedStyle(e).backgroundColor, w: getComputedStyle(e).borderTopWidth, r: getComputedStyle(e).borderTopLeftRadius }))).toEqual({ bg: 'rgba(0, 0, 0, 0)', w: expect.stringMatching(/^1(.5)?px$/), r: '0px' });
  const round = await circle.evaluate(e => ({ bg: getComputedStyle(e).backgroundColor, r: parseFloat(getComputedStyle(e).borderTopLeftRadius) }));
  expect(round.bg).toBe('rgba(0, 0, 0, 0)');
  expect(round.r).toBeGreaterThan(10);
  // 3. underlines: one line is the thickest, two and three are thinner, in the mark's color
  const thick = async (lines: number) => page.locator(`.mk-line[data-lines="${lines}"]`).first().evaluate(e => e.getBoundingClientRect().height);
  const [one, two, three] = [await thick(1), await thick(2), await thick(3)];
  expect(one).toBeGreaterThan(two);
  expect(two).toBeGreaterThan(three);
  expect(await page.locator(".mk-line[data-lines=\"2\"]").count()).toBeGreaterThanOrEqual(2);
  expect(await page.locator(".mk-line[data-lines=\"3\"]").count()).toBeGreaterThanOrEqual(3);
  expect(await page.locator('.mk-line[data-lines="1"]').first().evaluate(e => getComputedStyle(e).backgroundColor)).toBe('rgb(204, 51, 34)');
  // 4. an arrow is a curve with a head, in the gutter
  const arrow = page.locator('.mk-arrow').first();
  await expect(arrow.locator('path')).toHaveCount(2);
  await expect(arrow.locator('circle:not(.mk-end)')).toHaveCount(1);
  expect(await arrow.locator('path').first().getAttribute('stroke')).toBe('#3b79c4');
  // drawn once each: the fixture's old highlight (made with hl set) is one mark, not two
  const marks = await page.evaluate(() => (window as any).__wb.drawn.marks.marks.length);
  expect(marks).toBe(8);
  if (info.project.name === 'webkit-desktop' && process.env.WB_SHOTS === '1') {
    await page.locator('.vn[data-v="6"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: shotPath('design/features/marks/build/t5.png') });
  }
});

test('a folder color is a tab by the verse number, never a line on the words', async ({ page }) => {
  await ready(page);
  await expect(page.locator('.vn[data-v="12"]')).toHaveClass(/vth/);
  expect(await page.locator('.w').evaluateAll(els => els.filter(e => (e as HTMLElement).style.backgroundImage || (e as HTMLElement).style.paddingBottom).length)).toBe(0);
});

test('hovering a mark names its legend entry, an Unnamed one by its style', async ({ page }) => {
  await ready(page, [
    mark('underline', '#cc3322', 6, 0, 3, { lines: 2, legend: 'Warning' }),
    mark('box', 'blue', 6, 2, 5, { legend: 'Unnamed blue box' }),
    { id: 'a1', kind: 'arrow', color: 'green', at: 'NUM.25:7', to: 'NUM.25:9', created: '2026-01-01T00:01:00Z', legend: 'Pointer', style: 'arrow:green' },
  ]);
  const w = verses.find(x => x.v === 6)!.words;
  const k = (i: number) => page.evaluate(([v, ix]) => { const d = (window as any).__wb.drawn; return d.v.findIndex((vv: number, kk: number) => vv === v && d.i[kk] === ix); }, [6, w[i].i]);
  await expect(page.locator(`.w[data-k="${await k(0)}"]`)).toHaveAttribute('title', 'Warning');
  // a word under two marks names both, the newer first
  await expect(page.locator(`.w[data-k="${await k(3)}"]`)).toHaveAttribute('title', 'Unnamed blue box, Warning');
  await page.locator(`.w[data-k="${await k(0)}"]`).hover();
  await expect(page.locator(`.w[data-k="${await k(6)}"]`)).not.toHaveAttribute('title', /.+/);
  await expect(page.locator('.mk-arrow title')).toHaveText('Pointer');
});

test.describe('the marks panel', () => {
  test.beforeEach(({}, info) => { test.skip(info.project.name === 'webkit-phone', 'the panel is clicked on the desktop'); });

  async function panel(page: Page) {
    await page.locator('#hl-menu').click();
    await expect(page.locator('.marks-panel')).toBeVisible();
    return page.locator('.marks-panel');
  }
  const counts = (page: Page) => page.evaluate(() => ({
    hl: document.querySelectorAll('.w.hl').length,
    underline: document.querySelectorAll('.mk-line').length,
    box: document.querySelectorAll('.mk-shape.mk-box').length,
    circle: document.querySelectorAll('.mk-shape.mk-circle').length,
    arrow: document.querySelectorAll('.mk-arrow').length,
    two: document.querySelectorAll('.mk-line[data-lines="2"]').length,
    three: document.querySelectorAll('.mk-line[data-lines="3"]').length,
    one: document.querySelectorAll('.mk-line[data-lines="1"]').length,
  }));
  const settle = (page: Page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

  test('each kind hides and shows (row 44)', async ({ page }) => {
    await ready(page);
    const all = await counts(page);
    expect(all.hl).toBeGreaterThan(0); expect(all.underline).toBeGreaterThan(0); expect(all.box).toBeGreaterThan(0); expect(all.circle).toBeGreaterThan(0); expect(all.arrow).toBe(1);
    const p = await panel(page);
    await expect(p.getByRole('button', { name: /^Underline$/ })).toHaveAttribute('aria-pressed', 'true');
    await p.getByRole('button', { name: /^Underline$/ }).click();
    await settle(page);
    expect(await counts(page)).toEqual({ ...all, underline: 0, one: 0, two: 0, three: 0 });
    await expect(p.getByRole('button', { name: /^Underline$/ })).toHaveAttribute('aria-pressed', 'false');
    await p.getByRole('button', { name: /^Box$/ }).click();
    await p.getByRole('button', { name: /^Arrow$/ }).click();
    await p.getByRole('button', { name: /^Highlight$/ }).click();
    await settle(page);
    expect(await counts(page)).toEqual({ hl: 0, underline: 0, box: 0, circle: all.circle, arrow: 0, one: 0, two: 0, three: 0 });
    expect(await page.locator('.mk-circle').count()).toBe(all.circle);
    // the words are the same words
    expect(await page.locator('.w').count()).toBeGreaterThan(100);
    for (const name of ['Underline', 'Box', 'Arrow', 'Highlight']) await p.getByRole('button', { name: new RegExp(`^${name}$`) }).click();
    await settle(page);
    expect(await counts(page)).toEqual(all);
  });

  test('a legend entry hides and shows only the marks in its style (row 45)', async ({ page }) => {
    await ready(page);
    const all = await counts(page);
    const entry = legend.entries.find((e: any) => e.label === 'Fixture double');
    const p = await panel(page);
    await p.getByRole('button', { name: new RegExp(`^${entry.label} \\(${entry.count}\\)`) }).click();
    await settle(page);
    expect(await counts(page)).toEqual({ ...all, underline: all.underline - all.two, two: 0 });
    expect(await page.locator('.mk-line[data-lines="1"]').count()).toBe(all.one);
    await p.getByRole('button', { name: new RegExp(`^${entry.label}`) }).click();
    await settle(page);
    expect(await counts(page)).toEqual(all);
    // a style no entry names is listed as Unnamed and switches the same way
    const unnamed = legend.unlisted.find((e: any) => e.kind === 'circle');
    await p.getByRole('button', { name: new RegExp(`^${unnamed.label}`) }).click();
    await settle(page);
    expect((await counts(page)).circle).toBe(0);
  });

  test('Reading mode shows only the text, says so in one line, and Show brings the marks back (row 46)', async ({ page }) => {
    await ready(page);
    const all = await counts(page);
    const tabs = await page.locator('.vn.vth').count();
    expect(tabs).toBeGreaterThan(0);
    const p = await panel(page);
    await p.getByRole('button', { name: /^Reading mode/ }).click();
    await settle(page);
    expect(await counts(page)).toEqual({ hl: 0, underline: 0, box: 0, circle: 0, arrow: 0, one: 0, two: 0, three: 0 });
    expect(await page.locator('.vn.vth').count()).toBe(0);
    const note = page.locator('.reading-note');
    await expect(note).toBeVisible();
    await expect(note).toContainText('Marks are hidden');
    await page.keyboard.press('Escape');
    await note.getByRole('button', { name: 'Show' }).click();
    await settle(page);
    await expect(note).toBeHidden();
    expect(await counts(page)).toEqual(all);
    expect(await page.locator('.vn.vth').count()).toBe(tabs);
  });
});

// Row 49 as far as WebKit can show it: a chapter of many overlapping marks. The real-app check stays a desk check.
test('a chapter with a hundred overlapping marks keeps every word readable', async ({ page }) => {
  const made: unknown[] = [];
  const colors = ['yellow', 'green', 'blue', 'pink', 'orange', '#7a1f1f', '#cc3322'];
  for (const { v, words } of verses.slice(0, 16)) {
    const last = words.length - 1;
    made.push(mark('highlight', colors[v % 5], v, 0, last));
    made.push(mark('highlight', colors[(v + 2) % 5], v, 1, Math.min(3, last)));
    made.push(mark('underline', '#cc3322', v, 0, last, { lines: 1 }));
    made.push(mark('underline', 'blue', v, 1, Math.max(1, last - 1), { lines: 2 }));
    made.push(mark('underline', 'green', v, 2, Math.max(2, last - 2), { lines: 3 }));
    made.push(mark('underline', 'orange', v, 0, last, { lines: 3 }));
    made.push(mark('box', 'pink', v, 0, Math.min(4, last)));
    made.push(mark('circle', 'orange', v, Math.min(2, last), Math.min(6, last)));
    made.push(mark('box', 'blue', v, 0, last));
    made.push(mark('circle', 'green', v, 0, last));
    if (v + 2 <= 16) made.push({ id: `a${v}`, kind: 'arrow', color: colors[v % 7], at: `NUM.25:${v}`, to: `NUM.25:${v + 2}`, created: '2026-01-01T00:02:00Z', legend: 'Unnamed arrow', style: `arrow:${colors[v % 7]}` });
  }
  expect(made.length).toBeGreaterThan(100);
  await ready(page, made);
  const r = await page.evaluate(() => {
    const words = [...document.querySelectorAll('.w')].map(e => e.getBoundingClientRect());
    const hit = (a: { l: number; t: number; r: number; b: number }) => words.filter(w => a.l < w.right - 0.5 && a.r > w.left + 0.5 && a.t < w.bottom - 0.5 && a.b > w.top + 0.5).length;
    const R = (e: Element) => { const x = e.getBoundingClientRect(); return { l: x.left, t: x.top, r: x.right, b: x.bottom }; };
    let overlapsLines = 0, overlapsBorders = 0, filled = 0;
    for (const e of document.querySelectorAll('.mk-line')) overlapsLines += hit(R(e));
    for (const e of document.querySelectorAll<HTMLElement>('.mk-shape')) {
      const x = R(e), s = getComputedStyle(e), bw = (side: string) => parseFloat(s.getPropertyValue(`border-${side}-width`));
      if (s.backgroundColor !== 'rgba(0, 0, 0, 0)') filled++;
      // the four sides of the outline (a side the box leaves open has width 0)
      overlapsBorders += hit({ ...x, b: x.t + bw('top') });
      overlapsBorders += hit({ ...x, t: x.b - bw('bottom') });
      if (!e.classList.contains('mk-circle')) {
        overlapsBorders += hit({ ...x, r: x.l + bw('left') });
        overlapsBorders += hit({ ...x, l: x.r - bw('right') });
      }
    }
    // the arrows lie in the gutter left of the text
    const root = document.querySelector('#reader')!.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(document.querySelector('#reader')!).paddingLeft);
    let arrowsOut = 0, arrowsOnWords = 0;
    const arrows = [...document.querySelectorAll('.mk-arrow')];
    for (const g of arrows) { const x = R(g); if (x.l < root.left - 1 || x.r > root.left + pad) arrowsOut++; arrowsOnWords += hit(x); }
    // the layers take no pointer: the point at the middle of a word is the word
    const blocked = [...document.querySelectorAll<HTMLElement>('.w')].filter(e => { const x = e.getBoundingClientRect(); return !!document.elementFromPoint((x.left + x.right) / 2, (x.top + x.bottom) / 2)?.closest('.mk-layers'); }).length;
    // each word on a highlight is black or white (the contrast rule)
    const inks = new Set([...document.querySelectorAll<HTMLElement>('.w.hl')].map(e => getComputedStyle(e).color));
    return { shapes: document.querySelectorAll('.mk-shape').length, lines: document.querySelectorAll('.mk-line').length, arrows: arrows.length, overlapsLines, overlapsBorders, filled, arrowsOut, arrowsOnWords, blocked, inks: [...inks] };
  });
  expect(r.shapes).toBeGreaterThan(60);
  expect(r.lines).toBeGreaterThan(100);
  expect(r.arrows).toBe(14);
  expect(r).toMatchObject({ overlapsLines: 0, overlapsBorders: 0, filled: 0, arrowsOut: 0, arrowsOnWords: 0, blocked: 0 });
  for (const ink of r.inks) expect(['rgb(0, 0, 0)', 'rgb(255, 255, 255)']).toContain(ink);
});

test('narrowing the window places the layers again on the words', async ({ page }, info) => {
  test.skip(info.project.name === 'webkit-phone', 'resized on the desktop');
  await ready(page, [mark('box', 'blue', 7, 0, 4), mark('underline', 'green', 7, 0, 4, { lines: 1 })]);
  const first = (sel: string) => page.locator(sel).first().evaluate(e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top }; });
  const before = await first('.mk-line');
  await page.setViewportSize({ width: 600, height: 900 });
  await page.evaluate(() => new Promise(r => setTimeout(r, 200)));
  const k = await page.evaluate(() => { const d = (window as any).__wb.drawn; return d.v.findIndex((v: number) => v === 7); });
  const word = await page.locator(`.w[data-k="${k}"]`).evaluate(e => { const r = e.getBoundingClientRect(); return { l: r.left, b: r.bottom }; });
  const after = await first('.mk-line');
  expect(after.l).toBeCloseTo(word.l, 0);
  expect(after.t).toBeGreaterThan(word.b - 1);
  expect(after.l).not.toBeCloseTo(before.l, 0);
});
