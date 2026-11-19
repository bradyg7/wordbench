import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// The mark card (design/features/marks T8: rows 25 to 28 and 31). The UI runs without Rust here, so each `wb` call it makes
// is answered by the test's route and recorded by name (the argv as the fixture name). Marks are put on the chapter from
// word positions (no scripture is typed): a highlight, an underline and a box over the same words of verse 11.
interface M { id: string; kind: string; color: string; lines?: number; at: string; created: string; legend: string; style: string; words?: string; changed?: string }
const HL: M = { id: 'm_hl', kind: 'highlight', color: 'yellow', at: 'NUM.25:11.2-25:11.5', created: '2026-11-17T10:00:00Z', legend: 'Fixture promise', style: 'highlight:yellow' };
const UL: M = { id: 'm_ul', kind: 'underline', color: 'blue', lines: 2, at: 'NUM.25:11.3-25:11.4', created: '2026-11-18T10:00:00Z', legend: 'Fixture double', style: 'underline:blue:2' };
const BX: M = { id: 'm_bx', kind: 'box', color: '#cc3322', at: 'NUM.25:11.1-25:11.6', created: '2026-11-19T09:00:00Z', legend: 'Fixture box', style: 'box:#cc3322' };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

interface Run { calls: string[]; marks: M[] }

/** `marks` are on the chapter; `mark at` answers them topmost first (underline, box, highlight: the core's layers). */
async function ready(page: Page, marks: M[]): Promise<Run> {
  const run: Run = { calls: [], marks };
  const layer: Record<string, number> = { underline: 1, circle: 2, box: 2, highlight: 3 };
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').pop()!.replace(/\.json$/, '');
    if (name.startsWith('mark-at-')) {
      run.calls.push(name);
      const top = [...run.marks].sort((a, b) => layer[a.kind] - layer[b.kind] || (a.created < b.created ? 1 : -1));
      return route.fulfill({ json: { place: 'NUM.25:11.3', marks: top } });
    }
    if (name.startsWith('mark-style-')) {
      run.calls.push(name);
      const m = run.marks.find(x => name.startsWith(`mark-style-${slug(x.id)}-`))!;
      const kind = /-kind-([a-z]+)/.exec(name)?.[1] ?? m.kind;
      const raw = /-color-([a-z0-9]+)/.exec(name)![1];
      const color = /^[0-9a-f]{6}$/.test(raw) ? `#${raw}` : raw;
      const lines = /-lines-(\d)/.exec(name)?.[1];
      return route.fulfill({ json: { ...m, kind, color, ...(lines ? { lines: +lines } : {}), legend: undefined, style: undefined, changed: '2026-11-19T12:00:00Z' } });
    }
    if (name.startsWith('mark-show-')) { run.calls.push(name); return route.fulfill({ json: { legend: 'Fixture shown' } }); }
    if (name.startsWith('mark-rm-')) { run.calls.push(name); return route.fulfill({ json: { deleted: name.slice(8), trash: 'x.json', days: 7 } }); }
    if (name.startsWith('mark-restore-')) { run.calls.push(name); return route.fulfill({ json: {} }); }
    return route.fallback();
  });
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await setMarks(page, marks);
  return run;
}

async function setMarks(page: Page, marks: M[]) {
  await page.evaluate(m => { const w = (window as any).__wb; w.drawn.marks.marks = m; w.repaint(); }, marks);
}
const held = (page: Page): Promise<M[]> => page.evaluate(() => (window as any).__wb.drawn.marks.marks);

async function wordBox(page: Page, v: number, i: number) {
  const k = await page.evaluate(([v, i]) => { const d = (window as any).__wb.drawn; return d.v.findIndex((vv: number, k: number) => vv === v && d.i[k] === i); }, [v, i]);
  const el = page.locator(`.w[data-k="${k}"]`);
  await el.evaluate(e => e.scrollIntoView({ block: 'center' }));
  return (await el.boundingBox())!;
}
async function clickWord(page: Page, v: number, i: number) {
  const b = await wordBox(page, v, i);
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  if (page.viewportSize()!.width < 600) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
}

const card = (page: Page) => page.locator('.mark-card');
const entries = (page: Page) => card(page).locator('.mc-mark');
const wordCard = (page: Page) => page.locator('.word-card');

test('row 25: a click on marked words opens the mark card beside them: style, legend name, date, Change, Delete; Esc or a click away closes it', async ({ page }, info) => {
  const run = await ready(page, [HL]);
  await clickWord(page, 11, 3);
  await expect(card(page)).toBeVisible();
  const one = entries(page);
  await expect(one).toHaveCount(1);
  await expect(one.locator('.mc-sample.s-highlight')).toBeVisible();
  await expect(one.locator('.mc-name')).toHaveText('Fixture promise');
  await expect(one.locator('.mc-date')).toHaveText('2026-11-17');
  await expect(one.getByRole('button', { name: 'Change' })).toBeVisible();
  await expect(one.getByRole('button', { name: 'Delete' })).toBeVisible();
  expect(run.calls).toEqual(['mark-at-num-25-11-3']);
  await expect(wordCard(page)).toHaveCount(0);   // the click did not look the word up
  if (info.project.name === 'webkit-desktop') {
    // not draggable: a drag from the card leaves it where it was
    const panel = page.locator('.mark-card-panel');
    const before = await panel.boundingBox();
    await page.mouse.move(before!.x + 20, before!.y + 6);
    await page.mouse.down(); await page.mouse.move(before!.x + 120, before!.y + 90, { steps: 4 }); await page.mouse.up();
    expect(await panel.boundingBox()).toEqual(before);
    await expect(card(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(card(page)).toHaveCount(0);
    await clickWord(page, 11, 3);
    await expect(card(page)).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(card(page)).toHaveCount(0);
  } else {
    await page.keyboard.press('Escape');
    await expect(card(page)).toHaveCount(0);
  }
});

test('row 25: a click on a word with no mark still looks it up; on a marked word, Look up the word does', async ({ page }) => {
  await ready(page, [HL]);
  await clickWord(page, 11, 8);
  await expect(wordCard(page)).toBeVisible();
  await expect(card(page)).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(wordCard(page)).toHaveCount(0);
  await clickWord(page, 11, 3);
  await expect(card(page)).toBeVisible();
  await expect(wordCard(page)).toHaveCount(0);
  await card(page).getByRole('button', { name: 'Look up the word' }).click();
  await expect(card(page)).toHaveCount(0);
  await expect(wordCard(page)).toBeVisible();
});

test('row 25: the mark layers take no pointer: a drag over marked words still selects them', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop');
  await ready(page, [HL, UL, BX]);
  const a = await wordBox(page, 11, 2), b = await wordBox(page, 11, 5);
  await page.mouse.move(a.x + 3, a.y + a.height / 2);
  await page.mouse.down(); await page.mouse.move(b.x + b.width - 3, b.y + b.height / 2, { steps: 6 }); await page.mouse.up();
  await expect(page.locator('.markbar')).toBeVisible();
  await expect(card(page)).toHaveCount(0);
});

test('row 26: words with several marks: the card lists each, topmost first, each with Change and Delete', async ({ page }, info) => {
  const run = await ready(page, [HL, UL, BX]);
  await clickWord(page, 11, 3);
  const all = entries(page);
  await expect(all).toHaveCount(3);
  await expect(all.locator('.mc-name')).toHaveText(['Fixture double', 'Fixture box', 'Fixture promise']);
  await expect(all.getByRole('button', { name: 'Change' })).toHaveCount(3);
  await expect(all.getByRole('button', { name: 'Delete' })).toHaveCount(3);
  expect(run.calls).toEqual(['mark-at-num-25-11-3']);
  mkdirSync('design/features/marks/build', { recursive: true });
  await page.screenshot({ path: `design/features/marks/build/t8${info.project.name === 'webkit-desktop' ? '' : '-phone'}.png` });
});

test("row 27: Change opens that kind's drop-down; a pick runs wb mark style and only that mark changes", async ({ page }) => {
  const run = await ready(page, [HL, UL, BX]);
  await clickWord(page, 11, 3);
  await page.locator('.mc-mark[data-kind="underline"]').getByRole('button', { name: 'Change' }).click();
  const drop = page.locator('.mc-mark[data-kind="underline"] .mc-drop');
  await expect(drop.locator('[data-menu="underline"]')).toBeVisible();
  await expect(drop.locator('.mb-lines')).toBeVisible();      // the underline's own lines choice
  await expect(page.locator('.mc-mark[data-kind="box"] .mc-drop')).toHaveCount(0);
  const before = await held(page);
  const pick = drop.locator('.mb-row').first();
  const [, color, lines] = (await pick.getAttribute('data-style'))!.split(':');
  await pick.click();
  await expect(card(page)).toHaveCount(0);
  expect(run.calls.find(c => c.startsWith('mark-style-'))).toBe(`mark-style-m-ul-kind-underline-color-${slug(color)}-lines-${lines}`);
  const after = await held(page);
  expect(after.map(m => m.id)).toEqual(before.map(m => m.id));
  expect(after.find(m => m.id === 'm_hl')).toEqual(before.find(m => m.id === 'm_hl'));
  expect(after.find(m => m.id === 'm_bx')).toEqual(before.find(m => m.id === 'm_bx'));
  const changed = after.find(m => m.id === 'm_ul')!;
  expect(changed.color).toBe(color);
  expect(changed.created).toBe(UL.created);
  expect(changed.changed).toBeTruthy();
  expect(changed.legend).toBe('Fixture shown');
});

test('row 27: an old highlight changes color only', async ({ page }) => {
  const old: M = { ...HL, id: 'm_old', words: 'old', legend: 'Unnamed yellow highlight' };
  const run = await ready(page, [old]);
  await clickWord(page, 11, 3);
  await expect(card(page).locator('.mc-hint')).toHaveText('An old highlight: only its color can change.');
  await card(page).getByRole('button', { name: 'Change' }).click();
  const drop = card(page).locator('.mc-drop');
  await expect(drop.locator('[data-menu="highlight"]')).toBeVisible();
  await drop.locator('.mb-row').first().click();
  await expect(card(page)).toHaveCount(0);
  expect(run.calls.find(c => c.startsWith('mark-style-'))).toMatch(/^mark-style-m-old-color-[a-z0-9]+$/);
});

test('row 28: Delete removes the mark and says "Mark deleted · Undo" for 10 seconds; Undo puts it back', async ({ page }) => {
  const run = await ready(page, [HL, UL, BX]);
  await clickWord(page, 11, 3);
  await page.locator('.mc-mark[data-kind="box"]').getByRole('button', { name: 'Delete' }).click();
  await expect.poll(async () => (await held(page)).map(m => m.id)).toEqual(['m_hl', 'm_ul']);
  expect(run.calls).toContain('mark-rm-m-bx');
  await expect(entries(page)).toHaveCount(2);              // the card stays for the other two
  await expect(page.locator('.mk-shape[data-mark="m_bx"]')).toHaveCount(0);
  const toast = page.locator('.toast-undo');
  await expect(toast).toHaveText(/Mark deleted · Undo/);
  const colors = await toast.evaluate(e => { const s = getComputedStyle(e); return [s.backgroundColor, s.color]; });
  expect(colors[0]).not.toBe(colors[1]);
  await page.waitForTimeout(2600);                          // a plain toast (2.2 s) would be gone; this one stays
  await expect(toast).toBeVisible();
  await toast.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(async () => (await held(page)).map(m => m.id).sort()).toEqual(['m_bx', 'm_hl', 'm_ul']);
  expect(run.calls).toContain('mark-restore-m-bx');
  await expect(page.locator('.mk-shape[data-mark="m_bx"]').first()).toBeAttached();
  await expect(toast).toHaveCount(0);
});

test('row 28: deleting the last mark closes the card', async ({ page }) => {
  await ready(page, [HL]);
  await clickWord(page, 11, 3);
  await card(page).getByRole('button', { name: 'Delete' }).click();
  await expect(card(page)).toHaveCount(0);
  await expect(page.locator('.toast-undo')).toBeVisible();
  await expect.poll(() => held(page)).toEqual([]);
});

test('row 28: the toast takes the dark theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await ready(page, [HL]);
  await clickWord(page, 11, 3);
  await card(page).getByRole('button', { name: 'Delete' }).click();
  const toast = page.locator('.toast-undo');
  const page_bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(await toast.evaluate(e => getComputedStyle(e).color)).toBe(page_bg);   // the theme's page color as the toast's ink
  expect(await toast.evaluate(e => getComputedStyle(e).backgroundColor)).not.toBe(page_bg);
});

test('row 31: words that already have marks, a style picked: a new mark on top, nothing replaced', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop');
  const run = await ready(page, [HL, UL]);
  await page.route('**/fixtures/wb/mark-add-*.json', r => {
    run.calls.push(new URL(r.request().url()).pathname);
    return r.fulfill({ json: { id: 'm_new', kind: 'circle', color: 'orange', at: 'NUM.25:11.2-25:11.5', created: '2026-11-19T11:00:00Z' } });
  });
  const a = await wordBox(page, 11, 2), b = await wordBox(page, 11, 5);
  await page.mouse.move(a.x + 3, a.y + a.height / 2);
  await page.mouse.down(); await page.mouse.move(b.x + b.width - 3, b.y + b.height / 2, { steps: 6 }); await page.mouse.up();
  await page.locator('.markbar .mb-circle').click();
  await page.locator('.markbar .mb-menu .mb-row').first().click();
  expect(run.calls.some(c => c.includes('mark-add-'))).toBe(true);
  await expect.poll(async () => (await held(page)).map(m => m.id)).toEqual(['m_hl', 'm_ul', 'm_new']);
  const after = await held(page);
  expect(after[0]).toEqual(HL);
  expect(after[1]).toEqual(UL);
  run.marks.push(after[2]);
  await page.keyboard.press('Escape');
  await clickWord(page, 11, 3);
  await expect(entries(page)).toHaveCount(3);
});
