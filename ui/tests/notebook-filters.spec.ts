import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// design/features/filters-v2 rows 1-25 (NB16): the one filter-chip component on a List in a page (every view), the Library's lists
// (Questions, Ctrl+K, an opened folder), typed page properties and page ⋯ › Properties. No Rust here: a small server stands in for `wb`
// (it narrows the rows the way wb-core does, from the exact words the window sent: the `x-wb-argv` header), and what the window asked is
// read back from the calls. The words are the test's own, not scripture.
type Argv = string[];
interface F { property: string; way: string; values: string[]; date?: boolean }

const A = { id: 'word-studies', name: 'Word studies', color: 'pink' };
const B = { id: 'salt', name: 'Salt', color: 'green' };
const NOW = new Date().toISOString().slice(0, 19);
const OLD = '2025-01-01T10:00:00';
const ROWS = [
  { id: 'p1', title: 'Zeal', folder: A, props: { Status: 'Open', Speaker: 'J. Moore' } as Record<string, string>, updated: NOW, created: NOW, books: ['Numbers', 'Numbers 25'], kinds: ['Key point', 'Note'], preview: 'Zeal is the first word here' },
  { id: 'p2', title: 'Covenant of peace', folder: A, props: { Status: 'Done' } as Record<string, string>, updated: OLD, created: OLD, books: ['Numbers'], kinds: [] as string[], preview: 'A second page' },
  { id: 'p3', title: 'Haste', folder: B, props: {} as Record<string, string>, updated: OLD, created: OLD, books: ['Proverbs', 'Proverbs 1'], kinds: ['Key point'], preview: 'Haste, in the folder Salt' },
  { id: 'p4', title: 'Prayer list', folder: B, props: { Status: 'Open' } as Record<string, string>, updated: OLD, created: OLD, books: [] as string[], kinds: [] as string[], preview: 'A list' },
];
const word = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const dateIn = (choice: string, d: string) => {
  const day = d.slice(0, 10), now = new Date();
  const back = { today: 0, 'last 7 days': 7, 'last 30 days': 30, 'last year': 365 }[choice] ?? 0;
  const from = new Date(now.getTime() - back * 86400000).toISOString().slice(0, 10);
  return day >= from;
};
export const parseF = (text: string): F => {
  const d = /^(Edited|Written) (.+)$/.exec(text);
  if (d) return { property: d[1], way: 'is', values: [d[2]], date: true };
  const m = /^(.+?) (is not set|is set|is not|is) ?(.*)$/.exec(text)!;
  return { property: m[1], way: m[2], values: m[3] ? m[3].split(/(?<!\\), ?/).map(v => v.replace(/\\,/g, ',')) : [] };
};
const textOf = (f: F) => (f.date ? `${f.property} ${f.values[0]}` : f.way.endsWith('set') ? `${f.property} ${f.way}` : `${f.property} ${f.way} ${f.values.map(v => v.replace(/,/g, '\\,')).join(', ')}`);

interface Opts { filters?: string[]; view?: string; group?: string; types?: string[]; columns?: string; deleted?: string[]; texts?: string[] }

async function start(page: Page, o: Opts = {}) {
  const calls: Argv[] = [];
  let texts = o.texts ?? ['VIEW'];
  const st = { filters: (o.filters ?? []).map(parseF), view: o.view ?? 'table', group: o.group ?? '', types: [...(o.types ?? [])], columns: o.columns ?? '', deleted: o.deleted ?? [] };
  const folders = () => [A, B].filter(f => !st.deleted.includes(f.name));
  const fence = () => ['```view', 'notebook thread word-studies', ...(st.view !== 'table' ? [`view: ${st.view}`] : []), ...(st.group ? [`group: ${st.group}`] : []), ...(st.columns ? [`columns: ${st.columns}`] : []), ...st.types.map(t => `type: ${t}`), ...st.filters.map(f => `filter: ${textOf(f)}`), '```'].join('\n');
  const textsNow = () => texts.map(t => (t === 'VIEW' ? fence() : t));
  const TITLE = 'Word studies index';
  const blocks = () => {
    let pos = TITLE.length + 2;
    return { id: 'w1', folds: [], title: { text: TITLE, start: 0, end: TITLE.length },
      blocks: textsNow().map((text, i) => { const start = pos; pos += text.length + 2; const fenceK = /^```/.test(text); return { n: i + 1, kind: fenceK ? 'fence' : 'paragraph', text, start, end: start + text.length, ...(fenceK ? { lang: 'view' } : {}) }; }) };
  };
  const own = () => [...new Set([...ROWS.flatMap(r => Object.keys(r.props)), ...st.columns.split(',').map(x => x.trim()).filter(Boolean), ...st.types.map(t => t.slice(0, t.lastIndexOf(' ')))])].sort((a, b) => a.localeCompare(b));
  const facts = (r: (typeof ROWS)[number], prop: string): string[] => {
    const p = prop.toLowerCase();
    if (p === 'folder') return [r.folder.name];
    if (p === 'edited') return [r.updated];
    if (p === 'written') return [r.created];
    if (p === 'book') return r.books;
    if (p === 'callout kind') return r.kinds;
    const k = Object.keys(r.props).find(x => x.toLowerCase() === p);
    return k ? [r.props[k]] : [];
  };
  const gone = (f: F) => (f.property === 'Folder' ? f.values.every(v => !folders().some(x => x.name === v)) : !['Edited', 'Written', 'Book', 'Callout kind'].includes(f.property) && !own().some(n => n.toLowerCase() === f.property.toLowerCase()));
  const passes = (r: (typeof ROWS)[number], f: F) => {
    const have = facts(r, f.property);
    if (f.date) return have[0] ? dateIn(f.values[0], have[0]) : false;
    const hit = f.values.some(v => have.some(x => x.toLowerCase() === v.toLowerCase()));
    return f.way === 'is' ? hit : f.way === 'is not' ? !hit : f.way === 'is set' ? have.length > 0 : have.length === 0;
  };
  const tally = (prop: string) => { const m = new Map<string, number>(); for (const r of ROWS) for (const v of new Set(facts(r, prop))) m.set(v, (m.get(v) || 0) + 1); return [...m].sort(([a], [b]) => a.localeCompare(b)).map(([value, count]) => ({ value, label: value, count })); };
  const menu = () => {
    const out: any[] = [
      { name: 'Folder', group: 'page', hint: 'The folder a page is in', type: 'choice', values: tally('Folder') },
      { name: 'Edited', group: 'page', hint: 'When the page was last changed', type: 'date', values: ['today', 'last 7 days', 'last 30 days', 'last year'].map(v => ({ value: v, label: v[0].toUpperCase() + v.slice(1), count: ROWS.filter(r => dateIn(v, r.updated)).length })) },
      { name: 'Written', group: 'page', hint: 'When the page was first made', type: 'date', values: ['today', 'last 7 days', 'last 30 days', 'last year'].map(v => ({ value: v, label: v[0].toUpperCase() + v.slice(1), count: ROWS.filter(r => dateIn(v, r.created)).length })) },
      { name: 'Callout kind', group: 'page', hint: 'The callouts written in a page', type: 'choice', values: tally('Callout kind') },
      { name: 'Book', group: 'page', hint: 'The books a page names', type: 'choice', values: [
        { value: 'Numbers', label: 'Numbers', count: 2, chapters: [{ value: 'Numbers 25', label: '25', count: 1 }] },
        { value: 'Proverbs', label: 'Proverbs', count: 1, chapters: [{ value: 'Proverbs 1', label: '1', count: 1 }] }] },
    ];
    for (const n of own()) {
      const t = st.types.find(x => x.startsWith(`${n} `))?.split(' ').pop() ?? 'text';
      out.push({ name: n, group: 'own', hint: 'A column you added with + Property', type: t, values: t === 'yesno' ? [{ value: 'true', label: 'Yes', count: 0 }, { value: 'false', label: 'No', count: 0 }] : tally(n) });
    }
    return out;
  };
  const views = () => {
    const live = st.filters.filter(f => !gone(f));
    const keep = ROWS.filter(r => live.every(f => passes(r, f)));
    const g = st.group || (st.view === 'board' ? 'folder' : '');
    const v: any = { n: texts.indexOf('VIEW') + 1, line: 'notebook thread word-studies', view: st.view, group: g, columns: st.columns ? st.columns.split(',').map(x => x.trim()) : [], sort: '', properties: own(), folder: A, query: { thread: 'word-studies' },
      types: st.types.map(t => ({ name: t.slice(0, t.lastIndexOf(' ')), type: t.split(' ').pop() })),
      filters: st.filters.map(f => ({ ...f, way: f.date ? 'is' : f.way, text: textOf(f), gone: gone(f), gone_values: f.property === 'Folder' ? f.values.filter(x => !folders().some(y => y.name === x)) : [] })),
      filter_menu: menu(), total: ROWS.length, count: keep.length, pages: keep.length, rows: keep };
    if (g === 'folder' || (g && g !== 'callout')) {
      const key = (r: (typeof ROWS)[number]): [string, string, string | null] => (g === 'folder' ? [r.folder.id, r.folder.name, r.folder.color] : [r.props[g] ?? '', r.props[g] ?? `No ${g}`, null]);
      const all = new Map<string, any>();
      for (const r of ROWS) { const [k, label, color] = key(r); all.set(k, { key: k, label, color, count: 0, rows: [] }); }
      for (const r of keep) { const gg = all.get(key(r)[0]); gg.rows.push(r); gg.count++; }
      v.groups = [...all.values()].filter(x => st.view === 'board' || x.count);
    }
    return { id: 'w1', blocks: [v] };
  };
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!.replace(/\.json$/, '');
    const input = decodeURIComponent(route.request().headers()['x-wb-input'] ?? '');
    const argv: Argv = JSON.parse(decodeURIComponent(route.request().headers()['x-wb-argv'] ?? '[]'));
    const send = (json: unknown) => route.fulfill({ json });
    if (name === 'note-show-w1') return send({ id: 'w1', title: TITLE, kind: 'note', placed: false, text: [TITLE, ...textsNow()].join('\n\n'), updated: '2026-11-20T14:02:00', linked_from: [], also: [], threads: [], refs: [] });
    if (name === 'page-blocks-w1') return send(blocks());
    if (name === 'page-views-w1') return send(views());
    if (name.startsWith('refs-plain-')) return send([]);
    if (name === 'thread-list') return send([{ id: A.id, name: A.name, color: A.color, count: 3 }, { id: B.id, name: B.name, color: B.color, count: 1 }]);
    if (name.startsWith('block-view-w1-')) {
      calls.push(argv);
      for (let i = 4; i < argv.length; i++) {
        const f = argv[i], v = argv[i + 1];
        if (f === '--filter') { const nf = parseF(v); st.filters = [...st.filters.filter(x => x.property.toLowerCase() !== nf.property.toLowerCase()), ...(nf.date && nf.values[0] === 'any time' ? [] : [nf])]; }
        else if (f === '--unfilter') st.filters = v === 'all' ? [] : st.filters.filter(x => x.property !== v);
        else if (f === '--view') st.view = v;
        else if (f === '--group') st.group = v === 'none' ? '' : v;
        else if (f === '--columns') st.columns = v;
        else if (f === '--type') { const n = v.slice(0, v.lastIndexOf(' ')); st.types = [...st.types.filter(x => !x.startsWith(`${n} `)), v]; }
      }
      return send(blocks());
    }
    if (/^(page-prop|page-new|note-thread)-/.test(name)) {
      calls.push(argv);
      if (name === 'page-prop-w1') return send({ id: 'w1', props: { Status: 'Open' } });
      return send({ id: 'w1', props: {} });
    }
    if (name.startsWith('block-set-w1-1')) { calls.push(argv); texts = [input]; return send({ ...blocks(), n: 1, count: 1 }); }
    if (name === 'notebook-group-none') return send({ groups: [{ key: 'all', label: 'All', count: 1, entries: [{ id: 'w1', title: TITLE, kind: 'note', placed: false, label: '', preview: '', updated: '2026-11-20', created: '2026-11-20' }] }] });
    if (name === 'settings-notebook') return send({});
    if (name === 'page-sweep') return send({ operations: [], errors: [] });
    if (name === 'docs-looks') return send({ looks: [] });
    if (name === 'craft-designs') return send({ themes: {}, theme: '' });
    if (name.startsWith('docs-list-')) return send([]);
    if (name === 'template-list') return send({ templates: [] });
    if (name.startsWith('page-overview-') || name.startsWith('page-study-')) return send({});
    return route.fallback();
  });
  await page.goto('/?at=NUM.26');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
  await page.waitForSelector('.pane-notebook');
  await page.evaluate(() => (window as any).__wb.note('w1'));
  await page.waitForSelector('.nb-block[data-n="1"]');
  const list = page.locator('.nb-block[data-n="1"] .nb-listview');
  if (texts.includes('VIEW')) await expect(list.locator('.nbv-summary')).toContainText('Folder: Word studies');
  const filterCalls = () => calls.filter(c => c[0] === 'block' && c[1] === 'view').map(c => c.slice(4).join(' '));
  return { calls, st, list, filterCalls };
}

const row = (page: Page, label: string) => page.locator('.wbm-row .wbm-label').getByText(label, { exact: true });
/** Filter ▸ property ▸ tick a value (the picker stays open until Done). */
async function tick(page: Page, list: ReturnType<Page['locator']>, property: string, ...values: string[]) {
  const first = !(await page.locator('.wbm').count());
  if (first) await list.locator('.nbv-filters').click();
  await row(page, property).click();
  for (const v of values) await row(page, v).click();
}
const done = (page: Page) => page.locator('.wbm-done').click();
const chipsOf = (list: ReturnType<Page['locator']>) => list.locator('.wb-chip');

test('filter_menu_lists_properties', async ({ page }) => {
  const s = await start(page);
  // 1a: a labelled Filter button in the head; 1b: the one menu, About the page then Your own properties, each with a line saying what it is
  await expect(s.list.locator('.nbv-filters')).toHaveText('Filter');
  await s.list.locator('.nbv-filters').click();
  await expect(page.locator('.wbm-group')).toHaveText(['About the page', 'Your own properties']);
  await expect(page.locator('.wbm-row .wbm-label')).toHaveText(['Folder', 'Edited', 'Written', 'Callout kind', 'Book', 'Speaker', 'Status']);
  await expect(page.locator('.wbm-row .wbm-desc').first()).toHaveText('The folder a page is in');
  await expect(page.locator('.wbm-row .wbm-desc').nth(1)).toHaveText('When the page was last changed');
  // the old Filters button (it opened the line for editing) is gone
  await expect(s.list.getByRole('button', { name: 'Filters', exact: true })).toHaveCount(0);
  await page.keyboard.type('stat');
  await expect(page.locator('.wbm-row .wbm-label')).toHaveText(['Status']);
});

test('tick_value_applies_at_once', async ({ page }) => {
  const s = await start(page);
  await tick(page, s.list, 'Status', 'Open');
  // no Apply: the call went out, the list narrowed behind the menu, a chip appeared, the head counts
  await expect.poll(s.filterCalls).toEqual(['--filter Status is Open']);
  await expect(chipsOf(s.list)).toHaveText(['Status: Open▾×']);
  await expect(s.list.locator('.nbv-summary')).toContainText('2 of 4 pages');
  await expect(s.list.locator('tbody tr')).toHaveCount(2);
  await expect(page.locator('.wbm')).toBeVisible();
  await expect(page.locator('.wbm-row .wbm-label').getByText('Open', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Apply/ })).toHaveCount(0);
  await done(page);
  await expect(page.locator('.wbm')).toHaveCount(0);
});

test('chip_reopens_its_picker', async ({ page }) => {
  const s = await start(page, { filters: ['Status is Open'] });
  await s.list.locator('.wb-chip-main').click();
  await expect(page.locator('.wbm .wbm-row .wbm-label').filter({ hasText: /^(is|is not|is not set|is set)$/ })).toHaveText(['is', 'is not', 'is not set', 'is set']);
  await row(page, 'is not').click();
  await expect.poll(s.filterCalls).toEqual(['--filter Status is not Open']);
  await expect(chipsOf(s.list)).toContainText('Status is not: Open');
  await page.keyboard.press('Escape');
  await s.list.locator('.wb-chip-main').click();
  await row(page, 'is not set').click();
  await expect.poll(s.filterCalls).toEqual(['--filter Status is not Open', '--filter Status is not set']);
  await expect(page.locator('.wbm')).toHaveCount(0);
  await expect(s.list.locator('tbody tr')).toHaveCount(1);
});

test('chip_x_removes_filter', async ({ page }) => {
  const s = await start(page, { filters: ['Status is Open', 'Folder is Salt', 'Callout kind is Key point'] });
  await expect(chipsOf(s.list)).toHaveCount(3);
  // 4b: many chips wrap; nothing is squeezed or scrolled sideways, Add filter and Clear stay at the end
  const wrap = await s.list.locator('.wb-chips').evaluate(el => ({ wrap: getComputedStyle(el).flexWrap, over: el.scrollWidth > el.clientWidth }));
  expect(wrap).toEqual({ wrap: 'wrap', over: false });
  await expect(s.list.locator('.wb-chips > *').last()).toHaveText('Clear');
  await s.list.getByLabel('Remove filter Folder').click();
  await expect.poll(s.filterCalls).toEqual(['--unfilter Folder']);
  await expect(chipsOf(s.list)).toHaveCount(2);
  // Backspace on a focused chip takes it away and focus moves to the next chip
  await s.list.locator('.wb-chip-main').first().focus();
  await page.keyboard.press('Backspace');
  await expect.poll(s.filterCalls).toEqual(['--unfilter Folder', '--unfilter Status']);
  await expect(chipsOf(s.list)).toHaveCount(1);
  await expect(s.list.locator('.wb-chip-main')).toBeFocused();
  await s.list.getByLabel('Remove filter Callout kind').click();
  await expect(s.list.locator('.wb-chips')).toHaveCount(0);
  await expect(s.list.locator('tbody tr')).toHaveCount(4);
});

test('clear_removes_all_filters', async ({ page }) => {
  const s = await start(page, { filters: ['Status is Open', 'Folder is Salt'] });
  await s.list.locator('.wb-chip-clear').click();
  await expect.poll(s.filterCalls).toEqual(['--unfilter all']);
  await expect(chipsOf(s.list)).toHaveCount(0);
  await expect(s.list.locator('tbody tr')).toHaveCount(4);
});

test('filters_combine_and_within_or', async ({ page }) => {
  const s = await start(page);
  await tick(page, s.list, 'Status', 'Open', 'Done');
  await expect.poll(s.filterCalls).toEqual(['--filter Status is Open', '--filter Status is Done, Open']);
  await expect(chipsOf(s.list)).toHaveText(['Status: Done, Open▾×']);
  await expect(s.list.locator('tbody tr')).toHaveCount(3);
  await done(page);
  await tick(page, s.list, 'Folder', 'Salt');
  await expect.poll(s.filterCalls).toContain('--filter Folder is Salt');
  await expect(chipsOf(s.list)).toHaveCount(2);
  await expect(s.list.locator('tbody tr')).toHaveCount(1);
  await expect(s.list.locator('.nbv-summary')).toContainText('1 of 4 pages');
});

test('date_filter_fixed_choices', async ({ page }) => {
  const s = await start(page);
  await tick(page, s.list, 'Edited');
  await expect(page.locator('.wbm-row .wbm-label')).toHaveText(['Today', 'Last 7 days', 'Last 30 days', 'Last year', 'Any time']);
  await expect(page.locator('.wbm input:not(.wbm-input)')).toHaveCount(0);
  await row(page, 'Last 7 days').click();
  await expect.poll(s.filterCalls).toEqual(['--filter Edited last 7 days']);
  await expect(chipsOf(s.list)).toHaveText(['Edited: last 7 days▾×']);
  await expect(s.list.locator('tbody tr')).toHaveCount(1);
  await s.list.locator('.wb-chip-main').click();
  await row(page, 'Any time').click();
  await expect.poll(s.filterCalls).toEqual(['--filter Edited last 7 days', '--unfilter Edited']);
  await expect(chipsOf(s.list)).toHaveCount(0);
});

test('search_this_list_with_chips', async ({ page }) => {
  const s = await start(page, { filters: ['Status is Open'] });
  const before = s.calls.length;
  await s.list.getByRole('button', { name: 'Search this list' }).click();
  const field = s.list.getByRole('searchbox', { name: 'Search this list' });
  await expect(field).toBeFocused();
  await field.fill('zeal');
  await expect(s.list.locator('tbody tr')).toHaveCount(1);
  await expect(s.list.locator('.nbv-summary')).toContainText('1 of 4 pages');
  await expect(chipsOf(s.list)).toHaveCount(1);
  await field.press('Escape');
  await expect(field).toBeHidden();
  await expect(s.list.locator('tbody tr')).toHaveCount(2);
  // the words are not kept: nothing was written
  expect(s.calls.length).toBe(before);
});

test('chips_on_every_view', async ({ page }) => {
  const s = await start(page, { filters: ['Folder is Word studies'] });
  for (const [view, sel] of [['List', '.nbv-line-row'], ['Gallery', '.nbv-card'], ['Board', '.nbv-bcard'], ['Table', 'tbody tr']] as const) {
    await s.list.getByRole('button', { name: 'View' }).click();
    await row(page, view).click();
    await expect(s.list).toHaveAttribute('data-view', view.toLowerCase());
    await expect(chipsOf(s.list)).toHaveText(['Folder: Word studies▾×']);
    await expect(s.list.locator(sel)).toHaveCount(2);
  }
  // a Board column left empty stays, with 0, so a card can be dragged into it
  await s.list.getByRole('button', { name: 'View' }).click();
  await row(page, 'Board').click();
  await expect(s.list.locator('.nbv-col')).toHaveCount(2);
  await expect(s.list.locator('.nbv-col[data-key="salt"] .nbv-group-count')).toHaveText('0');
});

test('no_match_says_so', async ({ page }) => {
  const s = await start(page, { filters: ['Status is Done', 'Folder is Salt'] });
  await expect(s.list.locator('.nbv-nomatch')).toContainText('No pages match these filters.');
  await expect(chipsOf(s.list)).toHaveCount(2);
  await s.list.getByRole('button', { name: 'Clear filters' }).click();
  await expect.poll(s.filterCalls).toEqual(['--unfilter all']);
  await expect(s.list.locator('tbody tr')).toHaveCount(4);
});

test('filters_kept_in_the_page', async ({ page }) => {
  // 11b: a page closed and opened again shows the same chips over the same pages; nothing asks to save (they are lines of the fence)
  const s = await start(page, { filters: ['Status is Open', 'Edited today'] });
  await expect(chipsOf(s.list)).toHaveText(['Status: Open▾×', 'Edited: today▾×']);
  await expect(s.list.locator('tbody tr')).toHaveCount(1);
  await expect(s.list.locator('.nbv-summary')).toContainText('1 of 4 pages');
  await page.evaluate(() => (window as any).__wb.note('w1'));
  await expect(chipsOf(s.list)).toHaveCount(2);
  await expect(page.getByRole('button', { name: /^Save/ })).toHaveCount(0);
});

test('gone_value_chip', async ({ page }) => {
  const s = await start(page, { filters: ['Folder is Salt'], deleted: ['Salt'] });
  await expect(s.list.locator('.wb-chip.gone s')).toHaveText('Folder: Salt');
  await expect(s.list.locator('.wb-chip.gone')).toContainText('gone');
  // the list ignores that filter
  await expect(s.list.locator('tbody tr')).toHaveCount(4);
  await s.list.getByLabel('Remove filter Folder').click();
  await expect.poll(s.filterCalls).toEqual(['--unfilter Folder']);
  await expect(s.list.locator('.wb-chips')).toHaveCount(0);
});

for (const [name, property, value, call] of [
  ['filter_by_folder', 'Folder', 'Word studies', 'Folder is Word studies'],
  ['filter_by_own_status', 'Status', 'Done', 'Status is Done'],
  ['filter_by_callout_kind', 'Callout kind', 'Key point', 'Callout kind is Key point'],
  ['filter_by_own_property', 'Speaker', 'J. Moore', 'Speaker is J. Moore'],
] as const) {
  test(name, async ({ page }) => {
    const s = await start(page);
    await tick(page, s.list, property, value);
    await expect.poll(s.filterCalls).toEqual([`--filter ${call}`]);
    await expect(chipsOf(s.list)).toHaveText([`${property}: ${value}▾×`]);
    await expect(s.list.locator('.nbv-summary')).toContainText('of 4 pages');
  });
}

test('filter_by_edited_written', async ({ page }) => {
  const s = await start(page);
  await tick(page, s.list, 'Edited', 'Last 30 days');
  await tick(page, s.list, 'Written', 'Last year');
  await expect.poll(s.filterCalls).toEqual(['--filter Edited last 30 days', '--filter Written last year']);
  await expect(chipsOf(s.list)).toHaveText(['Edited: last 30 days▾×', 'Written: last year▾×']);
});

test('filter_by_book', async ({ page }) => {
  const s = await start(page);
  await s.list.locator('.nbv-filters').click();
  await row(page, 'Book').click();
  // the books a page names, and the chapter inside a book (Numbers › 25)
  await expect(page.locator('.wbm-row .wbm-label').filter({ hasText: /Numbers|Proverbs/ })).toHaveText(['Numbers', 'Numbers › 25', 'Proverbs', 'Proverbs › 1']);
  await row(page, 'Numbers › 25').click();
  await expect.poll(s.filterCalls).toEqual(['--filter Book is Numbers 25']);
  await expect(s.list.locator('tbody tr')).toHaveCount(1);
});

test('chips_on_phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const s = await start(page, { filters: ['Status is Open', 'Folder is Word studies', 'Callout kind is Key point'] });
  // 16a: a labelled Filter · 3, chips are big bordered buttons that wrap, 44 px to tap, nothing off screen
  await expect(s.list.locator('.nbv-filters')).toHaveText('Filter · 3');
  const boxes = await s.list.locator('.wb-chip, .wb-chip-add').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { h: r.height, right: r.right }; }));
  expect(Math.min(...boxes.map(b => b.h))).toBeGreaterThanOrEqual(44);
  expect(Math.max(...boxes.map(b => b.right))).toBeLessThanOrEqual(390);
  expect(await s.list.locator('.wb-chip-x').first().evaluate(e => e.getBoundingClientRect().width)).toBeGreaterThanOrEqual(44);
  // 16b: a tap opens a bottom sheet with big rows, the four ways, Remove this filter and Done
  await s.list.locator('.wb-chip-main').first().click();
  const sheet = page.locator('.wbm.wbm-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('.wbm-row').filter({ hasText: /^is not set$/ })).toBeVisible();
  await expect(sheet.locator('.wbm-row', { hasText: 'Remove this filter' })).toBeVisible();
  expect((await sheet.locator('.wbm-row').first().boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(sheet.locator('.wbm-done')).toHaveText('Done');
  await sheet.locator('.wbm-done').click();
  await expect(sheet).toHaveCount(0);
});

test('list_placed_from_slash', async ({ page }) => {
  // 23: / › List in a page, then a folder: the list is a view fence on the folder
  const s = await start(page, { texts: ['A first line'] });
  await page.locator('.nb-block[data-n="1"] .nb-block-body').click();
  await expect(page.locator('.nb-block-input')).toBeFocused();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('/');
  await page.keyboard.type('list in');
  await page.keyboard.press('Enter');
  await page.locator('.chooser-row', { hasText: 'Word studies' }).click();
  await expect.poll(() => s.calls.at(-1)?.[0]).toBe('block');
  await expect.poll(() => s.calls.some(c => c[1] === 'set')).toBe(true);
});

test('own_property_add_and_type', async ({ page }) => {
  const s = await start(page, { columns: 'Speaker, Status, Due, Done, Mood', types: ['Due date', 'Done yesno', 'Mood choice'] });
  const list = s.list;
  await expect(list.getByLabel('Due of Zeal')).toHaveAttribute('type', 'date');
  await expect(list.getByLabel('Done of Zeal')).toHaveAttribute('type', 'checkbox');
  await expect(list.getByLabel('Mood of Zeal')).toHaveAttribute('list', /nbv-ch-/);
  await list.getByLabel('Due of Zeal').fill('2026-11-22');
  await list.getByLabel('Done of Zeal').check();
  await expect.poll(() => [...new Set(s.calls.filter(c => c[1] === 'prop').map(c => c.slice(2).join(' ')))]).toEqual(['p1 Due 2026-11-22 --type date', 'p1 Done true --type yesno']);
  // + Property: a name, then its kind: Text, Choice, Date or Yes/no
  // a redraw after the last cell write can land late: open the name field again until it holds
  await expect(async () => {
    await list.getByRole('button', { name: '+ Property' }).click({ timeout: 1000 });
    await list.getByLabel('Property name').fill('Reviewed', { timeout: 1000 });
    await list.getByLabel('Property name').press('Enter', { timeout: 1000 });
    await expect(page.locator('.wbm-row .wbm-label')).toHaveText(['Text', 'Choice', 'Date', 'Yes/no'], { timeout: 1500 });
  }).toPass();
  await row(page, 'Date').click();
  await expect.poll(s.filterCalls).toEqual(['--columns Speaker, Status, Due, Done, Mood, Reviewed --type Reviewed date']);
  // the type is written; the list is drawn again with it (its filter menu is read in the same drawing): the new column's cells are dates
  await expect(list.getByLabel('Reviewed of Zeal')).toHaveAttribute('type', 'date');
  // the Filter menu offers it under Your own properties
  await list.locator('.nbv-filters').click();
  await expect(page.locator('.wbm-row .wbm-label')).toContainText(['Reviewed']);
});

test('page_menu_properties', async ({ page }) => {
  await start(page);
  await page.locator('.nb-ed-head .nb-more').first().click();
  await page.locator('.wbm-row .wbm-label').getByText('Properties', { exact: true }).click();
  const panel = page.locator('.wb-props');
  await expect(panel).toBeVisible();
  await expect(panel.getByLabel('Status value')).toHaveValue('Open');
  await panel.getByLabel('Status value').fill('Done');
  await panel.getByLabel('Status value').press('Enter');
  await panel.getByLabel('Property name').fill('Mood');
  await panel.getByLabel('Property value').fill('Glad');
  await panel.getByRole('button', { name: '+ Add property' }).click();
  await expect(panel.getByLabel('Property name')).toBeVisible();
});

// ---- the Library's lists ----------------------------------------------------------------------------------------------------------

async function startLibrary(page: Page, extra: (name: string, argv: Argv, send: (j: unknown) => Promise<void>) => Promise<boolean>) {
  const calls: Argv[] = [];
  const base = JSON.parse(readFileSync('ui/public/fixtures/wb/notebook-sidebar-at-num-25.json', 'utf8'));
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!.replace(/\.json$/, '');
    const argv: Argv = JSON.parse(decodeURIComponent(route.request().headers()['x-wb-argv'] ?? '[]'));
    const send = (json: unknown) => route.fulfill({ json });
    if (await extra(name, argv, send)) { calls.push(argv); return; }
    if (name.startsWith('notebook-sidebar-')) return send({ ...base, recents: [], pinned: [], pages: [], templates: [], questions: [Q1, Q2] });
    if (name === 'page-recents') return send({ recents: [] });
    if (name === 'page-tree') return send({ pinned: [], pages: [] });
    if (name === 'settings-notebook') return send({});
    if (name === 'page-sweep') return send({ operations: [], errors: [] });
    if (name === 'docs-looks') return send({ looks: [] });
    if (name === 'craft-designs') return send({ themes: {}, theme: '' });
    if (name.startsWith('docs-list-')) return send([]);
    if (name === 'template-list') return send({ templates: [] });
    if (name.startsWith('page-overview-') || name.startsWith('page-study-') || name.startsWith('page-scripture-') || name.startsWith('page-words-')) return send({ blocks: [] });
    if (name.startsWith('refs-plain-')) return send([]);
    if (name.startsWith('notebook-group-')) return send({ groups: [] });
    return route.fallback();
  });
  await page.addInitScript(() => localStorage.setItem('wb.dock.v1', JSON.stringify({ wide: { left: true, right: true } })));
  await page.goto('/?at=NUM.26');
  await page.waitForFunction(() => (window as any).__wbReady);
  return { calls };
}
const q = (id: string, first: string, status: string) => ({ id, kind: 'question', block: 1, page: 'p2', page_title: 'Questions for Tuesday', page_kind: 'note', status, placed: false, anchor: '', label: '', quote: '', text: first, title: first, first,
  more_lines: 0, has_list: false, preview: '', created: '2026-11-20', updated: '2026-11-20', time: '', day: '', also: [], threads: [], refs: [], whole: '' });
const Q1 = q('p2#1', 'Who acts first?', 'open'), Q2 = q('p2#2', 'What is promised afterwards?', 'done');

test('questions_list_chips', async ({ page }) => {
  test.skip(page.viewportSize()!.width < 700, 'the side list is the wide Notebook’s');
  const menu = [{ name: 'Folder', group: 'page', hint: 'The folder a question’s page is in', type: 'choice', values: [{ value: 'Salt', label: 'Salt', count: 1 }] }, { name: 'Book', group: 'page', hint: 'The books a question names', type: 'choice', values: [{ value: 'Numbers', label: 'Numbers', count: 2 }] }];
  const s = await startLibrary(page, async (name, argv, send) => {
    if (!name.startsWith('question-list-')) return false;
    await send({ questions: argv.includes('Folder is Salt') ? [Q1] : [Q1, Q2], filter_menu: menu });
    return true;
  });
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
  await page.waitForSelector('.pane-notebook');
  const head = page.locator('.nb-side-head[data-part="questions"] .nb-ghead');
  if ((await head.getAttribute('aria-expanded')) !== 'true') await head.click();
  const titles = page.locator('.nb-question-row .nb-tree-title');
  await expect(page.locator('.nb-qkind')).toHaveText(['All', 'Question', 'Answered']);
  // Add filter beside All, Question and Answered: a Folder or Book chip from the same picker
  await page.locator('.nb-side .wb-chip-add').click();
  await expect(page.locator('.wbm-row .wbm-label')).toHaveText(['Folder', 'Book']);
  await row(page, 'Folder').click();
  await row(page, 'Salt').click();
  await expect(page.locator('.nb-side .wb-chip')).toHaveText(['Folder: Salt▾×']);
  await expect(titles).toHaveText(['Who acts first?']);
  expect(s.calls.some(c => c.includes('Folder is Salt'))).toBe(true);
  await done(page);
  await page.locator('.nb-side .wb-chip-x').click();
  await expect(titles).toHaveText(['Who acts first?', 'What is promised afterwards?']);
});

test('ctrlk_chips_narrow_search', async ({ page }) => {
  test.skip(page.viewportSize()!.width < 700, 'Ctrl+K and its preview pane are the desktop’s');
  const hit = { kind: 'question', id: 'p2#1', title: 'Who acts first?', snippet: 'Who acts first?', page: 'p2', updated: '' };
  const s = await startLibrary(page, async (name, argv, send) => {
    if (name === 'thread-list') { await send([{ id: 'salt', name: 'Salt', color: 'green', count: 1 }]); return true; }
    if (!name.startsWith('find-')) return false;
    await send(argv.includes('Kind is Questions') ? { groups: [{ kind: 'question', count: 1, total: 3, results: [hit] }], count: 1, total: 3 } : { groups: [{ kind: 'page', count: 1, total: 3, results: [{ kind: 'page', id: 'p9', title: 'Tuesday study', snippet: '', updated: '', folder: '', has: '' }] }], count: 1, total: 3 });
    return true;
  });
  await page.keyboard.press('Control+k');
  const menu = page.locator('.wbm').first();
  await menu.locator('.wbm-input').fill('who');
  await expect(menu.locator('.wbm-row .wbm-label')).toHaveText(['Tuesday study']);
  await menu.locator('.wb-chip-add').click();
  await row(page, 'Kind').click();
  await row(page, 'Questions').click();
  await expect(menu.locator('.wb-chip')).toHaveText(['Kind: Questions▾×']);
  await expect(menu.locator('.wbm-row .wbm-label')).toHaveText(['Who acts first?']);
  expect(s.calls.some(c => c[0] === 'find' && c.includes('Kind is Questions'))).toBe(true);
  await done(page);
  // Esc clears the words first, then closes
  await page.keyboard.press('Escape');
  await expect(menu).toBeVisible();
  await expect(menu.locator('.wbm-input')).toHaveValue('');
  await page.keyboard.press('Escape');
  await expect(page.locator('.wbm')).toHaveCount(0);
});

test('folder_chips', async ({ page }) => {
  test.skip(page.viewportSize()!.width < 700, 'the folder page is checked at desktop width');
  const members = [
    ...Array.from({ length: 6 }, (_, i) => ({ anchor: `NUM.25:${11 + i}`, label: `Numbers 25:${11 + i}`, quote: '', kind: 'verse' })),
    ...Array.from({ length: 3 }, (_, i) => ({ anchor: `PRO.1:${i + 1}`, label: `Proverbs 1:${i + 1}`, quote: '', kind: 'verse' })),
    { anchor: 'H7065', label: 'H7065', quote: '', kind: 'lemma' },
  ];
  const thread = { id: 'thread:salt', slug: 'salt', kind: 'thread', title: 'Salt', color: 'green', text: '', preview: '', placed: false, anchor: '', updated: '2026-11-20', created: '2026-11-20' };
  await startLibrary(page, async (name, _argv, send) => {
    if (name === 'note-show-thread-salt') { await send(thread); return true; }
    if (name === 'page-blocks-thread-salt') { await send({ id: thread.id, text: '', blocks: [] }); return true; }
    if (name === 'thread-show-salt') { await send({ id: 'salt', members }); return true; }
    if (name === 'docs-list-thread-salt') { await send([]); return true; }
    return false;
  });
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
  await page.waitForSelector('.pane-notebook');
  await page.evaluate(() => (window as any).__wb.note('thread:salt'));
  const box = page.locator('.nb-thread-places');
  await expect(box.locator('.member')).toHaveCount(10);
  await box.locator('.wb-chip-add').click();
  await row(page, 'Book').click();
  await row(page, 'Numbers').click();
  await expect(box.locator('.wb-chip')).toHaveText(['Book: Numbers▾×']);
  await expect(box.locator('.member')).toHaveCount(6);
  await expect(box.locator('.label').first()).toHaveText('Places · 6 of 10');
});
