import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { shotPath } from '../../scripts/shots.mjs';

// The margin in the reader (design/features/marks T10: rows 17 to 19, 29, 30, 43 and 50; MK7-18, MK7-27, MK7-28, MK7-31).
// The UI runs without Rust here, so each `wb` call it makes is answered by the test's route and recorded by name (the argv as
// the fixture name). Notes are text the tests write themselves; no scripture is typed. Places are verse numbers of the
// generated chapter. A phone has signs only, so the open-margin cases run on the desktop.
interface N { id: string; at: string; label: string; kind: string; v1: number; v2: number; text: string; question?: boolean; done?: boolean; created: string; changed: string; grew: { id: string; title: string }[] }
const note = (id: string, kind: string, v1: number, v2: number, text: string, more: Partial<N> = {}): N => ({
  id, at: v1 ? `NUM.25:${v1}` : 'NUM.25', label: v1 ? `Numbers 25:${v1}${v2 > v1 ? `–${v2}` : ''}` : 'Numbers 25', kind, v1, v2, text, question: false, done: false, created: '2026-11-18', changed: '', grew: [], ...more,
});
const NC = note('n_ch', 'chapter', 0, 0, 'A chapter thought');
const N78 = note('n_78', 'span', 7, 8, 'A thought on two verses');
const N11 = note('n_11', 'verse', 11, 11, 'A thought on one verse');
const NQ = note('n_q', 'verse', 13, 13, '> [!question] Why here', { question: true });
const slug = (s: string) => s.replace(/_/g, '-');
const ALL = [NC, N78, N11, NQ];

interface Run { calls: string[]; notes: N[] }

async function ready(page: Page, notes: N[] = ALL, width?: number): Promise<Run> {
  const run: Run = { calls: [], notes: [...notes] };
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').pop()!.replace(/\.json$/, '');
    if (name === 'mark-notes-numbers-25') { run.calls.push(name); return route.fulfill({ json: { place: 'Numbers 25', count: run.notes.length, notes: run.notes } }); }
    if (name.startsWith('mark-note-')) {
      run.calls.push(name);
      const old = run.notes.find(n => name.startsWith(`mark-note-${slug(n.id)}-text-`));
      if (old) return route.fulfill({ json: { ...old, text: undefined, question: /question/.test(name), changed: '2026-11-19' } });
      const m = /^mark-note-num-25(?:-(\d+))?(?:-(\d+))?-([a-z].*)$/.exec(name)!;
      const v1 = m[1] ? +m[1] : 0, v2 = m[2] ? +m[2] : v1;
      return route.fulfill({ json: note('n_new', v1 ? (v2 > v1 ? 'span' : 'verse') : 'chapter', v1, v2, '', { question: /question/.test(m[3]), text: undefined as any }) });
    }
    if (name.startsWith('mark-rm-') || name.startsWith('mark-restore-')) { run.calls.push(name); return route.fulfill({ json: { deleted: name.replace(/^mark-(rm|restore)-/, ''), days: 7 } }); }
    if (name.startsWith('mark-grow-')) {
      run.calls.push(name);
      const id = name.slice('mark-grow-'.length);
      const n = run.notes.find(x => slug(x.id) === id)!;
      return route.fulfill({ json: { note: { ...n, grew: [{ id: 'p_grown', title: n.label }] }, page: 'p_grown', title: n.label } });
    }
    if (name.startsWith('settings-marks-margin-')) { run.calls.push(name); return route.fulfill({ json: { margin: name.slice(-5).replace(/^-/, '') } }); }
    return route.fallback();
  });
  if (width) await page.setViewportSize({ width, height: 900 });
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.waitForFunction(() => document.querySelector('.margin-col') && !(document.querySelector('.margin-col') as HTMLElement).hidden);
  return run;
}

const phone = (info: { project: { name: string } }) => info.project.name === 'webkit-phone';
const col = (page: Page) => page.locator('.margin-col');
const cards = (page: Page) => col(page).locator('.mg-card');
const signs = (page: Page) => col(page).locator('.mg-sign');
const noteCalls = (run: Run) => run.calls.filter(c => c.startsWith('mark-note-'));

async function vnBox(page: Page, v: number) {
  const el = page.locator(`.vn[data-v="${v}"]`);
  await el.evaluate(e => e.scrollIntoView({ block: 'center' }));
  return (await el.boundingBox())!;
}
async function clickMargin(page: Page, v: number) {
  const b = await vnBox(page, v);
  const c = (await col(page).boundingBox())!;
  await page.mouse.click(c.x + c.width - 20, b.y + 4);
}
async function selectVerse(page: Page, v: number) {
  const b = await vnBox(page, v);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await expect(page.locator('.markbar')).toBeVisible();
}

test('row 43: open, the margin is a column beside the text behind a thin line: each note level with its verse, the chapter note at the top', async ({ page }, info) => {
  test.skip(phone(info), 'a phone is always signs');
  const run = await ready(page);
  await expect(cards(page)).toHaveCount(4);
  const c = (await col(page).boundingBox())!;
  const text = (await page.locator('.ch-title').boundingBox())!;
  expect(c.x).toBeGreaterThanOrEqual(text.x + 500);   // beside the text, not over it
  expect(await col(page).evaluate(e => getComputedStyle(e).borderLeftWidth)).toBe('1px');
  const top = async (id: string) => (await page.locator(`.mg-card[data-note="${id}"]`).boundingBox())!.y;
  // the chapter's own note first, at the top
  const v7 = (await vnBox(page, 7)).y;
  expect(await top('n_ch')).toBeLessThan(v7);
  // each other note level with its verse (a note never rises above it)
  for (const [id, v] of [['n_78', 7], ['n_11', 11], ['n_q', 13]] as [string, number][]) {
    const vt = (await vnBox(page, v)).y, t = await top(id);
    expect(t, `${id} level with verse ${v}`).toBeGreaterThanOrEqual(vt - 6);
    expect(t, `${id} level with verse ${v}`).toBeLessThan(vt + 50);
  }
  await expect(cards(page).locator('.mg-label').nth(0)).toHaveText('Chapter');
  await expect(page.locator('.mg-card[data-note="n_78"] .mg-label')).toHaveText('25:7–8');
  // the notes are shown in full
  await expect(page.locator('.mg-card[data-note="n_11"]')).toContainText('A thought on one verse');
  // a question line shows as a question (MK7-28); the margin suggests nothing
  await expect(page.locator('.mg-card[data-note="n_q"] .mg-qpill')).toHaveText('question');
  await expect(page.locator('.mg-card[data-note="n_q"] .mg-q')).toContainText('Why here');
  expect(run.calls.filter(x => !x.startsWith('mark-notes-'))).toEqual([]);   // opening reads the chapter's notes and nothing else
  if (info.project.name === 'webkit-desktop') {
    mkdirSync(new URL('../../design/features/marks/build/', import.meta.url), { recursive: true });
    await page.evaluate(() => (document.getElementById('scroller') as HTMLElement).scrollTo(0, 0));
    await page.screenshot({ path: shotPath('design/features/marks/build/t10.png') });
  }
});

test('row 43: Minimize shows only signs, one beside each verse with a note and one for the chapter; Open puts the notes back; the choice is kept with wb settings marks margin', async ({ page }, info) => {
  test.skip(phone(info), 'a phone is always signs');
  const run = await ready(page);
  await page.getByRole('button', { name: 'Minimize the margin to signs' }).click();
  expect(run.calls).toContain('settings-marks-margin-signs');
  await expect(cards(page)).toHaveCount(0);
  await expect(signs(page)).toHaveCount(4);
  await expect(signs(page).nth(0)).toHaveAttribute('data-v', '0');
  const v11 = (await vnBox(page, 11));
  const s11 = (await col(page).locator('.mg-sign[data-v="11"]').boundingBox())!;
  expect(Math.abs(s11.y - v11.y)).toBeLessThan(30);
  // the text gets the room: the column is narrow
  expect((await col(page).boundingBox())!.width).toBeLessThan(60);
  if (info.project.name === 'webkit-desktop') {
    await page.evaluate(() => (document.getElementById('scroller') as HTMLElement).scrollTo(0, 0));
    await page.screenshot({ path: shotPath('design/features/marks/build/t10-signs.png') });
  }
  // another chapter opens as signs, as last left
  await page.evaluate(() => (window as any).__wb.open('NUM', 26));
  await expect(col(page)).toHaveAttribute('data-mode', 'signs');
  await page.evaluate(() => (window as any).__wb.open('NUM', 25));
  await expect(signs(page)).toHaveCount(4);
  await page.getByRole('button', { name: 'Open the margin' }).click();
  expect(run.calls).toContain('settings-marks-margin-open');
  await expect(cards(page)).toHaveCount(4);
  await expect(signs(page)).toHaveCount(0);
});

test('row 17: a click in the margin level with a verse opens an empty note there, the cursor in it; nothing is written until text is typed', async ({ page }, info) => {
  test.skip(phone(info), 'a phone is always signs');
  const run = await ready(page);
  await clickMargin(page, 12);
  const draft = col(page).locator('.mg-card[data-draft]');
  await expect(draft).toBeVisible();
  await expect(draft.locator('.mg-label')).toHaveText('25:12');
  await expect(draft.locator('textarea')).toBeFocused();
  await expect(draft.locator('textarea')).toHaveValue('');
  const t = (await draft.boundingBox())!.y, vt = (await vnBox(page, 12)).y;
  expect(Math.abs(t - vt)).toBeLessThan(20);
  expect(noteCalls(run)).toEqual([]);
  // Esc with nothing typed: the empty note goes, and nothing was written
  await page.keyboard.press('Escape');
  await expect(draft).toHaveCount(0);
  expect(noteCalls(run)).toEqual([]);
});

test('row 18: a click in the margin away from any verse makes a note for the chapter', async ({ page }, info) => {
  test.skip(phone(info), 'a phone is always signs');
  const run = await ready(page, []);
  const c = (await col(page).boundingBox())!;
  const title = (await page.locator('.ch-title').boundingBox())!;
  await page.evaluate(() => (document.getElementById('scroller') as HTMLElement).scrollTo(0, 0));
  await page.mouse.click(c.x + c.width - 20, title.y + 4);
  const draft = col(page).locator('.mg-card[data-draft]');
  await expect(draft.locator('.mg-label')).toHaveText('Chapter');
  await expect(draft.locator('textarea')).toBeFocused();
  expect(noteCalls(run)).toEqual([]);
  await page.keyboard.type('chapter words');
  await page.keyboard.press('Escape');
  await expect.poll(() => noteCalls(run)).toEqual(['mark-note-num-25-chapter-words']);
  // below the last verse is the chapter's too
  await clickMargin(page, 13);
  const last = (await vnBox(page, 13));
  await page.evaluate(() => (document.getElementById('scroller') as HTMLElement).scrollTo(0, 1e5));
  const end = await page.evaluate(() => { const r = document.getElementById('reader')!; const ps = [...r.querySelectorAll('.para, .line')] as HTMLElement[]; const l = ps[ps.length - 1]; return l.getBoundingClientRect().bottom; });
  void last;
  await page.mouse.click(c.x + c.width - 20, end + 30);
  await expect(col(page).locator('.mg-card[data-draft] .mg-label')).toHaveText('Chapter');
});

test('row 17: the bar\'s notepad, N and the right-click menu\'s Margin note open the note for the selected verse or span', async ({ page }, info) => {
  test.skip(phone(info), 'verse numbers are tapped to a card on a phone');
  const run = await ready(page, []);
  // the notepad icon
  await selectVerse(page, 12);
  await page.locator('.markbar [data-kind="note"]').click();
  let draft = col(page).locator('.mg-card[data-draft]');
  await expect(draft.locator('.mg-label')).toHaveText('25:12');
  await expect(draft.locator('textarea')).toBeFocused();
  await expect(page.locator('.markbar')).toHaveCount(0);   // the selection is done with
  await page.keyboard.press('Escape');
  // N
  await selectVerse(page, 11);
  await page.keyboard.press('n');
  draft = col(page).locator('.mg-card[data-draft]');
  await expect(draft.locator('.mg-label')).toHaveText('25:11');
  await expect(draft.locator('textarea')).toHaveValue('');   // the key itself was not typed
  await page.keyboard.press('Escape');
  // a span, from the right-click menu
  await selectVerse(page, 7);
  await page.locator('.vn[data-v="8"]').click({ modifiers: ['Shift'] });
  const w = (await page.locator('.sel, .sj').first().boundingBox())!;
  await page.mouse.click(w.x + 4, w.y + 4, { button: 'right' });
  await page.locator('.mb-ctx [data-act="note"]').click();
  draft = col(page).locator('.mg-card[data-draft]');
  await expect(draft.locator('.mg-label')).toHaveText('25:7–8');
  await page.keyboard.type('span words');
  await page.keyboard.press('Escape');
  await expect.poll(() => noteCalls(run)).toEqual(['mark-note-num-25-7-8-span-words']);
  expect(noteCalls(run).length).toBe(1);   // the two empty ones wrote nothing
});

test('row 19: type, then Esc or a click away: the note is kept with wb mark note and its sign shows', async ({ page }, info) => {
  test.skip(phone(info), 'a phone is always signs');
  const run = await ready(page, []);
  await clickMargin(page, 12);
  await page.keyboard.type('first words');
  await page.keyboard.press('Escape');
  await expect.poll(() => noteCalls(run)).toEqual(['mark-note-num-25-12-first-words']);
  const kept = col(page).locator('.mg-card[data-note="n_new"]');
  await expect(kept).toContainText('first words');
  await expect(kept.locator('textarea')).toHaveCount(0);
  // a click away keeps it too
  await clickMargin(page, 9);
  await page.keyboard.type('second words');
  await page.locator('.ch-title').click();
  await expect.poll(() => noteCalls(run)).toEqual(['mark-note-num-25-12-first-words', 'mark-note-num-25-9-second-words']);
  // its sign shows when the margin is minimized
  await page.getByRole('button', { name: 'Minimize the margin to signs' }).click();
  await expect(signs(page)).toHaveCount(2);
  await expect(col(page).locator('.mg-sign[data-v="12"]')).toBeVisible();
});

test('row 19: a question typed in a note shows as a question line and puts a ? on its verse number', async ({ page }, info) => {
  test.skip(phone(info), 'a phone is always signs');
  await ready(page, []);
  await clickMargin(page, 12);
  await page.keyboard.type('> [!question] why this');
  await page.keyboard.press('Escape');
  await expect(col(page).locator('.mg-qpill')).toHaveText('question');
  await expect(page.locator('.vn[data-v="12"]')).toHaveClass(/vq/);
});

test('row 29: a click on a note\'s text edits it; the edit is saved with wb mark note <id> --text', async ({ page }, info) => {
  test.skip(phone(info), 'a phone is always signs');
  const run = await ready(page);
  await page.locator('.mg-card[data-note="n_11"] .mg-text').click();
  const ta = page.locator('.mg-card[data-note="n_11"] textarea');
  await expect(ta).toBeFocused();
  await expect(ta).toHaveValue('A thought on one verse');
  await page.keyboard.press('End');
  await page.keyboard.type(' more');
  await page.locator('.ch-title').click();
  await expect.poll(() => noteCalls(run)).toEqual(['mark-note-n-11-text-a-thought-on-one-verse-more']);
  await expect(page.locator('.mg-card[data-note="n_11"]')).toContainText('A thought on one verse more');
  // unchanged text is not written again
  await page.locator('.mg-card[data-note="n_11"] .mg-text').click();
  await page.keyboard.press('Escape');
  expect(noteCalls(run).length).toBe(1);
});

test('row 29: emptying a note deletes it, with Undo', async ({ page }, info) => {
  test.skip(phone(info), 'a phone is always signs');
  const run = await ready(page);
  await page.locator('.mg-card[data-note="n_11"] .mg-text').click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await page.keyboard.press('Escape');
  await expect(page.locator('.mg-card[data-note="n_11"]')).toHaveCount(0);
  expect(run.calls).toContain('mark-rm-n-11');
  expect(noteCalls(run)).toEqual([]);   // no empty note was written
  await expect(page.locator('.toast')).toContainText('deleted');
  await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.mg-card[data-note="n_11"]')).toContainText('A thought on one verse');
  expect(run.calls).toContain('mark-restore-n-11');
});

test('row 30: the note menu: Grow into a page makes the page and the note stays, saying it grew into it', async ({ page }, info) => {
  test.skip(phone(info), 'a phone is always signs');
  const run = await ready(page);
  const card = page.locator('.mg-card[data-note="n_11"]');
  await card.hover();
  await card.getByRole('button', { name: 'Note menu' }).click();
  await expect(card.getByRole('menuitem')).toHaveText(['Grow into a page', 'Delete']);
  await card.getByRole('menuitem', { name: 'Grow into a page' }).click();
  await expect.poll(() => run.calls.filter(c => c.startsWith('mark-grow-'))).toEqual(['mark-grow-n-11']);
  await expect(card).toContainText('A thought on one verse');   // the note stays
  await expect(card.locator('.mg-grew-link')).toHaveText('grew into Numbers 25:11');
});

test('row 30: the note menu: Delete removes the note, with Undo', async ({ page }, info) => {
  test.skip(phone(info), 'a phone is always signs');
  const run = await ready(page);
  const card = page.locator('.mg-card[data-note="n_78"]');
  await card.hover();
  await card.getByRole('button', { name: 'Note menu' }).click();
  await card.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(card).toHaveCount(0);
  expect(run.calls).toContain('mark-rm-n-78');
  await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.mg-card[data-note="n_78"]')).toBeVisible();
  expect(run.calls).toContain('mark-restore-n-78');
});

test('row 50: in a narrow window the margin is signs only; a sign opens its note in a popover beside the verse; the bar keeps its size', async ({ page }, info) => {
  test.skip(phone(info), 'a phone has its own case');
  const run = await ready(page);
  await selectVerse(page, 11);
  const wide = (await page.locator('.markbar').boundingBox())!.width;
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 780, height: 900 });
  await expect(col(page)).toHaveAttribute('data-mode', 'signs');
  await expect(cards(page)).toHaveCount(0);
  await expect(signs(page)).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Open the margin' })).toBeHidden();   // there is no room to open it
  await selectVerse(page, 11);
  expect((await page.locator('.markbar').boundingBox())!.width).toBe(wide);
  await page.keyboard.press('Escape');
  await col(page).locator('.mg-sign[data-v="11"]').click();
  const pop = page.locator('.popover.mg-popover');
  await expect(pop).toBeVisible();
  await expect(pop).toContainText('A thought on one verse');
  const v = await vnBox(page, 11), p = (await pop.boundingBox())!;
  expect(Math.abs(p.y - v.y)).toBeLessThan(80);   // beside the verse
  expect(p.x + p.width).toBeLessThanOrEqual((await col(page).boundingBox())!.x + 2);
  // the popover's note is edited the same way
  await pop.locator('.mg-text').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' again');
  await page.keyboard.press('Escape');
  await expect.poll(() => noteCalls(run)).toEqual(['mark-note-n-11-text-a-thought-on-one-verse-again']);
  await expect(pop).toHaveCount(0);
});

test('row 50: a new note in a narrow window opens in the popover and is kept on Esc', async ({ page }, info) => {
  test.skip(phone(info), 'a phone has its own case');
  const run = await ready(page, [], 780);
  await clickMargin(page, 12);
  const pop = page.locator('.popover.mg-popover');
  await expect(pop.locator('textarea')).toBeFocused();
  expect(noteCalls(run)).toEqual([]);
  await page.keyboard.type('narrow words');
  await page.keyboard.press('Escape');
  await expect.poll(() => noteCalls(run)).toEqual(['mark-note-num-25-12-narrow-words']);
  await expect(col(page).locator('.mg-sign[data-v="12"]')).toBeVisible();
});

test('phone (MK7-31): the margin is always signs at the text\'s right edge; a tap opens the note as a bottom sheet', async ({ page }, info) => {
  test.skip(!phone(info), 'phone only');
  await ready(page);
  await expect(col(page)).toHaveAttribute('data-mode', 'signs');
  await expect(cards(page)).toHaveCount(0);
  await expect(page.locator('.mg-toggle')).toBeHidden();
  const sign = col(page).locator('.mg-sign[data-v="11"]');
  await sign.evaluate(e => e.scrollIntoView({ block: 'center' }));
  const b = (await sign.boundingBox())!;
  expect(b.x + b.width).toBeGreaterThan(390 - 40);   // at the right edge
  await sign.tap();
  const sheet = page.locator('.sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('A thought on one verse');
  expect((await sheet.boundingBox())!.y).toBeGreaterThan(300);   // a bottom sheet
});
