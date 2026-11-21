import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// design/features/notebook row 12 (NB5, accepted 2026-11-20): `@` then a reference, the link chip, the compact chapter panel.
// The file keeps the reference's plain text (decided 2026-11-21); the chip is how the page draws a reference it recognises.
// Scripture here is read from the generated fixtures (scripts/fixtures.mjs), never typed.
const TITLE = 'Chip page';
const fixture = (name: string) => JSON.parse(readFileSync(`ui/public/fixtures/wb/${name}.json`, 'utf8'));
const verse11: string = fixture('scripture-numbers-25-11').verses[0].text;
const chapter25: { v: number; text: string }[] = fixture('scripture-numbers-25').verses;

const bodies = [{ kind: 'paragraph', text: 'Zeal in a plain line' }, { kind: 'paragraph', text: 'Also Numbers 25:11 here' }];

async function openPage(page: Page, at = 'NUM.26') {
  const blocks = () => {
    let pos = TITLE.length + 2;
    return { id: 'w1', folds: [], title: { text: TITLE, start: 0, end: TITLE.length },
      blocks: bodies.map((b, i) => { const start = pos; pos += b.text.length + 2; return { n: i + 1, ...b, start, end: start + b.text.length }; }) };
  };
  const detail = () => {
    const b2 = blocks().blocks[1];
    const start = b2.start + 'Also '.length;
    return { id: 'w1', title: TITLE, kind: 'note', placed: false, text: [TITLE, ...bodies.map(b => b.text)].join('\n\n'), linked_from: [], also: [], threads: [],
      refs: [{ start, end: start + 'Numbers 25:11'.length, ref: 'Numbers 25:11', hash: '#NUM.25:11' }] };
  };
  const entry = (id: string, title: string, kind: string, extra: object = {}) => ({ id, title, kind, placed: false, label: '', preview: '', updated: '2026-11-20', created: '2026-11-20', ...extra });
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!;
    const send = (json: unknown) => route.fulfill({ json });
    if (name === 'note-show-w1.json') return send(detail());
    if (name === 'page-blocks-w1.json') return send(blocks());
    // the side reader asks for the passage by its words (wb text "Numbers 25:11" --version KJV --json)
    if (name === 'text-numbers-25-11-version-kjv-json.json') return send(fixture('text-numbers-25-11-json'));
    if (name.startsWith('refs-plain-')) {
      // the finder `wb refs --plain` stands in as a regex over what the block being written holds now
      const text: string = await page.evaluate(() => (document.querySelector('.nb-block-input') as any)?.value ?? '');
      return send([...text.matchAll(/Numbers 25:11/g)].map(m => ({ start: [...text.slice(0, m.index)].length, end: [...text.slice(0, m.index! + m[0].length)].length, ref: 'Numbers 25:11', hash: '#NUM.25:11' })));
    }
    if (name.startsWith('block-set-w1-')) return route.fulfill({ status: 500, body: 'kept' });
    if (name === 'notebook-group-none.json') return send({ groups: [{ key: 'all', label: 'All', count: 3, entries: [
      entry('w1', TITLE, 'note'), entry('p2', 'Tuesday study', 'note'), entry('t1', 'Phinehas', 'thread'),
    ] }] });
    if (name === 'settings-notebook.json') return send({});
    if (name === 'page-sweep.json') return send({ operations: [], errors: [] });
    if (name === 'docs-looks.json') return send({ looks: [] });
    if (name === 'craft-designs.json') return send({ themes: {}, theme: '' });
    if (name.startsWith('docs-list-')) return send([]);
    if (name === 'template-list.json') return send({ templates: [] });
    if (name.startsWith('page-overview-')) return send({});
    return route.fallback();
  });
  await page.goto(`/?at=${at}`);
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
  await page.waitForSelector('.pane-notebook');
  await page.evaluate(() => (window as any).__wb.note('w1'));
}

const chapterAt = (page: Page) => page.evaluate(() => (window as any).__wb.drawn.chapter.chapter);

test('at_verse_chip_popup', async ({ page }) => {
  await openPage(page);

  // `@` after a space opens one menu of verses, pages, folders and Today
  await page.locator('.nb-block[data-n="1"] .nb-block-body').click();
  const box = page.locator('.nb-block-input');
  await expect(box).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.type(' @');
  await expect(page.locator('.wbm')).toBeVisible();
  await expect(page.locator('.wbm-group')).toHaveText(['Today', 'Pages', 'Folders']);
  await expect(page.locator('.wbm-row .wbm-label')).toHaveText(['Today', 'Tuesday study', 'Phinehas']);
  // a typed reference offers that verse, its first words read from the database
  await page.keyboard.type('num 25:11');
  await expect(page.locator('.wbm-group').first()).toHaveText('Verses');
  await expect(page.locator('.wbm-row').first()).toContainText('Numbers 25:11');
  await expect(page.locator('.wbm-row').first()).toContainText(verse11.slice(0, 20));
  await page.keyboard.press('Enter');
  // the file keeps only the plain reference (no @, no other form)
  expect(await box.evaluate(e => (e as any).value as string)).toBe('Zeal in a plain line Numbers 25:11');
  await expect(page.locator('.wbm')).toHaveCount(0);

  // Esc on the menu puts the @ back out of the line
  await page.keyboard.type(' @');
  await expect(page.locator('.wbm')).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await box.evaluate(e => (e as any).value as string)).toBe('Zeal in a plain line Numbers 25:11 ');
  // a page is placed as a link to it
  await page.keyboard.type('@tues');
  await expect(page.locator('.wbm-row .wbm-label')).toHaveText(['Tuesday study']);
  await page.keyboard.press('Enter');
  expect(await box.evaluate(e => (e as any).value as string)).toBe('Zeal in a plain line Numbers 25:11 [[Tuesday study]]');
  await page.keyboard.press('Escape');   // leave the block (a save is refused in this test)

  // the page draws a reference as a chip; its words stay the reference
  const chip = page.locator('.nb-chip');
  await expect(chip).toHaveCount(1);
  await expect(chip).toHaveText('Numbers 25:11');
  await chip.click();
  const panel = page.locator('.cp');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.cp-title')).toHaveText('Numbers 25');
  // the chapter is read from the database, verbatim; the chip's verse is marked
  await expect(panel.locator('.cp-verse')).toHaveCount(chapter25.length);
  await expect(panel.locator('.cp-verse.cp-on')).toHaveCount(1);
  await expect(panel.locator('.cp-verse.cp-on')).toContainText(verse11);
  // header: grip, reference, ← →, Open in reader, close; snapped to the top-right corner, inside the window
  for (const n of ['Previous chapter', 'Next chapter', 'Close']) await expect(panel.getByRole('button', { name: n })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Open in reader' })).toBeVisible();
  const vp = page.viewportSize()!;
  await expect(panel).toHaveAttribute('data-corner', 'top-right');
  let r = (await panel.boundingBox())!;
  expect(r.x + r.width).toBeLessThanOrEqual(vp.width);
  expect(vp.width - (r.x + r.width)).toBeLessThan(20);
  expect(r.y).toBeLessThan(80);
  expect(r.y + r.height).toBeLessThanOrEqual(vp.height);
  // sized to its text: it never grows past the window, and a short chapter is not padded to fill it
  // ← → change the chapter
  await panel.getByRole('button', { name: 'Next chapter' }).click();
  await expect(panel.locator('.cp-title')).toHaveText('Numbers 26');
  await expect(panel.locator('.cp-verse.cp-on')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Previous chapter' }).click();
  await panel.getByRole('button', { name: 'Previous chapter' }).click();
  await expect(panel.locator('.cp-title')).toHaveText('Numbers 24');
  await panel.getByRole('button', { name: 'Next chapter' }).click();
  await expect(panel.locator('.cp-title')).toHaveText('Numbers 25');
  // dragging by the header and letting go snaps it to the nearest corner
  const grip = (await panel.locator('.cp-head').boundingBox())!;
  await page.mouse.move(grip.x + 12, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(40, vp.height - 40, { steps: 6 });
  await page.mouse.up();
  await expect(panel).toHaveAttribute('data-corner', 'bottom-left');
  r = (await panel.boundingBox())!;
  expect(r.x).toBeLessThan(20);
  expect(r.y + r.height).toBeLessThanOrEqual(vp.height);
  expect(vp.height - (r.y + r.height)).toBeLessThan(20);
  // Esc closes it
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);

  // Open beside (12d) sends the passage to the side reader at the verse; the page stays, and the reader keeps its place
  expect(await chapterAt(page)).toBe(26);
  await chip.click();
  await expect(panel.getByRole('button', { name: 'Open beside' })).toBeVisible();
  await panel.getByRole('button', { name: 'Open beside' }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.locator('.pane-reader2 .reader2 .vn-asked[data-v="11"]')).toBeAttached();
  await expect(page.locator('.pane-reader2 .reader2 .vn-asked')).toHaveCount(1);
  expect(await chapterAt(page)).toBe(26);
  // on a phone the front pane is a full-screen sheet over the reader (dock.ts, compact), so the page is behind it, out of the screen;
  // wider, the page stays in view beside the side reader
  await expect(page.locator('.pane-reader2')).toBeVisible();
  if (vp.width < 600) await page.evaluate(() => (window as any).__wb.note('w1'));   // the way back to the page on a phone
  await expect(page.locator('.nb-block[data-n="2"]')).toBeVisible();

  // Open in reader goes to the verse; Back returns to the place the reader left
  await chip.click();
  await expect(panel.locator('.cp-title')).toHaveText('Numbers 25');
  await panel.getByRole('button', { name: 'Open in reader' }).click();
  await expect(panel).toHaveCount(0);
  await expect.poll(() => chapterAt(page)).toBe(25);
  await page.evaluate(() => (window as any).__wb.run('back'));
  await expect.poll(() => chapterAt(page)).toBe(26);
});

test('chip_while_writing', async ({ page }) => {
  // a reference is a chip while its block is being written, not only after it is left; the file keeps the plain words
  await openPage(page);
  await page.locator('.nb-block[data-n="2"] .nb-block-body').click({ position: { x: 4, y: 8 } });
  const box = page.locator('.nb-block-input');
  await expect(box).toBeFocused();
  const chip = box.locator('.nb-chip');
  await expect(chip).toHaveCount(1);
  await expect(chip).toHaveText('Numbers 25:11');
  const md = () => box.evaluate(e => (e as any).value as string);
  const caret = () => box.evaluate(e => [(e as any).selectionStart, (e as any).selectionEnd]);
  expect(await md()).toBe('Also Numbers 25:11 here');
  // the caret walks through the chip a letter at a time, in the file's offsets
  await page.keyboard.press('Home');
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  expect(await caret()).toEqual([5, 5]);
  for (let i = 0; i < 13; i++) await page.keyboard.press('ArrowRight');
  expect(await caret()).toEqual([18, 18]);
  // typing next to the chip: the words are still the reference's, the new letter is outside it after a moment
  await page.keyboard.type('x');
  expect(await md()).toBe('Also Numbers 25:11x here');
  await expect(chip).toHaveText('Numbers 25:11');
  expect(await caret()).toEqual([19, 19]);
  // Backspace crosses the chip: letter by letter, and the chip goes when the reference is no longer whole
  await page.keyboard.press('Backspace');
  expect(await md()).toBe('Also Numbers 25:11 here');
  await page.keyboard.press('Backspace');
  expect(await md()).toBe('Also Numbers 25:1 here');
  await expect(chip).toHaveCount(0);
  for (let i = 0; i < 12; i++) await page.keyboard.press('Backspace');
  expect(await md()).toBe('Also  here');
  expect(await caret()).toEqual([5, 5]);
  // a reference typed in is a chip a moment after it is whole; the round trip is the same words
  await page.keyboard.type('Numbers 25:11');
  expect(await md()).toBe('Also Numbers 25:11 here');
  await expect(chip).toHaveCount(1);
  await expect(chip).toHaveText('Numbers 25:11');
  expect(await caret()).toEqual([18, 18]);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.type('!');
  expect(await md()).toBe('Also Numbers 25:11 !here');
  // Ctrl+click on the chip opens the chapter panel; a plain click only places the caret
  await chip.click();
  await expect(page.locator('.cp')).toHaveCount(0);
  await chip.click({ modifiers: ['Control'] });
  await expect(page.locator('.cp')).toBeVisible();
  await expect(page.locator('.cp .cp-title')).toHaveText('Numbers 25');
});
