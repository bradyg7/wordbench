import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// design/features/words: the word card (W6, W11) and the hover card (W5). Words, lemmas and definitions come from the
// database-generated fixture; no scripture or lexicon text is typed here.
const fx = JSON.parse(readFileSync(new URL('../public/fixtures/NUM.25.json', import.meta.url), 'utf8'));
const zeal = fx.words['11.24'];

async function ready(page: Page) {
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  // the fixture chapter holds marks on verse 11; a click on a marked word opens the mark card (marks T8), so these word-card tests read it unmarked
  await page.evaluate(() => { const w = (window as any).__wb; w.drawn.marks.marks = []; w.repaint(); });
}

async function wordBox(page: Page, v: number, i: number) {
  const k = await page.evaluate(([v, i]) => { const d = (window as any).__wb.drawn; return d.v.findIndex((vv: number, k: number) => vv === v && d.i[k] === i); }, [v, i]);
  const el = page.locator(`.w[data-k="${k}"]`);
  await el.scrollIntoViewIfNeeded();
  return (await el.boundingBox())!;
}

test('a click on a word opens the word card: the one door, BDB and Webster’s, no Strong’s or Every use', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  await ready(page);
  const box = await wordBox(page, 11, 24);
  const before = await page.evaluate(() => document.getElementById('scroller')!.scrollTop);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const card = page.locator('.word-card');
  await expect(card).toBeVisible();
  await expect(card.locator('.def')).toHaveText(zeal.lexicon.definition);
  await expect(card.locator('.wc-door')).toHaveText('In the Concordance');
  await expect(card.locator('.wc-bdb')).toHaveText('BDB');
  await expect(card.locator('.wc-webster')).toHaveText('Webster’s');
  await expect(card.getByRole('button', { name: /Every use|Strong’s/ })).toHaveCount(0);
  await expect(card.locator('.wc-float')).toBeVisible();
  // the reader behind it is as it was, and closing leaves it so (5f45, 94a1)
  await card.locator('.wc-close').click();
  await expect(card).toHaveCount(0);
  expect(await page.evaluate(() => document.getElementById('scroller')!.scrollTop)).toBe(before);
});

test('the word card is dragged by its handle, sized from its corner, and stays where it was put', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  await ready(page);
  const box = await wordBox(page, 11, 24);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const card = page.locator('.word-card');
  await expect(card).toBeVisible();
  const a = (await card.boundingBox())!;
  const handle = (await card.locator('.wc-head').boundingBox())!;
  await page.mouse.move(handle.x + 40, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + 40 - 120, handle.y + handle.height / 2 - 60, { steps: 6 });
  await page.mouse.up();
  const b = (await card.boundingBox())!;
  expect(Math.round(a.x - b.x)).toBe(120);
  expect(Math.round(a.y - b.y)).toBe(60);
  // sized from the corner
  const corner = (await card.locator('.card-size').boundingBox())!;
  await page.mouse.move(corner.x + 8, corner.y + 8);
  await page.mouse.down();
  await page.mouse.move(corner.x + 8 + 60, corner.y + 8 + 40, { steps: 6 });
  await page.mouse.up();
  const c = (await card.boundingBox())!;
  expect(c.width).toBeGreaterThan(b.width + 40);
  expect(c.x).toBe(b.x);
  // it stays: the reader scrolling or another click on the reader does not put it back
  await page.mouse.click(5, 5);
  await expect(card).toBeVisible();
  expect(Math.round((await card.boundingBox())!.x)).toBe(Math.round(c.x));
});

test('with the Reading setting on the Concordance, a click on a word does not open the card', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  await ready(page);
  await page.evaluate(() => { document.documentElement.dataset.wordclick = 'concordance'; });
  const box = await wordBox(page, 11, 24);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('.word-card')).toHaveCount(0);
});

test('the hover card shows the lemma, sound and Strong’s words, and nothing to click', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  await ready(page);
  await page.evaluate(() => { document.documentElement.dataset.hover = 'on'; });
  const z = await wordBox(page, 11, 24);
  await page.mouse.move(z.x + 5, z.y + z.height / 2);
  const hover = page.locator('.hovercard');
  await expect(hover).toBeVisible();
  await expect(hover).toContainText(zeal.lexicon.strong);
  await expect(hover).toContainText(zeal.lexicon.translit);
  await expect(hover.locator('.def')).toHaveText(zeal.lexicon.definition);
  expect(await hover.locator('button, a, input').count()).toBe(0);
  // hover off: nothing shows
  await page.mouse.move(5, 5);
  await expect(hover).toHaveCount(0);
  await page.evaluate(() => { document.documentElement.dataset.hover = 'off'; });
  await page.mouse.move(z.x + 5, z.y + z.height / 2);
  await page.waitForTimeout(500);
  await expect(page.locator('.hovercard')).toHaveCount(0);
});

test('at phone width the word card is a sheet with the same parts', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-phone', 'phone');
  await ready(page);
  const box = await wordBox(page, 11, 24);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  const sheet = page.locator('.sheet.word-card');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('.wc-door')).toHaveText('In the Concordance');
  await expect(sheet.locator('.wc-bdb')).toHaveText('BDB');
  await expect(sheet.locator('.wc-webster')).toHaveText('Webster’s');
  const b = (await sheet.boundingBox())!;
  expect(Math.round(b.y + b.height)).toBe(844);   // a sheet over the bottom
  for (const name of ['.wc-door', '.wc-bdb', '.wc-webster']) {
    const r = (await sheet.locator(name).boundingBox())!;
    expect(r.x + r.width).toBeLessThanOrEqual(390);
  }
});

// ---- the verse card (W4, W8, W10); opened as a reference in a page opens it ------------------------------------------------
const verseFx = JSON.parse(readFileSync(new URL('../public/fixtures/wb/scripture-num-25-11.json', import.meta.url), 'utf8'));

async function openVerseCard(page: Page) {
  await ready(page);
  await page.evaluate(async () => {
    const a = document.createElement('a');
    a.id = 'fake-ref';
    a.textContent = 'Num 25:11';
    a.style.cssText = 'position:fixed;left:700px;top:300px;z-index:1';
    document.body.append(a);
    const m = await import('/src/verses.ts');
    void m.verseCard('Num 25:11', a);
  });
  await page.locator('.verse-card').waitFor();
}

test('a reference opens the verse alone: its text, three whole tabs, Read the chapter, one count line', async ({ page }, info) => {
  await openVerseCard(page);
  const card = page.locator('.verse-card');
  await expect(card.locator('.sv-t')).toHaveText(verseFx.verses.map((v: any) => v.text));
  await expect(card.locator('.vc-tab')).toHaveText(['Interlinear', 'In the Concordance', 'Definitions']);
  await expect(card.locator('.vc-open .open-split-go')).toContainText('Read the chapter');
  await expect(card.locator('.wc-pages')).toHaveText('No page names this verse');
  const cb = (await card.boundingBox())!;
  for (const t of await card.locator('.vc-tab').all()) {
    const r = (await t.boundingBox())!;
    expect(r.x).toBeGreaterThanOrEqual(cb.x);
    expect(r.x + r.width).toBeLessThanOrEqual(cb.x + cb.width);
    expect(await t.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
  }
  expect(await card.locator('.vc-ver').textContent()).toContain('KJV');
});

test('the verse card is dragged, sized to 300 wide with every tab and Read the chapter whole, and closed', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  await openVerseCard(page);
  const card = page.locator('.verse-card');
  await expect(card.locator('.vc-float')).toBeVisible();
  await expect(card.locator('.vc-as-tab')).toBeVisible();
  const a = (await card.boundingBox())!;
  const h0 = (await card.locator('.vc-head').boundingBox())!;
  await page.mouse.move(h0.x + 20, h0.y + h0.height / 2);
  await page.mouse.down();
  await page.mouse.move(h0.x - 80, h0.y + h0.height / 2 - 40, { steps: 5 });
  await page.mouse.up();
  const b = (await card.boundingBox())!;
  expect(Math.round(a.x - b.x)).toBe(100);
  // sizing to 300 wide: the tabs take a second line, none is cut
  const corner = (await card.locator('.card-size').boundingBox())!;
  await page.mouse.move(corner.x + 8, corner.y + 8);
  await page.mouse.down();
  await page.mouse.move(corner.x + 8 - (b.width - 300), corner.y + 8, { steps: 6 });
  await page.mouse.up();
  const c = (await card.boundingBox())!;
  expect(Math.round(c.width)).toBe(300);
  for (const sel of ['.vc-tab-interlinear', '.vc-tab-concordance', '.vc-tab-definitions', '.vc-open']) {
    const r = (await card.locator(sel).boundingBox())!;
    expect(r.x).toBeGreaterThanOrEqual(c.x);
    expect(r.x + r.width).toBeLessThanOrEqual(c.x + c.width);
  }
  for (const t of await card.locator('.vc-tab').all()) expect(await t.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
  // a tab opens its panel in the card; the card stays where it was put
  await card.locator('.vc-tab-concordance').click();
  expect(Math.round((await card.boundingBox())!.x)).toBe(Math.round(c.x));
  await card.locator('.vc-close').click();
  await expect(card).toHaveCount(0);
});

test('at phone width the verse card is a sheet over the bottom with the same three tabs whole', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-phone', 'phone');
  await openVerseCard(page);
  const sheet = page.locator('.sheet.verse-card');
  await expect(sheet).toBeVisible();
  const sb = (await sheet.boundingBox())!;
  expect(Math.round(sb.y + sb.height)).toBe(844);
  await expect(sheet.locator('.vc-tab')).toHaveText(['Interlinear', 'In the Concordance', 'Definitions']);
  for (const t of await sheet.locator('.vc-tab').all()) {
    const r = (await t.boundingBox())!;
    expect(r.x + r.width).toBeLessThanOrEqual(390);
    expect(await t.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
  }
  await expect(sheet.locator('.vc-open')).toBeVisible();
});

// ---- years of study: one count line, whatever the count (W9; W-5, 2bc9) --------------------------------------------------
test('a word named by 412 pages shows one count line and the card is no taller than for 2', async ({ page }, info) => {
  const pagesOf = (n: number) => ({ anchor: 'H7065', count: n, pages: Array.from({ length: n }, (_, k) => ({ id: `n_${k}`, title: `Page ${k + 1}`, kind: 'note', created: '2026-01-01T00:00:00Z' })) });
  const measure = async (n: number) => {
    await page.route('**/fixtures/wb/anchor-h7065-pages.json', r => r.fulfill({ json: pagesOf(n) }));
    await ready(page);
    const box = await wordBox(page, 11, 24);
    if (info.project.name === 'webkit-phone') await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    const card = page.locator('.word-card');
    const line = card.locator('.wc-pages');
    await expect(line).toHaveText(`${n} pages name this word`);
    const out = { card: (await card.boundingBox())!.height, line: (await line.boundingBox())!.height, text: await line.evaluate(e => e.getClientRects().length) };
    // the line opens a list of titles, never a page's text
    await line.click();
    expect(await card.locator('.wc-page-list button').count()).toBe(Math.min(n, 50));
    expect(await card.locator('.wc-page-list').textContent()).not.toContain('\n#');
    await page.unroute('**/fixtures/wb/anchor-h7065-pages.json');
    return out;
  };
  const two = await measure(2);
  const many = await measure(412);
  expect(many.line).toBe(two.line);       // one line, the same height as the line for 2
  expect(many.card).toBeLessThanOrEqual(two.card);
});

// ---- history and reopen -------------------------------------------------------------------------------------------------
test('opening and closing a card adds no history step; floating it adds one', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  await openVerseCard(page);
  const steps = () => page.locator('#trailline .trail-step').count();
  const before = await steps();
  await page.locator('.verse-card .vc-close').click();
  await openVerseCard(page);
  await page.locator('.verse-card .vc-close').click();
  expect(await steps()).toBe(before);
  await openVerseCard(page);
  await page.locator('.verse-card .vc-float').click();
  await expect(page.locator('.pane-versecard')).toHaveCount(1);
  expect(await steps()).toBe(before + 1);
});

test('Open as a tab makes a tab in the study column, and a floated word card reopens from its key', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  await openVerseCard(page);
  await page.locator('.verse-card .vc-as-tab').click();
  await expect(page.locator('.pane-versecard')).toHaveCount(1);
  expect(await page.evaluate(() => (window as any).__wb.dock().panes.find((p: any) => p.kind === 'versecard').side)).toBe('left');
  const key = `wordcard|NUM.25:11.24`;
  await page.evaluate(async k => { const m = await import('/src/actions.ts'); await m.reopen(k); }, key);
  await expect(page.locator('.pane-wordcard .wc-door')).toHaveText('In the Concordance');
  expect(await page.evaluate(() => (window as any).__wb.dock().panes.find((p: any) => p.kind === 'wordcard').side)).toBe('float');
});
