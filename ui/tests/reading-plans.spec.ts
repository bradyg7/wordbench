import { test, expect, type Page } from '@playwright/test';

// Reading plans (design/features/reading-plans, RP-12 to RP-19): the strip under the bar, the end of a reading, a part of a
// chapter read, the pane's checklist and counter, Reading and its map, the kinds when starting a plan. The window outside the
// app reads fixtures; here every `wb` answer the plan screens ask for is given by a small model of one plan, so each test
// can read what the screen did to it. The scripture on screen is the database's (the chapters' fixtures); none is typed here.

const ENTRIES = ['NUM.24', 'NUM.25', 'NUM.26', 'NUM.27', 'NUM.28', 'NUM.29'];
const NAMES: Record<string, string> = { 'NUM.24': 'Numbers 24', 'NUM.25': 'Numbers 25', 'NUM.26': 'Numbers 26', 'NUM.27': 'Numbers 27', 'NUM.28': 'Numbers 28', 'NUM.29': 'Numbers 29' };

interface Model { read: Set<string>; part: Record<string, number>; behind: number; marks: string[]; about: any[] }
const fresh = (): Model => ({ read: new Set(), part: {}, behind: 0, marks: [], about: [] });

async function mock(page: Page, m: Model) {
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!.replace(/\.json$/, '');
    const j = (json: unknown) => route.fulfill({ json });
    const partOf = (e: string) => {
      const to = m.part[e];
      return m.read.has(e) ? { read_to: 36, parts: '', verses: '1-36', fraction: 1, whole: true } : to ? { read_to: to, parts: '', verses: `1-${to}`, fraction: Math.round((to / 36) * 100) / 100, whole: false } : { read_to: null, parts: '', verses: '', fraction: 0, whole: false };
    };
    const row = () => ({ day: 2, date: '2026-11-02', label: 'Numbers 24–29', entries: ENTRIES, read: ENTRIES.map(e => m.read.has(e)), parts: ENTRIES.map(partOf), done: ENTRIES.every(e => m.read.has(e)), skipped: false });
    if (name === 'plan-list') return j([{ id: 'demo', name: 'Demo plan', days: 365, done: 1, dated: true, behind: m.behind, ahead: 0, today: 2, next: row(), finished: false, cycle: false, days_off: [], start: '2026-11-01', source: null }]);
    if (name === 'plan-today') return j({ date: '2026-11-02', plans: [{ plan: 'Demo plan', id: 'demo', day: 2, of: 365, today: row(), dated: true, behind: m.behind, ahead: 0, finished: false, to_read: [row()], next: row() }] });
    if (name === 'plan-show-demo') return j({ id: 'demo', name: 'Demo plan', days: 365, dated: true, cycle: false, today: 2, next: row(), schedule: [{ ...row(), day: 1, entries: ['GEN.1'], read: [true], parts: [partOf('GEN.1')], done: true, label: 'Genesis 1' }, row()] });
    if (name === 'plan-past') return j([{ id: 'old', name: 'Old plan', stopped: '2026-10-01', done: 3, days: 30 }]);
    if (name === 'plan-done-demo-day-2') { ENTRIES.forEach(e => m.read.add(e)); m.marks.push('day'); return j({ ok: true }); }
    if (name.startsWith('read-mark-num-')) {
      m.marks.push(name);
      const to = /^read-mark-num-(\d+)-(\d+)-to-here$/.exec(name);
      if (to) { m.part[`NUM.${to[1]}`] = +to[2]; return j([{ ch: `NUM.${to[1]}`, v: `1-${to[2]}` }]); }
      const one = /^read-mark-num-(\d+)(?:-plan-demo)?$/.exec(name);
      if (one) { m.read.add(`NUM.${one[1]}`); return j([{ ch: `NUM.${one[1]}` }]); }
    }
    const times = /^read-times-numbers-(\d+)$/.exec(name);
    if (times) {
      const e = `NUM.${times[1]}`, p = partOf(e);
      return j(m.read.has(e) || m.part[e] ? { [e]: { times: m.read.has(e) ? 1 : 0, last: '2026-11-02T10:00:00Z', verses: p.verses, read_to: p.read_to, whole: p.whole } } : {});
    }
    if (/^read-about-numbers-\d+$/.test(name)) return j(m.about);
    if (name === 'read-progress') return j({ chapters: 3, of: 1189, percent: 0.3, partial: [{ ch: 'NUM.25', read_to: 9, parts: '1-9', last: '2026-11-02T10:00:00Z' }], books: [], last: null, lines: 4 });
    if (name === 'read-map') return j({ books: [{ code: 'NUM', name: 'Numbers', chapters: 36, read: [[24, 1, 1], [25, 0, 0.25]], written: [[25, 2]] }] });
    if (name.startsWith('plan-layout-kind-horner')) {
      const lists = ['Matthew-John', 'Genesis-Deuteronomy', 'Romans-Colossians', '1 Thessalonians-Revelation', 'Job, Ecclesiastes, Song of Solomon', 'Psalms', 'Proverbs', 'Joshua-Esther', 'Isaiah-Malachi', 'Acts']
        .map(b => ({ books: b, chapters: 20, first: ['One 1', 'One 2', 'One 3'] }));
      return j({ name: '', kind: 'horner', days: 250, cycle: true, lists, rows: [{ day: 1, label: 'Matthew 1; Genesis 1', chips: [], kept: false }, { day: 2, label: 'Matthew 2; Genesis 2', chips: [], kept: false }], first: [], kept: [] });
    }
    return route.fallback();
  });
}

async function ready(page: Page, at = 'NUM.25') {
  await page.goto(`/?at=${at}`);
  await page.waitForFunction(() => (window as any).__wbReady);
}

async function openPlanPane(page: Page) {
  await page.evaluate(() => (window as any).__wb.plans());
  await expect(page.locator('.pane-plans .plan-card')).toHaveCount(1);
}

test('Read opens the day in the reader with a strip that ticks and goes to any reading', async ({ page }) => {
  const m = fresh();
  await mock(page, m);
  await ready(page);
  await openPlanPane(page);
  await page.locator('.pane-plans [data-act="read"]').click();
  await expect(page.locator('.ch-title')).toHaveText('Numbers 24'); // the first reading not yet read
  const strip = page.locator('#planstrip');
  await expect(strip).toBeVisible();
  await expect(strip.locator('.plan-strip-label')).toHaveText('Demo plan · Day 2');
  await expect(strip.locator('.plan-strip-chip')).toHaveCount(4);
  await expect(strip.locator('.plan-strip-more')).toHaveText('+2');
  await expect(strip.locator('.plan-strip-count')).toHaveText('0 of 6');
  await expect(strip.locator('.plan-strip-chip.open')).toContainText('Numbers 24');
  // a click goes to any reading
  await strip.locator('.plan-strip-chip[data-entry="NUM.26"]').click();
  await expect(page.locator('.ch-title')).toHaveText('Numbers 26');
  await expect(strip.locator('.plan-strip-chip.open')).toContainText('Numbers 26');
  // the pane may stay closed; the label opens it
  await page.evaluate(() => { const d = (window as any).__wb.dock(); d.named('plans').forEach((p: any) => d.close(p)); });
  await expect(page.locator('.pane-plans')).toHaveCount(0);
  await strip.locator('.plan-strip-label').click();
  await expect(page.locator('.pane-plans')).toHaveCount(1);
});

test('the end of a reading asks, marks only on a click, and goes on', async ({ page }) => {
  const m = fresh();
  await mock(page, m);
  await ready(page, 'NUM.24');
  await openPlanPane(page);
  await page.locator('.pane-plans [data-act="read"]').click();
  const card = page.locator('.plan-end');
  await expect(card).toBeVisible();
  await expect(card.locator('.plan-end-next')).toHaveText('Mark read · next: Numbers 25');
  expect(m.read.size, 'nothing is marked without a click (not at the last verse)').toBe(0);
  await card.locator('.plan-end-skip').click();
  await expect(card).toHaveCount(0);
  expect(m.read.size).toBe(0);
  // Mark read · next is one step: it marks and opens the next reading
  await page.evaluate(() => (window as any).__wb.open('NUM', 24));
  await expect(page.locator('.plan-end .plan-end-next')).toBeVisible();
  await page.locator('.plan-end .plan-end-next').click();
  await expect(page.locator('.ch-title')).toHaveText('Numbers 25');
  expect([...m.read]).toEqual(['NUM.24']);
  await expect(page.locator('#planstrip .plan-strip-count')).toHaveText('1 of 6');
  await expect(page.locator('#planstrip .plan-strip-chip[data-entry="NUM.24"]')).toHaveClass(/done/);
});

test('on the day’s last reading there is only Mark read and Not now, and nothing follows it', async ({ page }) => {
  const m = fresh();
  ['NUM.24', 'NUM.25', 'NUM.27', 'NUM.28', 'NUM.29'].forEach(e => m.read.add(e));
  await mock(page, m);
  await ready(page, 'NUM.26');
  await openPlanPane(page);
  await page.locator('.pane-plans [data-act="read"]').click();
  const last = page.locator('.plan-end');
  await expect(last).toBeVisible();
  await expect(last.locator('.plan-end-next')).toHaveCount(0);
  await expect(last.locator('button')).toHaveText(['Mark read', 'Not now']);
  await last.locator('.plan-end-mark').click();
  await expect(last).toHaveCount(0);
  expect(m.read.has('NUM.26')).toBe(true);
  // nothing follows: no cheer, no streak, no prompt for the next day
  await expect(page.locator('.plan-end, .toast, .page-deletion')).toHaveCount(0);
  await expect(page.locator('#planstrip .plan-strip-count')).toHaveText('6 of 6');
});

test('a part of a chapter is marked from a verse number, drawn as a line in the margin, and shown in the pane', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'a right click is a mouse');
  const m = fresh();
  await mock(page, m);
  await ready(page);
  await expect(page.locator('.vn.vread')).toHaveCount(0);
  await page.locator('.vn[data-v="9"]').click({ button: 'right' });
  const menu = page.locator('.verse-menu');
  await expect(menu.locator('[data-act="read-to-here"]')).toBeVisible();
  await expect(menu.locator('[data-act="read-chapter"]')).toHaveText(/Mark Numbers 25 read/);
  await menu.locator('[data-act="read-to-here"]').click();
  await expect.poll(() => m.part['NUM.25']).toBe(9);
  await expect(page.locator('.vn.vread')).toHaveCount(9);
  await expect(page.locator('.vn.vread-run')).toHaveCount(9);
  await expect(page.locator('.vn[data-v="10"]')).not.toHaveClass(/vread/);
  // the menu on a later verse moves it
  await page.locator('.vn[data-v="12"]').click({ button: 'right' });
  await page.locator('.verse-menu [data-act="read-to-here"]').click();
  await expect.poll(() => m.part['NUM.25']).toBe(12);
  await expect(page.locator('.vn.vread')).toHaveCount(12);
  // the plan's row says where it stopped
  await openPlanPane(page);
  const row = page.locator('.pane-plans .plan-check[data-entry="NUM.25"]');
  await expect(row.locator('.stopped')).toHaveText('read to v. 12');
  await expect(row.locator('.tenbar i.on')).toHaveCount(3);
});

test('the pane is a checklist with a counter that shows only when behind, and the rest under the three dots', async ({ page }) => {
  const m = fresh();
  await mock(page, m);
  await ready(page);
  await openPlanPane(page);
  const card = page.locator('.pane-plans .plan-card');
  await expect(card.locator('.plan-check')).toHaveCount(6);
  await expect(card.locator('.plan-where')).toHaveText('Day 2 of 365');
  await expect(card.locator('.plan-missed, .plan-choices')).toHaveCount(0);
  await expect(card.getByText('What should happen?')).toHaveCount(0);
  // behind: one count in the quiet line, no prompt, no choices
  m.behind = 2;
  await page.evaluate(() => { const d = (window as any).__wb.dock(); d.named('plans').forEach((p: any) => d.close(p)); });
  await openPlanPane(page);
  await expect(page.locator('.pane-plans .plan-where')).toHaveText('Day 2 of 365 · 2 days behind');
  await expect(page.locator('.pane-plans .plan-where')).not.toHaveCSS('color', 'rgb(255, 0, 0)');
  await expect(page.locator('.pane-plans .plan-missed, .pane-plans .plan-choices, .pane-plans button:has-text("What should happen")')).toHaveCount(0);
  // Rename, Start day, Edit as text, Days and Stop go under the three dots
  await expect(page.locator('.pane-plans .plan-acts')).toHaveCount(0);
  await page.locator('.pane-plans [data-act="more"]').click();
  await expect(page.locator('.plan-menu .menu-item')).toHaveText(['Days', 'Rename…', 'Start day…', 'Edit as text…', 'Stop']);
  await page.keyboard.press('Escape');
  // Go on: and Mark the day read
  m.read.add('NUM.24');
  await page.evaluate(() => { const d = (window as any).__wb.dock(); d.named('plans').forEach((p: any) => d.close(p)); });
  await openPlanPane(page);
  await expect(page.locator('.pane-plans [data-act="read"]')).toHaveText('Go on: Numbers 25');
  await page.locator('.pane-plans [data-act="mark-day"]').click();
  await expect.poll(() => m.marks.includes('day')).toBe(true);
  // no Past plans and no What you have read in the pane any more
  await expect(page.locator('.pane-plans .plan-past, .pane-plans .plan-overall')).toHaveCount(0);
});

test('the chapter you are in shows how often it was read and what refers to it', async ({ page }) => {
  const m = fresh();
  m.read.add('NUM.25');
  m.about = [{ kind: 'page', id: 'p1', title: 'My page on the chapter', anchor: 'NUM.25:1', chapter: 'NUM.25' }, { kind: 'highlight', id: 'h1', title: 'NUM.25:11', anchor: 'NUM.25:11', chapter: 'NUM.25' }];
  await mock(page, m);
  await ready(page);
  await openPlanPane(page);
  const here = page.locator('.pane-plans .plan-here');
  await expect(here.locator('.plan-here-times')).toContainText('Read once');
  await expect(here.locator('.plan-about')).toHaveCount(2);
  await expect(here.locator('.plan-about').first()).toContainText('My page on the chapter');
});

test('Reading holds past plans and the map, and the plan pane keeps one row that opens it and a way back', async ({ page }) => {
  const m = fresh();
  m.about = [{ kind: 'page', id: 'p1', title: 'My page on the chapter', anchor: 'NUM.25:1', chapter: 'NUM.25' }];
  await mock(page, m);
  await ready(page, 'NUM.26');
  await openPlanPane(page);
  await page.locator('.pane-plans [data-act="reading"]').click();
  const pane = page.locator('.pane-reading');
  await expect(pane).toBeVisible();
  await expect(pane.locator('.reading-going')).toHaveCount(1);
  await expect(pane.locator('.plan-past-list .plan-past-row')).toContainText('Old plan');
  await expect(pane.locator('.plan-past-list .plan-past-row button', { hasText: 'Use again' })).toBeVisible();
  // the map: two layers; a chapter read in part is part filled
  await expect(pane.locator('[data-layer="read"]')).toHaveClass(/\bon\b/);
  const part = pane.locator('.rd-ch[data-ch="NUM.25"]');
  await expect(part).toHaveClass(/\bpart\b/);
  expect(await part.evaluate(e => (e as HTMLElement).style.background)).toContain('linear-gradient');
  await expect(pane.locator('.rd-ch[data-ch="NUM.24"]')).toHaveAttribute('data-times', '1');
  await pane.locator('[data-layer="written"]').click();
  await expect(pane.locator('.rd-ch[data-ch="NUM.25"]')).toHaveAttribute('data-refs', '2');
  // a click on a chapter lists what refers to it, and opens it
  await pane.locator('.rd-ch[data-ch="NUM.25"]').click();
  await expect(pane.locator('.rd-list .rd-ref')).toContainText('My page on the chapter');
  await pane.locator('.rd-list button', { hasText: 'Open Numbers 25' }).click();
  await expect(page.locator('.ch-title')).toHaveText('Numbers 25');
  // ‹ Plan goes back
  await pane.locator('[data-act="plan"]').click();
  await expect(page.locator('.pane-plans')).toHaveCount(1);
});

test('starting a plan offers the kinds as cards, and Horner’s ten lists stand side by side', async ({ page }) => {
  const m = fresh();
  await mock(page, m);
  await ready(page);
  await openPlanPane(page);
  await page.getByRole('button', { name: 'New plan' }).click();
  const kinds = page.locator('.plan-kind');
  await expect(kinds).toHaveCount(4);
  await expect(kinds.locator('.plan-kind-name')).toHaveText(['The Bible in its order', 'Some books', 'Horner’s ten lists', 'A published plan']);
  await page.locator('.plan-kind[data-kind="horner"]').click();
  await expect(page.locator('.plan-list')).toHaveCount(10);
  await expect(page.locator('.plan-lists')).toBeVisible();
  await expect(page.locator('.plan-modal')).toContainText('No end date');
  await expect(page.locator('.plan-modal')).toContainText('First days: Matthew 1; Genesis 1');
});

test('Listen asks Mark read through the same step as the strip', async ({ page }) => {
  const m = fresh();
  await mock(page, m);
  await page.addInitScript(() => {
    const utterances: any[] = [];
    class MockUtterance {
      text: string; voice: any = null; lang = ''; rate = 1;
      onstart: (() => void) | null = null; onend: (() => void) | null = null;
      onboundary: ((event: any) => void) | null = null; onerror: ((event: any) => void) | null = null;
      constructor(text: string) { this.text = text; }
    }
    const voices = [{ name: 'Local Test English', lang: 'en-US', localService: true, default: true }];
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: MockUtterance });
    Object.defineProperty(window, 'speechSynthesis', { value: {
      getVoices: () => voices, addEventListener: () => {}, cancel: () => {}, pause: () => {}, resume: () => {},
      speak: (u: any) => { utterances.push(u); u.onstart?.(); },
    } });
    (window as any).__speech = { utterances };
  });
  await ready(page, 'NUM.26');
  await openPlanPane(page);
  await page.evaluate(() => { (window as any).__wb.run('listen Numbers 26:1'); });
  for (let i = 0; i < 80; i++) {
    const done = await page.evaluate(() => {
      const u = (window as any).__speech.utterances;
      const last = u[u.length - 1];
      if (document.querySelector('.page-deletion')) return true;
      last?.onend?.();
      return false;
    });
    if (done) break;
    await page.waitForTimeout(25);
  }
  const ask = page.locator('.page-deletion', { hasText: 'Listened to Numbers 26' });
  await expect(ask).toBeVisible();
  expect(m.read.has('NUM.26')).toBe(false);
  await ask.getByRole('button', { name: 'Mark read' }).click();
  await expect.poll(() => m.read.has('NUM.26')).toBe(true);
});
