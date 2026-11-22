import { expect, test, type Page } from '@playwright/test';

// design/features/notebook rows 36, 48, 47 and 46d (NB14): a List in a page (a folder as the database: pages are rows, a column is a page
// property, + New page, + Property), a plain Table you type into (+ at the right, + Row at the foot), View ▾ (Table, List, Gallery, Board)
// and Group by (folder, callout kind, a property). No Rust here: a small server stands in for `wb` (the page's blocks as text, the list's
// rows from the tables below), and what the window sent is read back from the calls. The words are the test's own, not scripture.
interface Call { name: string; input: string }

const FOLDER = { id: 'word-studies', name: 'Word studies', color: 'pink' };
const ROWS = [
  { id: 'p1', title: 'Zeal', folder: FOLDER, props: { Status: 'Open', Book: 'Numbers' }, updated: '2026-11-03T10:00:00', edited: '2026-11-03T10:00:00', preview: 'Zeal is the first word here' },
  { id: 'p2', title: 'Covenant of peace', folder: FOLDER, props: { Status: 'Done', Book: 'Numbers' }, updated: '2026-10-28T10:00:00', edited: '2026-10-28T10:00:00', preview: 'A second page' },
  { id: 'p3', title: 'Haste', folder: { id: 'salt', name: 'Salt', color: 'green' }, props: { Book: 'Proverbs' }, updated: '2026-10-20T10:00:00', edited: '2026-10-20T10:00:00', preview: 'Haste, in the folder Salt' },
];
const CALLOUTS = [
  { id: 'p1#1', kind: 'key', label: 'Key point', page: 'p1', page_title: 'Zeal', first: 'The thing to hold on to.' },
  { id: 'p3#1', kind: 'key', label: 'Key point', page: 'p3', page_title: 'Haste', first: 'Wait for the word before acting.' },
  { id: 'p1#2', kind: 'note', label: 'Note', page: 'p1', page_title: 'Zeal', first: 'Read the next verse too.' },
];

const word = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const group = (rows: any[], key: (r: any) => [string, string, string | null]) => {
  const m = new Map<string, any>();
  for (const r of rows) { const [k, label, color] = key(r); const g = m.get(k) ?? { key: k, label, color, count: 0, rows: [] }; g.rows.push(r); g.count++; m.set(k, g); }
  return [...m.values()];
};

async function start(page: Page, texts: string[], opts: { view?: string; group?: string; columns?: string } = {}) {
  const calls: Call[] = [];
  let blocksText = [...texts];
  const state = { view: opts.view ?? 'table', group: opts.group ?? '', columns: opts.columns ?? '' };
  const fence = () => `\`\`\`view\nnotebook thread word-studies\n${state.view !== 'table' ? `view: ${state.view}\n` : ''}${state.group ? `group: ${state.group}\n` : ''}${state.columns ? `columns: ${state.columns}\n` : ''}\`\`\``;
  const textsNow = () => blocksText.map(t => (t === 'VIEW' ? fence() : t));
  const kindOf = (t: string) => (/^```/.test(t) ? 'fence' : /^\|/.test(t) ? 'table' : 'paragraph');
  const TITLE = 'Word studies index';
  const blocks = () => {
    let pos = TITLE.length + 2;
    return { id: 'w1', folds: [], title: { text: TITLE, start: 0, end: TITLE.length },
      blocks: textsNow().map((text, i) => { const start = pos; pos += text.length + 2; return { n: i + 1, kind: kindOf(text), text, start, end: start + text.length, ...(kindOf(text) === 'fence' ? { lang: 'view' } : {}) }; }) };
  };
  const views = () => {
    const g = state.group === 'callout' ? 'callout' : state.group || (state.view === 'board' ? 'folder' : '');
    const columns = state.columns ? state.columns.split(',').map(x => x.trim()) : [];
    const v: any = { n: blocksText.indexOf('VIEW') + 1, line: 'notebook thread word-studies', view: state.view, group: g, columns, sort: '', properties: ['Book', 'Status'], folder: FOLDER, query: { thread: 'word-studies' } };
    if (g === 'callout') {
      v.rows_are = 'callouts';
      v.rows = CALLOUTS;
      v.count = CALLOUTS.length;
      v.groups = group(CALLOUTS, c => [c.kind, c.label, null]);
    } else {
      v.rows = ROWS;
      v.count = ROWS.length;
      if (g === 'folder') v.groups = group(ROWS, r => [r.folder.id, r.folder.name, r.folder.color]);
      else if (g) v.groups = group(ROWS, r => [(r.props as any)[g] ?? '', (r.props as any)[g] ?? `No ${g}`, null]);
    }
    return { id: 'w1', blocks: [v] };
  };
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!.replace(/\.json$/, '');
    const input = decodeURIComponent(route.request().headers()['x-wb-input'] ?? '');
    const send = (json: unknown) => route.fulfill({ json });
    if (name === 'note-show-w1') return send({ id: 'w1', title: TITLE, kind: 'note', placed: false, text: [TITLE, ...textsNow()].join('\n\n'), updated: '2026-11-20T14:02:00', linked_from: [], also: [], threads: [], refs: [] });
    if (name === 'page-blocks-w1') return send(blocks());
    if (name === 'page-views-w1') return send(views());
    if (name.startsWith('refs-plain-')) return send([]);
    if (name.startsWith('block-view-w1-')) {
      calls.push({ name, input });
      let m: RegExpExecArray | null;
      if ((m = /-view-(table|list|gallery|board)(?:-|$)/.exec(name))) state.view = m[1];
      if ((m = /-group-(.+?)(?:-(?:view|sort|columns)-|$)/.exec(name))) state.group = m[1] === 'none' ? '' : m[1] === 'status' ? 'Status' : m[1];
      if ((m = /-columns-(.+)$/.exec(name))) state.columns = 'Book, Status, Reviewed';
      return send(blocks());
    }
    if (/^(page-prop|page-new|note-thread)-/.test(name)) { calls.push({ name, input }); return send({}); }
    if ((name.startsWith('block-set-w1-1'))) {
      calls.push({ name, input });
      blocksText = [input];
      return send({ ...blocks(), n: 1, count: 1 });
    }
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
  return { calls, state, block: () => page.locator('.nb-block[data-n="1"]') };
}

const pick = (page: Page, label: string) => page.locator('.wbm-row', { hasText: label }).first().click();

test('list_in_a_page_folder_as_database', async ({ page }) => {
  const s = await start(page, ['VIEW']);
  const list = s.block().locator('.nb-listview');
  // the folder is the database: its dot, name and page count; each page in it is a row; a column is a property
  await expect(list.locator('.nbv-summary')).toContainText('Folder: Word studies · 3 pages');
  await expect(list.locator('.nbv-summary .dot.c-pink')).toHaveCount(1);
  await expect(list.locator('th')).toHaveText(['Title', 'Book', 'Status', 'Edited', '+ Property']);
  await expect(list.locator('tbody tr')).toHaveCount(3);
  await expect(list.locator('tbody tr').first().locator('.nbv-open')).toHaveText('Zeal');
  await expect(list.getByLabel('Status of Zeal')).toHaveValue('Open');
  await expect(list.getByLabel('Status of Haste')).toHaveValue('');
  await expect(list.locator('tbody tr').first().locator('.nbv-when')).toHaveText('3 Nov');
  // a page that lacks a property shows an empty cell, and typing in it writes the property (wb page prop)
  await list.getByLabel('Status of Haste').fill('Open');
  await list.getByLabel('Status of Haste').press('Enter');
  await expect.poll(() => s.calls.map(c => c.name)).toContain('page-prop-p3-status-open');
  // + Property adds a column: its name goes into the list's own line, not into any page
  // a redraw after the last cell write can land late: open the name field again until it holds
  await expect(async () => {
    await list.getByRole('button', { name: '+ Property' }).click({ timeout: 1000 });
    await list.getByLabel('Property name').fill('Reviewed', { timeout: 1000 });
  }).toPass();
  await list.getByLabel('Property name').press('Enter');
  await page.locator('.wbm-row', { hasText: 'Text' }).first().click();
  await expect.poll(() => s.calls.map(c => c.name).join(' ')).toContain('block-view-w1-1-columns-book-status-reviewed');
  await expect(list.locator('th')).toHaveText(['Title', 'Book', 'Status', 'Reviewed', 'Edited', '+ Property']);
  // + New page writes a page on the folder
  await list.getByRole('button', { name: 'New page' }).click();
  await expect.poll(() => s.calls.map(c => c.name)).toContain('page-new-untitled-parent-thread-word-studies');
  // the first row opens its page
  await expect(list.locator('tbody tr').first().locator('.nbv-open')).toHaveAttribute('data-id', 'p1');
});

test('list_views_and_group_by', async ({ page }) => {
  const s = await start(page, ['VIEW']);
  const list = s.block().locator('.nb-listview');
  await expect(list).toHaveAttribute('data-view', 'table');
  // View ▾: Table, List, Gallery, Board; Calendar and Timeline are marked later
  await list.getByRole('button', { name: 'View' }).click();
  await expect(page.locator('.wbm-row')).toContainText(['Table', 'List', 'Gallery', 'Board', 'Calendar', 'Timeline', 'Group by', 'Sort']);
  await expect(page.locator('.wbm-row', { hasText: 'Calendar' })).toContainText('later');
  await pick(page, 'Calendar');
  await expect(list).toHaveAttribute('data-view', 'table');
  await list.getByRole('button', { name: 'View' }).click();
  await pick(page, 'List');
  await expect.poll(() => s.calls.some(c => /^block-view-w1-1-view-list/.test(c.name))).toBe(true);
  await expect(list).toHaveAttribute('data-view', 'list');
  await expect(list.locator('.nbv-line-row')).toHaveCount(3);
  await expect(list.locator('.nbv-line-row').first()).toContainText('Zeal');
  await expect(list.locator('.nbv-line-row .dot')).toHaveCount(3);
  await list.getByRole('button', { name: 'View' }).click();
  await pick(page, 'Gallery');
  await expect(list).toHaveAttribute('data-view', 'gallery');
  await expect(list.locator('.nbv-card')).toHaveCount(3);
  await expect(list.locator('.nbv-card').first()).toContainText('Zeal');
  await expect(list.locator('.nbv-card').first()).toContainText('Word studies');
  // Board: a column for each folder; a card dragged to another column moves the page there
  await list.getByRole('button', { name: 'View' }).click();
  await pick(page, 'Board');
  await expect(list).toHaveAttribute('data-view', 'board');
  await expect(list.locator('.nbv-col')).toHaveCount(2);
  await expect(list.locator('.nbv-col').first()).toContainText('Word studies');
  await expect(list.locator('.nbv-col').first().locator('.nbv-bcard')).toHaveCount(2);
  const dt = await page.evaluateHandle(() => new DataTransfer());
  const card = list.locator('.nbv-col[data-key="word-studies"] .nbv-bcard[data-id="p1"]');
  await card.dispatchEvent('dragstart', { dataTransfer: dt });
  await list.locator('.nbv-col[data-key="salt"]').dispatchEvent('dragover', { dataTransfer: dt });
  await list.locator('.nbv-col[data-key="salt"]').dispatchEvent('drop', { dataTransfer: dt });
  await expect.poll(() => s.calls.map(c => c.name)).toEqual(expect.arrayContaining(['note-thread-p1-salt', 'note-thread-p1-word-studies-remove']));
  // back to a table, Group by folder: a heading for each folder with its count, foldable
  await list.getByRole('button', { name: 'View' }).click();
  await pick(page, 'Table');
  await list.getByRole('button', { name: 'View' }).click();
  await pick(page, 'Group by');
  await expect(page.locator('.wbm-row')).toContainText(['None', 'Folder', 'Callout kind', 'Book', 'Status']);
  await pick(page, 'Folder');
  await expect.poll(() => s.calls.some(c => /^block-view-w1-1-group-folder/.test(c.name))).toBe(true);
  const heads = list.locator('.nbv-group-head');
  await expect(heads).toHaveCount(2);
  await expect(heads.first()).toContainText('Word studies');
  await expect(heads.first().locator('.nbv-group-count')).toHaveText('2');
  await expect(heads.nth(1)).toContainText('Salt');
  const first = list.locator('.nbv-group').first();
  await expect(first.locator('tbody tr')).toHaveCount(2);
  await heads.first().click();
  await expect(heads.first()).toHaveAttribute('aria-expanded', 'false');
  await expect(first.locator('tbody tr').first()).toBeHidden();
  await heads.first().click();
  await expect(first.locator('tbody tr').first()).toBeVisible();
});

test('callouts_grouped_by_kind', async ({ page }) => {
  // row 46d: a List in a page grouped by callout kind: Key point and Note as headings, each callout a row with its page
  const s = await start(page, ['VIEW'], { view: 'list', group: 'callout' });
  const list = s.block().locator('.nb-listview');
  await expect(list.locator('.nbv-summary')).toContainText('Callouts · 3 found');
  const heads = list.locator('.nbv-group-head');
  await expect(heads).toHaveCount(2);
  await expect(heads.first()).toContainText('Key point');
  await expect(heads.first().locator('.nbv-group-count')).toHaveText('2');
  await expect(heads.nth(1)).toContainText('Note');
  const rows = list.locator('.nbv-group').first().locator('.nbv-line-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('The thing to hold on to.');
  await expect(rows.first()).toContainText('Zeal');
  await expect(rows.nth(1)).toContainText('Haste');
  // a callout row opens the page it is written in
  await expect(rows.first().locator('.nbv-open')).toHaveAttribute('data-id', 'p1');
});

test('plain_table_add_row_column', async ({ page }) => {
  const s = await start(page, ['| Who | Acts |\n| --- | --- |\n| Phinehas |  |']);
  const table = s.block().locator('.nb-table-inline');
  await expect(table.locator('th')).toHaveCount(2);
  await expect(table.locator('tbody, tr')).toHaveCount(2);
  // a cell is typed into where it is; Enter keeps it as Markdown
  await table.getByLabel('Row 1, column 2').fill('rose up');
  await table.getByLabel('Row 1, column 2').press('Enter');
  await expect.poll(() => s.calls.at(-1)?.input).toBe('| Who | Acts |\n| --- | --- |\n| Phinehas | rose up |');
  await expect(table.getByLabel('Row 1, column 2')).toHaveValue('rose up');
  // + Row adds a row at the foot
  await s.block().getByRole('button', { name: 'Add a row' }).click();
  await expect.poll(() => s.calls.at(-1)?.input).toBe('| Who | Acts |\n| --- | --- |\n| Phinehas | rose up |\n|  |  |');
  await expect(table.locator('tr')).toHaveCount(3);
  // + adds a column at the right
  await s.block().getByRole('button', { name: 'Add a column' }).click();
  await expect.poll(() => s.calls.at(-1)?.input).toBe('| Who | Acts |  |\n| --- | --- | --- |\n| Phinehas | rose up |  |\n|  |  |  |');
  await expect(table.locator('th')).toHaveCount(3);
  // the new column's heading is typed into like any cell; nothing in the table is a link
  await table.getByLabel('Column 3 heading').fill('Promise');
  await table.getByLabel('Column 3 heading').press('Enter');
  await expect.poll(() => s.calls.at(-1)?.input).toBe('| Who | Acts | Promise |\n| --- | --- | --- |\n| Phinehas | rose up |  |\n|  |  |  |');
  await expect(s.block().locator('a')).toHaveCount(0);
});

test('list_in_a_page_from_the_slash_menu', async ({ page }) => {
  // row 36: / › List in a page asks which folder, then writes the list's block: the folder on the line, the view as an option
  await page.route('**/fixtures/wb/thread-list.json', route => route.fulfill({ json: [{ id: 'word-studies', name: 'Word studies', color: 'pink', count: 3 }, { id: 'salt', name: 'Salt', color: 'green', count: 1 }] }));
  const s = await start(page, ['A first line']);
  await s.block().locator('.nb-block-body').click();
  const box = page.locator('.nb-block-input');
  await expect(box).toBeFocused();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('/');
  await page.keyboard.type('list in');
  await page.keyboard.press('Enter');
  await page.locator('.chooser-row', { hasText: 'Word studies' }).click();
  await expect.poll(() => s.calls.at(-1)?.input).toBe('```view\nnotebook thread word-studies\nview: table\n```');
});
