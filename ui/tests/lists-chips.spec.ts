import { expect, test, type Page } from '@playwright/test';
import { notebookRoutes } from './notebook-fixtures';

// design/features/filters-v2 rows 26-33 (NB17): the one chip component (ui/src/chips.ts) on Margin notes, Highlights, Findings, the
// Legend's "where used", Colors across the Bible, Bible Search and Near, Every use and the Concordance. No Rust here: a small server
// stands in for `wb` and narrows its rows from the exact words the window sent (the `x-wb-argv` header), the way wb-core does, and each
// answer carries the `properties` the real command gives. The words and places are the test's own, not scripture.
type Argv = string[];
interface F { property: string; way: string; values: string[]; date?: boolean }

const parseF = (text: string): F => {
  const d = /^(Edited|Written) (.+)$/.exec(text);
  if (d) return { property: d[1], way: 'is', values: [d[2]], date: true };
  const m = /^(.+?) (is not set|is set|is not|is) ?(.*)$/.exec(text)!;
  return { property: m[1], way: m[2], values: m[3] ? m[3].split(/(?<!\\), ?/).map(v => v.replace(/\\,/g, ',')) : [] };
};
const filtersOf = (argv: Argv) => argv.flatMap((a, i) => (argv[i - 1] === '--filter' ? [parseF(a)] : []));
const passes = (have: string[], f: F) => {
  const hit = f.values.some(v => have.some(x => x.toLowerCase() === v.toLowerCase()));
  return f.way === 'is' ? hit : f.way === 'is not' ? !hit : f.way === 'is set' ? have.length > 0 : have.length === 0;
};
const narrow = <T>(rows: T[], argv: Argv, facts: (r: T, p: string) => string[]) => rows.filter(r => filtersOf(argv).every(f => passes(facts(r, f.property.toLowerCase()), f)));
const tally = (rows: string[][]) => { const m = new Map<string, number>(); for (const v of rows) for (const x of new Set(v)) m.set(x, (m.get(x) || 0) + 1); return [...m].map(([value, count]) => ({ value, label: value, count })); };
const prop = (name: string, hint: string, values: unknown[], type = 'choice') => ({ name, group: 'page', hint, type, values });

const row = (page: Page, label: string) => page.locator('.wbm-row .wbm-label').getByText(label, { exact: true });
const done = (page: Page) => page.locator('.wbm-done').click();
/** Add filter ▸ property ▸ tick values ▸ Done. */
async function pick(page: Page, scope: ReturnType<Page['locator']>, property: string, ...values: string[]) {
  await scope.locator('.wb-chip-add').click();
  await row(page, property).click();
  for (const v of values) await row(page, v).click();
  await done(page);
}
const offered = async (page: Page, scope: ReturnType<Page['locator']>) => {
  await scope.locator('.wb-chip-add').click();
  const names = await page.locator('.wbm-row .wbm-label').allTextContents();
  await page.keyboard.press('Escape');
  return names;
};

/** Serve `answer(name, argv)` for every `wb` call it knows; the others go to the generated fixtures. */
async function serve(page: Page, answer: (name: string, argv: Argv) => unknown | undefined) {
  const calls: Argv[] = [];
  await notebookRoutes(page);
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!.replace(/\.json$/, '');
    const argv: Argv = JSON.parse(decodeURIComponent(route.request().headers()['x-wb-argv'] ?? '[]'));
    // the command line the test types is parsed by wb-core in the app; here it is given its action
    const line = argv[0] === 'parse' ? String(argv[1]) : '';
    const word = line.split(' ');
    const parsed = word[0] === 'search' ? { cmd: 'search', q: word.slice(1).join(' '), scope: 'all' } : word[0] === 'uses' ? { cmd: 'uses', strong: '', word: word[1], scope: 'all' }
      : word[0] === 'near' ? { cmd: 'near', a: word[1], b: word[2], within: 10, scope: 'all' } : word[0] === 'findings' ? { cmd: 'findings' } : null;
    const json = parsed ? { action: parsed } : answer(name, argv);
    if (json === undefined) return route.fallback();
    calls.push(argv);
    return route.fulfill({ json });
  });
  return calls;
}

async function openSearchKind(page: Page, kind: string) {
  await page.goto('/?at=NUM.24');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
  await page.waitForSelector('.pane-notebook');
  await page.locator('.nb-kind').click();
  await page.locator(`.nb-kinds [data-kind="${kind}"]`).click();
}
const run = async (page: Page, line: string) => {
  await page.goto('/?at=NUM.24');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.evaluate(l => { void (window as any).__wb.run(l); }, line);
};

test.beforeEach(async ({}, info) => { test.skip(info.project.name === 'webkit-phone' && !info.title.startsWith('phone:'), 'desktop'); });

const NOW = new Date().toISOString().slice(0, 19);
const OLD = '2025-01-01T10:00:00';

// ---- row 26 ----
const NOTES = [
  { id: 'm1', title: 'Sample 1:1', at: 'NUM.25:11', code: 'NUM', chapter: 25, book: 'Numbers', created: NOW, updated: NOW, text: 'First sample note' },
  { id: 'm2', title: 'Sample 2:1', at: 'NUM.26:1', code: 'NUM', chapter: 26, book: 'Numbers', created: OLD, updated: OLD, text: 'Second sample note' },
  { id: 'm3', title: 'Sample 3:1', at: 'PRO.1:1', code: 'PRO', chapter: 1, book: 'Proverbs', created: OLD, updated: OLD, text: 'Third sample note' },
];
const noteFacts = (r: (typeof NOTES)[number], p: string) => (p === 'book' ? [r.book, `${r.book} ${r.chapter}`] : p === 'written' ? [r.created] : p === 'edited' ? [r.updated] : []);
const noteAnswer = (argv: Argv) => {
  const kept = narrow(NOTES, argv, noteFacts);
  return { q: '', count: kept.length, total: NOTES.length, unfiltered: NOTES.length, filters: [],
    properties: [prop('Book', 'The book (and chapter) the note is in', [{ value: 'Numbers', label: 'Numbers', count: 2, chapters: [{ value: 'Numbers 25', label: '25', count: 1 }, { value: 'Numbers 26', label: '26', count: 1 }] }, { value: 'Proverbs', label: 'Proverbs', count: 1 }]),
      prop('Written', 'When the note was first written', [{ value: 'today', label: 'Today', count: 1 }], 'date'), prop('Edited', 'When the note was last changed', [{ value: 'today', label: 'Today', count: 1 }], 'date'), prop('Folder', 'The folders of the pages the note grew into', [])],
    groups: [{ kind: 'margin', count: kept.length, results: kept.map(r => ({ kind: 'margin', id: r.id, title: r.title, snippet: r.text, updated: r.updated, at: r.at, question: false })) }] };
};

test('margin_notes_chips', async ({ page }) => {
  const calls = await serve(page, (name, argv) => (name.startsWith('find-') && argv.includes('margin') ? noteAnswer(argv) : undefined));
  await openSearchKind(page, 'margin');
  const box = page.locator('.nb-kind-chips');
  await expect(page.locator('.nb-kind-results .nb-item')).toHaveCount(3);
  // only the properties a margin note has
  expect(await offered(page, box)).toEqual(['Book', 'Written', 'Edited', 'Folder']);
  await pick(page, box, 'Book', 'Numbers');
  await expect(box.locator('.wb-chip')).toHaveText(['Book: Numbers▾×']);
  await expect(page.locator('.nb-kind-results .nb-item')).toHaveCount(2);
  await expect(page.locator('.nb-kind-line')).toHaveText('Margin notes · 2 of 3');
  expect(calls.some(c => c[0] === 'find' && c.includes('--kind') && c.includes('margin') && c.includes('--filter') && c.includes('Book is Numbers'))).toBe(true);
  await box.locator('.wb-chip-x').click();
  await expect(page.locator('.nb-kind-results .nb-item')).toHaveCount(3);
});

// ---- row 27 (and the retired T12 filter) ----
const MARKS = [
  { id: 'k1', title: 'Sample 1:1', kind: 'mark', mark_kind: 'underline', color: 'blue', lines: 2, legend: 'Warning', style: 'underline:blue:2', at: 'NUM.25:11', book: 'Numbers', code: 'NUM', chapter: 25, verse: 11, snippet: 'sample words', updated: NOW },
  { id: 'k2', title: 'Sample 2:1', kind: 'mark', mark_kind: 'highlight', color: 'yellow', legend: 'Promise', style: 'highlight:yellow', at: 'NUM.25:12', book: 'Numbers', code: 'NUM', chapter: 25, verse: 12, snippet: 'more words', updated: OLD },
  { id: 'k3', title: 'Sample 3:1', kind: 'mark', mark_kind: 'highlight', color: 'yellow', legend: 'Promise', style: 'highlight:yellow', at: 'PRO.1.1', book: 'Proverbs', code: 'PRO', chapter: 1, verse: 1, snippet: 'last words', updated: OLD },
];
const markFacts = (r: (typeof MARKS)[number], p: string) => (p === 'book' ? [r.book, `${r.book} ${r.chapter}`] : p === 'kind' ? [r.mark_kind[0].toUpperCase() + r.mark_kind.slice(1)] : p === 'legend entry' ? [r.legend] : p === 'written' ? [r.updated] : []);
const markAnswer = (argv: Argv) => {
  const kept = narrow(MARKS, argv, markFacts);
  return { q: '', count: kept.length, total: MARKS.length, unfiltered: MARKS.length, filters: [],
    properties: [prop('Kind', 'Highlight, underline, circle, box or arrow', tally(MARKS.map(r => markFacts(r, 'kind')))), prop('Legend entry', 'The Legend entry whose style the mark has', tally(MARKS.map(r => markFacts(r, 'legend entry')))),
      prop('Book', 'The book (and chapter) the mark is in', tally(MARKS.map(r => [r.book]))), prop('Written', 'The day the mark was made', [{ value: 'today', label: 'Today', count: 1 }], 'date')],
    groups: [{ kind: 'mark', count: kept.length, results: kept.map(r => ({ ...r, title: r.title, updated: r.updated })) }] };
};

test('highlights_chips', async ({ page }) => {
  const calls = await serve(page, (name, argv) => (name.startsWith('find-') && argv.includes('mark') ? markAnswer(argv) : undefined));
  await openSearchKind(page, 'mark');
  const box = page.locator('.nb-kind-chips');
  await expect(page.locator('.nb-marks .nb-mrow')).toHaveCount(3);
  // the T12 controls are gone; a Kind chip and a Legend entry chip take their place
  await expect(page.locator('.nb-mfilters')).toHaveCount(0);
  expect(await offered(page, box)).toEqual(['Kind', 'Legend entry', 'Book', 'Written']);
  await pick(page, box, 'Legend entry', 'Promise');
  await expect(page.locator('.nb-marks .nb-mrow')).toHaveCount(2);
  await pick(page, box, 'Kind', 'Highlight');
  await expect(box.locator('.wb-chip')).toHaveText(['Legend entry: Promise▾×', 'Kind: Highlight▾×']);
  await pick(page, box, 'Book', 'Proverbs');
  await expect(page.locator('.nb-marks .nb-mrow')).toHaveCount(1);
  await expect(page.locator('.nb-kind-line')).toHaveText('Marks · 1 of 3');
  expect(calls.at(-1)).toEqual(['find', '--kind', 'mark', '--filter', 'Legend entry is Promise', '--filter', 'Kind is Highlight', '--filter', 'Book is Proverbs']);
  await box.locator('.wb-chip-clear').click();
  await expect(page.locator('.nb-marks .nb-mrow')).toHaveCount(3);
});

// ---- row 28 ----
const FINDINGS = [
  { id: 'f1', status: 'open', created: NOW, updated: NOW, title: 'First finding', text: 'First finding', tags: ['library'], context: {}, files: [] },
  { id: 'f2', status: 'handled', created: OLD, updated: OLD, title: 'Second finding', text: 'Second finding', tags: ['marks'], context: {}, files: [] },
  { id: 'f3', status: 'open', created: OLD, updated: OLD, title: 'Third finding', text: 'Third finding', tags: [], context: {}, files: [] },
];
test('findings_chips', async ({ page }) => {
  const facts = (r: (typeof FINDINGS)[number], p: string) => (p === 'status' ? [r.status === 'handled' ? 'Handled' : 'Open'] : p === 'kind' ? r.tags : p === 'written' ? [r.created] : []);
  const calls = await serve(page, (name, argv) => {
    if (name !== 'findings' && !name.startsWith('findings-')) return undefined;
    const withStatus = filtersOf(argv).some(f => f.property === 'Status') || argv.includes('--all');
    const pool = FINDINGS.filter(r => withStatus || r.status !== 'handled');
    return { findings: narrow(pool, argv, facts), counts: { open: 2, handled: 1 }, filters: [], unfiltered: pool.length,
      properties: [prop('Status', 'Open, or handled', tally(FINDINGS.map(r => facts(r, 'status')))), prop('Kind', 'The design folders a finding is tagged with', tally(FINDINGS.map(r => r.tags))), prop('Written', 'When the finding was written', [{ value: 'today', label: 'Today', count: 1 }], 'date')] };
  });
  await run(page, 'findings');
  const pane = page.locator('.pane-findings:visible').last();
  await expect(pane.locator('.finding')).toHaveCount(2);
  expect(await offered(page, pane)).toEqual(['Status', 'Kind', 'Written']);
  await pick(page, pane, 'Status', 'Handled');
  await expect(pane.locator('.wb-chip')).toHaveText(['Status: Handled▾×']);
  await expect(pane.locator('.finding')).toHaveCount(1);
  await expect(pane.locator('.finding-tag-filter')).toHaveCount(0);
  expect(calls.at(-1)).toEqual(['findings', '--filter', 'Status is Handled']);
  await pane.locator('.wb-chip-clear').click();
  await expect(pane.locator('.finding')).toHaveCount(2);
});

// ---- rows 31 to 33: the lookups ----
const VERSES = [
  { code: 'NUM', c: 25, v: 11, book: 'Numbers', testament: 'Old Testament' },
  { code: 'NUM', c: 25, v: 12, book: 'Numbers', testament: 'Old Testament' },
  { code: 'PRO', c: 1, v: 1, book: 'Proverbs', testament: 'Old Testament' },
  { code: 'JHN', c: 2, v: 17, book: 'John', testament: 'New Testament' },
];
const verseRow = (r: (typeof VERSES)[number]) => ({ ref: { code: r.code, c: r.c, v: r.v, name: r.book }, text: 'sample words', spans: [[0, 6]], words: [{ i: 0, lead: '', t: 'sample', trail: ' ', m: 'e' }, { i: 1, lead: '', t: 'words', trail: '', m: '' }], runs: [{ anchor: `${r.code}.${r.c}:${r.v}.0` }] });
const vFacts = (r: (typeof VERSES)[number], p: string) => (p === 'book' ? [r.book] : p === 'testament' ? [r.testament] : p === 'version' ? ['KJV'] : p === "strong's number" ? [r.code === 'JHN' ? 'G2205' : 'H7068'] : []);
const bookProps = (extra: unknown[] = [], version = false) => [
  prop('Book', 'The book a verse is in', tally(VERSES.map(r => [r.book]))), prop('Testament', 'Old Testament or New Testament', tally(VERSES.map(r => [r.testament]))),
  ...(version ? [prop('Version', 'The Bible version searched (the KJV)', [{ value: 'KJV', label: 'KJV', count: 4 }])] : []), ...extra];
const verseAnswer = (argv: Argv, version: boolean, extra: unknown[] = []) => {
  const kept = narrow(VERSES, argv, vFacts);
  return { q: 'sample', verses: kept.length, matches: kept.length, occurrences: kept.length, totals: { both: kept.length }, offset: 0, rows: kept.map(verseRow), more: false, by_book: {}, filters: [], unfiltered: 4, properties: bookProps(extra, version) };
};

test('bible_search_chips', async ({ page }) => {
  const calls = await serve(page, (name, argv) => (name.startsWith('search-') ? verseAnswer(argv, true) : name.startsWith('near-') ? verseAnswer(argv, true) : undefined));
  await run(page, 'search sample');
  const pane = page.locator('.pane:visible, .pane-search:visible').last();
  const box = page.locator('.list-chips').last();
  await expect(page.locator('.row')).toHaveCount(4);
  expect(await offered(page, box)).toEqual(['Book', 'Testament', 'Version']);
  await pick(page, box, 'Testament', 'New Testament');
  await expect(page.locator('.row')).toHaveCount(1);
  expect(calls.at(-1)).toContain('Testament is New Testament');
  await box.locator('.wb-chip-clear').click();
  await expect(page.locator('.row')).toHaveCount(4);
  // Near takes the same chips
  await run(page, 'near sample words');
  const near = page.locator('.list-chips').last();
  expect(await offered(page, near)).toEqual(['Book', 'Testament', 'Version']);
  await pick(page, near, 'Book', 'Proverbs');
  expect(calls.at(-1)).toEqual(expect.arrayContaining(['near', '--filter', 'Book is Proverbs']));
  void pane;
});

test('every_use_chips', async ({ page }) => {
  const strongs = prop("Strong's number", 'The original word behind the English, by its number', [{ value: 'H7068', label: 'H7068', count: 3 }, { value: 'G2205', label: 'G2205', count: 1 }]);
  const calls = await serve(page, (name, argv) => (name.startsWith('uses-') ? verseAnswer(argv, false, [strongs]) : undefined));
  await run(page, 'uses sample');
  const box = page.locator('.list-chips').last();
  await expect(page.locator('.row')).toHaveCount(4);
  expect(await offered(page, box)).toEqual(['Book', 'Testament', "Strong's number"]);
  await pick(page, box, "Strong's number", 'G2205');
  await expect(page.locator('.row')).toHaveCount(1);
  expect(calls.at(-1)).toContain("Strong's number is G2205");
  await pick(page, box, 'Book', 'John');
  await expect(box.locator('.wb-chip')).toHaveCount(2);
});

test('concordance_chips', async ({ page }) => {
  const line = (r: (typeof VERSES)[number]) => ({ ref: `${r.book} ${r.c}:${r.v}`, code: r.code, c: r.c, v: r.v, before: 'a', word: 'sample', after: 'b', number: 'H7068' });
  const calls = await serve(page, (name, argv) => {
    if (!name.startsWith('concordance-') || name.startsWith('concordance-box') || name === 'concordance-letters') return undefined;
    const kept = narrow(VERSES, argv, vFacts);
    return { word: 'sample', mode: 'one', forms: [], words: ['sample'], places: kept.length, verses: kept.length, kind: 'run', small: false, lines: kept.map(line), book_counts: {}, filters: [], unfiltered: 4, properties: bookProps() };
  });
  await page.goto('/?at=NUM.24');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.evaluate(() => (window as any).__wb.concordance({ word: 'sample' }));
  const pane = page.locator('.pane-concordance:visible').last();
  await expect(pane.locator('.conc-line')).toHaveCount(4);
  expect(await offered(page, pane)).toEqual(['Book', 'Testament']);
  await pick(page, pane, 'Testament', 'Old Testament');
  await expect(pane.locator('.conc-line')).toHaveCount(3);
  expect(calls.at(-1)).toContain('Testament is Old Testament');
});

// ---- rows 29 and 30 ----
test('legend_where_used_chips', async ({ page }) => {
  // the Legend's uses list is also checked in marks-legend.spec.ts (row 40); here the menu is only what a mark has
  const uses = MARKS.filter(m => m.legend === 'Promise');
  const legend = { entries: [{ label: 'Promise', style: 'highlight:yellow', kind: 'highlight', color: 'yellow', meaning: '', quick: false, key: '', count: 2, listed: true }], unlisted: [] };
  const calls = await serve(page, (name, argv) => {
    if (name === 'legend') return legend;
    if (!name.startsWith('legend-uses-')) return undefined;
    const kept = narrow(uses, argv, markFacts);
    return { entry: { label: 'Promise', style: 'highlight:yellow', kind: 'highlight', color: 'yellow', listed: true, count: 2 }, count: kept.length, unfiltered: uses.length, filters: [],
      marks: kept.map(m => ({ id: m.id, kind: 'highlight', color: 'yellow', at: m.at, book: m.book, code: m.code, chapter: m.chapter, verse: m.verse, label: m.title, words: m.snippet, created: m.updated, old: false })),
      properties: [prop('Book', 'The book (and chapter) the mark is in', tally(uses.map(r => [r.book]))), prop('Kind', 'Highlight, underline, circle, box or arrow', [{ value: 'Highlight', label: 'Highlight', count: 2 }])] };
  });
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.locator('#rail').getByRole('button', { name: 'Legend', exact: true }).click();
  await page.locator('.lg-entry', { hasText: 'Promise' }).locator('.lg-count').click();
  const pane = page.locator('.pane-legend:visible').last();
  await expect(pane.locator('.lg-use')).toHaveCount(2);
  expect(await offered(page, pane)).toEqual(['Book', 'Kind']);
  await pick(page, pane, 'Book', 'Proverbs');
  await expect(pane.locator('.lg-use')).toHaveCount(1);
  expect(calls.at(-1)).toEqual(['legend', 'uses', 'highlight:yellow', '--filter', 'Book is Proverbs']);
});

test('colors_chips', async ({ page }) => {
  const books = (only: string[] | null, style: string | null) => ['Numbers', 'Proverbs'].filter(n => !only || only.includes(n)).map(name => ({ code: name.slice(0, 3).toUpperCase(), name, chapters: 2, cells: [1, 2].map(chapter => (style ? { chapter, count: chapter === 1 && name === 'Numbers' ? 1 : 0 } : { chapter, styles: [], folders: [] })) }));
  const styles = [{ style: 'highlight:yellow', kind: 'highlight', color: 'yellow', label: 'Promise', listed: true }, { style: 'underline:blue:2', kind: 'underline', color: 'blue', lines: 2, label: 'Warning', listed: true }];
  const calls = await serve(page, (name, argv) => {
    if (!name.startsWith('marks-map')) return undefined;
    const f = filtersOf(argv);
    const entry = f.find(x => x.property === 'Legend entry');
    const book = f.find(x => x.property === 'Book');
    return { books: books(book ? book.values : null, entry ? 'x' : null), styles, folders: [], filter: entry ? { label: entry.values.join(', '), kind: 'highlight', color: 'yellow', style: 'highlight:yellow' } : null, total: 1, chapters_with: 1, filters: [], unfiltered: 2,
      properties: [prop('Legend entry', 'The Legend entry whose style the marks have', [{ value: 'Promise', label: 'Promise', count: 2 }, { value: 'Warning', label: 'Warning', count: 1 }]), prop('Book', 'The book a chapter is in', [{ value: 'Numbers', label: 'Numbers', count: 2 }, { value: 'Proverbs', label: 'Proverbs', count: 1 }])] };
  });
  await openSearchKind(page, 'mark').catch(() => {});
  await page.evaluate(() => void 0);
  await page.locator('.nb-colors').click();
  const pane = page.locator('.colormap');
  await expect(pane.locator('.cm-row')).toHaveCount(2);
  expect(await offered(page, pane)).toEqual(['Legend entry', 'Book']);
  await pick(page, pane, 'Book', 'Numbers');
  await expect(pane.locator('.cm-row')).toHaveCount(1);
  await pick(page, pane, 'Legend entry', 'Promise');
  await expect(pane.locator('.wb-chip')).toHaveText(['Book: Numbers▾×', 'Legend entry: Promise▾×']);
  expect(calls.at(-1)).toEqual(['marks', 'map', '--filter', 'Book is Numbers', '--filter', 'Legend entry is Promise']);
});
