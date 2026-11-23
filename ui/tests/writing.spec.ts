import { expect, test, type Locator, type Page } from '@playwright/test';

// design/features/notebook rows 3, 4, 5 and 8 (NB2, NB2b, accepted 2026-11-20): the page's writing, in place.
const TITLE = 'Writing page';

/** A page of paragraphs (one block each), served without Rust; every block set and add is kept in `saved` by its name. */
async function writingPage(page: Page, body: string | string[] = 'First line', open = 1) {
  const saved: string[] = [];
  const bodies = Array.isArray(body) ? body : [body];
  const blocks = () => {
    let at = TITLE.length + 2;
    return { id: 'w1', title: { text: TITLE, start: 0, end: TITLE.length },
      blocks: bodies.map((b, i) => { const start = at; at += b.length + 2; return { n: i + 1, kind: 'paragraph', text: b, start, end: start + b.length }; }) };
  };
  const detail = () => ({ id: 'w1', title: TITLE, kind: 'note', placed: false, text: [TITLE, ...bodies].join('\n\n'), linked_from: [], also: [], threads: [] });
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!;
    const send = (json: unknown) => route.fulfill({ json });
    if (name === 'note-show-w1.json') return send(detail());
    if (name === 'page-blocks-w1.json') return send(blocks());
    if (name.startsWith('block-set-w1-') || name.startsWith('block-add-w1-')) { saved.push(name.replace(/\.json$/, '')); return send({ ...blocks(), n: 1, count: 1 }); }
    if (name === 'settings-notebook.json') return send({});
    if (name === 'page-sweep.json') return send({ operations: [], errors: [] });
    if (name === 'docs-looks.json') return send({ looks: [] });
    if (name === 'craft-designs.json') return send({ themes: {}, theme: '' });
    if (name.startsWith('docs-list-')) return send([]);
    if (name === 'template-list.json') return send({ templates: [] });
    if (name.startsWith('page-overview-') || name.startsWith('page-scripture-')) return send({});
    return route.fallback();
  });
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
  await page.waitForSelector('.pane-notebook');
  await page.evaluate(() => (window as any).__wb.note('w1'));
  await page.locator('.nb-block-body').nth(open - 1).click();
  const box = page.locator('.nb-block-input');
  await expect(box).toBeFocused();
  return { box, saved };
}

/** The Markdown the box would save: what is in it, as wb-core reads it. */
const md = (box: Locator) => box.evaluate(e => (e as any).value as string);

test('new_page_caret_in_title', async ({ page }) => {
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!;
    if (name === 'template-list.json') return route.fulfill({ json: { templates: [] } });
    if (name === 'settings-notebook.json') return route.fulfill({ json: {} });
    // the narrow Notebook's list (no fixture of its own): an empty one, so the pen is there
    if (name.startsWith('notebook-group-')) return route.fulfill({ json: { group: 'day', groups: [] } });
    return route.fallback();
  });
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
  await page.waitForSelector('.pane-notebook');
  await page.getByRole('button', { name: 'A new page' }).first().click();
  const title = page.locator('.nb-new-title');
  await expect(title).toBeFocused();
  await expect(title).toHaveAttribute('placeholder', 'Untitled');
  await expect(title).toHaveValue('');
  await page.keyboard.press('Enter');
  const line = page.locator('.nb-new-line');
  await expect(line).toBeFocused();
  await expect(line).toHaveAttribute('data-placeholder', 'Press / for blocks');
  // the first line is the same in-place editor as a block: # turns it into a heading and **word** is bold, as it is typed
  expect(await line.evaluate(e => e.tagName)).not.toBe('TEXTAREA');
  await page.keyboard.type('# ');
  await expect(line).toHaveAttribute('data-shape', 'h1');
  await expect(line).toHaveText('');
  await page.keyboard.type('Big **word** now');
  await expect(line.locator('strong')).toHaveText('word');
  expect(await line.evaluate(e => (e as any).value)).toBe('# Big **word** now');
});

// B8 (play-test of 0.3.0, 2026-11-23): after the first Enter in a new page, the page goes on in the block editor; nothing typed
// after it, even straight after Enter, is lost, and every line is saved as its own block.
/** A new page written from the pen: `slow` makes the page's making and every save slow; `failFirst` refuses the first making. */
async function newPageRun(page: Page, slow = 0, failFirst = false, redrawMid = false) {
  let refused = false;
  const wait = () => new Promise(r => setTimeout(r, slow));
  let title = '';
  const bodies: string[] = [];
  const blocks = () => {
    let at = title.length + 2;
    return { id: 'np1', title: { text: title, start: 0, end: title.length },
      blocks: bodies.map((b, i) => { const start = at; at += b.length + 2; return { n: i + 1, kind: 'paragraph', text: b, start, end: start + b.length }; }) };
  };
  const detail = () => ({ id: 'np1', title, kind: 'note', placed: false, text: [title, ...bodies].join('\n\n'), linked_from: [], also: [], threads: [], created: '2026-11-23T00:00:00Z', updated: '2026-11-23T00:00:00Z' });
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!;
    const input = decodeURIComponent(route.request().headers()['x-wb-input'] ?? '');
    const send = (json: unknown) => route.fulfill({ json });
    if (name === 'note-new.json' && failFirst && !refused) {
      refused = true;
      if (redrawMid) { await page.evaluate(() => (window as any).__wb.changed()); await new Promise(r => setTimeout(r, 300)); }
      return route.fulfill({ status: 500, body: 'disk full' });
    }
    if (name === 'note-new.json') {
      // something else redraws the Notebook while the page is being made (a list refresh, another window's change)
      if (redrawMid) { await page.evaluate(() => (window as any).__wb.changed()); await new Promise(r => setTimeout(r, 300)); }
      await wait(); const [t, ...rest] = input.split('\n\n'); title = t; bodies.splice(0, bodies.length, ...rest); return send(detail()); }
    if (name === 'note-show-np1.json') return send(detail());
    if (name === 'page-blocks-np1.json') return send(blocks());
    if (name.startsWith('block-add-np1-')) {
      await wait();
      // after N (--after N) or first; the block's words ride in the input
      const after = /after-(\d+)/.exec(name)?.[1];
      bodies.splice(after ? Number(after) : 0, 0, input);
      return send({ ...blocks(), n: (after ? Number(after) : 0) + 1, count: 1 });
    }
    if (name.startsWith('block-set-np1-')) { await wait(); const n = Number(/block-set-np1-(\d+)/.exec(name)![1]); bodies[n - 1] = input; return send({ ...blocks(), n, count: 1 }); }
    if (name === 'template-list.json') return send({ templates: [] });
    if (name === 'settings-notebook.json') return send({});
    if (name === 'page-sweep.json') return send({ operations: [], errors: [] });
    if (name.startsWith('docs-list-')) return send([]);
    if (name.startsWith('page-overview-') || name.startsWith('page-scripture-') || name.startsWith('page-look-')) return send({});
    if (name.startsWith('history-add')) return send({});
    if (name.startsWith('notebook-group-')) return send({ group: 'day', groups: [] });
    return route.fallback();
  });
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
  await page.waitForSelector('.pane-notebook');
  await page.getByRole('button', { name: 'A new page' }).first().click();
  await expect(page.locator('.nb-new-title')).toBeFocused();
  await page.keyboard.type('Fresh page');
  await page.keyboard.press('Enter');
  await page.keyboard.type('First words');
  if (failFirst) {
    // the making is refused: the message is shown, the form stays with every word, and what was typed after Enter is back in it
    await page.keyboard.press('Enter');
    await page.keyboard.type(' kept');
    await expect(page.locator('.pane-notebook .nb-new-line')).toBeFocused();
    await expect.poll(() => page.locator('.pane-notebook .nb-new-line').evaluate(e => (e as any).value)).toBe('First words kept');
    await expect(page.locator('.pane-notebook .nb-new-title')).toHaveValue('Fresh page');
    expect(refused).toBe(true);
  }
  // straight on, with no wait for the save: Enter, the next line, Enter, the third
  await page.keyboard.press('Enter');
  await page.keyboard.type('Second words');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Third words');
  await expect(page.locator('.pane-notebook .nb-block-input')).toHaveText('Third words', { timeout: 15000 });
  await page.keyboard.press('Escape');
  await expect.poll(() => bodies, { timeout: 15000 }).toEqual([failFirst ? 'First words kept' : 'First words', 'Second words', 'Third words']);
  expect(title).toBe('Fresh page');
  await expect(page.locator('.pane-notebook .nb-newpage')).toHaveCount(0);
  await expect(page.locator('.pane-notebook .nb-block')).toHaveCount(3);
}

test('new_page_keeps_every_line_after_enter', ({ page }) => newPageRun(page));
// B8 review: the page's making and every save slow (the held keys carry the typing), and a making that is refused once
test('new_page_keeps_every_line_with_slow_saves', ({ page }) => newPageRun(page, 500));
test('new_page_refused_once_keeps_the_words_and_goes_on', ({ page }) => newPageRun(page, 0, true));
// B8 re-review: a redraw while the page is being made does not take the held keys
test('new_page_redrawn_while_made_keeps_every_line', ({ page }) => newPageRun(page, 500, false, true));
// and when that making is refused, the words are in the form drawn again, not the one left behind
test('new_page_redrawn_and_refused_keeps_the_words', ({ page }) => newPageRun(page, 0, true, true));


// B11 (play-test of 0.3.0): Enter pressed while the block before is still being saved is kept, not lost: three lines typed
// straight on with Enter between them are three blocks, never two run together.
test('enter_while_saving_is_kept', async ({ page }) => {
  const { saved } = await writingPage(page);
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Second');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Third');
  await expect(page.locator('.pane-notebook .nb-block-input')).toHaveText('Third');
  await page.keyboard.press('Escape');
  await expect.poll(() => saved.filter(s => s.startsWith('block-add-w1-')).length).toBe(2);
});

/** A page that keeps what is saved (`bodies`, one block each), with every save and every read of the blocks made slow (`slow`
 *  ms), as a large page or a busy disk makes them: keys typed meanwhile are carried by the hold, not by the save's speed. */
async function slowPage(page: Page, start: string[], open = 1, slow = 400) {
  const bodies = [...start];
  const kind = (t: string) => /^<\/?details/.test(t) ? 'html' : t.startsWith('```') ? 'code' : 'paragraph';
  const blocks = () => {
    let at = TITLE.length + 2;
    return { id: 'w1', title: { text: TITLE, start: 0, end: TITLE.length },
      blocks: bodies.map((b, i) => { const start = at; at += b.length + 2; return { n: i + 1, kind: kind(b), text: b, start, end: start + b.length }; }) };
  };
  const detail = () => ({ id: 'w1', title: TITLE, kind: 'note', placed: false, text: [TITLE, ...bodies].join('\n\n'), linked_from: [], also: [], threads: [] });
  let loaded = false;
  const wait = () => new Promise(r => setTimeout(r, slow));
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!.replace(/\.json$/, '');
    const input = decodeURIComponent(route.request().headers()['x-wb-input'] ?? '');
    const send = (json: unknown) => route.fulfill({ json });
    if (name === 'note-show-w1') return send(detail());
    if (name === 'page-blocks-w1') { if (loaded) await wait(); return send(blocks()); }
    const set = /^block-set-w1-(\d+)(?:-count-(\d+))?/.exec(name);
    if (set) {
      await wait();
      const n = Number(set[1]), count = Number(set[2] ?? 1);
      bodies.splice(n - 1, count, input.replace(/\n+$/, ''));
      return send({ ...blocks(), n, count: 1 });
    }
    const add = /^block-add-w1-(?:after-(\d+)|first)(-details)?/.exec(name);
    if (add) {
      await wait();
      const after = Number(add[1] ?? 0);
      bodies.splice(after, 0, add[2] ? '</details>' : input.replace(/\n+$/, ''));
      return send({ ...blocks(), n: after + 1, count: 1 });
    }
    if (name.startsWith('page-fold-')) return send({ id: 'w1' });
    if (name === 'settings-notebook') return send({});
    if (name === 'page-sweep') return send({ operations: [], errors: [] });
    if (name === 'docs-looks') return send({ looks: [] });
    if (name === 'craft-designs') return send({ themes: {}, theme: '' });
    if (name.startsWith('docs-list-')) return send([]);
    if (name === 'template-list') return send({ templates: [] });
    if (name.startsWith('page-overview-') || name.startsWith('page-scripture-')) return send({});
    return route.fallback();
  });
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
  await page.waitForSelector('.pane-notebook');
  await page.evaluate(() => (window as any).__wb.note('w1'));
  await page.locator('.nb-block-body').nth(open - 1).click();
  await expect(page.locator('.nb-block-input')).toBeFocused();
  loaded = true;
  return bodies;
}

// B11, with slow saves: the words are checked, not only the count. An empty list item ended by a held Enter leaves the list.
test('held_enters_in_a_list_with_slow_saves', async ({ page }) => {
  const bodies = await slowPage(page, ['- a']);
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('b');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('After');
  await expect(page.locator('.pane-notebook .nb-block-input')).toHaveText('After', { timeout: 10000 });
  await page.keyboard.press('Escape');
  await expect.poll(() => bodies, { timeout: 10000 }).toEqual(['- a', '- b', 'After']);
});

// B11 review: the same, plain lines, every one saved with its own words (Shift+Enter held is a line inside the block)
test('held_enters_keep_every_word_with_slow_saves', async ({ page }) => {
  const bodies = await slowPage(page, ['First']);
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Second');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('more');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Third');
  await expect(page.locator('.pane-notebook .nb-block-input')).toHaveText('Third', { timeout: 10000 });
  await page.keyboard.press('Escape');
  await expect.poll(() => bodies, { timeout: 10000 }).toEqual(['First', 'Second\nmore', 'Third']);
});

// B11 review, finding 1: Backspace at the start of the first block makes no join; a held Enter after it is pressed, not written in
test('held_enter_after_a_backspace_with_no_join', async ({ page }) => {
  const bodies = await slowPage(page, ['One']);
  await page.keyboard.press('Home');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('x');
  await page.keyboard.press('Enter');
  await page.keyboard.type('y');
  await expect(page.locator('.pane-notebook .nb-new-block .nb-block-input')).toHaveCount(1, { timeout: 10000 });
  await expect.poll(() => md(page.locator('.pane-notebook .nb-block-input')), { timeout: 10000 }).toBe('yOne');
  await page.keyboard.press('Escape');
  await expect.poll(() => bodies, { timeout: 10000 }).toEqual(['x', 'yOne']);
});

// B11 re-review: a save so slow that the person puts the caret elsewhere (after 4 s) ends the hold; what was held is shown,
// and the block does not open late with it
test('a_hold_that_runs_out_shows_what_was_held', async ({ page }) => {
  test.setTimeout(60000);
  const bodies = await slowPage(page, ['First'], 1, 9000);
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('held');
  await page.waitForTimeout(4500);
  const other = page.locator('input:visible').first();
  await other.click();
  await page.keyboard.type('z');
  await expect(page.locator('.toast')).toContainText('what you typed: held');
  await expect(other).toHaveValue(/z$/);
  await expect.poll(() => bodies, { timeout: 20000 }).toEqual(['First']);
  await page.waitForTimeout(1500);
  await expect(page.locator('.pane-notebook .nb-new-block')).toHaveCount(0);
});

// B11 review, finding 2: Enter in a toggle's line opens its first block only after the saves; what is typed meanwhile goes in
// that block, never in the toggle's line
test('typing_after_enter_in_a_toggle_goes_inside', async ({ page }) => {
  const head = '<details><summary>Things to keep</summary>';
  const bodies = await slowPage(page, [head, 'Inside one', '</details>', 'After it']);
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Inside zero');
  await expect(page.locator('.pane-notebook .nb-new-block .nb-block-input')).toHaveText('Inside zero', { timeout: 10000 });
  await page.keyboard.press('Escape');
  await expect.poll(() => bodies, { timeout: 10000 }).toEqual([head, 'Inside zero', 'Inside one', '</details>', 'After it']);
});

test('markdown_shortcuts_turn_the_line', async ({ page }) => {
  const { box } = await writingPage(page);
  await box.fill('');
  // each shortcut turns the line at once, in place: the characters typed are gone and the box is drawn as the block
  const turn = async (typed: string, shape: string) => {
    await page.keyboard.type(typed);
    await expect(box).toHaveAttribute('data-shape', shape);
    await expect(box).toHaveText('');
    await page.keyboard.press('Backspace');
    await expect(box).toHaveAttribute('data-shape', '');
  };
  await page.keyboard.type('# ');
  await expect(box).toHaveAttribute('data-shape', 'h1');
  await expect(box).toHaveText('');
  expect(await md(box)).toBe('# ');
  expect(await box.evaluate(e => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThan(24);
  await page.keyboard.press('Backspace');
  await expect(box).toHaveAttribute('data-shape', '');
  await turn('## ', 'h2');
  await turn('### ', 'h3');
  await turn('- ', 'bullet');
  await turn('1. ', 'numbered');
  await turn('> ', 'quote');
  // what is typed after the mark is the block's words, and the file form is its Markdown
  await page.keyboard.type('## ');
  await page.keyboard.type('Heading words');
  await expect(box).toHaveAttribute('data-shape', 'h2');
  await expect(box).toHaveText('Heading words');
  expect(await md(box)).toBe('## Heading words');
  await box.fill('');
  await page.keyboard.press('Backspace');
  // [] becomes a to-do at once; Ctrl+Z gives back the typed characters
  await page.keyboard.type('[] ');
  await expect(box).toHaveAttribute('data-shape', 'todo');
  expect(await md(box)).toBe('- [ ] ');
  await page.keyboard.press('Control+z');
  await expect(box).toHaveAttribute('data-shape', '');
  expect(await md(box)).toBe('[] ');
  // --- is a divider at once and a new line opens under it
  await box.fill('');
  await page.keyboard.type('---');
  await expect(page.locator('.nb-block-input')).toHaveCount(1);
  await expect.poll(() => md(page.locator('.nb-block-input'))).toBe('');
});

test('inline_shortcuts_and_keys', async ({ page }) => {
  // a block opens with its marks already drawn: no asterisks or tags in the text
  const { box } = await writingPage(page, '**a** *b* <u>c</u>');
  await expect(box.locator('strong')).toHaveText('a');
  await expect(box.locator('em')).toHaveText('b');
  await expect(box.locator('u')).toHaveText('c');
  await expect(box).toHaveText('a b c');
  expect(await md(box)).toBe('**a** *b* <u>c</u>');
  // typing **word** and *word* styles the words in place, and what follows is plain
  const typed = await writingPage(page, 'x');
  const box2 = typed.box;
  await box2.fill('');
  await page.keyboard.type('say **bold** and *lean* now');
  await expect(box2.locator('strong')).toHaveText('bold');
  await expect(box2.locator('em')).toHaveText('lean');
  await expect(box2).toHaveText('say bold and lean now');
  expect(await box2.evaluate(e => getComputedStyle(e.querySelector('strong')!).fontWeight)).toMatch(/^(700|bold)$/);
  expect(await md(box2)).toBe('say **bold** and *lean* now');
  // Ctrl+Z straight after the shortcut gives the typed characters back
  await box2.fill('');
  await page.keyboard.type('**x**');
  await expect(box2.locator('strong')).toHaveText('x');
  await page.keyboard.press('Control+z');
  await expect(box2.locator('strong')).toHaveCount(0);
  await expect(box2).toHaveText('**x**');
});

test('inline_shortcuts_and_keys_in_the_box', async ({ page }) => {
  const { box } = await writingPage(page, 'word');
  await box.press('Control+a');
  await page.keyboard.press('Control+b');
  await expect(box.locator('strong, b')).toHaveText('word');
  expect(await md(box)).toBe('**word**');
  await page.keyboard.press('Control+b');
  await expect(box.locator('strong, b')).toHaveCount(0);
  expect(await md(box)).toBe('word');
  await page.keyboard.press('Control+i');
  await expect(box.locator('em, i')).toHaveText('word');
  expect(await md(box)).toBe('*word*');
  await page.keyboard.press('Control+i');
  await page.keyboard.press('Control+u');
  await expect(box.locator('u')).toHaveText('word');
  expect(await md(box)).toBe('<u>word</u>');
});

test('list_enter_tab_rules', async ({ page }) => {
  const { box } = await writingPage(page, '- Who acts first');
  await expect(box).toHaveAttribute('data-shape', 'bullet');
  await expect(box).toHaveText('Who acts first');
  await box.press('End');
  await page.keyboard.press('Tab');
  expect(await md(box)).toBe('  - Who acts first');
  expect(await box.evaluate(e => getComputedStyle(e).paddingLeft)).toBe('38px');
  await page.keyboard.press('Shift+Tab');
  expect(await md(box)).toBe('- Who acts first');
  await page.keyboard.press('Shift+Tab');
  expect(await md(box)).toBe('- Who acts first');
  // Enter continues the list: a new empty item opens under it
  await page.keyboard.press('Enter');
  const next = page.locator('.nb-block-input');
  await expect(next).toHaveCount(1);
  await expect(next).toHaveAttribute('data-shape', 'bullet');
  await expect(next).toHaveText('');
  expect(await md(next)).toBe('- ');
  // Enter on an empty item leaves the list: the mark goes, a plain line stays
  await page.keyboard.press('Enter');
  await expect(next).toHaveAttribute('data-shape', '');
  expect(await md(next)).toBe('');
});

test('enter_splits_a_block', async ({ page }) => {
  // Enter in the middle: what is before the caret stays, what follows opens in a new block
  const one = await writingPage(page, 'Hello world');
  await one.box.press('Home');
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => one.saved).toContain('block-set-w1-1-count-1');
  // the page is drawn again before the new block opens: wait for it (the block just left is still the one box until then)
  const tail = page.locator('.nb-new-block .nb-block-input');
  await expect(tail).toHaveCount(1);
  await expect.poll(() => md(tail)).toBe(' world');
  expect(await tail.evaluate(e => (e as any).selectionStart)).toBe(0);
});

test('typing_right_after_enter_is_not_lost', async ({ page }) => {
  // NB15: keys typed after Enter, before the new block is drawn, are held and put in the new block; none lands in the block just left
  const one = await writingPage(page, 'Hello world');
  await one.box.press('Home');
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.type('abc');
  await page.keyboard.press('Backspace');
  const tail = page.locator('.nb-new-block .nb-block-input');
  await expect(tail).toHaveCount(1);
  await expect.poll(() => md(tail)).toBe('ab world');
  expect(await tail.evaluate(e => (e as any).selectionStart)).toBe(2);
  await expect(page.locator('.nb-block[data-n="1"] .nb-block-body')).toHaveText(/Hello/);
});

test('backspace_at_the_start_joins_the_block_before', async ({ page }) => {
  const { box, saved } = await writingPage(page, ['One', 'Two'], 2);
  await box.press('Home');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('x');      // typed before the page is drawn again: held, and put where the two met (NB15)
  await expect.poll(() => saved).toContain('block-set-w1-1-count-2-undo');
  // the writing goes on in the first block, with the caret where the two met (the page is drawn again first: poll)
  const joined = page.locator('.nb-block[data-n="1"] .nb-block-input');
  await expect(joined).toHaveCount(1);
  await expect.poll(() => joined.evaluate(e => (e as any).selectionStart)).toBe(4);
  expect(await md(joined)).toBe('Onex');
});

test('arrows_cross_blocks', async ({ page }) => {
  const { box } = await writingPage(page, ['One', 'Two'], 2);
  await expect(page.locator('.nb-block.editing')).toHaveAttribute('data-n', '2');
  await box.press('ArrowUp');
  await expect(page.locator('.nb-block.editing')).toHaveAttribute('data-n', '1');
  await page.locator('.nb-block-input').press('ArrowDown');
  await expect(page.locator('.nb-block.editing')).toHaveAttribute('data-n', '2');
});

test('opening_and_leaving_a_block_keeps_its_markdown', async ({ page }) => {
  // the file form stays Markdown exactly as wb-core reads and writes it: a block opened and one letter typed at its end
  // changes that letter and nothing else (a fence, a #### heading, _italics_ and indents come back as they were)
  const corpus = [
    '## A heading with a *light* word and more',
    '- Who acts first',
    '  - an indented item with **bold** inside',
    '    - deeper with <u>under</u> line',
    '1. A numbered item',
    '12) Another style of number',
    '* a star item',
    '- [ ] a task still open',
    '- [x] a task done',
    '> a quote with _words_ in it',
    '> a quote\n> over two lines',
    '- an item\n  carried over a line',
    'two lines\nof a paragraph',
    '#### a fourth-level heading kept as typed',
    '```view\nnotebook kind note\n```',
    '<details><summary>Fold</summary>\nbody words\n</details>',
    '[[Another page]] and a plain line',
    'a ** lone pair and * stars',
    'snake_case_name and 2*3*4',
  ];
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  const back = await page.evaluate(async list => {
    const m = await import('/src/blockedit.ts');
    return list.map(t => m.roundTrip(t));
  }, corpus);
  expect(back).toEqual(corpus);
  // and through the keyboard, with one letter added at the end
  for (const i of [0, 2, 9, 10, 11, 13, 14, 16]) {
    const { box } = await writingPage(page, corpus[i]);
    await page.keyboard.press('Control+End');
    await page.keyboard.type('Z');
    expect(await md(box)).toBe(corpus[i] + 'Z');
  }
});

test('enter_at_start_adds_a_block_above', async ({ page }) => {
  // Enter at the start of a block with words: an empty block opens above, the caret stays with the text, nothing is changed in the file
  const { box, saved } = await writingPage(page, ['One', 'Two'], 2);
  await box.press('Home');
  await page.keyboard.press('Enter');
  await expect(page.locator('.nb-gap')).toHaveCount(1);
  await expect(box).toBeFocused();
  expect(await md(box)).toBe('Two');
  expect(await box.evaluate(e => (e as any).selectionStart)).toBe(0);
  // the empty line sits above the block with the caret, under block 1
  const order = await page.evaluate(() => [...document.querySelectorAll('.nb-blocks > .nb-block')].map(b => b.classList.contains('nb-gap') ? 'gap' : (b as HTMLElement).dataset.n));
  expect(order).toEqual(['1', 'gap', '2']);
  expect(saved).toEqual([]);
  // typing goes into the words, not above
  await page.keyboard.type('X');
  expect(await md(box)).toBe('XTwo');
});

test('typing_after_select_all_and_delete_is_not_bold', async ({ page }) => {
  // WebKit keeps the bold of deleted text for what is typed next; the box lets it go unless Ctrl+B is on
  const { box } = await writingPage(page, '**bold words**');
  await expect(box.locator('strong')).toHaveText('bold words');
  await box.press('Control+a');
  await page.keyboard.press('Delete');
  await page.keyboard.type('plain');
  await expect(box.locator('strong, b')).toHaveCount(0);
  expect(await md(box)).toBe('plain');
  // Ctrl+B turns it on again, on purpose
  await box.press('Control+a');
  await page.keyboard.press('Delete');
  await page.keyboard.press('Control+b');
  await page.keyboard.type('loud');
  await expect(box.locator('strong, b')).toHaveText('loud');
  expect(await md(box)).toBe('**loud**');
});

test('text_after_a_bold_shortcut_is_plain', async ({ page }) => {
  const { box } = await writingPage(page, 'x');
  await box.fill('');
  await page.keyboard.type('**word** after');
  await expect(box.locator('strong')).toHaveText('word');
  expect(await md(box)).toBe('**word** after');
  await page.keyboard.type(' ');
  await page.keyboard.press('Control+b');
  await page.keyboard.type('B');
  expect(await md(box)).toBe('**word** after **B**');
});
