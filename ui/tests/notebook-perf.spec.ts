import { expect, test, type Page } from '@playwright/test';

// design/features/notebook, "A page of 400 blocks types, opens menus and drags inside the typing budget" (NB15) and "the floating pane
// drags smoothly" (row 6). The budget (decided in the README, 2026-11-22), with the web view's CPU slowed 4x as `npm run measure` slows it:
// half the keys reach the next painted frame in 75 ms, nineteen in twenty in 150 ms, every one in 250 ms; a menu is on screen in 300 ms; the
// page drawn again at a drop takes no longer than 1.5x its first draw; a dragged floating window follows the pointer on every move, nineteen
// frames in twenty under 100 ms and none over 250 ms. Each limit is also relative: the same things are measured first on a page of 5 blocks
// in the same run, and the limit is the larger of the number above and a small multiple of that, so a computer busy with other tests (the
// workers of one run) does not fail a page that is no slower than a short one. This spec runs in Chromium (the real app's engine, WebView2)
// with the 4x slow-down; in WebKit there is no throttle and the same limits hold with room to spare. No Rust here: a small page server
// stands in for `wb`.
const SHORT = 'w5', LONG = 'w400';
const texts = (n: number) => Array.from({ length: n }, (_, i) => (i % 40 === 0 ? `## Part ${i / 40 + 1}` : i % 7 === 3 ? `- Item ${i + 1} of the list in this long page` : `Block ${i + 1}: some words of the study, long enough to take a line or two in a column.`));
const PAGES: Record<string, string[]> = { [SHORT]: texts(5), [LONG]: texts(400) };

async function open(page: Page) {
  const kindOf = (t: string) => (/^#{1,3} /.test(t) ? 'heading' : /^- /.test(t) ? 'bullet' : 'paragraph');
  const blocks = (id: string) => {
    let pos = id.length + 2;
    return { id, folds: [], title: { text: id, start: 0, end: id.length },
      blocks: PAGES[id].map((text, i) => { const start = pos; pos += text.length + 2; const k = kindOf(text); return { n: i + 1, kind: k, text, start, end: start + text.length, ...(k === 'heading' ? { level: 2 } : {}) }; }) };
  };
  let moved: string | null = null;
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!.replace(/\.json$/, '');
    const send = (json: unknown) => route.fulfill({ json });
    let m: RegExpExecArray | null;
    if ((m = /^note-show-(w\d+)$/.exec(name))) return send({ id: m[1], title: m[1], kind: 'note', placed: false, text: [m[1], ...PAGES[m[1]]].join('\n\n'), updated: new Date().toISOString().slice(0, 19), linked_from: [], also: [], threads: [], refs: [] });
    if ((m = /^page-blocks-(w\d+)$/.exec(name))) return send(blocks(m[1]));
    if ((m = /^page-look-(w\d+)$/.exec(name))) return send({ id: m[1], full_width: false, small_text: false, font: 'default', toc: false, locked: false });
    if ((m = /^block-move-(w\d+)-(\d+)-to-(\d+)/.exec(name))) {
      const [id, from, to] = [m[1], Number(m[2]), Number(m[3])];
      const [t] = PAGES[id].splice(from - 1, 1);
      PAGES[id].splice(to - 1, 0, t);
      moved = name;
      return send({ ...blocks(id), n: to, count: 1 });
    }
    if ((m = /^block-(?:set|add)-(w\d+)-(\d+)/.exec(name))) return send({ ...blocks(m[1]), n: Number(m[2]), count: 1 });
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
  await page.goto('/?at=NUM.26');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
  await page.waitForSelector('.pane-notebook');
  return {
    show: async (id: string) => {
      const n = PAGES[id].length;
      const t0 = Date.now();
      await page.evaluate(id => (window as any).__wb.note(id), id);
      await page.waitForSelector(`.nb-block[data-n="${n}"]`, { state: 'attached' });
      await expect(page.locator('.nb-block')).toHaveCount(n);
      return Date.now() - t0;
    },
    moved: () => moved,
  };
}

const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * 0.95))];
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];

/** The probes: every key's time to the next painted frame (two frames after its input), every menu's from the key or click to painted, every frame. */
const probes = (page: Page) => page.evaluate(() => {
  const w = window as any;
  w.__keys = []; w.__menus = []; w.__frames = [];
  let t0 = 0, kt = 0;
  addEventListener('keydown', () => { t0 = kt = performance.now(); }, true);
  addEventListener('click', () => { t0 = performance.now(); }, true);
  addEventListener('input', () => { const t = kt; requestAnimationFrame(() => requestAnimationFrame(() => w.__keys.push(performance.now() - t))); }, true);
  new MutationObserver(list => {
    for (const m of list) for (const n of m.addedNodes) if ((n as HTMLElement).classList?.contains('wbm')) { const t = t0; requestAnimationFrame(() => requestAnimationFrame(() => w.__menus.push(performance.now() - t))); }
  }).observe(document.body, { childList: true });
  let last = performance.now();
  const loop = () => { const n = performance.now(); w.__frames.push(n - last); last = n; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
});
const taken = (page: Page, what: '__keys' | '__menus' | '__frames'): Promise<number[]> => page.evaluate(w => { const xs = (window as any)[w] as number[]; return xs.splice(0, xs.length); }, what);

/** Menus, then typing, on the page that is shown: what a person does on it. */
async function work(page: Page, n: number) {
  const mid = Math.min(150, n - 1);
  await page.locator(`.nb-block[data-n="${mid}"] .nb-block-body`).click();
  await page.keyboard.press('End');
  await page.keyboard.type(' /');
  await expect(page.locator('.wbm').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.wbm')).toHaveCount(0);
  await page.keyboard.press('Escape');                         // the block is let go: no block is being written when the grip menu opens
  await page.mouse.click(5, 5);
  await page.locator(`.nb-block[data-n="${Math.min(201, n)}"]`).hover();
  await page.locator(`.nb-block[data-n="${Math.min(201, n)}"] > .nb-grip`).click();
  await expect(page.locator('.wbm').first()).toBeVisible();
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  const menus = await taken(page, '__menus');
  expect(menus.length).toBe(2);
  await taken(page, '__keys');
  await page.waitForTimeout(1000);                             // what the menus left behind (a block saved, the page drawn again) has settled
  await page.locator(`.nb-block[data-n="${Math.min(200, n - 1)}"] .nb-block-body`).click();
  await page.keyboard.press('End');
  for (const ch of 'Warming up the browser first.') await page.keyboard.type(ch);   // a cold browser is slower than one in use
  await taken(page, '__keys');
  for (const ch of 'Typing on a long page never waits for anything at all.') await page.keyboard.type(ch);
  await page.waitForTimeout(300);
  const keys = await taken(page, '__keys');
  expect(keys.length).toBeGreaterThanOrEqual(50);
  return { keys, menus };
}

test('page_of_400_blocks_types_menus_drags', async ({ page, browserName }, info) => {
  test.skip(info.project.name === 'webkit-phone', 'a 400-block page is measured on the desktop window');
  test.setTimeout(150_000);
  if (browserName === 'chromium') await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const s = await open(page);
  await probes(page);
  const log = (what: string) => console.log(`[${info.project.name}] ${what}`);
  // the same work on a page of 5 blocks first: this computer's own pace, right now
  await s.show(SHORT);
  const base = await work(page, 5);
  await taken(page, '__frames');
  // the long page: drawn once (reported, not a budget of this spec: the chapter budgets are `npm run measure`'s), then the same work
  const drawn = await s.show(LONG);
  const long = await work(page, 400);
  const medK = median(long.keys), p95K = p95(long.keys), maxK = Math.max(...long.keys), maxM = Math.max(...long.menus);
  const bK = { med: median(base.keys), p95: p95(base.keys), max: Math.max(...base.keys) }, bM = Math.max(...base.menus);
  log(`400 blocks drawn in ${drawn} ms; typing median ${Math.round(medK)} ms, p95 ${Math.round(p95K)}, max ${Math.round(maxK)} (5 blocks: ${Math.round(bK.med)}, ${Math.round(bK.p95)}, ${Math.round(bK.max)}); menus ${long.menus.map(Math.round).join(' and ')} ms (5 blocks: ${base.menus.map(Math.round).join(' and ')})`);
  expect(medK, 'half the keys reach a painted frame in 75 ms').toBeLessThanOrEqual(Math.max(75, 2.5 * bK.med));
  expect(p95K, 'nineteen in twenty in 150 ms').toBeLessThanOrEqual(Math.max(150, 3 * bK.p95));
  expect(maxK, 'and every one in 250 ms').toBeLessThanOrEqual(Math.max(250, 4 * bK.max));
  expect(maxM, 'a menu is on screen in 300 ms').toBeLessThanOrEqual(Math.max(300, 3 * bM + 100));

  // a block dragged up by its grip in the long page (HTML5 drag and drop is the real app's Chromium; WebKit's does not run it)
  if (browserName === 'chromium') {
    await taken(page, '__frames');
    await page.evaluate(() => (document.querySelector('.pane-notebook .nb-editor') as HTMLElement).scrollTo(0, 0));
    await page.mouse.click(5, 5);
    const box = (await page.locator('.nb-block[data-n="3"]').boundingBox())!;
    await page.locator('.nb-block[data-n="9"]').hover();
    const t = Date.now();
    await page.locator('.nb-block[data-n="9"] > .nb-grip').dragTo(page.locator('.nb-block[data-n="3"]'), { force: true, targetPosition: { x: box.width * 0.5, y: box.height * 0.2 } });
    await expect.poll(() => s.moved()).not.toBeNull();
    await expect(page.locator('.nb-block[data-n="3"] .nb-block-body')).toContainText('Block 9:');
    log(`a block dragged up and drawn again in its new place in ${Date.now() - t} ms (includes Playwright's own drag steps)`);
    const frames = await taken(page, '__frames');
    log(`longest frame at the drop: ${Math.round(Math.max(...frames))} ms`);
    expect(Math.max(...frames), 'the longest frame is the page drawn again once, at the drop: no longer than the page took to open (1.5x), and 1 s at least').toBeLessThanOrEqual(Math.max(1000, drawn * 1.5));
  }
});

test('floating_pane_drags_smoothly', async ({ page, browserName }, info) => {
  test.skip(info.project.name === 'webkit-phone', 'floating tabs are the desktop');
  test.setTimeout(150_000);
  if (browserName === 'chromium') await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const s = await open(page);
  await s.show(SHORT);
  await page.evaluate(() => { const d = (window as any).__wb.dock(); d.floatAt = { w: 560, h: 640 }; d.move(d.find('notebook'), 'float'); });
  const fl = page.locator('.dock-float');
  await expect(fl).toHaveCount(1);
  await page.waitForSelector('.dock-float .nb-block[data-n="1"]');
  await page.evaluate(() => {
    const w = window as any;
    w.__frames = [];
    let last = performance.now();
    const loop = () => { const n = performance.now(); w.__frames.push(n - last); last = n; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  /** One drag of the window by its strip, left and back: how far the window was from where the pointer's travel puts it, and the frames. */
  const drag = async (sign: 1 | -1) => {
    const start = (await fl.boundingBox())!;
    // a point on the window's strip that is the strip itself (not a tab or a button): that is where a float is taken
    const grab = await page.evaluate(() => {
      const st = document.querySelector('.dock-float .tabstrip') as HTMLElement, r = st.getBoundingClientRect();
      for (let x = r.right - 4; x > r.left; x -= 4) { const e = document.elementFromPoint(x, r.top + r.height / 2); if (e === st || e?.classList.contains('tabs')) return { x, y: r.top + r.height / 2 }; }
      return null;
    });
    expect(grab, 'the strip has a place to take the window by').not.toBeNull();
    await page.waitForTimeout(600);
    await taken(page, '__frames');
    await page.mouse.move(grab!.x, grab!.y);
    await page.mouse.down();
    // the window follows the pointer on every move: after each step its corner is where the pointer's travel puts it
    let worst = 0;
    const steps = 30;
    for (let i = 1; i <= steps; i++) {
      const dx = sign * -Math.round((i * 300) / steps), dy = sign * Math.round((i * 120) / steps);
      await page.mouse.move(grab!.x + dx, grab!.y + dy);
      const now = (await fl.boundingBox())!;
      worst = Math.max(worst, Math.abs(now.x - (start.x + dx)), Math.abs(now.y - (start.y + dy)));
    }
    await page.mouse.up();
    const frames = await taken(page, '__frames');
    const end = (await fl.boundingBox())!;
    return { worst, p95: p95(frames), max: Math.max(...frames), stayed: Math.abs(end.x - (start.x - sign * 300)) + Math.abs(end.y - (start.y + sign * 120)) };
  };
  const base = await drag(1);                                   // a page of 5 blocks in it
  await s.show(LONG);
  const long = await drag(-1);                                  // and one of 400
  console.log(`[${info.project.name}] floating drag with 400 blocks in it: worst distance from the pointer ${long.worst} px, frames p95 ${Math.round(long.p95)} ms, longest ${Math.round(long.max)} ms (5 blocks: ${base.worst} px, ${Math.round(base.p95)}, ${Math.round(base.max)})`);
  expect(long.worst, 'the window is under the pointer on every move').toBeLessThanOrEqual(2);
  expect(long.p95, 'nineteen frames in twenty are under 100 ms while it is dragged').toBeLessThanOrEqual(Math.max(100, 2 * base.p95));
  expect(long.max, 'and none is over 250 ms').toBeLessThanOrEqual(Math.max(250, 3 * base.max));
  expect(long.stayed, 'and it stays where it was dropped').toBeLessThanOrEqual(3);
});
