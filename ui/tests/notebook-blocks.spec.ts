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
    if (name === 'note-show-w1') return send({ id: 'w1', title: TITLE, kind: 'note', placed: false, text: full(), updated: '2026-11-20T14:02:00', linked_from: [], also: [], threads: [], refs: [] });
    if (name === 'page-blocks-w1') return send(blocks());
    if (name === 'page-scripture-w1') return send({ blocks: [] });
    if (name.startsWith('refs-plain-')) return send([]);
    let m: RegExpExecArray | null;
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
    if (name === 'block-undo-w1') { calls.push({ name, input }); return send(blocks()); }
    if (name.startsWith('notebook-sidebar-')) return send({ ...JSON.parse(readFileSync('ui/public/fixtures/wb/notebook-sidebar-at-num-25.json', 'utf8')), pages: [{ id: 'w1', title: TITLE, kind: 'note', placed: false, anchor: '', label: '', color: null, status: null, pinned: null, order: null, parent: null, created: '2026-11-20', updated: '2026-11-20', children: [] }] });
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
  // the Notebook's dock column is dragged wide (columns need 700 px: library L-23)
  await page.addInitScript(() => localStorage.setItem('wb.dock.v1', JSON.stringify({ wide: { left: true, right: true } })));
  await page.goto('/?at=NUM.26');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
  await page.waitForSelector('.pane-notebook');
  await page.evaluate(() => (window as any).__wb.note('w1'));
  await page.waitForSelector('.nb-block[data-n="1"]');
  return { texts: () => [...texts], calls };
}

const block = (page: Page, n: number) => page.locator(`.nb-block[data-n="${n}"]`);
const grip = (page: Page, n: number) => block(page, n).locator('> .nb-grip');

test('block_background_color', async ({ page }) => {
  const s = await openPage(page, ['Plain words', '## A heading', SCR('Num 25:11')]);
  // Color ▸ is in the menu of a text block (Background: Default and the 8 colors); not in a scripture block's
  await grip(page, 1).click({ force: true });
  await expect(page.locator('.wbm .wbm-row .wbm-label')).toHaveText(['Turn into', 'Color', 'Duplicate', 'Delete']);
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

test('several_blocks_act_together', async ({ page }) => {
  const s = await openPage(page, [...WORDS.slice(0, 3), '- an item', SCR('Num 25:11')]);
  // Shift+click picks the run from the block the caret is in
  await block(page, 1).locator('.nb-block-body').click();
  await expect(page.locator('.nb-block-input')).toBeFocused();
  await block(page, 3).locator('.nb-block-body').click({ modifiers: ['Shift'] });
  await expect(page.locator('.nb-block.nb-picked')).toHaveCount(3);
  await expect(page.locator('.nb-block-input')).toHaveCount(0);
  // the grip menu acts on all
  await grip(page, 2).click({ force: true });
  const menu = page.locator('.wbm');
  await expect(menu.locator('.wbm-group')).toHaveText(['3 blocks']);
  await expect(menu.locator('.wbm-row .wbm-label')).toHaveText(['Turn into', 'Color', 'Delete']);
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
  await page.locator('.wbm-row .wbm-label', { hasText: /^Quote$/ }).click();
  await expect.poll(() => s.texts().slice(0, 3)).toEqual(WORDS.slice(0, 3).map(w => `> <span data-bg="green">${w}</span>`));
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
