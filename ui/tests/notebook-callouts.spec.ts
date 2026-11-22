import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// design/features/notebook rows 22, 23, 24, 46 (NB10): callouts, their kinds, the kind menu on the icon, the questions already written
// read as callouts, several lines and a nested list in one callout, and the Questions list saying what follows a first line. No Rust here:
// a small page server stands in for `wb` (the page's blocks as text, a callout's kind as `wb callout kind` writes it), and what the window
// sent is read back from the calls. The words are the test's own, not scripture.
const TITLE = 'Callouts page';
const KINDS = ['question', 'done', 'key', 'note'];
const LABEL: Record<string, string> = { question: 'Question', done: 'Answered', key: 'Key point', note: 'Note' };

interface Call { name: string; input: string }

async function openPage(page: Page, start: string[], questions: unknown[] = [], blocksFail = false) {
  let texts = [...start];
  const calls: Call[] = [];
  const kindOf = (t: string) => (/^#{1,3} /.test(t) ? 'heading' : /^- /.test(t) ? 'item' : /^> /.test(t) ? 'quote' : 'paragraph');
  const calloutOf = (t: string) => {
    const lines = t.split('\n').map(l => l.replace(/^> ?/, ''));
    const m = /^\[!(question|done|key|note)\][+-]?\s?(.*)$/i.exec(lines[0]);
    if (!m || !t.startsWith('> ')) return undefined;
    const shown = [m[2], ...lines.slice(1)].filter(l => l.trim());
    return { kind: m[1].toLowerCase(), label: LABEL[m[1].toLowerCase()], first: shown[0] ?? '', more: Math.max(0, shown.length - 1), list: shown.some(l => /^\s*([-*+]|\d+[.)]) /.test(l)) };
  };
  const blocks = () => {
    let pos = TITLE.length + 2;
    return { id: 'w1', folds: [], title: { text: TITLE, start: 0, end: TITLE.length },
      blocks: texts.map((text, i) => { const start = pos; pos += text.length + 2; const k = kindOf(text); const callout = calloutOf(text); return { n: i + 1, kind: k, text, start, end: start + text.length, ...(callout ? { callout } : {}), ...(k === 'item' ? { indent: 0 } : {}) }; }) };
  };
  const full = () => [TITLE, ...texts].join('\n\n');
  const entry = (id: string, title: string) => ({ id, title, kind: 'note', placed: false, label: '', preview: '', updated: '2026-11-20', created: '2026-11-20' });
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!.replace(/\.json$/, '');
    const input = decodeURIComponent(route.request().headers()['x-wb-input'] ?? '');
    const send = (json: unknown) => route.fulfill({ json });
    let m: RegExpExecArray | null;
    if (name === 'note-show-w1') return send({ id: 'w1', title: TITLE, kind: 'note', placed: false, text: full(), updated: '2026-11-20T14:02:00', linked_from: [], also: [], threads: [], refs: [] });
    if (name === 'page-blocks-w1') return blocksFail ? route.fulfill({ status: 404, body: 'no blocks' }) : send(blocks());
    if (name === 'page-scripture-w1') return send({ blocks: [] });
    if (name.startsWith('refs-plain-')) return send([]);
    if ((m = /^callout-kind-w1-(\d+)-(\w+)$/.exec(name))) {
      calls.push({ name, input });
      const n = Number(m[1]) - 1;
      texts[n] = texts[n].replace(/^> \[!\w+\]/, `> [!${m[2]}]`);
      return send({ id: `w1#${m[1]}`, kind: m[2], label: LABEL[m[2]] });
    }
    if ((m = /^block-set-w1-(\d+)/.exec(name))) {
      calls.push({ name, input });
      texts.splice(Number(m[1]) - 1, 1, input);
      return send({ ...blocks(), n: Number(m[1]), count: 1 });
    }
    if ((m = /^block-add-w1(?:-after-(\d+))?/.exec(name))) {
      calls.push({ name, input });
      const after = Number(m[1] ?? texts.length);
      texts.splice(after, 0, input);
      return send({ ...blocks(), n: after + 1, count: 1 });
    }
    if ((m = /^block-rm-w1-(\d+)-/.exec(name))) {
      calls.push({ name, input });
      texts.splice(Number(m[1]) - 1, 1);
      return send({ ...blocks(), undo: { test: true } });
    }
    if (name.startsWith('notebook-sidebar-')) {
      const base = JSON.parse(readFileSync('ui/public/fixtures/wb/notebook-sidebar-at-num-25.json', 'utf8'));
      return send({ ...base, questions, pages: [{ id: 'w1', title: TITLE, kind: 'note', placed: false, anchor: '', label: '', color: null, status: null, pinned: null, order: null, parent: null, created: '2026-11-20', updated: '2026-11-20', children: [] }] });
    }
    if (name === 'notebook-group-none') return send({ groups: [{ key: 'all', label: 'All', count: 1, entries: [entry('w1', TITLE)] }] });
    if (name === 'settings-notebook') return send({});
    if (name === 'page-sweep') return send({ operations: [], errors: [] });
    if (name === 'docs-looks') return send({ looks: [] });
    if (name === 'craft-designs') return send({ themes: {}, theme: '' });
    if (name.startsWith('docs-list-')) return send([]);
    if (name === 'template-list') return send({ templates: [] });
    if (name.startsWith('page-overview-')) return send({});
    return route.fallback();
  });
  // the Notebook's dock column is dragged wide, so its side list (with the Questions) is drawn
  await page.addInitScript(() => localStorage.setItem('wb.dock.v1', JSON.stringify({ wide: { left: true, right: true } })));
  await page.goto('/?at=NUM.26');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
  await page.waitForSelector('.pane-notebook');
  await page.evaluate(() => (window as any).__wb.note('w1'));
  await page.waitForSelector(blocksFail ? '.nb-body .nb-page' : '.nb-block[data-n="1"]');
  return { texts: () => [...texts], calls };
}

const block = (page: Page, n: number) => page.locator(`.nb-block[data-n="${n}"]`);
const grip = (page: Page, n: number) => block(page, n).locator('> .nb-grip');
const plus = (page: Page, n: number) => block(page, n).locator('> .nb-plus');
// the side list with the Questions is the wide Notebook's; the narrow one has a row of sections instead
const wide = (page: Page) => page.viewportSize()!.width >= 700;
const openQuestions = async (page: Page) => {
  const head = page.locator('.nb-side-head[data-part="questions"] .nb-ghead');
  if ((await head.getAttribute('aria-expanded')) !== 'true') await head.click();
};
const question = (id: string, first: string, over: Record<string, unknown> = {}) => ({
  id, kind: 'question', block: 1, page: 'w1', page_title: TITLE, page_kind: 'note', status: 'open', placed: false, anchor: '', label: '', quote: '', text: first, title: first, first,
  more_lines: 0, has_list: false, preview: '', created: '2026-11-20', updated: '2026-11-20', time: '', day: '', also: [], threads: [], refs: [], whole: '', ...over,
});

test('callout_kinds_write_their_marker', async ({ page }) => {
  const s = await openPage(page, ['Read the chapter twice before writing anything about it.', 'Second block']);
  // 22: /callout in the / menu makes a Question callout in the line; the words typed after it are its first line
  await plus(page, 1).click({ force: true });
  await expect(page.locator('.wbm')).toBeVisible();
  await page.locator('.wbm-input').fill('callout');
  const row = page.locator('.wbm-row', { hasText: 'Callout' });
  await expect(row.locator('.wbm-hint')).toHaveText('/callout');
  await row.click();
  const ed = page.locator('.nb-block-input');
  await expect(ed).toHaveAttribute('data-shape', 'callout');
  await expect(ed).toHaveAttribute('data-kind', 'question');
  await page.keyboard.type('Why an everlasting priesthood?');
  await expect.poll(() => s.texts()[1], { timeout: 4000 }).toBe('> [!question] Why an everlasting priesthood?');
  // leaving it draws the soft box with its icon and kind
  await page.locator('.nb-block-input').blur();
  await expect(block(page, 2).locator('.nb-callout')).toHaveAttribute('data-kind', 'question');
  await expect(block(page, 2).locator('.nb-callout-label')).toHaveText('Question');
  await expect(block(page, 2).locator('.nb-callout-icon')).toHaveText('?');
  // Turn into ▸ Callout keeps the words and writes the marker
  await grip(page, 1).click({ force: true });
  await page.locator('.wbm-row', { hasText: 'Turn into' }).click();
  await page.locator('.wbm-row .wbm-label', { hasText: /^Callout$/ }).click();
  await expect.poll(() => s.texts()[0]).toBe('> [!question] Read the chapter twice before writing anything about it.');
  await expect(block(page, 1).locator('.nb-callout')).toHaveCount(1);
});

test('page_view_hides_the_block_id', async ({ page }) => {
  // the page drawn as a whole (not by blocks) hides a block's link id, ` ^abc123`, at the end of a block, as the block editor does (A2, 2026-11-21)
  await openPage(page, ['Read the chapter twice ^abc123', '- an item\n- another item ^def456', 'The last block, with a caret^in it'], [], true);
  const view = page.locator('.nb-body .nb-page');
  await expect(view).toContainText('Read the chapter twice');
  await expect(view).not.toContainText('abc123');
  await expect(view).not.toContainText('def456');
  await expect(view).toContainText('another item');
  await expect(view).toContainText('caret^in it');
});

test('callout_kinds_all_four_are_drawn', async ({ page }) => {
  await openPage(page, KINDS.map(k => `> [!${k}] A ${k} callout`));
  await expect(page.locator('.nb-callout')).toHaveCount(4);
  await expect(page.locator('.nb-callout-label')).toHaveText(['Question', 'Answered', 'Key point', 'Note']);
  await expect(page.locator('.nb-callout-icon')).toHaveText(['?', '✓', '☆', '✎']);
  await expect(page.locator('.nb-callout').nth(2)).toHaveAttribute('data-kind', 'key');
});

test('callout_kind_changes', async ({ page }) => {
  const s = await openPage(page, ['> [!question] Why “an everlasting priesthood” here?']);
  const icon = block(page, 1).locator('.nb-callout-icon');
  // 23: the icon opens the kind menu, a tick on the kind it has; Answered writes the marker and the box is drawn Answered
  await icon.click();
  const menu = page.locator('.wbm[aria-label="Callout kind"]');
  await expect(menu.locator('.wbm-group')).toHaveText(['Kind']);
  await expect(menu.locator('.wbm-row .wbm-label')).toHaveText(['Question', 'Answered', 'Key point', 'Note']);
  await expect(menu.locator('.wbm-row', { hasText: 'Question' }).locator('.wbm-hint')).toHaveText('✓');
  await menu.locator('.wbm-row', { hasText: 'Answered' }).click();
  await expect.poll(() => s.texts()[0]).toBe('> [!done] Why “an everlasting priesthood” here?');
  expect(s.calls.at(-1)!.name).toBe('callout-kind-w1-1-done');
  await expect(block(page, 1).locator('.nb-callout')).toHaveAttribute('data-kind', 'done');
  await expect(block(page, 1).locator('.nb-callout-label')).toHaveText('Answered');
  // and back
  await block(page, 1).locator('.nb-callout-icon').click();
  await expect(page.locator('.wbm[aria-label="Callout kind"] .wbm-row', { hasText: 'Answered' }).locator('.wbm-hint')).toHaveText('✓');
  await page.locator('.wbm[aria-label="Callout kind"] .wbm-row', { hasText: 'Question' }).click();
  await expect.poll(() => s.texts()[0]).toBe('> [!question] Why “an everlasting priesthood” here?');
  await expect(block(page, 1).locator('.nb-callout')).toHaveAttribute('data-kind', 'question');
  // the kinds that are not questions are one pick away too
  await block(page, 1).locator('.nb-callout-icon').click();
  await page.locator('.wbm[aria-label="Callout kind"] .wbm-row', { hasText: 'Key point' }).click();
  await expect.poll(() => s.texts()[0]).toBe('> [!key] Why “an everlasting priesthood” here?');
});

test('old_question_callouts_still_read', async ({ page }) => {
  const s = await openPage(page, ['> [!question] Who acts first, and who waits?', '> [!done] What is promised afterwards?'], [
    question('w1#1', 'Who acts first, and who waits?'),
    question('w1#2', 'What is promised afterwards?', { block: 2, status: 'done' }),
  ]);
  // 24: today's pages with > [!question] and > [!done] show as Question and Answered callouts, and the questions list still holds them
  await expect(page.locator('.nb-callout-label')).toHaveText(['Question', 'Answered']);
  await expect(block(page, 1).locator('.nb-callout')).toHaveAttribute('data-kind', 'question');
  await expect(block(page, 2).locator('.nb-callout')).toHaveAttribute('data-kind', 'done');
  if (wide(page)) {
    await openQuestions(page);
    await expect(page.locator('.nb-question-row .nb-tree-title')).toHaveText(['Who acts first, and who waits?', 'What is promised afterwards?']);
  }
  // nothing was written by reading them
  expect(s.calls).toEqual([]);
  expect(s.texts()).toEqual(['> [!question] Who acts first, and who waits?', '> [!done] What is promised afterwards?']);
});

test('callout_kinds_found', async ({ page }) => {
  const FILE = '> [!question] Why “an everlasting priesthood” here?\n> Read it beside the next verses before answering.\n> - Who receives the covenant?\n>   - the first one\n>   - the second one\n> - What is it called?';
  const s = await openPage(page, [FILE], [question('w1#1', 'Why “an everlasting priesthood” here?', { more_lines: 5, has_list: true })]);
  // 46a: it holds several lines and a nested list
  const body = block(page, 1).locator('.nb-callout-body');
  await expect(body.locator('> p')).toHaveText(['Why “an everlasting priesthood” here?', 'Read it beside the next verses before answering.']);
  await expect(body.locator('> ul > li')).toHaveCount(2);
  await expect(body.locator('> ul > li').first()).toContainText('Who receives the covenant?');
  await expect(body.locator('> ul > li').first().locator('> ul > li')).toHaveText(['the first one', 'the second one']);
  // 46b: the Questions list gives the first line and says what follows it
  if (wide(page)) {
    await openQuestions(page);
    await expect(page.locator('.nb-question-row .nb-tree-title')).toHaveText('Why “an everlasting priesthood” here?');
    await expect(page.locator('.nb-question-row .nb-side-note')).toHaveText('5 more lines, a list');
  }
  // writing in it: Enter is a new line, a list line goes on as a list, Tab nests it, an empty last line ends the callout
  await block(page, 1).locator('.nb-callout-body p').first().click();
  const ed = page.locator('.nb-block-input');
  await expect(ed).toHaveAttribute('data-shape', 'callout');
  expect(await ed.evaluate(e => (e as any).value as string)).toBe(FILE);
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await expect.poll(() => ed.evaluate(e => (e as any).value as string)).toBe(FILE + '\n> - ');
  await page.keyboard.press('Tab');
  await page.keyboard.type('a sub item');
  await expect.poll(() => s.texts()[0], { timeout: 4000 }).toBe(FILE + '\n>   - a sub item');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => ed.evaluate(e => (e as any).value as string)).toBe(FILE + '\n>   - a sub item\n> ');
});
