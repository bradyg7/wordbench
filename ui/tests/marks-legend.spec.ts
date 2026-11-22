import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// The Legend on the rail (design/features/marks T11: rows 32 to 41). The UI runs without Rust here, so every `wb` call it
// makes is answered by the test's route, which records the command as the fixture name (the argv, lower-cased: `legend-set-
// highlight-blue-quick-on`). The legend is the fixture `wb legend` made on a generated study (eight entries, six styles in use
// that no entry names). The words of a mark in a `wb legend uses` answer are cut from the chapter fixtures, never typed.
const base = JSON.parse(readFileSync(new URL('../public/fixtures/wb/legend.json', import.meta.url), 'utf8'));
const chapter = (name: string) => JSON.parse(readFileSync(new URL(`../public/fixtures/${name}.json`, import.meta.url), 'utf8')).reader.chapter;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

interface State { entries: any[]; unlisted: any[] }
interface Run { calls: string[]; state: State; uses: Record<string, any[]>; refuse: Set<string> }

/** The words a mark covers, from the chapter fixture: words i..j of a verse. */
function wordsOf(code: string, c: number, v: number, i: number, j: number) {
  const ch = chapter(`${code}.${c}`);
  return ch.verses.find((x: any) => x.v === v).words.filter((w: any) => w.i >= i && w.i <= j).map((w: any) => `${w.lead || ''}${w.text}${w.trail || ''}`).join('').trim();
}
const mark = (id: string, code: string, book: string, c: number, v: number, i: number, j: number, label: string) =>
  ({ id, kind: 'underline', color: 'blue', lines: 2, at: `${code}.${c}:${v}.${i}-${c}:${v}.${j}`, code, book, chapter: c, verse: v, label, words: wordsOf(code, c, v, i, j), created: '2026-11-19T10:00:00Z', old: false });

/** Four marks in two books, one style. */
const FOUR = [
  mark('mk_a', 'NUM', 'Numbers', 25, 11, 2, 5, 'Numbers 25:11'),
  mark('mk_b', 'NUM', 'Numbers', 25, 13, 0, 2, 'Numbers 25:13'),
  mark('mk_c', 'NUM', 'Numbers', 26, 2, 1, 3, 'Numbers 26:2'),
  mark('mk_d', 'PSA', 'Psalms', 119, 1, 0, 1, 'Psalm 119:1'),
];

async function ready(page: Page, opts: { state?: State; uses?: Record<string, any[]>; refuse?: string[]; on?: Record<string, (s: State) => void> } = {}): Promise<Run> {
  const run: Run = { calls: [], state: opts.state ?? structuredClone(base), uses: opts.uses ?? {}, refuse: new Set(opts.refuse ?? []) };
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').pop()!.replace(/\.json$/, '');
    if (name === 'legend') return route.fulfill({ json: run.state });
    if (name.startsWith('legend-uses-')) {
      const style = Object.keys(run.uses).find(s => name === `legend-uses-${slug(s)}` || name.startsWith(`legend-uses-${slug(s)}-filter-`));
      if (!style) return route.fallback();
      // `--filter "Book is X"` (filters-v2 row 29): the rows narrowed by the exact words the window sent
      const argv: string[] = JSON.parse(decodeURIComponent(route.request().headers()['x-wb-argv'] ?? '[]'));
      const books = argv.flatMap((a, i) => (argv[i - 1] === '--filter' ? [/^Book is (.+)$/.exec(a)?.[1]] : [])).filter(Boolean) as string[];
      const all = run.uses[style];
      const list = books.length ? all.filter(m => books.some(b => b === m.book)) : all;
      const names = [...new Set(all.map(m => m.book))];
      const e = [...run.state.entries, ...run.state.unlisted].find(x => slug(x.style) === slug(style)) ?? { label: style, style, kind: 'underline', color: 'blue', lines: 2, listed: true };
      return route.fulfill({ json: { entry: e, count: list.length, unfiltered: all.length, marks: list, filters: [],
        properties: [{ name: 'Book', group: 'page', hint: 'The book (and chapter) the mark is in', type: 'choice', values: names.map(n => ({ value: n, label: n, count: all.filter(m => m.book === n).length })) }, { name: 'Kind', group: 'page', hint: 'Highlight, underline, circle, box or arrow', type: 'choice', values: [{ value: 'Underline', label: 'Underline', count: all.length }] }] } });
    }
    if (/^(legend-(set|add|move|rm)|mark-(rm|restore))-/.test(name)) {
      run.calls.push(name);
      if ([...run.refuse].some(r => name.startsWith(r))) return route.fulfill({ status: 409, body: 'refused' });
      for (const [k, fn] of Object.entries(opts.on ?? {})) if (name.startsWith(k)) fn(run.state);
      return route.fulfill({ json: {} });
    }
    return route.fallback();
  });
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  return run;
}

const pane = (page: Page) => page.locator('.legend-pane');
const entry = (page: Page, label: string) => pane(page).locator('.lg-entry', { has: page.locator('.lg-name, .lg-edit', { hasText: label }) }).first();
const openLegend = async (page: Page) => { await page.locator('#rail').getByRole('button', { name: 'Legend', exact: true }).click(); await expect(pane(page)).toBeVisible(); };
const labels = (page: Page) => pane(page).locator('.lg-list > .lg-entry .lg-name').allTextContents();
const set = (state: State, label: string, patch: any) => { const e = state.entries.find(x => x.label === label)!; Object.assign(e, patch); };

test.beforeEach(async ({}, info) => { test.skip(info.project.name === 'webkit-phone' && !info.title.startsWith('phone:'), 'desktop: the rail'); });

test('row 32: the rail has Legend where Highlights was; it opens a pane with each entry\'s sample, name, meaning, key, Quick chip and count, then the styles in use that no entry names', async ({ page }) => {
  const state: State = structuredClone(base);
  set(state, 'Fixture promise', { meaning: 'a line of my own', key: 'Ctrl+1' });
  await ready(page, { state });
  const rail = page.locator('#rail');
  await expect(rail.getByRole('button', { name: 'Highlights', exact: true })).toHaveCount(0);
  await expect(rail.getByRole('button', { name: 'Legend', exact: true })).toBeVisible();
  await openLegend(page);
  expect(await labels(page)).toEqual(base.entries.map((e: any) => e.label));
  const rows = pane(page).locator('.lg-list > .lg-entry');
  await expect(rows).toHaveCount(8);
  // a sample drawn like the reader draws it, never a bare dot
  await expect(rows.first().locator('.mb-sample.s-underline b')).toHaveCount(2);
  await expect(rows.nth(1).locator('.mb-sample.s-box')).toHaveCount(1);
  const promise = entry(page, 'Fixture promise');
  await expect(promise.locator('.lg-meaning')).toHaveText('a line of my own');
  await expect(promise.locator('.lg-key')).toHaveText('Ctrl+1');
  await expect(promise.locator('.lg-quick')).toHaveText('Quick');
  await expect(entry(page, 'Fixture later').locator('.lg-meaning')).toHaveText('No meaning yet');
  await expect(entry(page, 'Fixture later').locator('.lg-meaning')).toHaveClass(/muted/);
  await expect(entry(page, 'Fixture later').locator('.lg-quick')).not.toHaveClass(/\bon\b/);
  await expect(rows.first().locator('.lg-count')).toHaveText('1 mark');
  await expect(rows.nth(2).locator('.lg-count')).toHaveText('0 marks');
  // below: the styles marks use that no entry names, as Unnamed
  await expect(pane(page).locator('.lg-group-title')).toHaveText('In use, not in the legend');
  const un = pane(page).locator('.lg-unlisted');
  await expect(un).toHaveCount(base.unlisted.length);
  await expect(un.first().locator('.lg-name')).toHaveText(base.unlisted[0].label);
  await expect(un.first().locator('.lg-name')).toHaveClass(/muted/);
  // the marks panel's switches stay in the reader's Highlights menu
  await page.locator('#reader .vn[data-v="3"]').click();   // a pane in front hides the reader's tools; a press in the reader brings them back
  await page.locator('#hl-menu').click();
  await expect(page.locator('.layers-menu').getByText('Reading mode', { exact: false })).toBeVisible();
});

test('row 32 (MK7-26): a new Library has an empty legend and one plain line', async ({ page }) => {
  await ready(page, { state: { entries: [], unlisted: [] } });
  await openLegend(page);
  await expect(pane(page).locator('.lg-empty')).toHaveText('Marks made with a new pen appear here.');
  await expect(pane(page).locator('.lg-entry')).toHaveCount(0);
  await expect(pane(page).locator('.lg-group')).toHaveCount(0);
});

test('row 33: New pen: a kind, any color, lines for an underline, then a name; wb legend add', async ({ page }) => {
  const run = await ready(page);
  await openLegend(page);
  await pane(page).getByRole('button', { name: 'New pen' }).click();
  const form = pane(page).locator('.lg-newpen');
  await expect(form.locator('.mb-lines')).toBeHidden();
  await form.getByRole('button', { name: 'Underline' }).click();
  await expect(form.locator('.mb-lines')).toBeVisible();
  await form.locator('.mb-line[data-lines="2"]').click();
  const color = form.locator('input[type=color]');
  await color.fill('#3e63dd');
  await form.getByLabel('Name of the new pen').fill('Twice');
  await form.getByRole('button', { name: 'Add' }).click();
  expect(run.calls).toEqual(['legend-add-kind-underline-color-3e63dd-lines-2-name-twice']);
  // no name is allowed: the pen is Unnamed
  await pane(page).getByRole('button', { name: 'New pen' }).click();
  await pane(page).locator('.lg-newpen').getByRole('button', { name: 'Box' }).click();
  await pane(page).locator('.lg-newpen').getByRole('button', { name: 'Add' }).click();
  expect(run.calls[1]).toBe('legend-add-kind-box-color-d9822b');
});

test('row 34: a click on a name or a meaning edits it where it is; wb legend set; every mark shows the new name', async ({ page }) => {
  const run = await ready(page, { on: {
    'legend-set-underline-blue-2-name-twice': s => { Object.assign(s.entries[0], { name: 'Twice', label: 'Twice' }); },
    'legend-set-highlight-pink-meaning-kept': s => { s.entries[2].meaning = 'kept'; },
  } });
  await openLegend(page);
  const had = await page.evaluate(() => (window as any).__wb.drawn.marks.marks.filter((m: any) => m.style === 'underline:blue:2').map((m: any) => m.legend));
  expect(had).toEqual(['Fixture double']);
  await entry(page, 'Fixture double').locator('.lg-name').click();
  const input = pane(page).locator('.lg-edit-name');
  await expect(input).toBeFocused();
  await input.fill('Twice');
  await input.press('Enter');
  await expect(entry(page, 'Twice').locator('.lg-name')).toHaveText('Twice');
  expect(run.calls).toEqual(['legend-set-underline-blue-2-name-twice']);
  // the reader's marks name it, on hover and in the card
  const now = await page.evaluate(() => (window as any).__wb.drawn.marks.marks.filter((m: any) => m.style === 'underline:blue:2').map((m: any) => m.legend));
  expect(now).toEqual(['Twice']);
  // the meaning
  await entry(page, 'Fixture promise').locator('.lg-meaning').click();
  await pane(page).locator('.lg-edit-meaning').fill('kept');
  await pane(page).locator('.lg-edit-meaning').press('Enter');
  await expect(entry(page, 'Fixture promise').locator('.lg-meaning')).toHaveText('kept');
  expect(run.calls[1]).toBe('legend-set-highlight-pink-meaning-kept');
  // Esc leaves it as it was
  await entry(page, 'Fixture later').locator('.lg-name').click();
  await pane(page).locator('.lg-edit-name').fill('Nothing');
  await pane(page).locator('.lg-edit-name').press('Escape');
  await expect(entry(page, 'Fixture later').locator('.lg-name')).toHaveText('Fixture later');
  expect(run.calls).toHaveLength(2);
});

test('row 35: a new color asks "Change the N marks in this style too?": Yes restyles them, No changes the entry only', async ({ page }) => {
  const run = await ready(page, { on: {
    'legend-set-underline-blue-2-color-11aa22-restyle': s => { s.entries[0].color = '#11aa22'; s.entries[0].style = 'underline:#11aa22:2'; },
    'legend-set-box-cc3322-color-aa1122-no-restyle': s => { s.entries[1].color = '#aa1122'; s.entries[1].style = 'box:#aa1122'; },
  } });
  await openLegend(page);
  const color = (label: string) => entry(page, label).locator('.lg-recolor input');
  // Yes
  await color('Fixture double').fill('#11aa22');
  await color('Fixture double').dispatchEvent('change');
  await expect(pane(page).locator('.lg-ask-text')).toHaveText('Change the 1 mark in this style too?');
  expect(run.calls).toEqual([]);
  await pane(page).locator('.lg-ask').getByRole('button', { name: 'Yes' }).click();
  expect(run.calls).toEqual(['legend-set-underline-blue-2-color-11aa22-restyle']);
  await expect.poll(() => page.evaluate(() => (window as any).__wb.drawn.marks.marks.filter((m: any) => m.legend === 'Fixture double').map((m: any) => m.color))).toEqual(['#11aa22']);
  // No: the entry only, the marks stay
  await color('Fixture box').fill('#aa1122');
  await color('Fixture box').dispatchEvent('change');
  await pane(page).locator('.lg-ask').getByRole('button', { name: 'No' }).click();
  expect(run.calls[1]).toBe('legend-set-box-cc3322-color-aa1122-no-restyle');
  await expect.poll(() => page.evaluate(() => (window as any).__wb.drawn.marks.marks.filter((m: any) => m.style === 'box:#cc3322').map((m: any) => m.color))).toEqual(['#cc3322']);
  // an entry no mark uses asks nothing
  await page.waitForTimeout(300);   // the list is drawn again after the answer
  await color('Fixture promise').fill('#445566');
  await color('Fixture promise').dispatchEvent('change');
  await expect(pane(page).locator('.lg-ask')).toHaveCount(0);
  expect(run.calls[2]).toBe('legend-set-highlight-pink-color-445566');
});

test('row 36: Pin and unpin as a quick style; the core refuses a sixth and its message is shown', async ({ page }) => {
  const run = await ready(page, { refuse: ['legend-set-highlight-blue-quick-on'], on: { 'legend-set-highlight-pink-quick-off': s => { s.entries[2].quick = false; } } });
  await openLegend(page);
  await entry(page, 'Fixture promise').locator('.lg-quick').click();
  expect(run.calls).toEqual(['legend-set-highlight-pink-quick-off']);
  await expect(entry(page, 'Fixture promise').locator('.lg-quick')).not.toHaveClass(/\bon\b/);
  await entry(page, 'Fixture later').locator('.lg-quick').click();
  expect(run.calls[1]).toBe('legend-set-highlight-blue-quick-on');
  await expect(page.locator('.toast')).toContainText('legend set highlight:blue --quick on');   // outside the app, the call's own error; in the app, the core's message
  await expect(entry(page, 'Fixture later').locator('.lg-quick')).not.toHaveClass(/\bon\b/);
});

test('row 37: a key Ctrl+1 to 9, "none" clears it, and a key another entry holds asks to move it', async ({ page }) => {
  const state: State = structuredClone(base);
  set(state, 'Fixture box', { key: 'Ctrl+7' });
  const run = await ready(page, { state, on: { 'legend-set-highlight-blue-key-ctrl-3': s => { s.entries[3].key = 'Ctrl+3'; }, 'legend-set-box-cc3322-key-none': s => { s.entries[1].key = undefined; } } });
  await openLegend(page);
  await entry(page, 'Fixture later').locator('.lg-key').click();
  await expect(page.locator('.lg-keys .menu-item')).toHaveText(['Ctrl+1', 'Ctrl+2', 'Ctrl+3', 'Ctrl+4', 'Ctrl+5', 'Ctrl+6', 'Ctrl+7 · Fixture box', 'Ctrl+8', 'Ctrl+9', 'None']);
  await page.locator('.lg-keys [data-key="Ctrl+3"]').click();
  expect(run.calls).toEqual(['legend-set-highlight-blue-key-ctrl-3']);
  await expect(entry(page, 'Fixture later').locator('.lg-key')).toHaveText('Ctrl+3');
  // a key already held: asked first, then moved
  await entry(page, 'Fixture later').locator('.lg-key').click();
  await page.locator('.lg-keys [data-key="Ctrl+7"]').click();
  await expect(pane(page).locator('.lg-ask-text')).toHaveText('Ctrl+7 is already used by “Fixture box”. Move it here?');
  expect(run.calls).toHaveLength(1);
  await pane(page).locator('.lg-ask').getByRole('button', { name: 'Yes' }).click();
  expect(run.calls[1]).toBe('legend-set-highlight-blue-key-ctrl-7-move-key');
  // none clears
  await entry(page, 'Fixture box').locator('.lg-key').click();
  await page.locator('.lg-keys [data-key="none"]').click();
  expect(run.calls[2]).toBe('legend-set-box-cc3322-key-none');
  await expect(entry(page, 'Fixture box').locator('.lg-key')).toHaveText('Key');
});

test('row 38: drag the grip to reorder, or press Up and Down on it; wb legend move', async ({ page }) => {
  const run = await ready(page, { on: { 'legend-move-underline-blue-2-to-2': s => { s.entries.splice(1, 0, s.entries.shift()); } } });
  await openLegend(page);
  const grip = (label: string) => entry(page, label).locator('.lg-drag');
  await grip('Fixture double').focus();
  await page.keyboard.press('ArrowDown');
  expect(run.calls).toEqual(['legend-move-underline-blue-2-to-2']);
  await expect.poll(async () => (await labels(page)).slice(0, 2)).toEqual(['Fixture box', 'Fixture double']);
  await expect(grip('Fixture double')).toBeFocused();   // the keys can go on
  // the first entry cannot go up
  await grip('Fixture box').focus();
  await page.keyboard.press('ArrowUp');
  expect(run.calls).toHaveLength(1);
  // a drag: the grip of the first row, let go below the third
  const a = (await grip('Fixture box').boundingBox())!, third = (await entry(page, 'Fixture promise').boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2, third.y + third.height + 4, { steps: 8 });
  await page.mouse.up();
  expect(run.calls[1]).toBe('legend-move-box-cc3322-to-3');
});

test('row 39: Remove asks, then wb legend rm; its marks stay and are listed under "In use, not in the legend"', async ({ page }) => {
  const run = await ready(page, { on: { 'legend-rm-underline-blue-2': s => { const e = s.entries.shift(); s.unlisted.unshift({ ...e, name: undefined, label: 'Unnamed blue double underline', listed: false, quick: false }); } } });
  await openLegend(page);
  await entry(page, 'Fixture double').locator('.lg-remove').click();
  await expect(pane(page).locator('.lg-ask-text')).toHaveText('Remove “Fixture double” from the legend? Its 1 mark stays, as Unnamed.');
  expect(run.calls).toEqual([]);
  await pane(page).locator('.lg-ask').getByRole('button', { name: 'Remove' }).click();
  expect(run.calls).toEqual(['legend-rm-underline-blue-2']);
  await expect.poll(() => labels(page)).not.toContain('Fixture double');
  await expect(pane(page).locator('.lg-unlisted .lg-name', { hasText: 'Unnamed blue double underline' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__wb.drawn.marks.marks.filter((m: any) => m.style === 'underline:blue:2').map((m: any) => m.legend))).toEqual(['Unnamed blue double underline']);
});

const withUses = (): Record<string, any[]> => ({ 'underline:blue:2': FOUR });

test('row 40: a count lists where the style is used: each mark with its words and reference, a filter by book; a click opens the reader there and Back returns', async ({ page }) => {
  await ready(page, { uses: withUses() });
  await openLegend(page);
  await entry(page, 'Fixture double').locator('.lg-count').click();
  await expect(pane(page).locator('.lg-title')).toHaveText('Fixture double · 4 marks');   // what `wb legend uses` found
  const rows = pane(page).locator('.lg-use');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0).locator('.lg-ref')).toHaveText('Numbers 25:11');
  await expect(rows.nth(0).locator('.lg-words')).toHaveText(`“${FOUR[0].words}”`);
  await expect(rows.nth(3).locator('.lg-ref')).toHaveText('Psalm 119:1');
  // Add filter (filters-v2 row 29): Book, picked from the books the style is used in; no typed field
  await pane(page).getByRole('button', { name: 'Add filter' }).click();
  await page.locator('.wbm-row .wbm-label').getByText('Book', { exact: true }).click();
  await page.locator('.wbm-row .wbm-label').getByText('Psalms', { exact: true }).click();
  await page.locator('.wbm-done').click();
  await expect(rows).toHaveCount(1);
  await expect(pane(page).locator('.lg-title')).toHaveText('Fixture double · 1 of 4 marks');
  await pane(page).getByRole('button', { name: 'Clear' }).click();
  await expect(rows).toHaveCount(4);
  // a click opens the reader there
  await rows.nth(3).locator('.lg-use-go').click();
  await expect.poll(() => page.evaluate(() => (window as any).__wb.drawn.chapter.code + (window as any).__wb.drawn.chapter.chapter)).toBe('PSA119');
  await expect(pane(page).locator('.lg-use')).toHaveCount(4);   // the list is still there
  // Back returns to the place the reader came from
  await pane(page).getByRole('button', { name: /^Back to Numbers 25/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__wb.drawn.chapter.code + (window as any).__wb.drawn.chapter.chapter)).toBe('NUM25');
  // the arrow at the head goes back to the legend
  await pane(page).getByRole('button', { name: 'Back to the legend' }).click();
  await expect(pane(page).locator('.lg-entry').first()).toBeVisible();
});

test('row 41: select marks in that list and Delete: wb mark rm for all of them in one call, one toast with Undo', async ({ page }) => {
  const run = await ready(page, { uses: withUses() });
  await openLegend(page);
  await entry(page, 'Fixture double').locator('.lg-count').click();
  const del = pane(page).locator('.lg-delete');
  await expect(del).toBeHidden();
  const rows = pane(page).locator('.lg-use');
  await rows.nth(0).locator('.lg-pick').check();
  await rows.nth(2).locator('.lg-pick').check();
  await expect(del).toBeVisible();
  await expect(del).toContainText('Delete 2 marks');
  await del.click();
  expect(run.calls).toEqual(['mark-rm-mk-a-mk-c']);
  await expect(page.locator('.toast')).toContainText('2 marks deleted');
  await expect(page.locator('.toast').getByRole('button', { name: 'Undo' })).toHaveCount(1);
  await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => run.calls.length).toBe(2);
  expect(run.calls[1]).toBe('mark-restore-mk-a-mk-c');
  await expect(del).toBeHidden();
  // Select all shown
  await pane(page).getByRole('button', { name: 'Select all shown' }).click();
  await expect(del).toContainText('Delete 4 marks');
});

test('screenshots: the Legend and where a style is used', async ({ page }, info) => {
  test.skip(!process.env.WB_SHOTS, 'only when asked for (WB_SHOTS=1)');
  const state: State = structuredClone(base);
  set(state, 'Fixture promise', { meaning: 'a line of my own', key: 'Ctrl+1' });
  set(state, 'Fixture repeated', { meaning: 'a line of my own', key: 'Ctrl+3' });
  set(state, 'Fixture box', { key: 'Ctrl+7' });
  await ready(page, { state, uses: withUses() });
  await openLegend(page);
  await page.screenshot({ path: new URL('../../design/features/marks/build/t11.png', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });
  await entry(page, 'Fixture double').locator('.lg-count').click();
  const rows = pane(page).locator('.lg-use');
  await rows.nth(0).locator('.lg-pick').check();
  await rows.nth(1).locator('.lg-pick').check();
  await page.screenshot({ path: new URL('../../design/features/marks/build/t11-uses.png', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });
  void info;
});

test('phone: the Legend is reached from More, under Panes', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-phone', 'phone only');
  await ready(page);
  await page.locator('#more').click();
  await page.locator('.more-menu').getByRole('button', { name: /^Legend/ }).click();
  await expect(pane(page)).toBeVisible();
  await expect(pane(page).locator('.lg-entry').first()).toBeVisible();
  await expect(pane(page).locator('.lg-list > .lg-entry')).toHaveCount(8);
});
