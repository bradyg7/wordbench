import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// design/features/notebook rows 25b, 15, 44, 21, 43 (NB6 Color, NB7): a block's background, dragging a block by its grip, Scripture
// blocks side by side in columns, several blocks picked together, and the margin's drag band. No Rust here: a small page server stands in
// for `wb` (the page's blocks as text), and what the window sent is read back from the calls. The words are the test's own; the
// scripture blocks hold only a reference, which the stand-in does not read.
const TITLE = 'Blocks page';
const OPEN = '<!-- columns -->', SEP = '<!-- column -->', CLOSE = '<!-- /columns -->';
const SCR = (ref: string) => '```scripture\n' + ref + '\n```';
const WORDS = ['First reading: one.', 'Second reading: two.', 'Third reading: three.', 'Fourth reading: four.', 'Fifth reading: five.'];

interface Call { name: string; input: string }

async function openPage(page: Page, start: string[] = WORDS) {
  let texts = [...start];
  const other: string[] = [];                       // the other page ("Other page", w2): what was moved into it
  const moves: string[][] = [];                     // this page before each move (what its undo token gives back)
  const calls: Call[] = [];
  const kindOf = (t: string) => (t.startsWith('```') ? 'fence' : /^#{1,3} /.test(t) ? 'heading' : /^- \[[ xX]\] /.test(t) ? 'todo' : /^- /.test(t) ? 'item' : /^> /.test(t) ? 'quote' : 'paragraph');
  const blocks = () => {
    let pos = TITLE.length + 2;
    return { id: 'w1', folds: [], title: { text: TITLE, start: 0, end: TITLE.length },
      blocks: texts.map((text, i) => { const start = pos; pos += text.length + 2; const k = kindOf(text); return { n: i + 1, kind: k, text, start, end: start + text.length, ...(k === 'fence' ? { lang: 'scripture' } : {}), ...(k === 'item' ? { indent: 0 } : {}) }; }) };
  };
  // the stand-in's tidy: a group with fewer than two filled columns loses its markers
  const tidy = () => {
    for (let guard = 0; guard < 8; guard++) {
      const o = texts.indexOf(OPEN);
      if (o < 0) return;
      const c = texts.indexOf(CLOSE, o);
      const inner = texts.slice(o + 1, c);
      const cols = inner.join('\u0000').split(SEP).map(x => x.split('\u0000').filter(Boolean));
      if (cols.filter(x => x.length).length >= 2) return;
      texts = [...texts.slice(0, o), ...inner.filter(x => x !== SEP), ...texts.slice(c + 1)];
    }
  };
  const full = () => [TITLE, ...texts].join('\n\n');
  const entry = (id: string, title: string) => ({ id, title, kind: 'note', placed: false, label: '', preview: '', updated: '2026-11-20', created: '2026-11-20' });
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!.replace(/\.json$/, '');
    const input = decodeURIComponent(route.request().headers()['x-wb-input'] ?? '');
    const send = (json: unknown) => route.fulfill({ json });
    let m: RegExpExecArray | null;
    if (name === 'note-show-w1') {
      // a link to a block of the other page, as wb-core reads it: its first words, and whether the block is still there
      const links: unknown[] = [];
      const t = full();
      for (const [lm, bid] of [...t.matchAll(/\[\[Other page#\^(\w{6})\]\]/g)].map(x => [x, x[1]] as const)) {
        links.push({ start: lm.index!, end: lm.index! + lm[0].length, title: 'Other page', heading: `^${bid}`, shown: '', block: bid, block_words: bid === 'abc123' ? 'Read the chapter twice' : null, to: 'w2', kind: 'note', heading_ok: bid === 'abc123' });
      }
      return send({ id: 'w1', title: TITLE, kind: 'note', placed: false, text: t, updated: '2026-11-20T14:02:00', linked_from: [], also: [], threads: [], refs: [], links });
    }
    if (name === 'note-show-w2') return send({ id: 'w2', title: 'Other page', kind: 'note', placed: false, text: 'Other page\n\nIntro\n\nRead the chapter twice ^abc123', updated: '2026-11-20T14:02:00', linked_from: [], also: [], threads: [], refs: [], links: [] });
    if (name === 'page-blocks-w2') return send({ id: 'w2', folds: [], title: { text: 'Other page', start: 0, end: 10 }, blocks: [
      { n: 1, kind: 'paragraph', text: 'Intro', start: 12, end: 17 }, { n: 2, kind: 'paragraph', text: 'Read the chapter twice', bid: 'abc123', start: 19, end: 49 }] });
    if (name === 'page-scripture-w2') return send({ blocks: [] });
    if ((m = /^block-link-w1-(\d+)$/.exec(name))) {
      calls.push({ name, input });
      return send({ id: 'w1', n: Number(m[1]), block: 'abc123', title: TITLE, link: `[[${TITLE}#^abc123]]`, wrote: true });
    }
    if (name === 'page-blocks-w1') return send(blocks());
    // columns are drawn "at Full width" (row 44): the page in these tests has Appearance › Full width on
    if (name === 'page-look-w1') return send({ id: 'w1', full_width: true, small_text: false, font: 'default', toc: false, locked: false });
    if (name === 'page-scripture-w1') return send({ blocks: [] });
    if (name.startsWith('refs-plain-')) return send([]);
    if ((m = /^block-color-w1-(\d+)-(\w+)-count-(\d+)/.exec(name))) {
      calls.push({ name, input });
      const n = Number(m[1]), color = m[2], count = Number(m[3]);
      for (let i = n - 1; i < n - 1 + count; i++) {
        if (texts[i].startsWith('```') || texts[i].startsWith('<!--')) continue;
        const [, lead, rest] = /^((?:#{1,3} |> |- )?)([\s\S]*)$/.exec(texts[i])!;
        const body = rest.replace(/^<span data-bg="\w+">([\s\S]*)<\/span>$/, '$1');
        texts[i] = lead + (color === 'default' ? body : `<span data-bg="${color}">${body}</span>`);
      }
      return send({ ...blocks(), undo: { test: true } });
    }
    if ((m = /^block-rm-w1-(\d+)-count-(\d+)/.exec(name))) {
      calls.push({ name, input });
      texts.splice(Number(m[1]) - 1, Number(m[2]));
      tidy();
      return send({ ...blocks(), undo: { test: true } });
    }
    if ((m = /^block-set-w1-(\d+)/.exec(name))) {
      calls.push({ name, input });
      texts.splice(Number(m[1]) - 1, 1, input);
      return send({ ...blocks(), n: Number(m[1]), count: 1 });
    }
    if ((m = /^block-move-w1-(\d+)-page-(\w+)-count-(\d+)$/.exec(name))) {
      calls.push({ name, input });
      moves.push([...texts]);
      const gone = texts.splice(Number(m[1]) - 1, Number(m[3]));
      other.push(...gone);
      tidy();
      return send({ ...blocks(), to: m[2], at: other.length - gone.length + 1, undo: { test: true } });
    }
    if ((m = /^block-rm-w2-(\d+)-count-(\d+)$/.exec(name))) {
      calls.push({ name, input });
      other.splice(Number(m[1]) - 1, Number(m[2]));
      return send({ id: 'w2', blocks: [] });
    }
    if ((m = /^block-move-w1-(\d+)-(to-(\d+)|last|beside-(\d+)(-left)?)$/.exec(name))) {
      calls.push({ name, input });
      const n = Number(m[1]) - 1;
      const moving = texts[n];
      if (m[4]) {
        const by = texts[Number(m[4]) - 1];
        const left = !!m[5];
        texts.splice(n, 1);
        const at = texts.indexOf(by);
        const o = texts.lastIndexOf(OPEN, at);
        const c = texts.indexOf(CLOSE, at);
        const grouped = o >= 0 && c > at && !texts.slice(o + 1, at).includes(CLOSE);
        if (!grouped) texts.splice(at, 1, ...(left ? [OPEN, moving, SEP, by, CLOSE] : [OPEN, by, SEP, moving, CLOSE]));
        else {
          // a new column beside the column that holds `by`
          let a = at, z = at;
          while (texts[a - 1] !== SEP && texts[a - 1] !== OPEN) a--;
          while (texts[z + 1] !== SEP && texts[z + 1] !== CLOSE) z++;
          if (left) texts.splice(a, 0, moving, SEP); else texts.splice(z + 1, 0, SEP, moving);
        }
      } else {
        texts.splice(n, 1);
        const to = m[3] ? Number(m[3]) - 1 : texts.length + 1;
        texts.splice(to > n ? to - 1 : to, 0, moving);
      }
      tidy();
      return send({ ...blocks(), n: 1, count: 1 });
    }
    if (name === 'block-undo-w1') { calls.push({ name, input }); if (moves.length) texts = moves.pop()!; return send(blocks()); }
    if (name.startsWith('notebook-sidebar-')) return send({ ...JSON.parse(readFileSync('ui/public/fixtures/wb/notebook-sidebar-at-num-25.json', 'utf8')), pages: [{ id: 'w1', title: TITLE, kind: 'note', placed: false, anchor: '', label: '', color: null, status: null, pinned: null, order: null, parent: null, created: '2026-11-20', updated: '2026-11-20', children: [] }] });
    if (name === 'notebook-group-none') return send({ groups: [{ key: 'all', label: 'All', count: 2, entries: [entry('w1', TITLE), entry('w2', 'Other page')] }] });
    if (name === 'settings-notebook') return send({});
    if (name === 'page-sweep') return send({ operations: [], errors: [] });
    if (name === 'docs-looks') return send({ looks: [] });
    if (name === 'craft-designs') return send({ themes: {}, theme: '' });
    if (name.startsWith('docs-list-')) return send([]);
    if (name === 'template-list') return send({ templates: [] });
    if (name.startsWith('page-overview-')) return send({});
    return route.fallback();
  });
  // the Notebook's dock column is dragged wide (columns need 700 px: library L-23)
  await page.addInitScript(() => localStorage.setItem('wb.dock.v1', JSON.stringify({ wide: { left: true, right: true } })));
  await page.goto('/?at=NUM.26');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
  await page.waitForSelector('.pane-notebook');
  await page.evaluate(() => (window as any).__wb.note('w1'));
  await page.waitForSelector('.nb-block[data-n="1"]');
  return { texts: () => [...texts], other: () => [...other], calls };
}

const block = (page: Page, n: number) => page.locator(`.nb-block[data-n="${n}"]`);
const grip = (page: Page, n: number) => block(page, n).locator('> .nb-grip');

test('block_background_color', async ({ page }) => {
  const s = await openPage(page, ['Plain words', '## A heading', SCR('Num 25:11')]);
  // Color ▸ is in the menu of a text block (Background: Default and the 8 colors); not in a scripture block's
  await grip(page, 1).click({ force: true });
  await expect(page.locator('.wbm .wbm-row .wbm-label')).toHaveText(['Turn into', 'Color', 'Copy link to block', 'Duplicate', 'Move to', 'Delete']);
  await page.locator('.wbm-row', { hasText: 'Color' }).click();
  await expect(page.locator('.wbm-group')).toHaveText(['Background']);
  await expect(page.locator('.wbm-row .wbm-label')).toHaveText(['Default', 'Gray', 'Brown', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Red']);
  await page.locator('.wbm-row', { hasText: 'Yellow' }).click();
  await expect.poll(() => s.texts()[0]).toBe('<span data-bg="yellow">Plain words</span>');
  expect(s.calls.at(-1)!.name).toMatch(/^block-color-w1-1-yellow-count-1-undo/);
  // the block is washed, and its tick is on Yellow the next time
  await expect(block(page, 1)).toHaveAttribute('data-block-bg', 'yellow');
  await grip(page, 1).click({ force: true });
  await page.locator('.wbm-row', { hasText: 'Color' }).click();
  await expect(page.locator('.wbm-row', { hasText: 'Yellow' }).locator('.wbm-hint')).toHaveText('✓');
  await page.locator('.wbm-row', { hasText: 'Default' }).click();
  await expect.poll(() => s.texts()[0]).toBe('Plain words');
  await expect(block(page, 1)).not.toHaveAttribute('data-block-bg', /.+/);
  await page.keyboard.press('Escape');
  // a heading keeps its marker; a scripture block has no Color
  await grip(page, 2).click({ force: true });
  await page.locator('.wbm-row', { hasText: 'Color' }).click();
  await page.locator('.wbm-row', { hasText: 'Blue' }).click();
  await expect.poll(() => s.texts()[1]).toBe('## <span data-bg="blue">A heading</span>');
  await expect(block(page, 2)).toHaveAttribute('data-block-bg', 'blue');
  await expect(page.locator('.wbm')).toHaveCount(0);
  await grip(page, 3).click({ force: true });
  await expect(page.locator('.wbm .wbm-row .wbm-label')).not.toContainText(['Color']);
  // a fenced block carries its link id on its opening line, so it can be linked to too
  await expect(page.locator('.wbm .wbm-row .wbm-label')).toContainText(['Copy link to block']);
});

/** Drag block `n`'s grip to a point inside block `m`: x as a share of the block's width, y as a share of its height. */
async function dragTo(page: Page, n: number, m: number, x: number, y: number) {
  const box = (await block(page, m).boundingBox())!;
  await grip(page, n).hover({ force: true });
  await grip(page, n).dragTo(block(page, m), { force: true, targetPosition: { x: box.width * x, y: box.height * y } });
}

test('drag_moves_block', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', "HTML5 drag and drop is the real app runs in WebView2 (Chromium) and Playwright's WebKit does not run it");
  const s = await openPage(page);
  // a blue line shows where the block will land
  const g = await grip(page, 1).boundingBox();
  await page.mouse.move(g!.x + 4, g!.y + 4);
  await page.mouse.down();
  const target = (await block(page, 3).boundingBox())!;
  await page.mouse.move(target.x + target.width * 0.5, target.y + target.height * 0.8, { steps: 8 });
  await expect(block(page, 3)).toHaveClass(/drop-after/);
  const line = await block(page, 3).evaluate(e => { const c = getComputedStyle(e, '::after'); return { h: c.height, bg: c.backgroundColor, content: c.content }; });
  expect(line.h).toBe('2px');
  expect(line.content).not.toBe('none');
  await page.mouse.up();
  // dropping moves it: first goes after the third
  await expect.poll(() => s.texts()).toEqual([WORDS[1], WORDS[2], WORDS[0], WORDS[3], WORDS[4]]);
  expect(s.calls.at(-1)!.name).toBe('block-move-w1-1-to-4');
  // the upper half goes before
  await expect(block(page, 1)).toContainText(WORDS[1]);
  await dragTo(page, 5, 1, 0.5, 0.2);
  await expect.poll(() => s.texts()[0]).toBe(WORDS[4]);
  expect(s.calls.at(-1)!.name).toBe('block-move-w1-5-to-1');
  // nothing is left marked
  await expect(page.locator('.drop-before, .drop-after, .drop-left, .drop-right')).toHaveCount(0);
});

test('scripture_side_by_side_up_to_four', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', "HTML5 drag and drop is the real app runs in WebView2 (Chromium) and Playwright's WebKit does not run it");
  const refs = ['Num 25:11', 'Ps 106:30', 'Num 25:9', 'Ps 106:31', 'Num 25:7'];
  await page.setViewportSize({ width: 2800, height: 900 });
  const s = await openPage(page, refs.map(SCR));
  // a drop at a block's right edge puts the two in columns (wb block move --beside)
  await dragTo(page, 2, 1, 0.97, 0.5);
  await expect.poll(() => s.texts().slice(0, 5)).toEqual([OPEN, SCR(refs[0]), SEP, SCR(refs[1]), CLOSE]);
  expect(s.calls.at(-1)!.name).toBe('block-move-w1-2-beside-1');
  await expect(page.locator('.nb-columns')).toHaveCount(1);
  await expect(page.locator('.nb-column')).toHaveCount(2);
  // the markers are not drawn and the blocks keep their numbers
  await expect(page.locator('.nb-col-marker')).toHaveCount(3);
  await expect(page.locator('.nb-col-marker').first()).toBeHidden();
  const x1 = (await block(page, 2).boundingBox())!, x2 = (await block(page, 4).boundingBox())!;
  expect(Math.abs(x1.y - x2.y)).toBeLessThan(2);
  expect(x2.x).toBeGreaterThan(x1.x + x1.width - 2);
  // a third and a fourth column
  await dragTo(page, 6, 4, 0.97, 0.5);
  await expect(page.locator('.nb-column')).toHaveCount(3);
  await dragTo(page, 8, 6, 0.97, 0.5);
  await expect(page.locator('.nb-column')).toHaveCount(4);
  const boxes = await page.locator('.nb-column').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return [r.x, r.y]; }));
  expect(new Set(boxes.map(b => Math.round(b[1]))).size).toBe(1);     // four side by side at full width
  expect(new Set(boxes.map(b => Math.round(b[0]))).size).toBe(4);
  // fewer columns as the pane narrows, then one under another
  await page.setViewportSize({ width: 1000, height: 900 });
  await expect.poll(() => page.locator('.nb-column').evaluateAll(els => new Set(els.map(e => Math.round(e.getBoundingClientRect().y))).size)).toBeGreaterThan(1);
  await page.setViewportSize({ width: 620, height: 900 });
  await expect.poll(() => page.locator('.nb-column').evaluateAll(els => new Set(els.map(e => Math.round(e.getBoundingClientRect().x))).size)).toBe(1);
  await page.setViewportSize({ width: 2800, height: 900 });
  await expect(page.locator('.nb-columns')).toHaveCount(1);
  s.calls.length = 0;
});

/** The page is drawn again after a change, a moment after the server has it: mark what is on screen, then wait until none of it is left.
 *  (A key pressed on a grip that is about to be replaced goes nowhere, which is the page being drawn again, not a lost key.) */
const markOld = (page: Page) => page.evaluate(() => document.querySelectorAll('.nb-block').forEach(e => e.setAttribute('data-old', '1')));
const drawnAgain = (page: Page) => expect(page.locator('.nb-block[data-old]')).toHaveCount(0);
/** The Notebook has stopped changing: no change to it for 400 ms (an Undo draws the page again twice, once for each half of it). */
const settled = (page: Page) => page.evaluate(() => new Promise<void>(done => {
  const pane = document.querySelector('.pane-notebook')!;
  let t = window.setTimeout(() => { mo.disconnect(); done(); }, 400);
  const mo = new MutationObserver(() => { clearTimeout(t); t = window.setTimeout(() => { mo.disconnect(); done(); }, 400); });
  mo.observe(pane, { childList: true, subtree: true, attributes: true });
}));

test('several_blocks_act_together', async ({ page }) => {
  const s = await openPage(page, [...WORDS.slice(0, 3), '- an item', SCR('Num 25:11')]);
  // Shift+click picks the run from the block the caret is in
  await block(page, 1).locator('.nb-block-body').click();
  await expect(page.locator('.nb-block-input')).toBeFocused();
  await block(page, 3).locator('.nb-block-body').click({ modifiers: ['Shift'] });
  await expect(page.locator('.nb-block.nb-picked')).toHaveCount(3);
  await expect(page.locator('.nb-block-input')).toHaveCount(0);
  await settled(page);
  // the grip menu acts on all
  await grip(page, 2).click({ force: true });
  const menu = page.locator('.wbm');
  await expect(menu.locator('.wbm-group')).toHaveText(['3 blocks']);
  await expect(menu.locator('.wbm-row .wbm-label')).toHaveText(['Turn into', 'Color', 'Move to', 'Delete']);
  await menu.locator('.wbm-row', { hasText: 'Color' }).click();
  await page.locator('.wbm-row', { hasText: 'Green' }).click();
  await expect.poll(() => s.texts().slice(0, 3)).toEqual(WORDS.slice(0, 3).map(w => `<span data-bg="green">${w}</span>`));
  expect(s.calls.at(-1)!.name).toMatch(/^block-color-w1-1-green-count-3/);
  // the run is still picked: Turn into acts on each
  await expect(page.locator('.nb-block.nb-picked')).toHaveCount(3);
  await expect(page.locator('.wbm')).toHaveCount(0);
  await expect(grip(page, 1)).toBeFocused();
  await grip(page, 1).click({ force: true });
  await page.locator('.wbm-row', { hasText: 'Turn into' }).click();
  await markOld(page);
  await page.locator('.wbm-row .wbm-label', { hasText: /^Quote$/ }).click();
  await expect.poll(() => s.texts().slice(0, 3)).toEqual(WORDS.slice(0, 3).map(w => `> <span data-bg="green">${w}</span>`));
  await drawnAgain(page);
  // Del on the grip deletes them all, with Undo
  await expect(page.locator('.nb-block.nb-picked')).toHaveCount(3);
  await grip(page, 3).focus();
  await page.keyboard.press('Delete');
  await expect.poll(() => s.texts().length).toBe(2);
  expect(s.calls.at(-1)!.name).toMatch(/^block-rm-w1-1-count-3/);
  await expect(page.locator('.block-deletion')).toContainText('Deleted');
  // dragging across blocks picks them; Esc lets them go
  await block(page, 1).locator('.nb-block-body').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.nb-block.nb-picked')).toHaveCount(1);       // Esc picks the block the caret is in
  await expect(block(page, 1)).toHaveClass(/nb-picked/);
  await expect(grip(page, 1)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.nb-block.nb-picked')).toHaveCount(0);
  const a = (await block(page, 1).locator('.nb-block-body').boundingBox())!, z = (await block(page, 2).boundingBox())!;
  await page.mouse.move(a.x + 20, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(z.x + z.width / 2, z.y + z.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator('.nb-block.nb-picked')).toHaveCount(2);
  await expect(page.locator('.nb-block-input')).toHaveCount(0);           // the drag did not start writing
});

test('band_selects_blocks', async ({ page }) => {
  await openPage(page);
  const wrap = (await page.locator('.nb-blocks').boundingBox())!;
  const b2 = (await block(page, 2).boundingBox())!, b4 = (await block(page, 4).boundingBox())!;
  // from the margin to the right of the blocks, across blocks 2 to 4
  const x = wrap.x + wrap.width + 8;
  await page.mouse.move(x, b2.y + b2.height / 2);
  await page.mouse.down();
  await page.mouse.move(wrap.x + 200, b4.y + b4.height / 2, { steps: 8 });
  const band = page.locator('.nb-band');
  await expect(band).toBeVisible();
  const r = (await band.boundingBox())!;
  expect(r.y).toBeCloseTo(b2.y + b2.height / 2, 0);
  expect(r.y + r.height).toBeCloseTo(b4.y + b4.height / 2, 0);
  await expect(page.locator('.nb-block.nb-picked')).toHaveCount(3);
  await expect(block(page, 2)).toHaveClass(/nb-picked/);
  await expect(block(page, 4)).toHaveClass(/nb-picked/);
  // the band follows the pointer: back up, fewer are touched
  await page.mouse.move(wrap.x + 200, b2.y + b2.height - 2, { steps: 4 });
  await expect(page.locator('.nb-block.nb-picked')).toHaveCount(1);
  await page.mouse.up();
  await expect(band).toHaveCount(0);
  // nothing was written
  await expect(page.locator('.nb-block-input')).toHaveCount(0);
});

test('picks_only_the_blocks_touched_in_columns', async ({ page }) => {
  // two columns of three: after a lead line, block numbers run down the first column then the second, so a run of numbers is not what was touched
  await page.setViewportSize({ width: 2800, height: 900 });
  const col = ['A one', 'A two', 'A three', 'B one', 'B two', 'B three'];
  const s = await openPage(page, ['Lead line', OPEN, col[0], col[1], col[2], SEP, col[3], col[4], col[5], CLOSE]);
  await expect(page.locator('.nb-column')).toHaveCount(2);
  const picked = () => page.locator('.nb-block.nb-picked').evaluateAll(els => els.map(e => Number((e as HTMLElement).dataset.n)));
  // the margin's band across the middle row touches A two (4) and B two (8) only
  const wrap = (await page.locator('.nb-blocks').boundingBox())!;
  const a2 = (await block(page, 4).boundingBox())!;
  await page.mouse.move(wrap.x + wrap.width + 8, a2.y + 2);
  await page.mouse.down();
  await page.mouse.move(wrap.x + 40, a2.y + a2.height - 2, { steps: 8 });
  await expect.poll(picked).toEqual([4, 8]);
  await page.mouse.up();
  // a drag from A one to B two picks the four blocks the pointer crossed, not A three
  await page.keyboard.press('Escape');
  await page.mouse.click(wrap.x - 20, wrap.y - 20);
  await expect(page.locator('.nb-block.nb-picked')).toHaveCount(0);
  const a1 = (await block(page, 3).locator('.nb-block-body').boundingBox())!, b2 = (await block(page, 8).locator('.nb-block-body').boundingBox())!;
  await page.mouse.move(a1.x + 20, a1.y + a1.height / 2);
  await page.mouse.down();
  await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2, { steps: 8 });
  await page.mouse.up();
  expect(await picked()).toEqual([3, 4, 7, 8]);
  // the grip menu acts on those four only
  await grip(page, 4).click({ force: true });
  await page.locator('.wbm-row', { hasText: 'Color' }).click();
  await page.locator('.wbm-row', { hasText: 'Green' }).click();
  await expect.poll(() => s.calls.filter(c => c.name.startsWith('block-color-')).map(c => c.name.replace(/-count.*/, ''))).toEqual(['block-color-w1-3-green', 'block-color-w1-7-green']);
  const t = s.texts();
  expect(t[4]).toBe(col[2]);                    // A three is untouched
  expect(t[8]).toBe(col[5]);                    // so is B three
});

test('move_block_to_another_page', async ({ page }) => {
  const s = await openPage(page);
  // Move to is in the block menu (Ctrl+Shift+P); the page chooser is the one menu, without this page, and filters as you type
  await grip(page, 2).click({ force: true });
  await page.locator('.wbm-row', { hasText: 'Move to' }).click();
  const chooser = page.locator('.wbm[aria-label="Move to"]');
  await expect(chooser.locator('.wbm-row .wbm-label')).toHaveText(['Other page']);
  await chooser.locator('.wbm-row', { hasText: 'Other page' }).click();
  await expect.poll(() => s.other()).toEqual([WORDS[1]]);
  expect(s.calls.at(-1)!.name).toBe('block-move-w1-2-page-w2-count-1');
  expect(s.texts()).toEqual([WORDS[0], ...WORDS.slice(2)]);
  await expect(page.locator('.nb-block')).toHaveCount(4);
  await settled(page);
  // the keys: Ctrl+Shift+P from the open menu
  await grip(page, 1).click({ force: true });
  await page.keyboard.press('Control+Shift+P');
  await expect(page.locator('.wbm[aria-label="Move to"] .wbm-row')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect.poll(() => s.other()).toEqual([WORDS[1], WORDS[0]]);
  await expect(page.locator('.nb-block')).toHaveCount(3);
  await expect(page.locator('.wbm')).toHaveCount(0);
  await settled(page);
  // several picked blocks go together, in the page's order, last in the other page
  await block(page, 1).locator('.nb-block-body').click();
  await block(page, 3).locator('.nb-block-body').click({ modifiers: ['Shift'] });
  await expect(page.locator('.nb-block.nb-picked')).toHaveCount(3);
  await settled(page);                                   // the block just written in is saved and the page drawn again first
  await grip(page, 2).click({ force: true });
  await page.locator('.wbm-row', { hasText: 'Move to' }).click();
  await expect(page.locator('.wbm[aria-label="Move to"] .wbm-group')).toHaveText(['Move 3 blocks to']);
  await page.locator('.wbm[aria-label="Move to"] .wbm-row', { hasText: 'Other page' }).click();
  await expect.poll(() => s.texts().length).toBe(0);
  expect(s.other()).toEqual([WORDS[1], WORDS[0], ...WORDS.slice(2)]);
  expect(s.calls.at(-1)!.name).toBe('block-move-w1-1-page-w2-count-3');
});

test('move_to_says_where_and_undoes', async ({ page }) => {
  const s = await openPage(page);
  // one block: "Moved to Other page · Undo"; Undo moves it back (this page's Undo, then it is taken out of the other page)
  await grip(page, 2).click({ force: true });
  await page.locator('.wbm-row', { hasText: 'Move to' }).click();
  await page.locator('.wbm[aria-label="Move to"] .wbm-row', { hasText: 'Other page' }).click();
  const said = page.locator('.block-deletion');
  await expect(said).toContainText('Moved to Other page · Undo');
  await expect.poll(() => s.other()).toEqual([WORDS[1]]);
  await markOld(page);
  await said.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => s.texts()).toEqual(WORDS);
  await expect.poll(() => s.other()).toEqual([]);
  expect(s.calls.map(c => c.name).slice(-2)).toEqual(['block-undo-w1', 'block-rm-w2-1-count-1']);
  await settled(page);
  // several picked blocks: Move to shows Ctrl+Shift+P in the picked-blocks menu, and the key opens the chooser from the open menu
  await block(page, 1).locator('.nb-block-body').click();
  await block(page, 3).locator('.nb-block-body').click({ modifiers: ['Shift'] });
  await expect(page.locator('.nb-block.nb-picked')).toHaveCount(3);
  await settled(page);                                   // the block just written in is saved and the page drawn again first
  await grip(page, 2).click({ force: true });
  const menu = page.locator('.wbm[aria-label="Block actions"]');
  await expect(menu.locator('.wbm-row', { hasText: 'Move to' }).locator('.wbm-hint')).toHaveText('Ctrl+Shift+P');
  await page.keyboard.press('Control+Shift+P');
  await expect(page.locator('.wbm[aria-label="Move to"] .wbm-group')).toHaveText(['Move 3 blocks to']);
  await page.locator('.wbm[aria-label="Move to"] .wbm-row', { hasText: 'Other page' }).click();
  await expect(page.locator('.block-deletion')).toContainText('Moved to Other page · Undo', { timeout: 15000 });
  await expect.poll(() => s.texts()).toEqual(WORDS.slice(3));
  await page.locator('.block-deletion').getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => s.texts()).toEqual(WORDS);
  await expect.poll(() => s.other()).toEqual([]);
});

test('link_to_block_flow', async ({ page, context, browserName }) => {
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const LINK = '[[Other page#^abc123]]';
  const s = await openPage(page, ['Before the link', `See ${LINK} for more`, 'See [[Other page#^zzzzzz]] too']);
  // 18a: Copy link to block is in the block menu of a text block; it asks wb-core for the link (which writes the id) and copies it
  await grip(page, 1).click({ force: true });
  await page.locator('.wbm-row', { hasText: 'Copy link to block' }).click();
  await expect.poll(() => s.calls.at(-1)?.name).toBe('block-link-w1-1');
  await expect(page.locator('.toast, [role=status]').filter({ hasText: 'Link to block copied' }).first()).toBeVisible();
  if (browserName === 'chromium') expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('[[Blocks page#^abc123]]');
  // 18b: pasted in another page the link is a chip "Page A › first words", not the brackets
  const chip = block(page, 2).locator('a.nb-blocklink');
  await expect(chip).toHaveText('Other page › Read the chapter twice');
  // 18c: clicking it opens that page scrolled to the block, which glows; Back returns
  await chip.click();
  const target = page.locator('.nb-block[data-bid="abc123"]');
  await expect(target).toBeVisible();
  await expect(target).toHaveClass(/flash/);
  await expect(page.locator('.nb-return')).toContainText('Back to');
  await page.locator('.nb-return').click();
  await expect(page.locator('.nb-block[data-n="2"] a.nb-blocklink')).toBeVisible();
  // a link whose id is gone opens the page quietly with "That block is gone"
  await block(page, 3).locator('a.nb-blocklink').click();
  await expect(page.locator('.toast, [role=status]').filter({ hasText: 'That block is gone' }).first()).toBeVisible();
  await expect(page.locator('.nb-block.flash')).toHaveCount(0);
});
