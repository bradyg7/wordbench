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

  // Open in reader goes to the verse; Back returns to the place the reader left
  expect(await chapterAt(page)).toBe(26);
  await chip.click();
  await expect(panel.locator('.cp-title')).toHaveText('Numbers 25');
  await panel.getByRole('button', { name: 'Open in reader' }).click();
  await expect(panel).toHaveCount(0);
  await expect.poll(() => chapterAt(page)).toBe(25);
  await page.evaluate(() => (window as any).__wb.run('back'));
  await expect.poll(() => chapterAt(page)).toBe(26);
});
