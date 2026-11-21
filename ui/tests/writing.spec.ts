import { expect, test, type Page } from '@playwright/test';

// design/features/notebook rows 3, 4, 5 and 8 (NB2, accepted 2026-11-20): the page's writing.
const TITLE = 'Writing page';

/** One page of one paragraph, served without Rust; every `block set` is kept in `saved`. */
async function writingPage(page: Page, body = 'First line') {
  const saved: string[] = [];
  const blocks = () => ({ id: 'w1', title: { text: TITLE, start: 0, end: TITLE.length },
    blocks: [{ n: 1, kind: 'paragraph', text: body, start: TITLE.length + 2, end: TITLE.length + 2 + body.length }] });
  const detail = () => ({ id: 'w1', title: TITLE, kind: 'note', placed: false, text: `${TITLE}\n\n${body}`, linked_from: [], also: [], threads: [] });
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!;
    const send = (json: unknown) => route.fulfill({ json });
    if (name === 'note-show-w1.json') return send(detail());
    if (name === 'page-blocks-w1.json') return send(blocks());
    if (name.startsWith('block-set-w1-')) { saved.push(name); return send({ ...blocks(), n: 1, count: 1 }); }
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
  await page.locator('.nb-block-body').first().click();
  const box = page.locator('.nb-block-input');
  await expect(box).toBeFocused();
  return { box, saved };
}

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
  const shape = async (typed: string) => {
    await box.fill('');
    await page.keyboard.type(typed);
    return box.getAttribute('data-shape');
  };
  expect(await shape('# ')).toBe('h1');
  expect(await shape('## ')).toBe('h2');
  expect(await shape('### ')).toBe('h3');
  expect(await shape('- ')).toBe('bullet');
  expect(await shape('1. ')).toBe('numbered');
  expect(await shape('> ')).toBe('quote');
  // [] becomes a to-do at once; Ctrl+Z gives back the typed characters
  expect(await shape('[] ')).toBe('todo');
  await expect(box).toHaveValue('- [ ] ');
  await page.keyboard.press('Control+z');
  await expect(box).toHaveValue('[] ');
  // --- is a divider at once and a new line opens under it
  await box.fill('');
  await page.keyboard.type('---');
  await expect(page.locator('.nb-block-input')).toHaveCount(1);
  await expect(page.locator('.nb-block-input')).toHaveValue('');
});

test('inline_shortcuts_and_keys', async ({ page }) => {
  // as a block is read: bold, italic and underline marks
  await writingPage(page, '**a** *b* <u>c</u>');
  await page.keyboard.press('Escape');
  await page.locator('.nb-block-input').blur();
  const read = page.locator('.nb-block').first();
  await expect(read.locator('strong')).toHaveText('a');
  await expect(read.locator('em')).toHaveText('b');
  await expect(read.locator('u')).toHaveText('c');
});

test('inline_shortcuts_and_keys_in_the_box', async ({ page }) => {
  const { box } = await writingPage(page, 'word');
  await box.press('Control+a');
  await page.keyboard.press('Control+b');
  await expect(box).toHaveValue('**word**');
  await page.keyboard.press('Control+b');
  await expect(box).toHaveValue('word');
  await page.keyboard.press('Control+i');
  await expect(box).toHaveValue('*word*');
  await page.keyboard.press('Control+i');
  await page.keyboard.press('Control+u');
  await expect(box).toHaveValue('<u>word</u>');
});

test('list_enter_tab_rules', async ({ page }) => {
  const { box } = await writingPage(page, '- Who acts first');
  await box.press('End');
  await page.keyboard.press('Tab');
  await expect(box).toHaveValue('  - Who acts first');
  await page.keyboard.press('Shift+Tab');
  await expect(box).toHaveValue('- Who acts first');
  await page.keyboard.press('Shift+Tab');
  await expect(box).toHaveValue('- Who acts first');
  // Enter continues the list: a new empty item opens under it
  await page.keyboard.press('Enter');
  await expect(page.locator('.nb-block-input')).toHaveValue('- ');
  // Enter on an empty item leaves the list: the mark goes, a plain line stays
  await page.keyboard.press('Enter');
  await expect(page.locator('.nb-block-input')).toHaveValue('');
});
