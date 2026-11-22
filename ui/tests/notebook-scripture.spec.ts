import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// design/features/notebook rows 11, 39 and 40 (NB8): on scripture in a page the selection bar is Mark ▾ (the Legend's styles, the menu under
// the bar) and Margin note (a card beside the words). A mark is drawn on the scripture's own words from the chapter's marks, the reader's own
// list; a margin note is that verse's note. There is no Rust here: a small server stands in for `wb` and keeps the calls the window made. The
// scripture is read from the generated fixtures (scripts/fixtures.mjs), never typed; the note's words are the test's own.
const TITLE = 'Scripture page';
const fixture = (name: string) => JSON.parse(readFileSync(`ui/public/fixtures/wb/${name}.json`, 'utf8'));
const verse = fixture('scripture-numbers-25-11');
const words: { t: string; i: number }[] = verse.verses[0].parts.filter((p: any) => p.i !== undefined);
const [W1, W2] = [words[4], words[6]];                                 // the selection: from the fifth word to the seventh

const bodies = [{ kind: 'paragraph', text: 'Words before' }, { kind: 'fence', lang: 'scripture', text: '```scripture\nNumbers 25:11\n```' }];

interface Call { name: string; input: string }

async function openPage(page: Page) {
  const calls: Call[] = [];
  const blocks = () => {
    let pos = TITLE.length + 2;
    return { id: 'w1', folds: [], title: { text: TITLE, start: 0, end: TITLE.length },
      blocks: bodies.map((b, i) => { const start = pos; pos += b.text.length + 2; return { n: i + 1, ...b, start, end: start + b.text.length }; }) };
  };
  const entry = (id: string, title: string) => ({ id, title, kind: 'note', placed: false, label: '', preview: '', updated: '2026-11-20', created: '2026-11-20' });
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!.replace(/\.json$/, '');
    const input = decodeURIComponent(route.request().headers()['x-wb-input'] ?? '');
    const send = (json: unknown) => route.fulfill({ json });
    if (name === 'note-show-w1') return send({ id: 'w1', title: TITLE, kind: 'note', placed: false, text: [TITLE, ...bodies.map(b => b.text)].join('\n\n'), updated: '2026-11-20T14:02:00', linked_from: [], also: [], threads: [], refs: [] });
    if (name === 'page-blocks-w1') return send(blocks());
    if (name === 'page-scripture-w1') return send({ blocks: [{ n: 2, reference: 'Numbers 25:11', label: verse.label, version: 'KJV', lines: false, marks: false, verses: verse.verses }] });
    let m: RegExpExecArray | null;
    if ((m = /^mark-add-(num-25-11-\d+(?:-25-11-\d+)?)-style-(.+)$/.exec(name))) {
      calls.push({ name, input });
      const [, a, b = a] = /^num-25-11-(\d+)(?:-25-11-(\d+))?$/.exec(m[1])!;
      return send({ id: 'made-1', kind: 'highlight', color: 'pink', at: `NUM.25:11.${a}-25:11.${b}`, created: '2026-11-21T10:00:00', legend: 'Fixture promise', style: 'highlight:pink' });
    }
    if (name.startsWith('mark-note-num-25-11-')) {
      calls.push({ name, input });
      return send({ id: 'note-1', at: 'NUM.25:11', label: 'Numbers 25:11', kind: 'verse', v1: 11, v2: 11, text: 'See Numbers 25:18', grew: [] });
    }
    if (name.startsWith('refs-plain-see-numbers-25-18')) return send([{ start: 4, end: 17, ref: 'Numbers 25:18', hash: '#NUM.25:18' }]);
    if (name.startsWith('refs-plain-')) return send([]);
    if (name.startsWith('notebook-sidebar-')) return send({ ...fixture('notebook-sidebar-at-num-25'), pages: [{ id: 'w1', title: TITLE, kind: 'note', placed: false, anchor: '', label: '', color: null, status: null, pinned: null, order: null, parent: null, created: '2026-11-20', updated: '2026-11-20', children: [] }] });
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
  await page.addInitScript(() => localStorage.setItem('wb.dock.v1', JSON.stringify({ wide: { left: true, right: true } })));
  await page.goto('/?at=NUM.26');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
  await page.waitForSelector('.pane-notebook');
  await page.evaluate(() => (window as any).__wb.note('w1'));
  await page.waitForSelector('.sv-words .w');
  return { calls };
}

/** Select the words from `a` to `b` of verse 11 the way a drag does. */
async function select(page: Page, a: number, b: number) {
  await page.evaluate(([x, y]) => {
    const w = (i: number) => document.querySelector(`.sv-words .w[data-v="11"][data-i="${i}"]`)!;
    const r = document.createRange();
    r.setStartBefore(w(x));
    r.setEndAfter(w(y));
    const s = getSelection()!;
    s.removeAllRanges();
    s.addRange(r);
  }, [a, b]);
}

const bar = (page: Page) => page.locator('.nb-selbar');

test('mark_from_a_page_step_by_step', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1300 });   // room under the bar for the menu (it opens above when there is none)
  const s = await openPage(page);
  // 39a: the bar above the selection is Mark ▾ and Margin note, nothing else (scripture is not written in)
  await select(page, W1.i, W2.i);
  await expect(bar(page)).toBeVisible();
  await expect(bar(page).locator('.nb-sb-btn')).toHaveText(['Mark ▾', 'Margin note']);
  const sel = (await page.evaluate(() => { const r = getSelection()!.getRangeAt(0).getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; }));
  const b = (await bar(page).boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(sel.bottom);
  // 39b: Mark ▾ opens the Legend's styles under the bar, attached to it
  await bar(page).getByRole('button', { name: 'Mark' }).click();
  const menu = page.locator('.wbm');
  await expect(menu).toBeVisible();
  await expect(menu.locator('.wbm-group')).toHaveText(['Legend']);
  await expect(menu).toContainText('Fixture promise');
  await expect(menu).toContainText('Fixture double');
  await expect(menu).not.toContainText('arrow');
  const mb = (await menu.boundingBox())!, btn = (await bar(page).getByRole('button', { name: 'Mark' }).boundingBox())!;
  expect(mb.y).toBeGreaterThanOrEqual(btn.y + btn.height - 1);
  expect(Math.abs(mb.x - btn.x)).toBeLessThan(40);
  // searchable
  await page.keyboard.type('promise');
  await expect(menu.locator('.wbm-row')).toHaveCount(1);
  // 39c: picking a style puts the mark on those words, on the scripture's own words in the page
  const before = await page.locator('.sv-words .w[style*="--hl-pink"]').count();
  expect(before).toBe(0);
  await page.keyboard.press('Enter');
  await expect.poll(() => s.calls.length).toBe(1);
  expect(s.calls[0].name).toBe(`mark-add-num-25-11-${W1.i}-25-11-${W2.i}-style-highlight-pink`);
  const pink = page.locator('.sv-words .w[style*="--hl-pink"]');
  await expect(pink).toHaveCount(3);
  await expect(pink.first()).toHaveAttribute('data-i', String(W1.i));
  await expect(pink.last()).toHaveAttribute('data-i', String(W2.i));
  await expect(bar(page)).toHaveCount(0);
  // the words are the same words: the verse still reads as the database has it
  expect(await page.locator('.sv-words .sv-t').first().evaluate(e => e.textContent)).toBe(verse.verses[0].text);
});

test('mark_from_a_page_is_the_reader_s_mark', async ({ page }) => {
  const s = await openPage(page);
  // the marks already on the chapter (the reader's list, `wb marks`) are drawn on the page's words: the fixture's circle is on words 2 to 5 of the verse
  await expect(page.locator('.sv-words .mk-shape').first()).toBeAttached();
  // a mark made here is made for the place the words have in the chapter, as the reader makes it: NUM.25:11.<first>-25:11.<last>
  await select(page, W1.i, W2.i);
  await bar(page).getByRole('button', { name: 'Mark' }).click();
  await page.locator('.wbm-row', { hasText: 'Fixture promise' }).click();
  await expect.poll(() => s.calls.length).toBe(1);
  expect(s.calls[0].name).toMatch(/^mark-add-num-25-11-\d+-25-11-\d+-style-/);
  // a word alone is a mark on that word
  await select(page, W1.i, W1.i);
  await bar(page).getByRole('button', { name: 'Mark' }).click();
  await page.locator('.wbm-row', { hasText: 'Fixture promise' }).click();
  await expect.poll(() => s.calls.length).toBe(2);
  expect(s.calls[1].name).toBe(`mark-add-num-25-11-${W1.i}-style-highlight-pink`);
});

test('margin_note_beside_the_words', async ({ page }) => {
  const s = await openPage(page);
  await select(page, W1.i, W2.i);
  await bar(page).getByRole('button', { name: 'Margin note' }).click();
  const card = page.locator('.pm-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Margin note · Numbers 25:11');
  // beside the words: right of the scripture block, level with the selection
  const blockBox = (await page.locator('.nb-block[data-n="2"]').boundingBox())!, c0 = (await card.boundingBox())!;
  const vw = page.viewportSize()!.width;
  if (c0.x + c0.width <= vw - 8 && blockBox.x + blockBox.width + 12 + c0.width <= vw - 8) {
    expect(c0.x).toBeGreaterThanOrEqual(blockBox.x + blockBox.width - 2);
    expect(c0.y).toBeGreaterThanOrEqual(blockBox.y - 4);
    expect(c0.y).toBeLessThanOrEqual(blockBox.y + blockBox.height);
  } else {
    expect(c0.y).toBeGreaterThanOrEqual(blockBox.y);      // no room beside (a phone): under the words
  }
  // nothing is kept before there are words
  expect(s.calls.length).toBe(0);
  // written: it is that verse's margin note (wb mark note NUM.25:11 "…"); the reference in its words is a link chip
  await expect(card.locator('textarea')).toBeFocused();
  await page.keyboard.type('See Numbers 25:18');
  await page.keyboard.press('Control+Enter');
  await expect.poll(() => s.calls.length).toBe(1);
  expect(s.calls[0].name).toBe('mark-note-num-25-11-see-numbers-25-18');
  const chip = card.locator('.nb-chip');
  await expect(chip).toHaveText('Numbers 25:18');
  await expect(card.locator('.pm-text')).toContainText('See');
  // the chip opens the compact chapter panel
  await chip.click();
  await expect(page.locator('.cp')).toBeVisible();
  await expect(page.locator('.cp .cp-title')).toHaveText('Numbers 25');
  await page.keyboard.press('Escape');
  await expect(page.locator('.cp')).toHaveCount(0);
  // the grip drags the card
  const dx = c0.x >= 130 ? -120 : 30;
  const grip = (await card.locator('.pm-grip').boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 + dx, grip.y + grip.height / 2 + 90, { steps: 6 });
  await page.mouse.up();
  const c1 = (await card.boundingBox())!;
  expect(Math.abs(c1.x - c0.x - dx)).toBeLessThan(2);
  expect(Math.abs(c1.y - c0.y - 90)).toBeLessThan(2);
});
