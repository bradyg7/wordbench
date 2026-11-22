import { expect, test, type Page } from '@playwright/test';

// design/features/notebook row 37 (NB15, a page at every width): a floating tab (37a, 560 px), a narrow pane (37b, 460 px) and a
// phone (37c, 390 px, the webkit-phone project). The column fits its pane, the handle (+ and grip) sits inside the pane's own
// margin, the selection bar and every menu fit the window (a bottom sheet on a phone), and nothing jumps when they open.
// No Rust here: a small page server stands in for `wb`.
const TITLE = 'Zeal in Numbers 25';
const TEXTS = [
  '## Where the word first appears in this story',
  'Where the word first appears in this story, with a long unbroken-reference-like-this-one-Numbers-25-11-to-13 that must wrap.',
  '- A list item that is long enough to wrap onto a second line in a narrow pane',
  '> A quote block in the page, long enough to wrap in a narrow pane as well.',
  'The last block of the page.',
];

async function openPage(page: Page, setup?: () => void) {
  const kindOf = (t: string) => (/^#{1,3} /.test(t) ? 'heading' : /^- /.test(t) ? 'bullet' : /^> /.test(t) ? 'quote' : 'paragraph');
  const blocks = () => {
    let pos = TITLE.length + 2;
    return { id: 'w1', folds: [], title: { text: TITLE, start: 0, end: TITLE.length },
      blocks: TEXTS.map((text, i) => { const start = pos; pos += text.length + 2; const k = kindOf(text); return { n: i + 1, kind: k, text, start, end: start + text.length, ...(k === 'heading' ? { level: 2 } : {}) }; }) };
  };
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!.replace(/\.json$/, '');
    const send = (json: unknown) => route.fulfill({ json });
    if (name === 'note-show-w1') return send({ id: 'w1', title: TITLE, kind: 'note', placed: false, text: [TITLE, ...TEXTS].join('\n\n'), updated: new Date().toISOString().slice(0, 19), linked_from: [], also: [], threads: [], refs: [] });
    if (name === 'page-blocks-w1') return send(blocks());
    if (name === 'page-look-w1') return send({ id: 'w1', full_width: false, small_text: false, font: 'default', toc: false, locked: false });
    if (name.startsWith('block-set-w1-') || name.startsWith('block-add-w1-')) return send({ ...blocks(), n: 1, count: 1 });
    if (name.startsWith('refs-plain-')) return send([]);
    if (name === 'settings-notebook') return send({});
    if (name === 'page-sweep') return send({ operations: [], errors: [] });
    if (name === 'docs-looks') return send({ looks: [] });
    if (name === 'craft-designs') return send({ themes: {}, theme: '' });
    if (name.startsWith('docs-list-')) return send([]);
    if (name === 'template-list') return send({ templates: [] });
    if (name.startsWith('page-overview-') || name.startsWith('page-scripture-')) return send({});
    if (name.startsWith('notebook-group-')) return send({ groups: [] });
    return route.fallback();
  });
  void setup;
  await page.goto('/?at=NUM.26');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
  await page.waitForSelector('.pane-notebook');
  await page.evaluate(() => (window as any).__wb.note('w1'));
  await page.waitForSelector('.nb-block[data-n="1"]');
}

const box = async (page: Page, sel: string) => {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error(`${sel} has no box`);
  return b;
};
type Box = { x: number; y: number; width: number; height: number };
/** `a` is inside `b` (to a pixel). */
const within = (a: Box, b: Box, slack = 1) => a.x >= b.x - slack && a.y >= b.y - slack && a.x + a.width <= b.x + b.width + slack && a.y + a.height <= b.y + b.height + slack;

/** What row 37 asks, in whatever pane the page is in. `paneSel` is the pane that holds it. */
async function fitsHere(page: Page, paneSel: string, label: string) {
  const vp = page.viewportSize()!;
  const win = { x: 0, y: 0, width: vp.width, height: vp.height };
  const pane = await box(page, paneSel);
  // the column fits: it sits in the pane, and the page does not scroll sideways
  const col = await box(page, `${paneSel} .nb-pagecol`);
  expect(within(col, pane), `${label}: the column is inside its pane`).toBe(true);
  const over = await page.evaluate(sel => { const e = document.querySelector(sel) as HTMLElement; return e.scrollWidth - e.clientWidth; }, `${paneSel} .nb-editor`);
  expect(over, `${label}: nothing scrolls sideways`).toBeLessThanOrEqual(1);
  for (const n of [1, 2, 3, 4, 5]) {
    const b = await box(page, `${paneSel} .nb-block[data-n="${n}"] .nb-block-body`);
    expect(within(b, pane), `${label}: block ${n} is inside the pane`).toBe(true);
  }
  // the handle sits inside the pane's own margin (not under its edge, not over the text)
  const first = page.locator(`${paneSel} .nb-block[data-n="2"]`);
  await first.hover();
  const plus = await box(page, `${paneSel} .nb-block[data-n="2"] > .nb-plus`);
  const grip = await box(page, `${paneSel} .nb-block[data-n="2"] > .nb-grip`);
  const text = await box(page, `${paneSel} .nb-block[data-n="2"] .nb-block-body`);
  expect(within(plus, pane) && within(grip, pane), `${label}: + and the grip are inside the pane`).toBe(true);
  expect(grip.x + grip.width, `${label}: the grip stays left of the text`).toBeLessThanOrEqual(text.x + 1);
  // nothing jumps: the text is where it was before the handle showed
  await page.mouse.move(vp.width / 2, 2);
  const still = await box(page, `${paneSel} .nb-block[data-n="2"] .nb-block-body`);
  expect(Math.abs(still.x - text.x) + Math.abs(still.y - text.y), `${label}: the handle's showing moves nothing`).toBeLessThanOrEqual(1);
  // the / menu opens at the caret and fits the window (a bottom sheet on a phone); opening it moves nothing
  await page.locator(`${paneSel} .nb-block[data-n="5"] .nb-block-body`).click();
  await page.keyboard.press('End');
  const before = await box(page, `${paneSel} .nb-block[data-n="5"]`);
  await page.keyboard.type(' /');
  const menu = page.locator('.wbm').first();
  await expect(menu).toBeVisible();
  expect(within(await menu.boundingBox() as Box, win), `${label}: the / menu fits the window`).toBe(true);
  if (vp.width <= 520) {
    const m = (await menu.boundingBox())!;
    expect(m.width, `${label}: on a phone the menu is a sheet as wide as the window`).toBeGreaterThanOrEqual(vp.width - 1);
    expect(Math.abs(m.y + m.height - vp.height), `${label}: the sheet sits at the bottom`).toBeLessThanOrEqual(1);
  }
  const after = await box(page, `${paneSel} .nb-block[data-n="5"]`);
  expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y), `${label}: the menu moves nothing`).toBeLessThanOrEqual(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.wbm')).toHaveCount(0);
  // the block menu (the grip's click) fits the window too
  await page.locator(`${paneSel} .nb-block[data-n="3"]`).hover();
  await page.locator(`${paneSel} .nb-block[data-n="3"] > .nb-grip`).click();
  const bm = page.locator('.wbm').first();
  await expect(bm).toBeVisible();
  expect(within(await bm.boundingBox() as Box, win), `${label}: the block menu fits the window`).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('.wbm')).toHaveCount(0);
  // the selection bar wraps and fits: select words of block 2
  await page.locator(`${paneSel} .nb-block[data-n="2"] .nb-block-body`).click();
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+End');
  const bar = page.locator('.nb-selbar').first();
  await expect(bar).toBeVisible();
  expect(within(await bar.boundingBox() as Box, win), `${label}: the selection bar fits the window`).toBe(true);
  await page.keyboard.press('Escape');
}

test('writing_at_every_width', async ({ page }, info) => {
  const phone = info.project.name === 'webkit-phone';
  await openPage(page);
  if (phone) {
    // 37c: the page at 390 px, every menu a sheet
    expect(page.viewportSize()!.width).toBe(390);
    await fitsHere(page, '.pane-notebook', 'phone');
    return;
  }
  const paneSel = '.pane-notebook';
  // 37b: a narrow pane, 460 px beside the reader
  await page.evaluate(() => { const d = (window as any).__wb.dock(); d.widths.right = 460; d.layout(); });
  await expect.poll(async () => Math.round((await box(page, paneSel)).width)).toBeGreaterThan(420);
  expect((await box(page, paneSel)).width).toBeLessThanOrEqual(470);
  await fitsHere(page, paneSel, 'a narrow pane (460 px)');
  // 37a: a floating tab, 560 px over the reader
  await page.evaluate(() => { const d = (window as any).__wb.dock(); d.floatAt = { w: 560, h: 640 }; d.move(d.find('notebook'), 'float'); });
  await expect(page.locator('.dock-float')).toHaveCount(1);
  const fl = `.dock-float ${paneSel}`;
  await expect.poll(async () => Math.round((await box(page, '.dock-float')).width)).toBeGreaterThan(520);
  expect((await box(page, '.dock-float')).width).toBeLessThanOrEqual(570);
  await fitsHere(page, fl, 'a floating tab (560 px)');
});
