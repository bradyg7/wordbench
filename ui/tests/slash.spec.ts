import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// design/features/notebook rows 6, 7 and 49 (NB3, accepted 2026-11-20): the / menu as one list, and the Scripture block.
// Scripture in these tests is the database's, from the generated fixtures (npm run fixtures), never typed.
const fx = (name: string) => JSON.parse(readFileSync(new URL(`../public/fixtures/wb/${name}.json`, import.meta.url), 'utf8'));
const TITLE = 'Slash page';

type B = { kind: string; text: string; lang?: string };
async function slashPage(page: Page, bodies: B[] = [{ kind: 'paragraph', text: 'First line' }], scripture: Record<string, unknown> = {}) {
  const blocks = () => {
    let at = TITLE.length + 2;
    return { id: 'w1', title: { text: TITLE, start: 0, end: TITLE.length },
      blocks: bodies.map((b, i) => { const start = at; at += b.text.length + 2; return { n: i + 1, ...b, start, end: start + b.text.length }; }) };
  };
  const detail = () => ({ id: 'w1', title: TITLE, kind: 'note', placed: false, text: [TITLE, ...bodies.map(b => b.text)].join('\n\n'), linked_from: [], also: [], threads: [] });
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!;
    const send = (json: unknown) => route.fulfill({ json });
    if (name === 'note-show-w1.json') return send(detail());
    if (name === 'page-blocks-w1.json') return send(blocks());
    if (name.startsWith('block-set-w1-') || name.startsWith('block-add-w1-')) return send({ ...blocks(), n: 1, count: 1 });
    if (name === 'page-scripture-w1.json') return send(scripture);
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
}

/** An emptied first line with `/` typed in it: the list is open. */
async function slash(page: Page) {
  await page.locator('.nb-block-body').first().click();
  const box = page.locator('.nb-block-input');
  await expect(box).toBeFocused();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('/');
  await expect(page.locator('.wbm')).toBeVisible();
  return box;
}
const md = (box: Locator) => box.evaluate(e => (e as any).value as string);

test('slash_menu_one_list_finds_folded', async ({ page }) => {
  await slashPage(page);
  const box = await slash(page);
  // one list: Basic blocks first, Study folded as one row at its end
  const labels = page.locator('.wbm-row:not(.wbm-fold) .wbm-label');
  await expect(labels).toHaveText(['Text', 'Heading 1', 'Heading 2', 'Heading 3', 'Bullet list', 'Numbered list', 'To-do', 'Toggle list', 'Quote', 'Divider', 'Table', 'Page', 'Link to a page']);
  await expect(page.locator('.wbm-group')).toHaveText(['Basic']);
  const fold = page.locator('.wbm-row.wbm-fold');
  await expect(fold).toHaveCount(1);
  await expect(fold).toContainText('Scripture, Word, Callout, Saved thing, List in a page');
  expect(await page.locator('.wbm-row').last().getAttribute('class')).toContain('wbm-fold');
  // it opens at the caret and fits the pane (the same in a narrow pane)
  const m = await page.locator('.wbm').boundingBox();
  const line = await box.boundingBox();
  const vp = page.viewportSize()!;
  expect(m!.x).toBeGreaterThanOrEqual(0);
  expect(m!.x + m!.width).toBeLessThanOrEqual(vp.width);
  expect(Math.abs(m!.y - (line!.y + line!.height))).toBeLessThan(60);
  // typing finds a command by name though Study is folded
  await page.keyboard.type('scr');
  await expect(page.locator('.wbm-row')).toHaveText([/Scripture/]);
  await expect(page.locator('.wbm-group')).toHaveText(['Study']);
  await page.keyboard.press('Control+a');
  await page.keyboard.type('saved');
  await expect(page.locator('.wbm-row')).toHaveText([/Saved thing/]);
  // a Basic command is picked and writes its form into the line
  await page.keyboard.press('Control+a');
  await page.keyboard.type('heading 2');
  await page.keyboard.press('Enter');
  await expect(page.locator('.wbm')).toHaveCount(0);
  await expect(box).toBeFocused();
  expect(await md(box)).toBe('## ');
});

test('slash_after_a_space_and_back_out', async ({ page }) => {
  await slashPage(page, [{ kind: 'paragraph', text: 'Where it first appears' }]);
  await page.locator('.nb-block-body').first().click();
  const box = page.locator('.nb-block-input');
  await page.keyboard.press('End');
  await page.keyboard.type(' /');
  await expect(page.locator('.wbm')).toBeVisible();
  await page.keyboard.press('Escape');                       // closes, nothing picked, the caret returns, the slash is taken out
  await expect(page.locator('.wbm')).toHaveCount(0);
  await expect(box).toBeFocused();
  expect(await md(box)).toBe('Where it first appears');
  await page.keyboard.type('x');                             // not after a space now: no list
  await expect(page.locator('.wbm')).toHaveCount(0);
  expect(await md(box)).toBe('Where it first appearsx');
});

test('slash_after_a_space_inserts_a_block_below', async ({ page }) => {
  await slashPage(page, [{ kind: 'paragraph', text: 'Where it first appears' }]);
  await page.locator('.nb-block-body').first().click();
  const box = page.locator('.nb-block-input');
  await page.keyboard.press('End');
  await page.keyboard.type(' /');
  await expect(page.locator('.wbm')).toBeVisible();          // right there in the line: no new block, no extra Enter
  await expect(page.locator('.nb-block-input')).toHaveCount(1);
  await page.keyboard.type('heading 2');
  await page.keyboard.press('Enter');
  await expect(page.locator('.wbm')).toHaveCount(0);
  // the first line keeps its words (the slash and the filter are gone); the picked kind is a new block below it
  const below = page.locator('.nb-new-block .nb-block-input');
  await expect(below).toBeFocused();
  expect(await md(below)).toBe('## ');
  await expect(page.locator('.nb-block[data-n="1"]')).toContainText('Where it first appears');
  await expect(page.locator('.nb-block[data-n="1"]')).not.toContainText('/');
  void box;
});

test('editing_a_scripture_block_uses_the_reference_field', async ({ page }) => {
  const d = fx('scripture-numbers-25-11-13');
  const text = ['```scripture', 'Numbers 25:11-13', '```'].join('\n');
  await slashPage(page, [{ kind: 'fence', lang: 'scripture', text }], { blocks: [{ n: 1, label: d.label, lines: false, verses: d.verses }] });
  await expect(page.locator('.nb-scripture')).toContainText(d.verses[0].text);
  await page.locator('.nb-scripture .sv-ref').click();
  const field = page.locator('.sf-input');
  await expect(field).toBeFocused();
  await expect(field).toHaveValue('Numbers 25:11-13');
  // the old "Edit card" form is not used for scripture
  await expect(page.locator('.nb-card-input, .nb-card-field')).toHaveCount(0);
  await expect(page.locator('.sf-verse')).toHaveCount(d.verses.length);
  await expect(page.locator('.sf-verse').first()).toContainText(d.verses[0].text);
  await page.keyboard.press('Escape');
  await expect(page.locator('.sf')).toHaveCount(0);
  await expect(page.locator('.nb-scripture')).toBeVisible();
});

test('scripture_block_completes_and_previews', async ({ page }) => {
  await slashPage(page);
  const box = await slash(page);
  await page.keyboard.type('scr');
  await page.keyboard.press('Enter');
  const field = page.locator('.sf-input');
  await expect(field).toBeFocused();
  // the book completes as it is typed: josh → Joshua, Tab
  await page.keyboard.type('josh');
  await expect(page.locator('.sf-book')).toHaveCount(1);
  await expect(page.locator('.sf-book')).toContainText('Joshua');
  await expect(page.locator('.sf-book')).toContainText('24 chapters');
  await page.keyboard.press('Tab');
  await expect(field).toHaveValue('Joshua ');
  await page.keyboard.type('1:9');
  // the verse text under the field is the database's
  const joshua = fx('scripture-joshua-1-9');
  await expect(page.locator('.sf-verse')).toHaveCount(1);
  await expect(page.locator('.sf-verse')).toContainText(joshua.verses[0].text);
  // a range across chapters is one block
  await field.fill('');
  await page.keyboard.type('num');
  await page.keyboard.press('Tab');
  await page.keyboard.type('25:18-26:1');
  const range = fx('scripture-numbers-25-18-26-1');
  await expect(page.locator('.sf-verse')).toHaveCount(range.verses.length);
  await expect(page.locator('.sf-verse').first()).toContainText(range.verses[0].text);
  await expect(page.locator('.sf-verse').last()).toContainText(range.verses.at(-1).text);
  // Enter places it: the block holds only the reference
  await box.evaluate(e => e.addEventListener('input', () => ((window as any).__v = (e as any).value)));
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).__v)).toBe('```scripture\nNumbers 25:18-26:1\n```');
});

test('scripture_field_escape_keeps_the_line', async ({ page }) => {
  await slashPage(page);
  const box = await slash(page);
  await page.keyboard.type('scripture');
  await page.keyboard.press('Enter');
  await expect(page.locator('.sf-input')).toBeFocused();
  await page.keyboard.type('zzz 1:1');
  await page.keyboard.press('Enter');                        // nothing the database knows: nothing is placed
  await expect(page.locator('.sf-input')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.sf')).toHaveCount(0);
  await expect(box).toBeFocused();
});

test('study_scripture_reference_only', async ({ page }) => {
  const d = fx('scripture-numbers-25-11-13');
  const text = '```scripture\nNumbers 25:11-13\n```';
  await slashPage(page, [{ kind: 'fence', lang: 'scripture', text }], { blocks: [{ n: 1, label: d.label, lines: false, verses: d.verses }] });
  const block = page.locator('.nb-scripture');
  await expect(block).toBeVisible();
  // the file holds only the reference; every word shown is the database's
  expect(text.split('\n')).toEqual(['```scripture', 'Numbers 25:11-13', '```']);
  for (const v of d.verses) await expect(block).toContainText(v.text);
  await expect(block.locator('.sv-ref')).toHaveText(d.label);
});
