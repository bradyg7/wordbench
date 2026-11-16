import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// The fixture holds what the database says (made by `wb fixture`); the test compares the screen with it, never with
// text typed here.
const fx = JSON.parse(readFileSync(new URL('../public/fixtures/NUM.25.json', import.meta.url), 'utf8'));
const shots = 'docs/phase2';

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
  await page.evaluate(() => { document.documentElement.dataset.hover = 'on'; });   // off by default: a click opens the card
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

// Phase 2: the desktop shell around the reader. (The panes and the Notebook call Rust, so they are checked in the app
// itself by measure/desk.mjs; here WebKit checks the layout the iPad and Mac web views will draw.)
test('desktop: the toolbar with the command field, opened by backtick', async ({ page }, info) => {
  test.skip(info.project.name === 'webkit-phone', 'desktop');
  await ready(page);
  expect(await page.evaluate(() => document.documentElement.dataset.size)).toBe('large');
  for (const id of ['#cmd', '#tb-notebook', '#hl-menu']) await expect(page.locator(id)).toBeVisible();
  await expect(page.locator('#tabs')).toBeHidden();
  await page.locator('.ch-title').click();
  await page.keyboard.press('Backquote');
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('cmd');
  await page.keyboard.press('Escape');
  await expect(page.locator('#place .place-label')).toHaveText('Numbers 25');
});

// The dock in WebKit (tier 1): panes filled here with a word, not from Rust. The verse at the top is read as the desk
// check reads it.
const topVerse = (page: Page) => page.evaluate(() => {
  const sc = document.getElementById('scroller')!, r = document.getElementById('reader')!;
  let v = 1;
  for (const e of r.querySelectorAll<HTMLElement>('.vn')) { if (r.offsetTop + e.offsetTop - 12 > sc.scrollTop + 2) break; v = +e.dataset.v!; }
  return v;
});
const openPane = (page: Page, key: string, side: string) => page.evaluate(([key, side]) => {
  (window as any).__wb.dock().open('test', key, key, side, (el: HTMLElement) => { el.textContent = key; });
}, [key, side]);

test('desktop: a band across the reader and floats each on their own, the verse kept', async ({ page }, info) => {
  test.skip(info.project.name === 'webkit-phone', 'desktop');
  await ready(page);
  await page.evaluate(() => (window as any).__wb.open('NUM', 25, 10));
  await page.waitForTimeout(300);
  const v0 = await topVerse(page);
  await openPane(page, 'One', 'left');
  await openPane(page, 'Two', 'left');
  await expect(page.locator('.dock-left.open .tab')).toHaveCount(2);
  const y0 = (await page.locator('#scroller').boundingBox())!.y;
  await page.evaluate(() => { const d = (window as any).__wb.dock(); d.move(d.find('One'), 'top'); });
  await expect(page.locator('.dock-top.open .pane-test')).toHaveCount(1);
  expect((await page.locator('#scroller').boundingBox())!.y).toBeGreaterThan(y0 + 100);
  expect(await topVerse(page)).toBe(v0);
  await page.evaluate(() => { const d = (window as any).__wb.dock(); d.move(d.find('One'), 'float'); d.move(d.find('Two'), 'float'); });
  await expect(page.locator('.dock-float')).toHaveCount(2);
  await expect(page.locator('.dock-top.open')).toHaveCount(0);
  expect(await topVerse(page)).toBe(v0);
  await page.locator('.dock-float').nth(1).locator('.strip-btn[aria-label="Minimize"]').click();
  await expect(page.locator('.dock-chip')).toHaveCount(1);
  await expect(page.locator('.dock-float')).toHaveCount(1);
  await page.screenshot({ path: `${shots}/${info.project.name}-dock-floats.png` });
});

test('phone: a pane is the whole screen with the way back', async ({ page }, info) => {
  test.skip(info.project.name === 'webkit-desktop', 'phone');
  await ready(page);
  await openPane(page, 'One', 'float');
  await expect(page.locator('.pane-sheet.open .pane-test')).toHaveText('One');
  await expect(page.locator('.pane-sheet .back-pill')).toContainText('Back to');
  for (const sel of ['.dock-col.open', '.dock-band.open', '.dock-float', '.dock-chips.open']) await expect(page.locator(sel)).toHaveCount(0);
  await page.locator('.pane-sheet .back-pill').click();
  await expect(page.locator('.pane-sheet.open')).toHaveCount(0);
  await expect(page.locator('#place .place-label')).toHaveText('Numbers 25');
});

test('phone: the tabs and the pen, no desktop toolbar', async ({ page }, info) => {
  test.skip(info.project.name === 'webkit-desktop', 'phone');
  await ready(page);
  expect(await page.evaluate(() => document.documentElement.dataset.size)).toBe('compact');
  await expect(page.locator('#tabs')).toBeVisible();
  await expect(page.locator('#pen')).toBeVisible();
  for (const id of ['#cmd', '#tb-notebook']) await expect(page.locator(id)).toBeHidden();
});

// The findings of 2026-11-04 and 11-05 (docs/phase2-results.md section 16), the parts that need no Rust.
test('desktop: a click on a verse number selects the verse with the color bar; a click away clears it', async ({ page }, info) => {
  test.skip(info.project.name === 'webkit-phone', 'desktop');
  await ready(page);
  const vn = page.locator('#reader .vn[data-v="7"]');
  await vn.scrollIntoViewIfNeeded();
  await vn.click();
  await expect(page.locator('.colorbar.verse-bar')).toBeVisible();
  const words = await page.evaluate(() => (window as any).__wb.drawn.v.filter((v: number) => v === 7).length);
  await expect(page.locator('#reader .w.sel')).toHaveCount(words);
  await expect(page.locator('#reader .vn.vsel')).toHaveCount(1);
  await page.locator('.ch-title').click();
  await expect(page.locator('.colorbar')).toHaveCount(0);
  await expect(page.locator('#reader .w.sel, #reader .vn.vsel')).toHaveCount(0);
});

test('the findings box takes a pasted picture and says no to a file over 10 MB; it fits the width (C1)', async ({ page }, info) => {
  await ready(page);
  await page.locator('#reader').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+Shift+KeyJ');
  const box = page.locator('.finding-box');
  await expect(box.locator('.finding-browse')).toBeVisible();
  await expect(box.locator('.finding-attach')).toContainText('10 MB');
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(64)], 'image.png', { type: 'image/png' }));
    document.querySelector('.finding-field')!.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
  });
  await expect(box.locator('.file-chip-name')).toHaveText([/^pasted \d{4}-\d\d-\d\d \d{6}\.png$/]);
  await box.locator('.file-pick').setInputFiles({ name: 'big.bin', mimeType: 'application/octet-stream', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
  await expect(page.locator('.toast')).toContainText('10 MB at most');
  await expect(box.locator('.file-chip')).toHaveCount(1);
  const fits = await box.evaluate(b => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && [...b.querySelectorAll('.file-chip, .finding-attach')].every(e => e.getBoundingClientRect().right <= r.right + 0.5); });
  expect(fits).toBe(true);
  await page.screenshot({ path: `${shots}/${info.project.name}-finding-files.png` });
  await box.locator('.file-chip-x').click();
  await expect(box.locator('.file-chip')).toHaveCount(0);
});

test('the pen: on the phone only', async ({ page }, info) => {
  await ready(page);
  if (info.project.name === 'webkit-phone') await expect(page.locator('#pen')).toBeVisible();
  else await expect(page.locator('#pen')).toBeHidden();
});

test('desktop: one part of a split column minimizes alone; the tab list closes a tab', async ({ page }, info) => {
  test.skip(info.project.name === 'webkit-phone', 'desktop');
  await ready(page);
  await openPane(page, 'One', 'left');
  await openPane(page, 'Two', 'left');
  await openPane(page, 'Three', 'right');
  await page.evaluate(() => { const d = (window as any).__wb.dock(); d.move(d.find('Three'), 'right'); });   // a pane of the same kind opens beside the others
  // Two split below One, as a drop on One's lower half does
  await page.evaluate(() => { const d = (window as any).__wb.dock(); d.drop(d.find('Two'), { to: 'split', group: d.groupOf(d.find('One')), after: true }); });
  await expect(page.locator('.dock-left .dock-group')).toHaveCount(2);
  await page.locator('.dock-left .dock-group').nth(1).locator('.strip-btn[aria-label="Minimize"]').click();
  await expect(page.locator('.dock-left.open .dock-group')).toHaveCount(1);
  await expect(page.locator('.dock-left .dock-restore-bar')).toContainText('Two');
  await expect(page.locator('.dock-right.open')).toHaveCount(1);
  await page.locator('.dock-left .dock-restore-bar').click();
  await expect(page.locator('.dock-left .dock-group')).toHaveCount(2);
  await openPane(page, 'Four', 'right');
  await page.evaluate(() => { const d = (window as any).__wb.dock(); d.move(d.find('Four'), 'right'); });
  await page.locator('.dock-right .tab-list').click();
  await expect(page.locator('.menu .tab-list-close')).toHaveCount(2);
  await page.locator('.menu .tab-list-row', { hasText: 'Three' }).locator('.tab-list-close').click();
  await expect(page.locator('.menu .tab-list-row')).toHaveCount(0);   // one tab left: the list closes
  expect(await page.evaluate(() => (window as any).__wb.dock().panes.map((p: any) => p.title).sort().join())).toBe('Four,One,Two');
});

test('desktop: layer menu and commands repaint both readers in place and persist', async ({ page }, info) => {
  test.skip(info.project.name === 'webkit-phone', 'desktop');
  const mark = (v: number, id: string, color?: string) => ({
    kind: 'verse', code: 'NUM', c1: 25, v1: v, i1: null, c2: null, v2: null, i2: null, id, color,
  });
  const chapter = {
    ...fx,
    reader: {
      ...fx.reader,
      marks: { highlights: [mark(10, 'fill', 'yellow')], threads: [mark(10, 'trial', 'green')],
        notes: [mark(11, 'note')], thread_names: { trial: 'Trial thread' } },
      questions: [{ id: 'question', v: 12, text: 'Test question' }],
    },
  };
  await page.route('**/fixtures/NUM.25.json', r => r.fulfill({ json: chapter }));
  await page.route('**/fixtures/wb/text-num-25-10-version-kjv-json.json', r =>
    r.fulfill({ json: { verses: [{ book: fx.reader.chapter.name, c: 25, v: 10 }] } }));
  await page.route('**/fixtures/wb/thread-list.json', r => r.fulfill({ json: [{ name: 'Trial thread', id: 'trial', color: 'green' }] }));
  for (const [word, on] of [['off', false], ['on', true]] as const) {
    await page.route('**/fixtures/wb/parse-highlights-' + word + '.json', r => r.fulfill({ json: { action: { cmd: 'highlights', on } } }));
  }

  const main = page.locator('#reader');
  const second = page.locator('.pane-reader2 .reader2');
  async function openSecond() {
    await main.locator('.vn[data-v="10"]').click({ button: 'right' });
    await page.getByRole('button', { name: 'Open in a new tab', exact: true }).click();
    await expect(second.locator('.vn-asked[data-v="10"]')).toBeAttached();
  }
  async function marks(fill: boolean, thread: boolean) {
    for (const reader of [main, second]) {
      const firstWord = reader.locator('.vn[data-v="10"] + .w');
      if (fill) await expect(firstWord).toHaveClass(/\bhl\b/);
      else await expect(firstWord).not.toHaveClass(/\bhl\b/);
      if (thread) await expect(firstWord).toHaveAttribute('style', /linear-gradient/);
      else await expect(firstWord).not.toHaveAttribute('style', /linear-gradient/);
      await expect(reader.locator('.vn.vnote[data-v="11"], .vn.vq[data-v="12"]')).toHaveCount(2);
    }
    await expect(second.locator('.vn-asked[data-v="10"]')).toBeAttached();
  }

  await ready(page);
  await openSecond();
  await marks(true, true);
  const readScroll = () => page.evaluate(() => ['#scroller', '.reader2-pane'].map(s => document.querySelector(s)!.scrollTop));
  const position = await readScroll();
  await page.locator('#hl-menu').click();
  await page.getByRole('button', { name: 'Your highlights', exact: true }).click();
  await marks(false, true);
  await page.getByRole('button', { name: 'Trial thread', exact: true }).click();
  await marks(false, false);
  await page.keyboard.press('Escape');
  expect(await readScroll()).toEqual(position);

  await page.reload();
  await page.waitForFunction(() => (window as any).__wbReady);
  await openSecond();
  await marks(false, false);
  await page.locator('#hl-menu').click();
  await page.getByRole('button', { name: 'Your highlights', exact: true }).click();
  await page.getByRole('button', { name: 'Trial thread', exact: true }).click();
  await page.keyboard.press('Escape');
  await marks(true, true);
  expect(await page.evaluate(() => (window as any).__wb.run('highlights off'))).toMatchObject({ ok: true });
  await marks(false, false);
  expect(await page.evaluate(() => (window as any).__wb.run('highlights on'))).toMatchObject({ ok: true });
  await marks(true, true);
});

test('an unlinked word opens the interlinear for its verse', async ({ page }, info) => {
  const phone = info.project.name === 'webkit-phone';
  const [key, word] = Object.entries(fx.words).find(([, value]: [string, any]) => !value.strong)!;
  const [v, i] = key.split('.').map(Number);
  await page.route(`**/fixtures/wb/interlinear-num-25-${v}.json`, r => r.fulfill({
    json: { lang: 'heb', book: { name: fx.reader.chapter.name }, verses: [{ c: 25, v, words: [] }] },
  }));
  await ready(page);
  const box = await wordBox(page, v, i);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  if (phone) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  const card = page.getByRole('dialog');
  await expect(card.getByText('No direct Strong’s tag on this word.')).toBeVisible();
  await card.getByRole('button', { name: 'Verse interlinear' }).click();
  await expect(page.locator('.pane-interlinear .pane-title')).toHaveText((word as any).reference);
  await expect(card).toHaveCount(0);
});

// The words on a highlight are black or white by WCAG contrast with its color, in either theme (highlights, 2026-11-16).
test('highlighted words take the higher-contrast ink, light and dark', async ({ page }) => {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await ready(page);
    const r = await page.evaluate(() => {
      const lum = (c: string) => {
        const [r, g, b] = c.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      return [...document.querySelectorAll<HTMLElement>('.w.hl')].slice(0, 20).map(e => {
        const s = getComputedStyle(e);
        const bg = lum(s.backgroundColor), ink = lum(s.color);
        return { ink: s.color, ok: ratio(bg, ink) >= ratio(bg, 1 - ink) && ratio(bg, ink) >= 4.5 };
      });
    });
    expect(r.length).toBeGreaterThan(0);
    for (const x of r) { expect(x.ok).toBe(true); expect(['rgb(0, 0, 0)', 'rgb(255, 255, 255)']).toContain(x.ink); }
  }
});
