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
  await expect(line).toHaveAttribute('placeholder', 'Press / for blocks');
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
  const tail = page.locator('.nb-block-input');
  await expect(tail).toHaveCount(1);
  expect(await md(tail)).toBe(' world');
  expect(await tail.evaluate(e => (e as any).selectionStart)).toBe(0);
});

test('backspace_at_the_start_joins_the_block_before', async ({ page }) => {
  const { box, saved } = await writingPage(page, ['One', 'Two'], 2);
  await box.press('Home');
  await page.keyboard.press('Backspace');
  await expect.poll(() => saved).toContain('block-set-w1-1-count-2');
  // the writing goes on in the first block, with the caret where the two met
  const joined = page.locator('.nb-block-input');
  await expect(joined).toHaveCount(1);
  expect(await joined.evaluate(e => (e as any).selectionStart)).toBe(3);
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
