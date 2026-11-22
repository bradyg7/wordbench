import { expect, test, type Page } from '@playwright/test';

// design/features/notebook rows 13, 41, 14, 16, 17, 42, 20 (NB6): the block handle (+ and the grip), the block menu, Turn into, Duplicate,
// Delete with Undo, and the Undo of a Backspace that joins two blocks. There is no Rust in these tests: a small page server stands in for
// `wb` (the page's blocks as text, changed by block set / add / rm / dup / undo), and what the window writes is read from the x-wb-input
// header the fixture call carries. The words are the test's own, not scripture.
const TITLE = 'Handle page';
const FIRST = 'Read the chapter twice before writing anything about it.';
const ITEM = '- Who acts first, and who waits?';
const START = [FIRST, ITEM, '**Bold** and plain words', 'Last line'];

interface Call { name: string; input: string }

async function openPage(page: Page, start = START) {
  let texts = [...start];
  const stack: string[][] = [];
  const calls: Call[] = [];
  const kindOf = (t: string) => (/^#{1,3} /.test(t) ? 'heading' : /^- \[[ xX]\] /.test(t) ? 'todo' : /^- /.test(t) ? 'item' : /^\d+\. /.test(t) ? 'numbered' : /^> /.test(t) ? 'quote' : 'paragraph');
  const blocks = () => {
    let pos = TITLE.length + 2;
    return { id: 'w1', folds: [], title: { text: TITLE, start: 0, end: TITLE.length },
      blocks: texts.map((text, i) => { const start = pos; pos += text.length + 2; const k = kindOf(text); return { n: i + 1, kind: k, text, start, end: start + text.length, ...(k === 'item' ? { indent: 0 } : {}) }; }) };
  };
  const full = () => [TITLE, ...texts].join('\n\n');
  const entry = (id: string, title: string) => ({ id, title, kind: 'note', placed: false, label: '', preview: '', updated: '2026-11-20', created: '2026-11-20' });
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!.replace(/\.json$/, '');
    const input = decodeURIComponent(route.request().headers()['x-wb-input'] ?? '');
    const send = (json: unknown) => route.fulfill({ json });
    if (name === 'note-show-w1') return send({ id: 'w1', title: TITLE, kind: 'note', placed: false, text: full(), updated: '2026-11-20T14:02:00', linked_from: [], also: [], threads: [], refs: [] });
    if (name === 'page-blocks-w1') return send(blocks());
    if (name.startsWith('refs-plain-')) return send([]);
    let m: RegExpExecArray | null;
    if ((m = /^block-set-w1-(\d+)(?:-count-(\d+))?/.exec(name))) {
      calls.push({ name, input });
      stack.push([...texts]);
      const n = Number(m[1]), count = Number(m[2] ?? 1);
      texts.splice(n - 1, count, ...input.split(/\n\n+/));
      return send({ ...blocks(), n, count: 1, undo: name.includes('-undo') ? { test: true } : undefined });
    }
    if ((m = /^block-add-w1(?:-after-(\d+))?/.exec(name))) {
      calls.push({ name, input });
      stack.push([...texts]);
      const after = Number(m[1] ?? texts.length);
      texts.splice(after, 0, input);
      return send({ ...blocks(), n: after + 1, count: 1 });
    }
    if ((m = /^block-rm-w1-(\d+)-/.exec(name))) {
      calls.push({ name, input });
      stack.push([...texts]);
      texts.splice(Number(m[1]) - 1, 1);
      return send({ ...blocks(), undo: { test: true } });
    }
    if ((m = /^block-dup-w1-(\d+)-/.exec(name))) {
      calls.push({ name, input });
      stack.push([...texts]);
      const n = Number(m[1]);
      texts.splice(n, 0, texts[n - 1]);
      return send({ ...blocks(), n: n + 1, count: 1, undo: { test: true } });
    }
    if (name === 'block-undo-w1') { calls.push({ name, input }); texts = stack.pop() ?? texts; return send(blocks()); }
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
  await page.goto('/?at=NUM.26');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
  await page.waitForSelector('.pane-notebook');
  await page.evaluate(() => (window as any).__wb.note('w1'));
  await page.waitForSelector('.nb-block[data-n="1"]');
  return { texts: () => [...texts], calls };
}

const block = (page: Page, n: number) => page.locator(`.nb-block[data-n="${n}"]`);
const grip = (page: Page, n: number) => block(page, n).locator('> .nb-grip');
const plus = (page: Page, n: number) => block(page, n).locator('> .nb-plus');
const opacity = (l: ReturnType<Page['locator']>) => l.evaluate(e => Number(getComputedStyle(e).opacity));
const wordsOf = (texts: string[]) => [TITLE, ...texts].join(' ').replace(/<[^>]*>/g, ' ').split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;

test('handle_appears_without_shift', async ({ page, hasTouch }) => {
  await openPage(page);
  const body = block(page, 1).locator('.nb-block-body');
  const before = (await body.boundingBox())!;
  if (!hasTouch) {
    // not hovered: the handle is drawn invisible; hovered (or focused): + and the grip show in the gutter, left of the text
    await page.mouse.move(0, 0);
    expect(await opacity(plus(page, 1))).toBe(0);
    expect(await opacity(grip(page, 1))).toBe(0);
    await block(page, 1).hover();
    await expect.poll(() => opacity(plus(page, 1))).toBe(1);
    expect(await opacity(grip(page, 1))).toBe(1);
  } else {
    // there is no hover on a touch screen: the handle is faintly there
    expect(await opacity(grip(page, 1))).toBeGreaterThan(0);
  }
  const pb = (await plus(page, 1).boundingBox())!, gb = (await grip(page, 1).boundingBox())!, after = (await body.boundingBox())!;
  expect(pb.x + pb.width).toBeLessThanOrEqual(gb.x);
  expect(gb.x + gb.width).toBeLessThanOrEqual(after.x);
  expect(after.x).toBe(before.x);
  expect(after.y).toBe(before.y);
  expect(after.width).toBe(before.width);
  // focus shows it too
  await page.mouse.move(0, 0);
  await grip(page, 2).focus();
  expect(await opacity(grip(page, 2))).toBe(1);
  expect(await opacity(plus(page, 2))).toBe(1);
});

test('handle_controls_explained', async ({ page }) => {
  await openPage(page);
  await expect(plus(page, 1)).toHaveAttribute('title', /Add a line below.*\/ menu/);
  await expect(grip(page, 1)).toHaveAttribute('title', /Drag to move.*click for its menu/);
  await expect(grip(page, 1)).toHaveAttribute('draggable', 'true');
  await expect(plus(page, 1)).toHaveAttribute('aria-label', 'Add a block below block 1');
  await expect(grip(page, 1)).toHaveAttribute('aria-label', 'Actions for block 1');
});

test('plus_adds_below_with_menu', async ({ page }) => {
  const s = await openPage(page);
  await plus(page, 1).click({ force: true });
  // an empty line right below block 1, the / menu open on it; nothing is written yet
  await expect(page.locator('.nb-block-input')).toHaveCount(1);
  await expect(page.locator('.wbm')).toBeVisible();
  await expect(page.locator('.wbm-input')).toBeFocused();
  await expect(page.locator('.wbm')).toHaveAttribute('aria-label', 'Add a block');
  await expect(page.locator('.nb-blocks > .nb-block').nth(1)).toHaveClass(/nb-new-block/);
  expect(s.calls).toEqual([]);
  // a pick writes its form in the line (Heading 1), the text typed after it is the heading
  await page.locator('.wbm-row', { hasText: 'Heading 1' }).click();
  await page.keyboard.type('New heading');
  await expect.poll(() => s.texts().length, { timeout: 4000 }).toBe(START.length + 1);
  expect(s.texts()[1]).toBe('# New heading');
  expect(s.texts()[0]).toBe(FIRST);
  // leaving the menu with Esc and the line empty writes nothing and leaves nothing behind
  await page.keyboard.press('Escape');
  await expect(page.locator('.nb-block-input')).toHaveCount(0);
  const before = s.calls.length;
  await plus(page, 3).click({ force: true });
  await expect(page.locator('.wbm')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.wbm')).toHaveCount(0);
  await page.locator('.nb-block-input').blur();
  await expect(page.locator('.nb-block-input')).toHaveCount(0);
  expect(s.calls.length).toBe(before);
  expect(s.texts().length).toBe(START.length + 1);
});

test('block_menu_items_and_foot', async ({ page }) => {
  const s = await openPage(page);
  await grip(page, 1).click({ force: true });
  const menu = page.locator('.wbm');
  await expect(menu).toHaveAttribute('aria-label', 'Block actions');
  await expect(menu.locator('.wbm-row .wbm-label')).toHaveText(['Turn into', 'Color', 'Duplicate', 'Move to', 'Delete']);
  await expect(menu.locator('.wbm-row', { hasText: 'Duplicate' }).locator('.wbm-hint')).toHaveText('Ctrl+D');
  await expect(menu.locator('.wbm-row', { hasText: 'Delete' }).locator('.wbm-hint')).toHaveText('Del');
  // the foot: when the page was edited, and how many words it holds
  const foot = menu.locator('.wbm-foot');
  await expect(foot).toContainText('Edited');
  await expect(foot).toContainText(`${wordsOf(s.texts())} words`);
  // searchable
  await menu.locator('.wbm-input').fill('dup');
  await expect(menu.locator('.wbm-row .wbm-label')).toHaveText(['Duplicate']);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  // nothing is written until something is used
  expect(s.calls).toEqual([]);
  // a table or a fence is not plain text: no Turn into
  expect(await block(page, 1).evaluate(e => e.classList.contains('nb-selected'))).toBe(false);
});

test('turn_into_keeps_text', async ({ page }) => {
  const s = await openPage(page);
  const turn = async (n: number, kind: string, drawn: RegExp) => {
    await expect(page.locator('.wbm')).toHaveCount(0);
    await grip(page, n).click({ force: true });
    await page.locator('.wbm-row', { hasText: 'Turn into' }).click();
    await expect(page.locator('.wbm')).toHaveAttribute('aria-label', 'Turn into');
    await page.locator('.wbm-row .wbm-label', { hasText: new RegExp(`^${kind}$`) }).click();
    // the page is drawn again as the new kind before the next handle is used
    await expect(block(page, n)).toHaveClass(drawn);
  };
  await turn(1, 'Heading 2', /nb-b-heading/);
  await expect.poll(() => s.texts()[0]).toBe(`## ${FIRST}`);
  // a list item keeps its words in a to-do; a block with marks keeps them in a quote
  await turn(2, 'To-do', /nb-b-todo/);
  await expect.poll(() => s.texts()[1]).toBe('- [ ] Who acts first, and who waits?');
  await turn(3, 'Quote', /nb-b-quote/);
  await expect.poll(() => s.texts()[2]).toBe('> **Bold** and plain words');
  await turn(2, 'Numbered list', /nb-b-numbered/);
  await expect.poll(() => s.texts()[1]).toBe('1. Who acts first, and who waits?');
  await turn(1, 'Text', /nb-b-paragraph/);
  await expect.poll(() => s.texts()[0]).toBe(FIRST);
  await turn(4, 'Toggle list', /nb-toggle/);
  await expect.poll(() => s.texts()[3]).toBe('<details><summary>Last line</summary></details>');
  expect(s.texts().length).toBe(START.length);
});

test('duplicate_block_below', async ({ page }) => {
  const s = await openPage(page);
  await grip(page, 2).click({ force: true });
  await page.locator('.wbm-row', { hasText: 'Duplicate' }).click();
  await expect.poll(() => s.texts()).toEqual([FIRST, ITEM, ITEM, START[2], START[3]]);
  // the caret is in the copy
  const box = page.locator('.nb-block-input');
  await expect(box).toBeFocused();
  await expect(page.locator('.nb-blocks > .nb-block').nth(2)).toHaveClass(/editing/);
  expect(await box.evaluate(e => (e as any).value as string)).toBe(ITEM);
  expect(s.calls.at(-1)!.name).toMatch(/^block-dup-w1-2-undo/);
  // Ctrl+D with the caret in a block copies it too (the browser's bookmark is not asked for)
  await page.keyboard.press('Control+d');
  await expect.poll(() => s.texts().length).toBe(START.length + 2);
  await expect(page.locator('.nb-block-input')).toBeFocused();
  // Ctrl+D on the focused grip
  await page.keyboard.press('Escape');
  await grip(page, 1).focus();
  await page.keyboard.press('Control+d');
  await expect.poll(() => s.texts().slice(0, 3)).toEqual([FIRST, FIRST, ITEM]);
});

test('delete_block_with_undo', async ({ page }) => {
  const s = await openPage(page);
  await grip(page, 1).click({ force: true });
  await page.locator('.wbm-row', { hasText: 'Delete' }).click();
  await expect.poll(() => s.texts()).toEqual(START.slice(1));
  const toast = page.locator('.block-deletion');
  await expect(toast).toContainText('Deleted');
  await expect(toast).toContainText('Undo');
  expect(s.calls.at(-1)!.name).toMatch(/^block-rm-w1-1-.*undo/);
  await toast.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => s.texts()).toEqual(START);
  await expect(grip(page, 1)).toBeFocused();   // the page is drawn again, the focus back on the block that returned
  await expect(page.locator('.nb-block')).toHaveCount(4);
  // Del on a selected block (the grip focused): it goes, and Ctrl+Z is the page's Undo
  await grip(page, 2).focus();
  await expect(block(page, 2)).toHaveClass(/nb-selected/);
  await page.keyboard.press('Delete');
  await expect.poll(() => s.texts()).toEqual([START[0], START[2], START[3]]);
  await expect(page.locator('.block-deletion')).toContainText('Deleted');
  await page.locator('.nb-blocks').first().press('Control+z');
  await expect.poll(() => s.texts()).toEqual(START);
});

test('backspace_join_is_undoable', async ({ page }) => {
  const s = await openPage(page, ['First words', 'Second words', 'Third']);
  await page.locator('.nb-block[data-n="2"] .nb-block-body').click();
  const box = page.locator('.nb-block-input');
  await expect(box).toBeFocused();
  await page.keyboard.press('Home');
  await page.keyboard.press('Backspace');
  await expect.poll(() => s.texts()).toEqual(['First wordsSecond words', 'Third']);
  expect(s.calls.at(-1)!.name).toMatch(/^block-set-w1-1-count-2-undo/);
  await expect(page.locator('.block-deletion')).toContainText('Joined');
  // Ctrl+Z with nothing typed in the joined block is the page's Undo: the two blocks are back
  await expect(page.locator('.nb-block-input')).toBeFocused();
  await page.keyboard.press('Control+z');
  await expect.poll(() => s.texts()).toEqual(['First words', 'Second words', 'Third']);
  expect(s.calls.at(-1)!.name).toBe('block-undo-w1');
});

test('handle_on_a_block_being_written', async ({ page }) => {
  // the handle works on the block the caret is in: its words are saved first, then the action is done
  const s = await openPage(page);
  await page.locator('.nb-block[data-n="1"] .nb-block-body').click();
  await expect(page.locator('.nb-block-input')).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.type(' More.');
  await grip(page, 1).click({ force: true });
  await expect(page.locator('.wbm')).toHaveAttribute('aria-label', 'Block actions');
  await page.locator('.wbm-row', { hasText: 'Duplicate' }).click();
  await expect.poll(() => s.texts().slice(0, 3)).toEqual([`${FIRST} More.`, `${FIRST} More.`, ITEM]);
  await expect(page.locator('.nb-block-input')).toBeFocused();
  // + on a block being written: its words are saved, and the empty line opens below it
  await page.keyboard.type(' Again.');
  await plus(page, 1).click({ force: true });
  await expect(page.locator('.wbm')).toHaveAttribute('aria-label', 'Add a block');
  await expect.poll(() => s.texts()[1]).toBe(`${FIRST} More. Again.`);
  await expect(page.locator('.nb-blocks > .nb-block').nth(1)).toHaveClass(/nb-new-block/);
});
