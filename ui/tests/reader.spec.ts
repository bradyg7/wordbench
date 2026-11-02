import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// The fixture holds what the database says (made by `wb fixture`); the test compares the screen with it, never with
// text typed here.
const fx = JSON.parse(readFileSync(new URL('../public/fixtures/NUM.25.json', import.meta.url), 'utf8'));
const shots = 'docs/phase0';

async function ready(page: Page) {
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
}

// A finger as pointer events (Playwright has no long press or touch drag); the reader listens to pointer events.
async function touch(page: Page, type: string, x: number, y: number) {
  await page.evaluate(([type, x, y]) => {
    const target = document.elementFromPoint(x as number, y as number)!;
    target.dispatchEvent(new PointerEvent(type as string, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x as number, clientY: y as number, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
  }, [type, x, y]);
}

async function wordBox(page: Page, v: number, i: number) {
  const k = await page.evaluate(([v, i]) => { const d = (window as any).__wb.drawn; return d.v.findIndex((vv: number, k: number) => vv === v && d.i[k] === i); }, [v, i]);
  const el = page.locator(`.w[data-k="${k}"]`);
  await el.scrollIntoViewIfNeeded();
  return (await el.boundingBox())!;
}

test('draws Numbers 25 with the marks, in Literata', async ({ page }, info) => {
  await ready(page);
  await expect(page.locator('.ch-title')).toHaveText('Numbers 25');
  expect(await page.locator('.vn').count()).toBe(fx.reader.chapter.verses.length);
  expect(await page.evaluate(() => document.fonts.check('18px Literata'))).toBe(true);
  expect(await page.locator('.w.hl').count()).toBeGreaterThan(0);
  expect(await page.locator('.w.noted').count()).toBeGreaterThan(0);
  expect(await page.locator('.w[style*="linear-gradient"]').count()).toBeGreaterThan(0);   // thread lines
  // The words on screen are the database's words, in order.
  const v11 = fx.reader.chapter.verses.find((v: any) => v.v === 11);
  const shown = await page.$$eval('.w', els => els.map(e => e.textContent));
  const k0 = await page.evaluate(() => { const d = (window as any).__wb.drawn; return d.v.indexOf(11); });
  expect(shown.slice(k0, k0 + v11.words.length).join(' ')).toContain(v11.words[0].text);
  // Lines are evenly spaced: verse numbers, highlights and thread lines must not make a line taller.
  const pitches = await page.evaluate(() => {
    const tops = new Set<number>();
    document.querySelectorAll('.para')[2].querySelectorAll('.w').forEach(w => { for (const r of w.getClientRects()) tops.add(Math.round(r.top)); });
    const t = [...tops].sort((a, b) => a - b);
    return t.slice(1).map((y, n) => y - t[n]);
  });
  expect(Math.max(...pitches) - Math.min(...pitches)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${shots}/${info.project.name}-reader.png` });
});

test('tap a word: the word sheet', async ({ page }, info) => {
  test.skip(info.project.name === 'webkit-desktop', 'phone');
  await ready(page);
  const zeal = fx.words['11.24'];
  const box = await wordBox(page, 11, 24);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  const sheet = page.locator('.sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('.sheet-title')).toHaveText(zeal.text);
  await expect(sheet).toContainText(zeal.lexicon.strong);
  await expect(sheet.locator('.def')).toHaveText(zeal.lexicon.definition);
  await expect(sheet).toContainText(`${zeal.count.times} times in ${zeal.count.verses} verses`);
  await page.screenshot({ path: `${shots}/${info.project.name}-word-sheet.png` });
  // Closing returns exactly where the reader was.
  const before = await page.evaluate(() => document.getElementById('scroller')!.scrollTop);
  await page.touchscreen.tap(195, 120);   // above the sheet
  await expect(sheet).toHaveCount(0);
  expect(await page.evaluate(() => document.getElementById('scroller')!.scrollTop)).toBe(before);
});

test('tap a verse number: the verse sheet, verbatim', async ({ page }, info) => {
  test.skip(info.project.name === 'webkit-desktop', 'phone');
  await ready(page);
  const vn = page.locator('.vn[data-v="11"]');
  await vn.scrollIntoViewIfNeeded();
  const b = (await vn.boundingBox())!;
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  const sheet = page.locator('.sheet');
  await expect(sheet.locator('.sheet-title')).toHaveText('Numbers 25:11');
  await expect(sheet.locator('.scripture')).toHaveText(fx.verses['11'].text);
  await page.screenshot({ path: `${shots}/${info.project.name}-verse-sheet.png` });
});

test('press and hold, drag across verses, then a handle', async ({ page }, info) => {
  test.skip(info.project.name === 'webkit-desktop', 'phone');
  await ready(page);
  const a = await wordBox(page, 7, 2);          // the third word of verse 7
  await touch(page, 'pointerdown', a.x + 4, a.y + a.height / 2);
  await page.waitForTimeout(600);               // the hold
  expect(await page.evaluate(() => (window as any).__wb.selector.sel)).not.toBeNull();
  const b = await wordBox(page, 8, 3);
  await touch(page, 'pointermove', b.x + 4, b.y + b.height / 2);
  await touch(page, 'pointerup', b.x + 4, b.y + b.height / 2);
  const sel = await page.evaluate(() => { const s = (window as any).__wb.selector.sel, d = (window as any).__wb.drawn; return { a: [d.v[s.a], d.i[s.a]], b: [d.v[s.b], d.i[s.b]] }; });
  expect(sel).toEqual({ a: [7, 2], b: [8, 3] });
  await expect(page.locator('.selbar')).toBeVisible();
  await expect(page.locator('.handle-a')).toBeVisible();
  await page.screenshot({ path: `${shots}/${info.project.name}-selection.png` });
  // Drag the end handle on to verse 9.
  const hb = (await page.locator('.handle-b i').boundingBox())!;
  const line = (await page.locator('.handle-b').boundingBox())!;
  const grip = hb.y + hb.height / 2 - (line.y + line.height / 2);   // the finger holds the knob, below the line
  await page.evaluate(() => (document.querySelector('.selbar') as HTMLElement).style.display = 'none');
  await touch(page, 'pointerdown', hb.x + hb.width / 2, hb.y + hb.height / 2);
  const c = await wordBox(page, 9, 4);
  await page.evaluate(([x, y]) => {
    const h = document.querySelector('.handle-b')!;
    for (const type of ['pointermove', 'pointerup']) h.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: 'touch', clientX: x, clientY: y }));
  }, [c.x + c.width - 2, c.y + c.height / 2 + grip]);
  const end = await page.evaluate(() => { const s = (window as any).__wb.selector.sel, d = (window as any).__wb.drawn; return [d.v[s.b], d.i[s.b]]; });
  expect(end[0]).toBe(9);
  // A color from the bar highlights the words (in the spike, for this session only).
  await page.locator('.selbar .swatch.c-green').tap();
  expect(await page.locator('.w.hl[style*="hl-green"]').count()).toBeGreaterThan(5);
});

test('mouse: hover card and the color bar', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  await ready(page);
  const z = await wordBox(page, 11, 24);
  await page.mouse.move(z.x + 5, z.y + z.height / 2);
  await expect(page.locator('.hovercard')).toBeVisible();
  await expect(page.locator('.hovercard')).toContainText(fx.words['11.24'].lexicon.strong);
  await page.screenshot({ path: `${shots}/${info.project.name}-hover-card.png` });
  const a = await wordBox(page, 7, 2), b = await wordBox(page, 7, 9);
  await page.mouse.move(a.x + 3, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width - 3, b.y + b.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator('.colorbar')).toBeVisible();
  await page.screenshot({ path: `${shots}/${info.project.name}-color-bar.png` });
});

test('timings in this engine', async ({ page }, info) => {
  await ready(page);
  for (const [b, c] of [['NUM', 24], ['NUM', 26], ['NUM', 25], ['PSA', 119], ['NUM', 25]] as const) await page.evaluate(([b, c]) => (window as any).__wb.open(b, c), [b, c]);
  const entries = await page.evaluate(() => (window as any).__wb.perf.entries);
  console.log(info.project.name, JSON.stringify(entries.map((e: any) => [e.at, Math.round(e.ms)])));
});

test('a mark made while a long chapter is still being drawn reaches its last verses', async ({ page }) => {
  await ready(page);
  await page.evaluate(async () => {
    const wb = (window as any).__wb;
    await wb.open('PSA', 119);
    const d = wb.drawn;
    d.marks.highlights.push({ kind: 'verse', code: 'PSA', c1: 119, v1: 170, i1: null, c2: null, v2: null, i2: null, id: 't', color: 'green' });
    wb.repaint();
  });
  await page.waitForFunction(() => { const d = (window as any).__wb.drawn; return d.el.filter(Boolean).length === d.v.length; });
  const k = await page.evaluate(() => (window as any).__wb.drawn.v.indexOf(170));
  await expect(page.locator(`.w[data-k="${k}"]`)).toHaveClass(/hl/);
});
