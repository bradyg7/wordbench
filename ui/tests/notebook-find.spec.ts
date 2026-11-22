import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// design/features/notebook rows 34, 35, 26 and 46b (NB13): Ctrl+K, the Library's one search with its live preview; Recents replacing Today in
// the side list; a folder's color dotting its pages; the Questions list filtered by kind. No Rust here: a small server stands in for `wb`
// (what the window asks is answered from the tables below), and what the window sent is read back from the calls. The words are the
// test's own, not scripture.
interface Call { name: string; input: string }
type P = { id: string; title: string; texts: string[]; threads?: { id: string; name: string; color: string | null }[] };

const PAGES: P[] = [
  { id: 'p1', title: 'Tuesday study', texts: ['- first item to read', '- second item to read', '- third item to read'] },
  { id: 'p2', title: 'Questions for Tuesday', texts: ['> [!question] Who acts first, and who waits?'] },
  { id: 'p3', title: 'Word studies index', texts: ['| Title | Folder | Edited |\n| --- | --- | --- |\n| Zeal | Word studies | 3 Nov |\n| Covenant of peace | Word studies | 28 Oct |'] },
  { id: 'p4', title: 'Phinehas and notes', texts: ['> [!key] The thing to remember.', 'A plain paragraph.'], threads: [{ id: 'phinehas', name: 'Phinehas', color: 'orange' }] },
];

const kindOf = (t: string) => (/^#{1,3} /.test(t) ? 'heading' : /^- /.test(t) ? 'bullet' : /^\|/.test(t) ? 'table' : /^> /.test(t) ? 'quote' : 'paragraph');
const LABEL: Record<string, string> = { question: 'Question', done: 'Answered', key: 'Key point', note: 'Note' };
const calloutOf = (t: string) => {
  const m = /^> \[!(question|done|key|note)\][+-]?\s?(.*)$/i.exec(t.split('\n')[0]);
  return m ? { kind: m[1].toLowerCase(), label: LABEL[m[1].toLowerCase()], first: m[2], more: 0, list: false } : undefined;
};
const blocksOf = (p: P) => {
  let pos = p.title.length + 2;
  return { id: p.id, folds: [], title: { text: p.title, start: 0, end: p.title.length },
    blocks: p.texts.map((text, i) => { const start = pos; pos += text.length + 2; const c = calloutOf(text); return { n: i + 1, kind: kindOf(text), text, start, end: start + text.length, ...(c ? { callout: c } : {}), ...(kindOf(text) === 'bullet' ? { indent: 0 } : {}) }; }) };
};
const detail = (p: P) => ({ id: p.id, title: p.title, kind: 'note', placed: false, text: [p.title, ...p.texts].join('\n\n'), updated: '2026-11-20T14:02:00', linked_from: [], also: [], threads: p.threads ?? [], refs: [] });
const treeRow = (p: P, over: Record<string, unknown> = {}) => ({ id: p.id, title: p.title, kind: 'note', placed: false, anchor: '', label: '', color: null, dot: p.threads?.[0]?.color ?? null, status: null, pinned: null, order: null, parent: null, created: '2026-11-20', updated: '2026-11-20', children: [], ...over });

interface Setup {
  recents?: unknown[];
  finds?: Record<string, unknown>;
  sidebar?: (base: any) => any;
  extra?: (name: string, send: (json: unknown) => Promise<void>, input: string) => Promise<boolean> | boolean;
}

async function start(page: Page, setup: Setup = {}) {
  const calls: Call[] = [];
  const base = JSON.parse(readFileSync('ui/public/fixtures/wb/notebook-sidebar-at-num-25.json', 'utf8'));
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!.replace(/\.json$/, '');
    const input = decodeURIComponent(route.request().headers()['x-wb-input'] ?? '');
    const send = (json: unknown) => route.fulfill({ json });
    const m = /^(?:page-blocks|note-show)-(p\d)$/.exec(name);
    if (m) { const p = PAGES.find(x => x.id === m[2 - 1])!; return send(name.startsWith('page-blocks') ? blocksOf(p) : detail(p)); }
    if (name === 'page-recents') return send({ recents: setup.recents ?? [] });
    if (name.startsWith('find-')) { calls.push({ name, input }); return send(setup.finds?.[name] ?? { groups: [], count: 0, total: 0 }); }
    if (name.startsWith('history-add-')) { calls.push({ name, input }); return send({ id: 's1' }); }
    if (name.startsWith('notebook-sidebar-')) return send(setup.sidebar ? setup.sidebar(base) : { ...base, recents: setup.recents ?? [] });
    if (name === 'page-tree') return send({ pinned: [], pages: [] });
    if (name === 'settings-notebook') return send({});
    if (name === 'page-sweep') return send({ operations: [], errors: [] });
    if (name === 'docs-looks') return send({ looks: [] });
    if (name === 'craft-designs') return send({ themes: {}, theme: '' });
    if (name.startsWith('docs-list-')) return send([]);
    if (name === 'template-list') return send({ templates: [] });
    if (name.startsWith('page-overview-') || name.startsWith('page-study-')) return send({});
    if (name.startsWith('page-scripture-')) return send({ blocks: [] });
    if (name.startsWith('refs-plain-')) return send([]);
    if (name.startsWith('page-words-')) return send({ blocks: [] });
    if (name.startsWith('notebook-group-')) return send({ groups: [] });
    if (setup.extra && (await setup.extra(name, send, input))) { calls.push({ name, input }); return; }
    return route.fallback();
  });
  await page.addInitScript(() => localStorage.setItem('wb.dock.v1', JSON.stringify({ wide: { left: true, right: true } })));
  await page.goto('/?at=NUM.26');
  await page.waitForFunction(() => (window as any).__wbReady);
  return { calls };
}
const openNotebook = async (page: Page) => {
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
  await page.waitForSelector('.pane-notebook');
};
const wide = (page: Page) => page.viewportSize()!.width >= 700;

const result = (kind: string, p: P, over: Record<string, unknown> = {}) => ({ kind, id: p.id, title: p.title, snippet: '', updated: '2026-11-20', ...over });
const FIND_TUESDAY = { groups: [{ kind: 'page', count: 3, total: 4, results: [
  result('page', PAGES[0], { folder: '', has: 'a list' }),
  result('page', PAGES[1], { folder: 'Salt', has: 'callouts' }),
  result('page', PAGES[2], { folder: '', has: 'a table' }),
] }], count: 3, total: 4 };
const FIND_PHIN = { groups: [
  { kind: 'folder', count: 2, total: 2, results: [
    { kind: 'folder', id: 'thread:phinehas', title: 'Phinehas', color: 'orange', pages: 40, saves: 16, count: 56, updated: '' },
    { kind: 'folder', id: 'thread:echoes', title: 'Phinehas echoes', color: 'blue', pages: 9, saves: 10, count: 19, updated: '' },
  ] },
  { kind: 'page', count: 1, total: 1, results: [result('page', PAGES[3], { folder: 'Phinehas', has: 'callouts' })] },
  { kind: 'key', count: 1, total: 1, results: [{ kind: 'key', id: 'p4#1', title: 'The thing to remember.', snippet: 'Phinehas and notes', page: 'p4', updated: '' }] },
], count: 4, total: 4 };

test('quick_search_preview_and_recents', async ({ page }) => {
  test.skip(!wide(page), 'Ctrl+K and its preview pane are the desktop’s; the phone’s menus are sheets (row 37)');
  const recents = [PAGES[2], PAGES[0]].map(p => treeRow(p, { at: '2026-11-20T10:00:00Z' }));
  const s = await start(page, { recents, finds: { 'find-tuesday-sort-edited': FIND_TUESDAY, 'find-phin-sort-edited': FIND_PHIN } });
  // Ctrl+K from anywhere (here: the reader, no Notebook open yet) opens the one menu, in the middle, with its preview pane
  await page.keyboard.press('Control+k');
  const menu = page.locator('.wbm');
  await expect(menu).toBeVisible();
  await expect(menu.locator('.wbm-preview')).toBeVisible();
  await expect(menu.locator('.wbm-input')).toBeFocused();
  // empty: Recents, the last pages opened, newest first
  await expect(menu.locator('.wbm-group')).toHaveText(['Recents']);
  await expect(menu.locator('.wbm-row .wbm-label')).toHaveText(['Word studies index', 'Tuesday study']);
  // 34a: typing finds pages; the first is highlighted and previewed, its list shown as it is in the page
  await menu.locator('.wbm-input').fill('tuesday');
  await expect(menu.locator('.wbm-group')).toHaveText(['Pages']);
  await expect(menu.locator('.wbm-row .wbm-label')).toHaveText(['Tuesday study', 'Questions for Tuesday', 'Word studies index']);
  await expect(menu.locator('.wbm-row .wbm-desc')).toHaveText(['Pages · a list', 'Salt · callouts', 'Pages · a table']);
  const pv = menu.locator('.wbm-preview');
  await expect(pv.locator('.wbm-pv-title')).toHaveText('Tuesday study');
  await expect(pv.locator('.wbm-pv-li')).toHaveText(['•first item to read', '•second item to read', '•third item to read']);
  // 34b: ↓ shows the callout with its kind and its color
  await page.keyboard.press('ArrowDown');
  await expect(pv.locator('.wbm-pv-title')).toHaveText('Questions for Tuesday');
  await expect(pv.locator('.nb-callout')).toHaveAttribute('class', /nb-callout-question/);
  await expect(pv.locator('.nb-callout-label')).toHaveText('Question');
  await expect(pv.locator('.nb-callout-main')).toContainText('Who acts first, and who waits?');
  // 34c: ↓ again, a table's first rows
  await page.keyboard.press('ArrowDown');
  await expect(pv.locator('.wbm-pv-title')).toHaveText('Word studies index');
  await expect(pv.locator('th')).toHaveText(['Title', 'Folder', 'Edited']);
  await expect(pv.locator('tr')).toHaveCount(3);
  await expect(pv.locator('tr').nth(2).locator('td').first()).toHaveText('Covenant of peace');
  // 34d: folders show their color and how many pages and saves they hold; Key points are a group of their own
  await menu.locator('.wbm-input').fill('phin');
  await expect(menu.locator('.wbm-group')).toHaveText(['Folders', 'Pages', 'Key points']);
  const folders = menu.locator('.wbm-row').filter({ has: page.locator('.wbm-dot') });
  await expect(folders.locator('.wbm-label')).toHaveText(['Phinehas', 'Phinehas echoes']);
  await expect(folders.locator('.wbm-hint')).toHaveText(['56 pages and saves', '19 pages and saves']);
  await expect(folders.first().locator('.wbm-dot')).toHaveCSS('background-color', /rgb/);
  await expect(pv.locator('.wbm-pv-title')).toContainText('Phinehas');
  expect(s.calls.map(c => c.name).filter(n => n.startsWith('find-'))).toEqual(['find-tuesday-sort-edited', 'find-phin-sort-edited']);
  // Esc clears the words first, then closes it; Ctrl+K again opens it
  await page.keyboard.press('Escape');
  await expect(menu.locator('.wbm-input')).toHaveValue('');
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await page.keyboard.press('Control+k');
  await expect(menu).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(menu).toHaveCount(0);
});

test('quick_search_enter_opens_the_page', async ({ page }) => {
  await start(page, { finds: { 'find-tuesday-sort-edited': FIND_TUESDAY } });
  await page.keyboard.press('Control+k');
  await page.locator('.wbm-input').fill('tuesday');
  await expect(page.locator('.wbm-row')).toHaveCount(3);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('.wbm')).toHaveCount(0);
  await page.waitForSelector('.pane-notebook');
  await expect(page.locator('.nb-title').first()).toContainText('Questions for Tuesday');
});

test('side_list_recents_replaces_today', async ({ page }) => {
  test.skip(!wide(page), 'the side list is the wide Notebook’s');
  const eight = Array.from({ length: 8 }, (_, i) => treeRow({ id: `r${i + 1}`, title: `Recent page ${i + 1}`, texts: [] }, { at: `2026-11-20T10:0${9 - i}:00Z` }));
  eight[0] = treeRow(PAGES[3], { at: '2026-11-20T10:09:00Z' });
  const s = await start(page, { recents: eight, sidebar: base => ({ ...base, recents: eight, today: [{ id: 'd1', day: '2026-11-20', title: 'Friday, November 20', today: true, exists: true }],
    pinned: [], pages: PAGES.map(p => treeRow(p)), questions: [], templates: [] }) });
  await openNotebook(page);
  const heads = page.locator('.nb-side-head .nb-glabel');
  // Recents is the first group, above Pinned and Pages; there is no Today
  await expect(heads.first()).toHaveText('Recents');
  await expect(heads.nth(1)).toHaveText('Pinned');
  await expect(page.locator('.nb-side-head[data-part="today"]')).toHaveCount(0);
  await expect(page.locator('.nb-side-head[data-part="recents"] .nb-count')).toHaveText('8');
  const rows = page.locator('.nb-recent-row .nb-tree-title');
  await expect(rows).toHaveCount(8);
  await expect(rows.first()).toHaveText('Phinehas and notes');
  await expect(rows.last()).toHaveText('Recent page 8');
  // the page of a folder with a color carries its dot here too (row 26)
  await expect(page.locator('.nb-recent-row').first().locator('.dot')).toHaveAttribute('data-color', 'orange');
  // the group folds
  const head = page.locator('.nb-side-head[data-part="recents"] .nb-ghead');
  await head.click();
  await expect(rows).toHaveCount(0);
  await head.click();
  await expect(rows).toHaveCount(8);
  // opening a page takes a step on the trail (what `wb page recents` reads): kind page, line `page <id>`
  await page.locator('.nb-recent-row', { hasText: 'Phinehas and notes' }).click();
  await expect(page.locator('.nb-title').first()).toContainText('Phinehas and notes');
  await expect.poll(() => s.calls.map(c => c.name).some(n => n.startsWith('history-add-page-phinehas-and-notes-line-page-p4'))).toBe(true);
});

test('folder_color_dots_its_pages', async ({ page }) => {
  test.skip(!wide(page), 'the side list is the wide Notebook’s');
  const folder = (color: string | null) => ({ id: 'thread:phinehas', title: 'Phinehas', kind: 'thread', placed: true, anchor: '', label: '', color, dot: null, status: null, pinned: null, order: null, parent: null, created: '2026-11-20', updated: '2026-11-20', slug: 'phinehas',
    children: [treeRow({ ...PAGES[3], threads: [{ id: 'phinehas', name: 'Phinehas', color }] }, { dot: color })] });
  let color: string | null = null;
  const s = await start(page, {
    sidebar: base => ({ ...base, recents: [], pinned: [], pages: [folder(color)], questions: [], templates: [] }),
    extra: async (name, send) => {
      if (name === 'note-show-thread-phinehas') { await send({ id: 'thread:phinehas', title: 'Phinehas', kind: 'thread', slug: 'phinehas', color, text: '', placed: true, label: '', also: [], threads: [], linked_from: [], updated: '2026-11-20', created: '2026-11-20' }); return true; }
      const m = /^folder-color-phinehas-(\w+)$/.exec(name);
      if (m) { color = m[1] === 'none' ? null : m[1]; await send({ key: 'thread:phinehas', name: 'Phinehas', color: color ?? '' }); return true; }
      return false;
    },
  });
  await openNotebook(page);
  const row = page.locator('.nb-tree-row', { hasText: 'Phinehas' }).first();
  await expect(row.locator('.dot').first()).toHaveAttribute('data-color', '');
  // ⋯ on the folder row opens its menu; Color… opens the folder colors, None first, as they are today
  await row.hover();
  await row.locator('.nb-folder-more').click();
  await page.locator('.wbm-row', { hasText: 'Color…' }).click();
  const menu = page.locator('.wbm');
  await expect(menu.locator('.wbm-group')).toHaveText('Phinehas · Color');
  await expect(menu.locator('.wbm-row .wbm-label')).toHaveText(['None', 'Yellow', 'Green', 'Blue', 'Pink', 'Orange']);
  await menu.locator('.wbm-row', { hasText: 'Orange' }).click();
  // the color is `wb folder color`; nothing is added to any list of colors
  await expect.poll(() => s.calls.map(c => c.name)).toContain('folder-color-phinehas-orange');
  expect(s.calls.some(c => c.name.startsWith('palette'))).toBe(false);
  // the folder and its page show the color in the side list
  await expect(page.locator('.nb-tree-row', { hasText: 'Phinehas' }).first().locator('.dot').first()).toHaveAttribute('data-color', 'orange');
  const child = page.locator('.nb-tree-row', { hasText: 'Phinehas and notes' });
  await expect(child.locator('.dot')).toHaveAttribute('data-color', 'orange');
  // and by the title of the page when it is open
  await child.locator('.nb-tree-open').click();
  await expect(page.locator('.nb-title .nb-title-dot')).toHaveAttribute('data-color', 'orange');
  await expect(page.locator('.nb-title').first()).toContainText('Phinehas and notes');
});

test('questions_list_filters_by_kind', async ({ page }) => {
  test.skip(!wide(page), 'the side list is the wide Notebook’s');
  const q = (id: string, first: string, status: string) => ({ id, kind: 'question', block: 1, page: 'p2', page_title: 'Questions for Tuesday', page_kind: 'note', status, placed: false, anchor: '', label: '', quote: '', text: first, title: first, first,
    more_lines: 0, has_list: false, preview: '', created: '2026-11-20', updated: '2026-11-20', time: '', day: '', also: [], threads: [], refs: [], whole: '' });
  const open = q('p2#1', 'Who acts first?', 'open'), done = q('p2#2', 'What is promised afterwards?', 'done');
  const s = await start(page, {
    sidebar: base => ({ ...base, recents: [], pinned: [], pages: [], questions: [open, done], templates: [] }),
    extra: async (name, send) => {
      if (name === 'question-list-kind-question') { await send({ questions: [open] }); return true; }
      if (name === 'question-list-kind-answered') { await send({ questions: [done] }); return true; }
      return false;
    },
  });
  await openNotebook(page);
  const head = page.locator('.nb-side-head[data-part="questions"] .nb-ghead');
  if ((await head.getAttribute('aria-expanded')) !== 'true') await head.click();
  const titles = page.locator('.nb-question-row .nb-tree-title');
  await expect(titles).toHaveText(['Who acts first?', 'What is promised afterwards?']);
  await expect(page.locator('.nb-qkind')).toHaveText(['All', 'Question', 'Answered']);
  await page.locator('.nb-qkind[data-kind="answered"]').click();
  await expect(titles).toHaveText(['What is promised afterwards?']);
  await expect(page.locator('.nb-qkind[data-kind="answered"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.nb-qkind[data-kind="question"]').click();
  await expect(titles).toHaveText(['Who acts first?']);
  await page.locator('.nb-qkind[data-kind=""]').click();
  await expect(titles).toHaveCount(2);
  expect(s.calls.map(c => c.name).filter(n => n.startsWith('question-list'))).toEqual(['question-list-kind-answered', 'question-list-kind-question']);
});
