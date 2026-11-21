import { expect, test, type Locator, type Page } from '@playwright/test';

// design/features/notebook rows 9, 10 and 25 (NB4, accepted 2026-11-20): toggles, the selection bar, Color ▾.
// The words in these pages are the test's own plain words (no scripture).
const TITLE = 'Toggle page';
type B = { kind: string; text: string };

/** `keep`: a save is refused (the mock's page cannot change, so a save would redraw the old words over the edit; these tests read the editor). */
async function openPage(page: Page, bodies: B[], folds: string[] = [], keep = false) {
  const seen: string[] = [];
  const blocks = () => {
    let at = TITLE.length + 2;
    return { id: 'w1', folds, title: { text: TITLE, start: 0, end: TITLE.length },
      blocks: bodies.map((b, i) => { const start = at; at += b.text.length + 2; return { n: i + 1, ...b, start, end: start + b.text.length }; }) };
  };
  const detail = () => ({ id: 'w1', title: TITLE, kind: 'note', placed: false, text: [TITLE, ...bodies.map(b => b.text)].join('\n\n'), linked_from: [], also: [], threads: [] });
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!;
    const send = (json: unknown) => route.fulfill({ json });
    if (name === 'note-show-w1.json') return send(detail());
    if (name === 'page-blocks-w1.json') return send(blocks());
    if (name.startsWith('page-fold-')) { seen.push(name); return send({ id: 'w1' }); }
    if (keep && name.startsWith('block-set-w1-')) return route.fulfill({ status: 500, body: 'kept' });
    if (name.startsWith('block-set-w1-') || name.startsWith('block-add-w1-')) { seen.push(name); return send({ ...blocks(), n: 1, count: 1 }); }
    if (name === 'settings-notebook.json') return send({});
    if (name === 'page-sweep.json') return send({ operations: [], errors: [] });
    if (name === 'docs-looks.json') return send({ looks: [] });
    if (name === 'craft-designs.json') return send({ themes: {}, theme: '' });
    if (name.startsWith('docs-list-')) return send([]);
    if (name === 'template-list.json') return send({ templates: [] });
    if (name.startsWith('page-overview-')) return send({});
    return route.fallback();
  });
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
  await page.waitForSelector('.pane-notebook');
  await page.evaluate(() => (window as any).__wb.note('w1'));
  return seen;
}

const HEAD = '<details><summary>Things to keep</summary>';
const toggleBodies: B[] = [
  { kind: 'html', text: HEAD }, { kind: 'paragraph', text: 'Inside one' }, { kind: 'paragraph', text: 'Inside two' },
  { kind: 'html', text: '</details>' }, { kind: 'paragraph', text: 'After it' },
];

test('toggle_folds_children', async ({ page }) => {
  const seen = await openPage(page, toggleBodies);
  const tri = page.locator('.nb-toggle-tri');
  await expect(tri).toHaveCount(1);
  await expect(page.locator('.nb-block[data-n="1"]')).toContainText('Things to keep');
  await expect(page.locator('.nb-block[data-n="2"]')).toBeVisible();
  await expect(page.locator('.nb-block[data-n="4"]')).toBeHidden();   // the end marker is never shown
  // clicking the triangle folds what is inside, and not what is after
  await tri.click();
  await expect(page.locator('.nb-block[data-n="2"]')).toBeHidden();
  await expect(page.locator('.nb-block[data-n="3"]')).toBeHidden();
  await expect(page.locator('.nb-block[data-n="5"]')).toBeVisible();
  await expect(tri).toHaveAttribute('aria-expanded', 'false');
  expect(seen.some(n => n.startsWith('page-fold-w1-1') && n.includes('on'))).toBe(true);
  await tri.click();
  await expect(page.locator('.nb-block[data-n="2"]')).toBeVisible();
  expect(seen.some(n => n.startsWith('page-fold-w1-1') && n.includes('off'))).toBe(true);
  // Ctrl+Enter in the toggle's line folds it too
  await page.locator('.nb-block[data-n="1"] .nb-toggle-line').click();
  await expect(page.locator('.nb-block-input')).toBeFocused();
  await page.keyboard.press('Control+Enter');
  await expect(page.locator('.nb-block[data-n="2"]')).toBeHidden();
  await page.keyboard.press('Control+Enter');
  await expect(page.locator('.nb-block[data-n="2"]')).toBeVisible();
});

test('toggle_opens_folded_as_kept_and_a_heading_can_be_one', async ({ page }) => {
  const head = '<details><summary><h2>Big part</h2></summary>';
  await openPage(page, [{ kind: 'html', text: head }, { kind: 'paragraph', text: 'Hidden words' }, { kind: 'html', text: '</details>' }], [head]);
  await expect(page.locator('.nb-block[data-n="1"]')).toContainText('Big part');
  await expect(page.locator('.nb-block[data-n="2"]')).toBeHidden();
  await expect(page.locator('.nb-toggle-tri')).toHaveAttribute('aria-expanded', 'false');
});

async function select(page: Page, text: string) {
  await page.locator('.nb-block[data-n="1"] .nb-block-body').click();
  const box = page.locator('.nb-block-input');
  await expect(box).toBeFocused();
  await box.evaluate((e, t) => {
    const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = w.nextNode())) {
      const i = (n.textContent ?? '').indexOf(t);
      if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + t.length); const s = getSelection()!; s.removeAllRanges(); s.addRange(r); break; }
    }
  }, text);
  return box;
}
const md = (box: Locator) => box.evaluate(e => (e as any).value as string);

test('selection_bar_on_intent', async ({ page }) => {
  await openPage(page, [{ kind: 'paragraph', text: 'Plain words here' }], [], true);
  await page.locator('.nb-block[data-n="1"] .nb-block-body').click();
  await expect(page.locator('.nb-block-input')).toBeFocused();
  await expect(page.locator('.nb-selbar')).toHaveCount(0);              // nothing until words are selected
  const box = await select(page, 'words');
  const bar = page.locator('.nb-selbar');
  await expect(bar).toBeVisible();
  await expect(bar.locator('.nb-sb-btn')).toHaveText(['Text ▾', 'B', 'I', 'U', 'S', 'Link', 'Color ▾']);
  await expect(bar.getByRole('button', { name: /Mark|Margin/ })).toHaveCount(0);   // scripture's own, with NB8
  const b = await bar.boundingBox(), t = await box.boundingBox();
  expect(b!.y + b!.height).toBeLessThanOrEqual(t!.y + t!.height);       // above the selection
  await bar.getByRole('button', { name: 'Bold' }).click();
  expect(await md(box)).toBe('Plain **words** here');
  await bar.getByRole('button', { name: 'Strikethrough' }).click();
  expect(await md(box)).toBe('Plain **~~words~~** here');
  // Turn into ▾ is the one menu
  await bar.getByRole('button', { name: 'Turn into' }).click();
  await expect(page.locator('.wbm')).toBeVisible();
  await page.keyboard.type('heading 2');
  await page.keyboard.press('Enter');
  await expect(page.locator('.wbm')).toHaveCount(0);
  expect((await md(box)).startsWith('## ')).toBe(true);
  // a collapsed caret takes the bar away
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.nb-selbar')).toHaveCount(0);
});

test('color_menu_plain_colors', async ({ page }) => {
  await openPage(page, [{ kind: 'paragraph', text: 'Plain words here' }], [], true);
  const box = await select(page, 'words');
  await page.locator('.nb-selbar').getByRole('button', { name: 'Color' }).click();
  await expect(page.locator('.wbm-group')).toHaveText(['Text', 'Background']);
  const names = ['Default', 'Gray', 'Brown', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Red'];
  await expect(page.locator('.wbm-row .wbm-label')).toHaveText([...names, ...names]);
  // text color: Red under Text
  await page.locator('.wbm-row').nth(8).click();
  expect(await md(box)).toBe('Plain <span data-c="red">words</span> here');
  // a background on the same words: Blue under Background
  await page.locator('.nb-selbar').getByRole('button', { name: 'Color' }).click();
  await page.locator('.wbm-row').nth(9 + 6).click();
  const both = await md(box);
  expect(both).toContain('data-bg="blue"');
  expect(both).toContain('data-c="red"');
  // Default under Text takes the text color off and keeps the background
  await page.locator('.nb-selbar').getByRole('button', { name: 'Color' }).click();
  await page.locator('.wbm-row').nth(0).click();
  expect(await md(box)).toBe('Plain <span data-bg="blue">words</span> here');
});

test('colors_read_back_as_colored_words', async ({ page }) => {
  await openPage(page, [{ kind: 'paragraph', text: 'Plain <span data-c="green">words</span> and <span data-bg="yellow">more</span>' }]);
  await expect(page.locator('.nb-block[data-n="1"] [data-c="green"]')).toHaveText('words');
  await expect(page.locator('.nb-block[data-n="1"] [data-bg="yellow"]')).toHaveText('more');
});
