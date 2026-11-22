import { expect, test, type Page } from '@playwright/test';

// design/features/notebook, the last line of "What the build must satisfy" (NB15 follow-up, the lead's decisions of 2026-11-22):
// (1) the `[[` link list and the older popover lists are the one menu (ui/src/menu.ts); (2) a day's page is written with the block
// editor, never in a whole-text box. No Rust here: a small server stands in for `wb`; the words are the test's own, not scripture.
const TITLE = 'Menu page';
const DAY = '2026-11-22';

async function serve(page: Page, handler: (name: string, argv: string[], send: (j: unknown) => Promise<void>) => Promise<boolean>) {
  const calls: string[][] = [];
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!.replace(/\.json$/, '');
    const argv: string[] = JSON.parse(decodeURIComponent(route.request().headers()['x-wb-argv'] ?? '[]'));
    const send = async (json: unknown) => { await route.fulfill({ json }); };
    if (await handler(name, argv, send)) { calls.push(argv); return; }
    if (name === 'settings-notebook') return send({});
    if (name === 'page-sweep') return send({ operations: [], errors: [] });
    if (name === 'docs-looks') return send({ looks: [] });
    if (name === 'craft-designs') return send({ themes: {}, theme: '' });
    if (name === 'template-list') return send({ templates: [] });
    if (name.startsWith('docs-list-')) return send([]);
    if (name.startsWith('page-overview-') || name.startsWith('page-scripture-') || name.startsWith('page-study-') || name.startsWith('page-words-')) return send({ blocks: [] });
    if (name.startsWith('refs-plain-')) return send([]);
    return route.fallback();
  });
  return calls;
}
const open = async (page: Page) => {
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
  await page.waitForSelector('.pane-notebook');
};

test('link_list_is_the_one_menu', async ({ page }, info) => {
  test.skip(info.project.name === 'webkit-phone', 'typing in a block is the desktop’s; the menu as a sheet is checked in menu.spec');
  const body = 'See also ';
  const entry = (id: string, title: string, kind = 'note') => ({ id, title, kind, placed: false, label: '', updated: '2026-11-20', created: '2026-11-20', text: '', preview: '', also: [], threads: [], links: [], headings: [], linked_from: [] });
  await serve(page, async (name, _argv, send) => {
    if (name === 'note-show-w1') { await send({ ...entry('w1', TITLE), text: `${TITLE}\n\n${body}` }); return true; }
    if (name === 'page-blocks-w1') {
      await send({ id: 'w1', title: { text: TITLE, start: 0, end: TITLE.length }, blocks: [{ n: 1, kind: 'paragraph', text: body, start: TITLE.length + 2, end: TITLE.length + 2 + body.length }] });
      return true;
    }
    if (name === 'notebook-group-none') { await send({ groups: [{ key: 'all', label: 'All', count: 2, entries: [entry('p1', 'Zeal study'), entry('p2', 'Covenant of peace')] }] }); return true; }
    if (name.startsWith('block-set-w1-')) { await send({ n: 1, count: 1 }); return true; }
    return false;
  });
  await open(page);
  await page.evaluate(() => void (window as any).__wb.note('w1'));
  await page.locator('.nb-block-body').first().click();
  const box = page.locator('.nb-block-input');
  await expect(box).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.type('[[');
  // the one menu, with the titles; the old hand-made list is gone
  const menu = page.locator('.wbm[aria-label="Link to a page"]');
  await expect(menu).toBeVisible();
  await expect(page.locator('.nb-suggest')).toHaveCount(0);
  await expect(menu.locator('.wbm-row .wbm-label')).toHaveText(['Zeal study', 'Covenant of peace']);
  await menu.locator('.wbm-input').fill('zea');
  await expect(menu.locator('.wbm-row .wbm-label')).toHaveText(['Zeal study', 'Link to “zea”']);
  await page.keyboard.press('Enter');
  await expect(menu).toHaveCount(0);
  expect(await box.evaluate(e => (e as any).value as string)).toBe(`${body}[[Zeal study]]`);
});

test('link_list_esc_leaves_the_brackets', async ({ page }, info) => {
  test.skip(info.project.name === 'webkit-phone', 'typing in a block is the desktop’s');
  await serve(page, async (name, _argv, send) => {
    if (name === 'note-show-w1') { await send({ id: 'w1', title: TITLE, kind: 'note', placed: false, text: `${TITLE}\n\nWrite `, linked_from: [], also: [], threads: [] }); return true; }
    if (name === 'page-blocks-w1') { await send({ id: 'w1', title: { text: TITLE, start: 0, end: TITLE.length }, blocks: [{ n: 1, kind: 'paragraph', text: 'Write ', start: TITLE.length + 2, end: TITLE.length + 8 }] }); return true; }
    if (name === 'notebook-group-none') { await send({ groups: [] }); return true; }
    return false;
  });
  await open(page);
  await page.evaluate(() => void (window as any).__wb.note('w1'));
  await page.locator('.nb-block-body').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type('[[');
  await expect(page.locator('.wbm')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.wbm')).toHaveCount(0);
  expect(await page.locator('.nb-block-input').evaluate(e => (e as any).value as string)).toBe('Write [[');
});

test('phone: a_days_page_is_written_with_the_block_editor', async ({ page }) => {
  const written: string[] = [];
  const blank = { id: '', kind: 'day', placed: false, anchor: '', label: '', day: DAY, exists: false, today: true, title: 'Today', preview: '', text: '', created: '', updated: '', time: '', refs: [], also: [], threads: [], links: [], headings: [], linked_from: [] };
  await serve(page, async (name, argv, send) => {
    if (name.startsWith('notebook-group-day') || name === 'notebook-group-none' || name.startsWith('notebook-sidebar')) {
      await send({ groups: [{ key: DAY, label: 'Today', count: 1, today: true, entries: [blank] }], recents: [], pinned: [], pages: [], templates: [], questions: [] });
      return true;
    }
    if (name.startsWith('day-') && argv[0] === 'day' && argv[1] === 'text') { written.push(argv.join(' ')); await send({ ...blank, id: `d:${DAY}`, exists: true, text: 'First day line' }); return true; }
    if (name.startsWith('day-')) { await send(blank); return true; }
    return false;
  });
  await open(page);
  await page.locator('.nb-item', { hasText: 'Not written in yet' }).first().click();
  // no whole-text box: the form is the first line of a block page, with the day's own placeholder
  await expect(page.locator('.nb-whole')).toHaveCount(0);
  const line = page.locator('.nb-new-line');
  await expect(line).toBeVisible();
  expect(await line.evaluate(e => e.tagName)).not.toBe('TEXTAREA');
  await expect(page.locator('.nb-new-title')).toHaveCount(0);
  await expect(line).toHaveAttribute('data-placeholder', /Today’s dump/);
  await line.click();
  await page.keyboard.type('First day line');
  await page.keyboard.press('Enter');
  await expect.poll(() => written.length).toBe(1);
  // the day's file is made the way it always was: `wb day text - --day DAY`
  expect(written[0]).toBe(`day text - --day ${DAY}`);
});
